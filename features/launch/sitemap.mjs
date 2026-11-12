// A prepared launch inventory, not an indexing switch. All noindex guards remain.
const ORIGIN='https://homeimprovement.tools';
export const readyPaths=['/','/home-garden/','/paint-calculator/','/about/','/our-mission/','/contact/','/blog/'];
const escape=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export function sitemapFromPublished(xml){
 if(!/<urlset\b/.test(xml)||!/<\/urlset>/.test(xml))throw Error('Published sitemap unavailable');
 const urls=new Map(readyPaths.map(p=>[ORIGIN+p,'']));
 for(const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)){
  const loc=match[1].match(/<loc>([^<]+)<\/loc>/)?.[1];if(!loc)continue;
  let url;try{url=new URL(loc);}catch{continue;}
  if(url.origin!==ORIGIN||url.search||url.hash||!/^\/home-garden\/paint-calculators\/paint-calculator\/[a-z0-9-]+\/$/.test(url.pathname))continue;
  const date=match[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]||'';
  urls.set(url.href,/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/.test(date)?date:'');
 }
 return '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+[...urls].map(([u,d])=>'<url><loc>'+escape(u)+'</loc>'+(d?'<lastmod>'+d+'</lastmod>':'')+'</url>').join('')+'</urlset>';
}
