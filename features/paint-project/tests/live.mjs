// Public UI only. No editorial writes.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE);
mkdirSync('test-output',{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const report={at:new Date().toISOString(),checks:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto('https://homeimprovement.tools/paint-calculator/');assert.equal(response.status(),200);assert.match(response.headers()['x-robots-tag'],/noindex/);
 await page.waitForSelector('#quickChoice');assert.ok(await page.locator('#quickPanel').isVisible());assert.ok(!await page.locator('#advancedPanel').isVisible());
 const fields=page.locator('[data-panel="needed"] [data-fields="area"] input');await fields.nth(0).fill('1000');await fields.nth(1).fill('400');await fields.nth(2).fill('10');assert.equal(await page.locator('#result-value').textContent(),'5.5 gallons');report.checks.push('Quick calculation on live domain');
 await page.locator('#advancedChoice').click();assert.ok(await page.locator('#advancedPanel').isVisible());assert.match(await page.locator('#pp-breakdown').textContent(),/5.5 US gal/);
 await page.locator('#pp-method').selectOption('room');assert.match(await page.locator('#pp-breakdown').textContent(),/435/);report.checks.push('Planner transfer and detailed dimensions');
 for(const id of ['pp-letter','pp-a4']){const wait=page.waitForEvent('download');await page.locator('#'+id).click();const download=await wait;await download.saveAs('test-output/'+id+'.pdf');assert.equal(readFileSync('test-output/'+id+'.pdf').subarray(0,5).toString(),'%PDF-');}report.checks.push('Letter and A4 PDFs');
 await page.screenshot({path:'test-output/live-planner-desktop.png',fullPage:true});await page.locator('#quickChoice').click();assert.equal(await fields.nth(0).inputValue(),'1000');
 await page.waitForSelector('[data-hi-cards="calculator"] a');const links=await page.locator('[data-hi-cards="calculator"] a').evaluateAll(es=>es.map(e=>e.href));assert.ok(links.length>0);for(const url of [...new Set(links)]){assert.ok(url.startsWith('https://homeimprovement.tools/'));const r=await page.request.get(url);assert.equal(r.status(),200);}report.guideLinks=links;report.checks.push('Live CMS guide links');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-output/live-quick-mobile.png',fullPage:true});await page.locator('#advancedChoice').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);report.checks.push('Mobile layout and JavaScript');report.success=true;
}finally{await browser.close();writeFileSync('test-output/live-report.json',JSON.stringify(report,null,2));console.log('LIVE_PAINT '+JSON.stringify(report));}
