import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const dir=resolve(process.argv[2]);
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const path=resolve(dir,'.'+pathname+(pathname.endsWith('/')?'index.html':''));try{res.setHeader('Content-Type',({'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.css':'text/css'})[extname(path)]||'application/octet-stream');res.end(readFileSync(path));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try {
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/paint-calculator/');
 const button=page.getByRole('button',{name:'View Report',exact:true});
 await button.waitFor();assert.equal(await page.locator('#mp-share button').count(),1);
 assert.equal(await page.locator('[data-mp-share="copy"],[data-mp-share="email"]').count(),0);
 await button.click();await page.waitForURL('**/print/paint-calculator/');
 assert.match(await page.locator('.result-value').textContent(),/gallons/);
 await page.goBack();await button.waitFor();await button.click();await page.waitForURL('**/print/paint-calculator/');
 await page.goBack();await page.setViewportSize({width:390,height:844});
 assert.equal(await button.isVisible(),true);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 for(const slug of ['paint-cost-calculator','exterior-paint-calculator','ceiling-paint-calculator','room-paint-calculator']) {
  await page.goto(origin+'/'+slug+'/');assert.equal(await page.locator('#specialized-print').textContent(),'View Report');
  const value=await page.locator('#specialized-result').textContent();await page.locator('#specialized-print').click();await page.waitForURL('**/print/paint-calculator/');assert.equal(await page.locator('.result-value').textContent(),value);
 }
 assert.deepEqual(errors,[]);console.log('PASS: one report button, report data, repeated/back navigation, mobile and four specialized reports');
} finally {await browser.close();await new Promise(r=>server.close(r));}
