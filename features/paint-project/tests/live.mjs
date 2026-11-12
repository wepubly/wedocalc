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
 for(const name of ['Measurements','Materials','Budget','Results']){
  const active=page.locator('.planner-steps [aria-current=step]');
  assert.ok((await active.textContent()).includes(name),name);
  assert.equal(await page.locator('[data-planner-step]:visible').count(),1);
  if(name!=='Results')await page.locator('#pp-next').click();
 }
 assert.equal(await page.locator('.paint-tool-card').count(),6);
 report.checks.push('Four planner steps and six specialized cards');
 for(const id of ['pp-letter','pp-a4']){const wait=page.waitForEvent('download');await page.locator('#'+id).click();const download=await wait;await download.saveAs('test-output/'+id+'.pdf');assert.equal(readFileSync('test-output/'+id+'.pdf').subarray(0,5).toString(),'%PDF-');}report.checks.push('Letter and A4 PDFs');
 await page.screenshot({path:'test-output/live-planner-desktop.png',fullPage:true});await page.locator('#quickChoice').click();assert.equal(await fields.nth(0).inputValue(),'1000');
 await page.waitForSelector('[data-hi-cards="calculator"] a');const links=await page.locator('[data-hi-cards="calculator"] a').evaluateAll(es=>es.map(e=>e.href));assert.ok(links.length>0);for(const url of [...new Set(links)]){assert.ok(url.startsWith('https://homeimprovement.tools/'));const r=await page.request.get(url);assert.equal(r.status(),200);}report.guideLinks=links;report.checks.push('Live CMS guide links');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-output/live-quick-mobile.png',fullPage:true});await page.locator('#advancedChoice').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);report.checks.push('Mobile layout and JavaScript');const colors=await browser.newPage();
 const light='rgb(241, 247, 255)';
 const homeResponse=await colors.goto('https://homeimprovement.tools/');
 assert.equal(homeResponse.status(),200);
 assert.equal(await colors.locator('body.teste2 > main').evaluate(el=>getComputedStyle(el).backgroundColor),light);
 const paintCard=colors.locator('a.project-card').filter({hasText:'Painting & Walls'});
 assert.equal(await paintCard.getAttribute('href'),'/paint-calculator/');
 await paintCard.click();
 assert.equal(new URL(colors.url()).pathname,'/paint-calculator/');
 report.checks.push('Painting & Walls card opens the calculator directly');
 const paths=['/paint-calculator/','/home-garden/','/blog/','/about/','/our-mission/','/contact/','/privacy-policy/','/terms-of-service/','/print/paint-calculator/','/__launch_check_missing_page__',...links];
 for(const path of paths){
  const url=new URL(path,'https://homeimprovement.tools');
  const response=await colors.goto(url.href);
  assert.equal(response.status(),path==='/__launch_check_missing_page__'?404:200,path);
  assert.equal(await colors.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),light,path);
 }
 await colors.goto('https://homeimprovement.tools/paint-calculator/');
 await colors.locator('.theme-toggle').click();
 assert.equal(await colors.locator('html').getAttribute('data-theme'),'dark');
 assert.notEqual(await colors.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),light);
 report.checks.push('Shared light background on '+paths.length+' internal pages and dark mode toggle');
 const estimates = {
  'paint-cost-calculator': ['price','50','$215.00'],
  'exterior-paint-calculator': ['coverage','400','6.6 gal'],
  'ceiling-paint-calculator': ['coverage','400','0.66 gal'],
  'trim-paint-calculator': ['coverage','400','0.1833 gal'],
  'room-paint-calculator': ['coverage','400','1.716 gal'],
 };
 await colors.locator('.theme-toggle').click();
 const linksOnMain=colors.locator('.paint-tool-card a');
 assert.equal(await linksOnMain.count(),5);
 assert.equal(await colors.locator('[data-mode=cost]').isVisible(),false);
 for(const [slug,[field,value,expected]] of Object.entries(estimates)){
  const href='/'+slug+'/';
  assert.equal(await colors.locator('.paint-tool-card a[href="'+href+'"]').count(),1,href);
  const res=await page.goto('https://homeimprovement.tools'+href);
  assert.equal(res.status(),200,href);
  assert.match(res.headers()['x-robots-tag'],/noindex/,href);
  assert.equal(await page.locator('.paint-tool-card').count(),6,href);
  assert.equal(await page.locator('.paint-tool-card a[href="/paint-calculator/"]').count(),1,href);
  assert.equal(await page.getByRole('button',{name:'Project Planner Advanced Coming Soon'}).isEnabled(),false,href);
  await page.locator('#'+field).fill(value);
  assert.ok(await page.locator('.instant-estimate').isVisible(),href);
  assert.equal(await page.locator('.paint-result-can').isVisible(),slug!=='paint-cost-calculator',href);
  assert.equal(await page.locator('#specialized-result').innerText(),expected,href);
  assert.ok(await page.locator('#specialized-print').isEnabled(),href);
 }
 assert.deepEqual(errors,[]);
 report.checks.push('Five dedicated calculators, results, noindex, and cards linking to the main calculator');
 report.success=true;
}finally{await browser.close();writeFileSync('test-output/live-report.json',JSON.stringify(report,null,2));console.log('LIVE_PAINT '+JSON.stringify(report));}
