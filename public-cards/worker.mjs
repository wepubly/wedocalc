import {PUBLIC_ORIGIN,readCatalog,select,card,homeColumns,escape,rotationDay,balanced,decode} from './catalog.mjs';
async function catalog(){
 // Cache the source, never authenticated responses. A withdrawal disappears within 60 seconds.
 const key=new Request(PUBLIC_ORIGIN+'/blog/?public-cards-source=1');
 let cached=await caches.default.match(key);
 if(!cached){const upstream=await fetch(PUBLIC_ORIGIN+'/blog/',{cf:{cacheTtl:0}});if(!upstream.ok)throw Error('Catalogue unavailable');cached=new Response(upstream.body,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public,max-age=60'}});await caches.default.put(key,cached.clone());}
 return readCatalog(cached);
}
function context(path){if(path==='/')return {kind:'home'};return null;}
export default {async fetch(request,env){
 const url=new URL(request.url),path=url.pathname;
 // This preview has no CMS, no storage bindings and cannot forward editorial mutations.
 if(path.startsWith('/admin')||path.startsWith('/api/editorial')||path==='/cms')return Response.redirect(PUBLIC_ORIGIN+'/admin/',302);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(path.startsWith('/blog')||path.startsWith('/media/')||/^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/$/.test(path))return Response.redirect(PUBLIC_ORIGIN+path+url.search,302);
 const aliases={'/home-garden/paint-calculators/':'/paint-calculators/','/home-garden/paint-calculators/paint-calculator/':'/paint-calculator/'};
 if(aliases[path])return Response.redirect(url.origin+aliases[path],302);
 const listing=path==='/guides/' ||path==='/guides';
 const source=await env.ASSETS.fetch(listing?new Request(url.origin+'/index.html',request):request);
 if(!source.headers.get('content-type')?.includes('text/html'))return source;
 let rows;try{rows=await catalog();}catch{rows=[];}
 let scope=context(path);
 const mapper=new HTMLRewriter()
 .on('[data-article-scope]',{element(e){scope={kind:e.getAttribute('data-article-scope'),categoryId:e.getAttribute('data-category'),subcategoryId:e.getAttribute('data-subcategory'),calculatorId:e.getAttribute('data-calculator')};}})
 .on('[data-article-cards]',{element(e){const chosen=select(rows,scope||{kind:'home'});if(scope?.kind==='home')return; e.setInnerContent(chosen.map(a=>card(a,scope.kind)).join('')||'<p>No published guides yet.</p>',{html:true});}})
 .on('[data-home-cards]',{element(e){const ad=decode(e.getAttribute('data-ad-html'));e.setInnerContent(homeColumns(select(rows,{kind:'home'}),ad||''),{html:true});}})
 .on('head',{element(e){e.append('<meta name="robots" content="noindex,nofollow">',{html:true});}});
 let response=mapper.transform(source);
 if(listing){const categoryId=url.searchParams.get('category'),subcategoryId=url.searchParams.get('subcategory');const filtered=rows.filter(a=>(!categoryId||a.categoryId===categoryId)&&(!subcategoryId||a.subcategoryId===subcategoryId));const content=`<div class="content"><section id="guides"><div class="section-heading"><h1>${escape(filtered[0]?.category&&categoryId?filtered[0].category+' Guides':'Ideas, Tips & Guides')}</h1></div><div class="guides-grid">${balanced(filtered,filtered.length,rotationDay()).map(a=>'<div class="guide-column">'+card(a,'home')+'</div>').join('')||'<p>No published guides yet.</p>'}</div></section></div>`;response=new HTMLRewriter().on('main',{element(e){e.setInnerContent(content,{html:true});}}).on('head',{element(e){e.prepend('<base href="/">',{html:true});}}).on('title',{element(e){e.setInnerContent('Published Guides | Metricpedia');}}).transform(response);}
 const headers=new Headers(response.headers);headers.set('Cache-Control','no-store');headers.set('X-Robots-Tag','noindex,nofollow');headers.set('X-Metricpedia-Cards-Rotation',String(rotationDay()));return new Response(request.method==='HEAD'?null:response.body,{status:source.status,headers});
}};
