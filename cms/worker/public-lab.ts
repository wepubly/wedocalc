import type {Env} from "./types";
import {workbench,testArticle} from "./workbench";
const reply=(msg:string,status=404)=>new Response(JSON.stringify({error:msg}),{status,headers:{"Content-Type":"application/json","X-Robots-Tag":"noindex,nofollow","Cache-Control":"no-store"}});
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,"")||"/";
 if(env.ENVIRONMENT!=="production-lab"||!env.DB||!env.MEDIA||!env.ASSETS)return reply("Laboratório não configurado.",503);
 try{
 let r:Response;
 if(path==="/")r=Response.redirect(url.origin+"/admin",302);
 else if(path==="/robots.txt")r=new Response("User-agent: *\\nDisallow: /\\n",{headers:{"Content-Type":"text/plain"}});
 else if(path==="/admin"&&["GET","HEAD"].includes(request.method))r=await env.ASSETS.fetch(new Request(new URL("/admin-assets/visual.html",url)));
 else if(path==="/admin/test-article"&&["GET","HEAD"].includes(request.method))r=await env.ASSETS.fetch(new Request(new URL("/admin-assets/test-article.html",url)));
 else if(path.startsWith("/api/workbench/"))r=await workbench(request,env,path);
 else if(path.startsWith("/test-blog/"))r=await testArticle(request,env,path);
 else return reply("Página não encontrada.");
 const h=new Headers(r.headers);h.set("X-Robots-Tag","noindex,nofollow,noarchive");h.set("Cache-Control","no-store");h.set("X-Content-Type-Options","nosniff");return new Response(request.method==="HEAD"?null:r.body,{status:r.status,headers:h});
 }catch(e){const status=typeof e==="object"&&e!==null&&"status" in e?Number(e.status):500;const msg=e instanceof Error?e.message:"Erro interno";return reply(status===500?"Não foi possível concluir.":msg,status)}
 }};
