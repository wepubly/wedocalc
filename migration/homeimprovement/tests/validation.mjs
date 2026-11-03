import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,extname} from 'node:path';
const cms=resolve(process.argv[2]);
const require=createRequire(cms+'/package.json');
const {Miniflare,convertV4MiniflareOptions}=require('miniflare');
const {build}=require('esbuild');
const built=await build({entryPoints:[cms+'/worker/homeimprovement-validation.ts'],bundle:true,format:'esm',write:false});
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:built.outputFiles[0].text,compatibilityDate:'2026-10-01',bindings:{ENVIRONMENT:'staging',PUBLIC_ORIGIN:'https://homeimprovement.tools'},d1Databases:{DB:'validation-only'},r2Buckets:['MEDIA'],serviceBindings:{ASSETS:async request=>{
 const p=new URL(request.url).pathname;let path=cms+'/dist'+p;
 if(p.endsWith('/'))path+='index.html';
 try{const body=readFileSync(path);return new Response(body,{headers:{'Content-Type':({'.html':'text/html','.js':'application/javascript','.css':'text/css'})[extname(path)]||'application/octet-stream'}});}catch{return new Response('Not found',{status:404});}
}}}));
try{
 const db=await mf.getD1Database('DB');
 // Independent local fixture schema. No remote data, credentials, or operational bindings.
 await db.exec('CREATE TABLE articles (id TEXT PRIMARY KEY,draft_version INTEGER,published_version INTEGER,published_slug TEXT,published_at TEXT,created_at TEXT,updated_at TEXT); CREATE TABLE article_versions(article_id TEXT,version INTEGER,snapshot TEXT,created_at TEXT); CREATE TABLE routes(id TEXT,kind TEXT,name TEXT,path TEXT,parent_id TEXT,state TEXT); CREATE TABLE terms(id TEXT,kind TEXT,name TEXT,slug TEXT); CREATE TABLE media(id TEXT,object_key TEXT,mime TEXT); CREATE TABLE editorial_reviews(article_id TEXT,version INTEGER,status TEXT,reviewer TEXT,notes TEXT,updated_at TEXT); CREATE TABLE schedules(id TEXT,article_id TEXT,version INTEGER,run_at TEXT,status TEXT,last_error TEXT);');
 const route={category:{id:'home-garden',name:'Home & Garden',path:'/home-garden/'},subcategory:{id:'paint-calculators',name:'Paint Calculators',path:'/paint-calculators/'}};
 for(const calc of ['paint-calculator','primer','exterior'])for(let i=0;i<4;i++){
  const id=calc+'-'+i;const snapshot={title:'Guide '+id,slug:'guide-'+i,body:'Use the [calculator](https://metricpedia.com/paint-calculator/).',excerpt:'Measure the surface.',description:'Paint guidance',author:'Alexandro M. Braga',authorType:'Person',language:'en-US',category:'Home & Garden',categoryId:'home-garden',subcategoryId:'paint-calculators',calculatorId:calc,tags:[],coverId:'',coverAlt:'',sources:[],relatedIds:[],destination:{...route,calculator:{id:calc,name:calc,path:'/'+calc+'/'}}};
  await db.prepare('INSERT INTO articles VALUES(?,1,1,?,?,?,?)').bind(id,snapshot.slug,'2026-11-03','2026-11-03','2026-11-03').run();
  await db.prepare('INSERT INTO article_versions VALUES(?,1,?,?)').bind(id,JSON.stringify(snapshot),'2026-11-03').run();
 }
 for(const path of ['/','/admin','/blog/','/paint-calculators/','/paint-calculator/','/print/paint-calculator/','/sitemap-blog.xml','/home-garden/paint-calculators/paint-calculator/guide-0/']){
  const r=await mf.dispatchFetch('https://homeimprovement.tools'+path);assert.equal(r.status,200,path);assert.match(r.headers.get('X-Robots-Tag'),/noindex/);const html=await r.text();assert.ok(!html.includes('https://metricpedia.com'),path);
  if(path==='/'){assert.match(html,/data-hi-cards="home"/);assert.match(html,/Guide primer-/);assert.match(html,/Guide exterior-/);}
  if(path==='/paint-calculators/'){assert.match(html,/Guide paint-calculator-/);assert.match(html,/Guide primer-/);assert.match(html,/Guide exterior-/);}
  if(path==='/paint-calculator/'){assert.match(html,/Guide paint-calculator-/);assert.doesNotMatch(html,/Guide primer-|Guide exterior-/);}
 }
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await mf.dispatchFetch('https://homeimprovement.tools/api/editorial/articles',{method,body:'{}'})).status,423);
 assert.match(await (await mf.dispatchFetch('https://homeimprovement.tools/robots.txt')).text(),/Disallow: \//);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM articles').first()).n,12);
 assert.equal((await db.prepare('SELECT COUNT(*) n FROM schedules').first()).n,0);
 assert.equal((await mf.dispatchFetch('https://homeimprovement.tools/not-found')).status,404);
 console.log('PASS destination runtime: local CMS/read, 8 routes, noindex, blocked writes, isolated fixtures and three card scopes.');
 if(process.env.BROWSER_TEST==='1'){
  const {chromium}=await import(process.env.HI_PLAYWRIGHT_PATH||'playwright');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
   const page=await browser.newPage();
   await page.route('https://homeimprovement.tools/**',async route=>{
    const req=route.request();const r=await mf.dispatchFetch(req.url(),{method:req.method()});await route.fulfill({status:r.status,headers:Object.fromEntries(r.headers),body:Buffer.from(await r.arrayBuffer())});
   });
   await page.goto('https://homeimprovement.tools/paint-calculator/');
   await page.waitForFunction(()=>document.querySelector('#result-value')?.textContent.includes('gallons'));
   const inputs=page.locator('[data-panel="needed"] [data-fields="area"] input');
   await inputs.nth(0).fill('1000');await inputs.nth(1).fill('400');await inputs.nth(2).fill('10');
   assert.equal(await page.locator('#result-value').textContent(),'5.5 gallons');
   await inputs.nth(0).fill('-1');assert.equal(await page.locator('#result-label').textContent(),'Check your input');
   await inputs.nth(0).fill('1000');
   await page.locator('[data-mp-share="print"]').click();await page.waitForURL('**/print/paint-calculator/');
   assert.equal(await page.locator('.result-value').textContent(),'5.5 gallons');
   await page.emulateMedia({media:'print'});for(const format of ['Letter','A4']){const pdf=await page.pdf({format});assert.ok(pdf.length>1000);assert.equal(pdf.subarray(0,4).toString(),'%PDF');}
   console.log('PASS browser: paint arithmetic 5.5 gallons, invalid input, print-media PDF rendering.');
  }finally{await browser.close();}
 }
}finally{await mf.dispose();}
