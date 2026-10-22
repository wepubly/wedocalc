import { Env, HttpError, now } from "./types";
import { hash } from "./security";
import { brasiliaToUtc } from "../src/editorial-time";
const out=(v:unknown,status=200)=>Response.json(v,{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex,nofollow"}});
const txt=(x:unknown,max:number,name:string)=>{if(typeof x!=="string"||!x.trim()||x.length>max)throw new HttpError(400,name+" inválido.");return x.trim()};
const slots=["08:15","11:40","09:05","13:25","10:20","14:10","07:50","12:05","09:30","15:15","08:45","11:10","13:55","10:05"];
async function rows(env:Env,calculator:string){
 const records=(await env.DB.prepare("SELECT a.id,a.draft_version,a.published_version,v.snapshot,r.status AS review_status,p.digest,p.approved_by FROM articles a JOIN article_versions v ON v.article_id=a.id AND v.version=a.draft_version LEFT JOIN editorial_reviews r ON r.article_id=a.id AND r.version=a.draft_version LEFT JOIN external_approvals p ON p.article_id=a.id AND p.version=a.draft_version WHERE json_extract(v.snapshot,'$.calculatorId')=? ORDER BY a.created_at").bind(calculator).all<{id:string;draft_version:number;published_version:number|null;snapshot:string;review_status:string|null;digest:string|null;approved_by:string|null}>()).results;
 return Promise.all(records.map(async item=>{
 const s=JSON.parse(item.snapshot) as {title?:string;circuit?:number;articleType?:string;slug?:string};
 const valid=item.review_status==="approved"&&!!item.digest&&item.digest===await hash(item.snapshot)&&
  (env.ENVIRONMENT!=="production-lab" || !!item.approved_by?.startsWith("Escritor: "));
 return {id:item.id,version:item.draft_version,title:s.title||"",slug:s.slug||"",circuit:Number(s.circuit),articleType:s.articleType||"",approved:valid,published:item.published_version!==null};
 }));
}
async function activeCampaign(env:Env,calculator:string){return env.DB.prepare("SELECT * FROM editorial_campaigns WHERE calculator_id=? AND status='scheduled' ORDER BY created_at DESC LIMIT 1").bind(calculator).first()}
export async function campaigns(request:Request,env:Env,path:string):Promise<Response|null>{
 if(path==="/api/editorial/campaigns"&&request.method==="GET"){
 const url=new URL(request.url),calculator=url.searchParams.get("calculatorId");
 if(!calculator)return out({error:"Informe a calculadora."},400);
 const docs=await rows(env,calculator);
 const audit=await env.DB.prepare("SELECT * FROM calculator_audits WHERE calculator_id=? ORDER BY created_at DESC LIMIT 1").bind(calculator).first();
 const active=await activeCampaign(env,calculator);
 const history=(await env.DB.prepare("SELECT * FROM editorial_campaigns WHERE calculator_id=? ORDER BY created_at DESC LIMIT 10").bind(calculator).all()).results;
 const approved=docs.filter(x=>x.approved&&!x.published);
 const count1=approved.filter(x=>x.circuit===1).length,count2=approved.filter(x=>x.circuit===2).length;
 return out({calculatorId:calculator,articles:docs,counts:{circuit1:count1,circuit2:count2},audit,campaigns:history,ready:count1===7&&count2===7&&approved.length===14&&!active&&(audit as any)?.verdict==="passed"&&!!(audit as any)?.approval_reference});
 }
 if(path==="/api/editorial/calculator-audits"&&request.method==="POST"){
 const d=await request.json() as Record<string,unknown>;
 const calculatorId=txt(d.calculatorId,80,"Calculadora");
 const route=await env.DB.prepare("SELECT path FROM routes WHERE id=? AND kind='calculator' AND state='live'").bind(calculatorId).first<{path:string}>();
 if(!route)throw new HttpError(400,"Cadastre primeiro uma calculadora existente.");
 const formula=txt(d.formulaChecked,2000,"Fórmula verificada"),test=txt(d.testInputs,2000,"Entradas de teste"),expected=txt(d.expectedResult,500,"Resultado esperado"),observed=txt(d.observedResult,500,"Resultado observado"),auditor=txt(d.auditor,120,"Auditor");
 const approvalReference=txt(d.approvalReference,2000,"Referência da auditoria no Grok");
 const verdict=d.verdict==="passed"?"passed":d.verdict==="failed"?"failed":null;
 if(!verdict)throw new HttpError(400,"Resultado da auditoria inválido.");
 const id=crypto.randomUUID(),time=now(),calculatorUrl="https://metricpedia.com"+route.path,notes=String(d.notes||"").slice(0,1000);
 await env.DB.prepare("INSERT INTO calculator_audits(id,calculator_id,calculator_url,formula_checked,test_inputs,expected_result,observed_result,auditor,verdict,notes,created_at,approval_reference) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,calculatorId,calculatorUrl,formula,test,expected,observed,auditor,verdict,notes,time,approvalReference).run();
 return out({id,calculatorUrl,verdict},201);
 }
 if(path==="/api/editorial/campaigns/activate"&&request.method==="POST"){
 const d=await request.json() as Record<string,unknown>;
 const calculatorId=txt(d.calculatorId,80,"Calculadora"),date=txt(d.startDate,10,"Data");
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||new Date(date+"T12:00:00Z").toISOString().slice(0,10)!==date)throw new HttpError(400,"Data inválida.");
 const audit=await env.DB.prepare("SELECT id,verdict,approval_reference FROM calculator_audits WHERE calculator_id=? ORDER BY created_at DESC LIMIT 1").bind(calculatorId).first<{id:string;verdict:string;approval_reference:string}>();
 if(audit?.verdict!=="passed"||!audit.approval_reference)throw new HttpError(409,"A auditoria mais recente da calculadora precisa estar aprovada.");
 if(await activeCampaign(env,calculatorId))throw new HttpError(409,"Esta calculadora já tem campanha ativa.");
 const records=await rows(env,calculatorId),approved=records.filter(x=>x.approved&&!x.published);
 const one=approved.filter(x=>x.circuit===1),two=approved.filter(x=>x.circuit===2);
 if(one.length!==7||two.length!==7||approved.length!==14)throw new HttpError(409,"É necessário aprovar exatamente sete artigos de cada circuito (14 ao todo).");
 if(records.some(x=>!x.approved&&!x.published))throw new HttpError(409,"Existem artigos não aprovados para esta calculadora.");
 const ordered=[...one,...two].sort((a,b)=>a.circuit-b.circuit || Number(b.articleType==="pillar")-Number(a.articleType==="pillar") || a.slug.localeCompare(b.slug));
 const start=new Date(date+"T12:00:00Z"),campaignId=crypto.randomUUID(),time=now(),batch: D1PreparedStatement[]=[];
 batch.push(env.DB.prepare("INSERT INTO editorial_campaigns(id,calculator_id,start_date,status,audit_id,created_at) VALUES(?,?,?,'scheduled',?,?)").bind(campaignId,calculatorId,date,audit.id,time));
 const planned=[];
 for(let i=0;i<14;i++){
  const day=new Date(start.getTime()+i*86400000).toISOString().slice(0,10),runAt=brasiliaToUtc(day+"T"+slots[i]);
  if(new Date(runAt).getTime()<Date.now()+60000)throw new HttpError(400,"A primeira data precisa ser futura.");
  const scheduleId=crypto.randomUUID(),a=ordered[i];
  batch.push(env.DB.prepare("INSERT INTO schedules(id,article_id,version,run_at,status,created_at) VALUES(?,?,?,?,'queued',?)").bind(scheduleId,a.id,a.version,runAt,time));
  batch.push(env.DB.prepare("INSERT INTO editorial_campaign_items(campaign_id,article_id,version,day_number,schedule_id) VALUES(?,?,?,?,?)").bind(campaignId,a.id,a.version,i+1,scheduleId));
  planned.push({day:i+1,articleId:a.id,title:a.title,circuit:a.circuit,runAt,slot:slots[i]});
 }
 await env.DB.batch(batch);
 return out({campaignId,scheduled:14,planned},201);
 }
 if(path==="/api/editorial/campaigns/cancel"&&request.method==="POST"){
 const d=await request.json() as {id?:string};
 const id=txt(d.id,40,"Campanha");
 const c=await env.DB.prepare("SELECT status FROM editorial_campaigns WHERE id=?").bind(id).first<{status:string}>();
 if(!c||c.status!=="scheduled")throw new HttpError(404,"Campanha ativa não encontrada.");
 await env.DB.batch([
 env.DB.prepare("UPDATE schedules SET status='cancelled' WHERE status='queued' AND id IN(SELECT schedule_id FROM editorial_campaign_items WHERE campaign_id=?)").bind(id),
 env.DB.prepare("UPDATE editorial_campaigns SET status='cancelled' WHERE id=? AND status='scheduled'").bind(id)
 ]);
 return out({ok:true});
 }
 return null;
}
