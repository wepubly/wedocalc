import { Env, HttpError, now } from "./types";
import { imageDimensions } from "./images";
import { escape } from "./render";
const j=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex,nofollow"}});
function guardOrigin(req:Request){
 const origin=req.headers.get("Origin");
 if(origin && origin!==new URL(req.url).origin)throw new HttpError(403,"Origem inválida.");
 const site=req.headers.get("Sec-Fetch-Site");
 if(site && !["same-origin","none"].includes(site))throw new HttpError(403,"Requisição de outro site bloqueada.");
}
async function key(req:Request,env:Env){
 if(env.ENVIRONMENT!=="staging")throw new HttpError(404,"Indisponível.");
 const secret=env.SETUP_TOKEN;
 if(!secret||secret.length<24)throw new HttpError(503,"Chave temporária ainda não está configurada.");
 const supplied=req.headers.get("X-Metricpedia-Workbench-Key")||"";
 const enc=new TextEncoder();
 const [a,b]=await Promise.all([crypto.subtle.digest("SHA-256",enc.encode(secret)),crypto.subtle.digest("SHA-256",enc.encode(supplied))]);
 let diff=0;const x=new Uint8Array(a),y=new Uint8Array(b);for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
 if(diff!==0||supplied.length<24)throw new HttpError(403,"Chave temporária incorreta.");
}
const limit=100000;
function validate(obj:Record<string,unknown>){
 const out:Record<string,string>={};
 for(const [field,max] of Object.entries({title:180,excerpt:500,body:60000,seoTitle:180,meta:320,slug:110,keyword:180,tags:600,secondary:1000,coverAlt:250,category:80,subcategory:80,calculator:80,articleType:20,circuit:3,author:100})){
 const v=obj[field];if(typeof v!=="string"||v.length>max)throw new HttpError(400,"Campo inválido: "+field);out[field]=v.trim();
 }
 if(!out.title||!out.body)throw new HttpError(400,"Título e conteúdo são obrigatórios.");
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(out.slug))throw new HttpError(400,"Slug inválido.");
 if(!["pillar","cluster"].includes(out.articleType)||!["1","2"].includes(out.circuit))throw new HttpError(400,"Classificação inválida.");
 return out;
}
async function getArticle(env:Env,id:string){
 return env.DB.prepare("SELECT * FROM staging_test_articles WHERE id=?").bind(id).first<{id:string;slug:string;payload:string;image_id:string|null;status:string;created_at:string;updated_at:string}>();
}
function articleMarkup(d:Record<string,string>){
 return d.body.split(/\n{2,}/).filter(Boolean).map(b=>{
 const s=b.trim(),m=/^(#{1,3})\s+(.+)$/s.exec(s);
 if(m){const n=Math.max(2,m[1].length);return "<h"+n+">"+escape(m[2])+"</h"+n+">";}
 if(s.split("\n").every(line=>line.startsWith("- ")))return "<ul>"+s.split("\n").map(line=>"<li>"+escape(line.slice(2))+"</li>").join("")+"</ul>";
 return "<p>"+escape(s).replace(/\n/g,"<br>")+"</p>";
 }).join("");
}
export async function workbench(req:Request,env:Env,path:string):Promise<Response>{
 if(env.ENVIRONMENT!=="staging")throw new HttpError(404,"Não encontrado.");
 if(["POST","PUT"].includes(req.method))guardOrigin(req);
 const imageRoute=/^\/api\/workbench\/image\/([a-f0-9-]{36})$/.exec(path);
 if(imageRoute&&req.method==="GET"){
  const img=await env.DB.prepare("SELECT object_key,mime FROM staging_test_images WHERE id=?").bind(imageRoute[1]).first<{object_key:string;mime:string}>();
  if(!img)throw new HttpError(404,"Imagem não encontrada.");
  // Do not expose unpublished covers publicly. Key required for image preview.
  await key(req,env);
  const data=await env.MEDIA.get(img.object_key);if(!data)throw new HttpError(404,"Imagem não encontrada.");
  return new Response(data.body,{headers:{"Content-Type":img.mime,"Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow","X-Content-Type-Options":"nosniff"}});
 }
 if(path==="/api/workbench/image"&&req.method==="POST"){
  await key(req,env);
  const mime=(req.headers.get("content-type")||"").split(";")[0];
  if(!["image/jpeg","image/png","image/webp"].includes(mime))throw new HttpError(400,"Formato inválido.");
  const bytes=new Uint8Array(await req.arrayBuffer());
  if(bytes.length>5*1024*1024||!bytes.length)throw new HttpError(413,"Imagem deve ter até 5 MB.");
  try{imageDimensions(bytes,mime)}catch{throw new HttpError(400,"Arquivo de imagem inválido.");}
  const id=crypto.randomUUID(),object_key="staging-workbench/"+id;
  await env.MEDIA.put(object_key,bytes,{httpMetadata:{contentType:mime}});
  try{await env.DB.prepare("INSERT INTO staging_test_images(id,object_key,mime,size,created_at) VALUES (?,?,?,?,?)").bind(id,object_key,mime,bytes.length,now()).run()}
  catch(err){await env.MEDIA.delete(object_key);throw err}
  return j({id},201);
 }
 const m=/^\/api\/workbench\/article(?:\/([a-f0-9-]{36}))?(?:\/(publish))?$/.exec(path);
 if(!m)throw new HttpError(404,"Não encontrado.");
 await key(req,env);
 if(req.method==="GET"&&m[1]){
  const row=await getArticle(env,m[1]);if(!row)throw new HttpError(404,"Rascunho não encontrado.");
  return j({id:row.id,data:JSON.parse(row.payload),imageId:row.image_id,status:row.status,previewUrl:row.status==="test_published"?"/blog/test-"+row.slug+"/":null});
 }
 if(req.method==="POST"&&!m[2]){
  const raw=await req.text();if(raw.length>limit)throw new HttpError(413,"Conteúdo muito grande.");
  let d:any;try{d=JSON.parse(raw)}catch{throw new HttpError(400,"JSON inválido.");}
  if(!d||typeof d!=="object")throw new HttpError(400,"Dados inválidos.");
  const data=validate(d.data||{}),imageId=typeof d.imageId==="string"?d.imageId:null;
  if(imageId&&!(await env.DB.prepare("SELECT id FROM staging_test_images WHERE id=?").bind(imageId).first()))throw new HttpError(400,"Capa não encontrada.");
  const id=m[1]||crypto.randomUUID(),old=m[1]?await getArticle(env,id):null;
  if(m[1]&&!old)throw new HttpError(404,"Rascunho não encontrado.");
  const time=now();
  try{
   if(old)await env.DB.prepare("UPDATE staging_test_articles SET slug=?,payload=?,image_id=?,status='draft',updated_at=? WHERE id=?").bind(data.slug,JSON.stringify(data),imageId,time,id).run();
   else await env.DB.prepare("INSERT INTO staging_test_articles(id,slug,payload,image_id,status,created_at,updated_at) VALUES(?,?,?,?,'draft',?,?)").bind(id,data.slug,JSON.stringify(data),imageId,time,time).run();
  }catch(err){if(err instanceof Error&&/UNIQUE constraint/i.test(err.message))throw new HttpError(409,"Slug já usado em outro teste.");throw err}
  return j({id,status:"draft"},old?200:201);
 }
 if(req.method==="POST"&&m[1]&&m[2]==="publish"){
  const row=await getArticle(env,m[1]);if(!row)throw new HttpError(404,"Rascunho não encontrado.");
  if(!JSON.parse(row.payload).body)throw new HttpError(400,"Rascunho sem conteúdo.");
  await env.DB.prepare("UPDATE staging_test_articles SET status='test_published',updated_at=? WHERE id=?").bind(now(),row.id).run();
  return j({url:"/blog/test-"+row.slug+"/",status:"test_published"});
 }
 throw new HttpError(405,"Método não permitido.");
}
export async function testArticle(req:Request,env:Env,path:string):Promise<Response>{
 if(env.ENVIRONMENT!=="staging"||!["GET","HEAD"].includes(req.method))throw new HttpError(404,"Não encontrado.");
 const img=/^\/blog\/test-cover\/([a-f0-9-]{36})$/.exec(path);
 if(img){
 const row=await env.DB.prepare("SELECT i.object_key,i.mime FROM staging_test_images i JOIN staging_test_articles a ON a.image_id=i.id WHERE i.id=? AND a.status='test_published' LIMIT 1").bind(img[1]).first<{object_key:string;mime:string}>();
 if(!row)throw new HttpError(404,"Capa não encontrada.");const obj=await env.MEDIA.get(row.object_key);if(!obj)throw new HttpError(404,"Capa não encontrada.");
 return new Response(obj.body,{headers:{"Content-Type":row.mime,"X-Robots-Tag":"noindex,nofollow","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }
 const m=/^\/blog\/test-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path);
 if(!m)throw new HttpError(404,"Artigo de teste não encontrado.");
 const row=await env.DB.prepare("SELECT * FROM staging_test_articles WHERE slug=? AND status='test_published'").bind(m[1]).first<{payload:string;image_id:string|null;updated_at:string}>();
 if(!row)throw new HttpError(404,"Artigo de teste não encontrado.");
 const d=JSON.parse(row.payload) as Record<string,string>;
 const cover=row.image_id?'<img style="width:100%;border-radius:14px" src="/blog/test-cover/'+row.image_id+'" alt="'+escape(d.coverAlt||d.title)+'">':"";
 const body='<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>'+escape(d.seoTitle||d.title)+' — Metricpedia TEST</title><meta name="description" content="'+escape(d.meta)+'"><style>body{margin:0;background:#f1f7ff;color:#102a4d;font:17px/1.75 Arial,sans-serif}header{background:white;padding:17px 5%;font-size:26px;font-weight:800;color:#082957}.wrap{max-width:850px;background:white;margin:30px auto;padding:32px;border-radius:14px}.notice{background:#fff0e5;border:1px solid #f7d2b4;padding:12px;border-radius:8px;color:#81400e;font-size:13px}h1{font-size:38px;line-height:1.2}@media(max-width:850px){.wrap{margin:12px;padding:20px}}</style></head><body><header>Metricpedia</header><main class="wrap"><div class="notice">TEST ONLY — Homologação, não indexado, não publicado no site oficial</div><p>'+escape(d.category)+' / '+escape(d.subcategory)+'</p><h1>'+escape(d.title)+'</h1><p>'+escape(d.excerpt)+'</p>'+cover+articleMarkup(d)+'<p><a href="https://metricpedia.com/paint-calculator/">Related calculator →</a></p><hr><small>'+escape(d.author)+'</small></main></body></html>';
 return new Response(body,{headers:{"Content-Type":"text/html; charset=utf-8","X-Robots-Tag":"noindex,nofollow,noarchive","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
