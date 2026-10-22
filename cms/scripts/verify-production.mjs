import assert from 'node:assert/strict';
const origin='https://metricpedia.com';
for(const p of ['/admin','/api/editorial/session','/api/editorial/articles','/api/editorial/media','/api/editorial/routes','/api/editorial/schedules','/blog/','/sitemap-blog.xml']){
 const r=await fetch(origin+p);const body=await r.text();assert.equal(r.status,200,p+': '+body.slice(0,100));
 if(p==='/admin'){assert.match(body,/id="root"/);assert.match(body,/Metricpedia/);assert.match(r.headers.get('x-robots-tag')||'',/noindex/);}
 if(p==='/api/editorial/session')assert.equal(JSON.parse(body).mode,'production');
}
for(const p of ['/','/paint-calculator/','/home-garden/','/paint-calculators/']){const r=await fetch(origin+p);assert.equal(r.status,200,'Existing site route '+p);}
const legacy=await fetch('https://metricpedia-editorial-lab.alex-b81.workers.dev/admin',{redirect:'manual'});assert.equal(legacy.status,308);assert.equal(legacy.headers.get('location'),origin+'/admin');
console.log('PASS official production CMS, public blog, original site routes and old URL redirect.');
