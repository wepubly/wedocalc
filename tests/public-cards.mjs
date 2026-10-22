import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {normalize,select,balanced,homeColumns,rotationDay,escape} from '../public-cards/catalog.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../public-cards/package.json',import.meta.url));
const fixtures=[];
for(const category of ['home-garden','cooking','finance'])for(const calculator of ['alpha','beta','gamma'])for(let i=0;i<7;i++)fixtures.push(normalize({href:`/${category}/tools/${calculator}/guide-${i}/`,title:`${category} ${calculator} & guide ${i}`,description:'A real-shaped local fixture, never uploaded to the CMS.',category,alt:'Cover & details',image:'/media/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}));
assert.equal(normalize({href:'https://other.invalid/test',title:'bad'}),null);
const scope={kind:'calculator',categoryId:'home-garden',subcategoryId:'tools',calculatorId:'alpha'};
assert.deepEqual(select(fixtures,scope),fixtures.slice(0,4));
assert.equal(select(fixtures,{...scope,calculatorId:'missing'}).length,0);
assert.equal(select(fixtures.slice(0,2),scope).length,2);
const category=select(fixtures,{kind:'category',categoryId:'home-garden'},123);
assert.equal(category.length,5);assert.equal(new Set(category.slice(0,3).map(a=>a.calculatorId)).size,3);assert.ok(category.every(a=>a.categoryId==='home-garden'));
const home=select(fixtures,{kind:'home'},123);assert.equal(home.length,9);assert.equal(new Set(home.map(a=>a.href)).size,9);
for(const cat of ['home-garden','cooking','finance']){const group=home.filter(a=>a.categoryId===cat);assert.equal(group.length,3);assert.equal(new Set(group.map(a=>a.calculatorId)).size,3);}
assert.deepEqual(select(fixtures,{kind:'home'},123),home);assert.notDeepEqual(select(fixtures,{kind:'home'},124),home);
assert.equal(rotationDay(Date.UTC(2026,9,23,2,59)),rotationDay(Date.UTC(2026,9,22,12)));assert.notEqual(rotationDay(Date.UTC(2026,9,23,3)),rotationDay(Date.UTC(2026,9,22,12)));
const html=readFileSync(root+'index.html','utf8');const ad=html.match(/data-ad-html="([^"]*)"/)[1].replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#x27;',"'").replaceAll('&amp;','&');
for(const n of [0,2,7]){const sparse=homeColumns(home.slice(0,n),ad);assert.equal((sparse.match(/data-empty-guide-slot/g)||[]).length,9-n);assert.equal((sparse.match(/data-ad-slot="HOME-GUIDES-01"/g)||[]).length,1);}
const columns=homeColumns(home,ad);assert.equal((columns.match(/<article/g)||[]).length,10);assert.equal((columns.match(/data-ad-slot="HOME-GUIDES-01"/g)||[]).length,1);assert.equal(columns.indexOf(ad)>columns.lastIndexOf('guide-column'),true);
console.log('PASS filtering, limits, diversity, stable daily rotation, escaping and unchanged advertising slot.');
if(process.env.CARDS_UNIT_ONLY==='1')process.exit(0);
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');const {build}=require('esbuild');
const {outputFiles}=await build({entryPoints:[root+'public-cards/worker.mjs'],bundle:true,format:'esm',platform:'browser',write:false});
const catalogue=items=>'<div class="blog-grid">'+items.map(a=>`<a class="blog-card" href="${escape(new URL(a.href).pathname)}"><div class="blog-card-cover"><img src="${escape(a.image)}" alt="${escape(a.alt)}"></div><div class="blog-card-body"><p class="blog-card-category">${escape(a.category)} · Calculator</p><h2>${escape(a.title)}</h2><p>${escape(a.description)}</p></div></a>`).join('')+'</div>';
const paint=Array.from({length:7},(_,i)=>normalize({...fixtures[0],href:`/home-garden/paint-calculators/paint-calculator/paint-${i}/`,title:`Published paint guide ${i}`}));
const cost=normalize({...fixtures[0],href:'/home-garden/paint-calculators/paint-cost/cost-guide/',title:'Published cost guide'});
let upstreamReads=0;let active=[...paint,cost,...fixtures];let failure=false;
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:outputFiles[0].text,compatibilityDate:'2026-10-01',serviceBindings:{ASSETS:async request=>{const p=new URL(request.url).pathname;const file=p==='/'?'/index.html':p.endsWith('/')?p+'index.html':p;try{return new Response(readFileSync(root+file.slice(1)),{headers:{'Content-Type':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':file.endsWith('.jpg')?'image/jpeg':file.endsWith('.png')?'image/png':'text/plain'}});}catch{return new Response('Not found',{status:404});}}},outboundService:async request=>{assert.equal(request.method,'GET');assert.equal(new URL(request.url).origin,'https://metricpedia.com');assert.equal(new URL(request.url).pathname,'/blog/');upstreamReads++;return new Response(failure?'unavailable':catalogue(active),{status:failure?503:200,headers:{'Content-Type':'text/html'}});}}));
try{
 const homepage=await mf.dispatchFetch('http://preview.test/');const rendered=await homepage.text();assert.equal(homepage.status,200);assert.equal((rendered.match(/<article class="guide card">/g)||[]).length,9);assert.match(rendered,/href="https:\/\/metricpedia.com\/home-garden\/tools\//);assert.ok(rendered.includes(' &amp; guide '));assert.ok(!rendered.includes('&amp;amp; guide'));assert.equal((rendered.match(/data-ad-slot="HOME-GUIDES-01"/g)||[]).length,1);
 assert.equal(await (await mf.dispatchFetch('http://preview.test/')).text(),rendered);assert.equal(upstreamReads,1,'one source query within cache window');
 const categoryPage=await (await mf.dispatchFetch('http://preview.test/paint-calculators/')).text();assert.ok(!categoryPage.includes('How Much Does Paint Cost?'));assert.equal((categoryPage.match(/class="paint-guide"/g)||[]).length,5);assert.match(categoryPage,/Published cost guide/);
 // Test actual Paint Calculator scope with local public-shaped rows.
 const listing=await (await mf.dispatchFetch('http://preview.test/guides/?category=cooking')).text();assert.equal((listing.match(/<article class="guide card">/g)||[]).length,21);assert.ok(!listing.includes('home-garden alpha &amp; guide'));assert.match(listing,/<base href="\/">/);
 const calc=await (await mf.dispatchFetch('http://preview.test/paint-calculator/')).text();assert.equal((calc.match(/<b>Published paint guide/g)||[]).length,4);assert.ok(!calc.includes('Published cost guide')); assert.ok(!calc.includes('How Much Does Paint Cost?'));
 assert.equal((await mf.dispatchFetch('http://preview.test/api/editorial/articles',{method:'POST',body:'{}',redirect:'manual'})).status,302);assert.equal(upstreamReads,1,'editorial requests are not forwarded');
 const testScope=await mf.dispatchFetch('http://preview.test/',{method:'POST'});assert.equal(testScope.status,405);
 const cache=await mf.getCaches();await cache.default.delete('https://metricpedia.com/blog/?public-cards-source=1');active=[];
 const emptyHome=await (await mf.dispatchFetch('http://preview.test/')).text();assert.equal((emptyHome.match(/<article class="guide card">/g)||[]).length,0);assert.match(emptyHome,/data-ad-slot="HOME-GUIDES-01"/);
 const emptyCalc=await (await mf.dispatchFetch('http://preview.test/paint-calculator/')).text();assert.match(emptyCalc,/No published guides yet/);
 await cache.default.delete('https://metricpedia.com/blog/?public-cards-source=1');failure=true;
 const unavailable=await (await mf.dispatchFetch('http://preview.test/paint-calculators/')).text();assert.match(unavailable,/No published guides yet/);assert.ok(!unavailable.includes('Published cost guide'));
 failure=false;active=[...paint,cost,...fixtures];await cache.default.delete('https://metricpedia.com/blog/?public-cards-source=1');
 console.log('PASS native HTMLRewriter parsing, server HTML cards, complete category listing, empty states, source caching and read-only boundary.');
 // Expose the same isolated renderer for optional desktop/mobile DOM checks.
 if(process.env.CARDS_BROWSER==='1'){
  const {chromium}=require('playwright');const browser=await chromium.launch({headless:true});
  try{for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:1000}});await page.route('http://preview.test/**',async route=>{const r=await mf.dispatchFetch(route.request().url());await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});});await page.route('https://metricpedia.com/media/**',route=>route.fulfill({contentType:'image/jpeg',body:readFileSync(root+'assets/images/guide-3.jpg')}));await page.goto('http://preview.test/');const metrics=await page.locator('#guides').evaluate(e=>({cards:e.querySelectorAll('article.guide:not(.mp-ad-placeholder)').length,ads:e.querySelectorAll('[data-ad-slot="HOME-GUIDES-01"]').length,width:e.getBoundingClientRect().width,overflow:document.documentElement.scrollWidth>innerWidth}));assert.equal(metrics.cards,9);assert.equal(metrics.ads,1);assert.ok(!metrics.overflow,JSON.stringify(metrics));for(const [path,selector,count] of [['/paint-calculator/','[data-article-cards] .related-item',4],['/paint-calculators/','[data-article-cards] .paint-guide',5]]){await page.goto('http://preview.test'+path);assert.equal(await page.locator(selector).count(),count);assert.ok(await page.locator(selector+' img').first().evaluate(e=>e.getBoundingClientRect().height>0));}await page.close();}console.log('PASS desktop 1440px and mobile 390px DOM layout, nine cards and advertising preserved.');}finally{await browser.close();}
 }
}finally{await mf.dispose();}
