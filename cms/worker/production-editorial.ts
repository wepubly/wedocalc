import type { Article, Env, Snapshot } from './types';
import { HttpError, now } from './types';
import {articlePath} from '../src/destination';
import { markdownLinks, safeUrl } from './markdown';
export interface Review { status: 'review'|'changes'|'approved'; reviewer: string; notes: string; updated_at: string; }
export async function review(env: Env, a: Pick<Article,"id"|"draft_version">): Promise<Review | null> {
 return env.DB.prepare('SELECT status,reviewer,notes,updated_at FROM editorial_reviews WHERE article_id=? AND version=?').bind(a.id,a.draft_version).first<Review>();
}
export async function reviewed(env: Env,a: Article,v: number) {
 if(v!==a.draft_version|| (await review(env,a))?.status!=='approved') throw new HttpError(409,'A versão atual precisa da aprovação do Auditor.');
}
export function safeSource(url: string) {return !!safeUrl(url) && /^https?:\/\//.test(url);}
export async function publicationIssues(env: Env,s: Snapshot,id: string): Promise<string[]> {
 const issues:string[]=[];
 if(!s.title)issues.push('Título ausente.');
 if(!s.body.trim())issues.push('Conteúdo vazio.');
 if(!s.excerpt)issues.push('Resumo ausente.');
 if(!s.author)issues.push('Autor ausente.');
 if(s.coverId&&!s.coverAlt)issues.push('Imagem sem alt text.');
 if(s.requiresSources&&!s.sources?.length)issues.push('Este conteúdo exige fontes.');
 const collision=await env.DB.prepare('SELECT id FROM articles WHERE published_slug=? AND id<>?').bind(s.slug,id).first();
 if(collision)issues.push('URL já utilizada por outro artigo.');
 const origin=new URL(env.PUBLIC_ORIGIN).origin;
 for(const link of markdownLinks(s.body)){
  const safe=safeUrl(link);if(!safe){issues.push('Link inseguro: '+link);continue;}
  const url=new URL(safe,origin);
  if(url.origin!==origin)continue;
  if(['/','/music','/blog','/blog/'].includes(url.pathname))continue;
  const routes=(await env.DB.prepare("SELECT path FROM routes WHERE state='live'").all<{path:string}>()).results;
  if(routes.some(r=>r.path.replace(/\/$/,'')===url.pathname.replace(/\/$/,'')))continue;
  if(url.pathname.replace(/\/$/,'')===articlePath(s).replace(/\/$/,''))continue;
  const posts=(await env.DB.prepare("SELECT v.snapshot FROM articles a JOIN article_versions v ON v.article_id=a.id AND v.version=a.published_version").all<{snapshot:string}>()).results;
  if(!posts.some(p=>articlePath(JSON.parse(p.snapshot)).replace(/\/$/,'')===url.pathname.replace(/\/$/,'')))issues.push('Link interno não publicado: '+url.pathname);
 }
 for(const target of [s.pillarId,...(s.relatedIds||[])].filter(Boolean)){
  if(target===id) {issues.push('Um artigo não pode relacionar-se a si mesmo.');continue;}
  if(!await env.DB.prepare('SELECT id FROM articles WHERE id=? AND published_version IS NOT NULL').bind(target).first())issues.push('Artigo relacionado ainda não publicado.');
 }
 return [...new Set(issues)];
}
export async function requireQuality(env: Env,s: Snapshot,id: string) {
 const issues=await publicationIssues(env,s,id);if(issues.length)throw new HttpError(issues.includes('URL já utilizada por outro artigo.')?409:400,issues.join(' '));
}
export function editorialEvent(env: Env,a: Pick<Article,"id"|"draft_version">,action: string,actor='Responsável autenticado',notes='') {
 return env.DB.prepare('INSERT INTO editorial_events(article_id,version,action,actor,notes,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM articles WHERE id=? AND draft_version=?)').bind(a.id,a.draft_version,action,actor,notes,now(),a.id,a.draft_version);
}
export async function transition(env: Env,a: Pick<Article,"id"|"draft_version">,action: string,actor: string,notes: string) {
 const current=await review(env,a);
 if(action==='submit-review'&&current?.status==='approved')throw new HttpError(409,'Edite para iniciar uma nova revisão ou solicite correções.');
 if(['approve','request-changes'].includes(action)&&!['review','approved'].includes(current?.status||''))throw new HttpError(409,'Envie esta versão para revisão primeiro.');
 const status=action==='approve'?'approved':action==='request-changes'?'changes':'review';
 const result=await env.DB.batch([
  env.DB.prepare(`INSERT INTO editorial_reviews(article_id,version,status,reviewer,notes,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM articles WHERE id=? AND draft_version=?) ON CONFLICT(article_id,version) DO UPDATE SET status=excluded.status,reviewer=excluded.reviewer,notes=excluded.notes,updated_at=excluded.updated_at`).bind(a.id,a.draft_version,status,actor,notes,now(),a.id,a.draft_version),
  editorialEvent(env,a,action,actor,notes),
  env.DB.prepare("UPDATE schedules SET status='cancelled' WHERE article_id=? AND status='queued' AND ?<>'approved'").bind(a.id,status),
 ]);
 if(!result[0].meta.changes)throw new HttpError(409,'A versão mudou; reabra o artigo.');
}

