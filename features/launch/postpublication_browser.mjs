// Read-only Chromium mobile render check for each Home Improvement article.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {chromium} from await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const input=JSON.parse(readFileSync('hi-audit-output/audit-report.json','utf8'));
mkdirSync('hi-audit-output',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
const records=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 page.setDefaultTimeout(10000);
 page.setDefaultNavigationTimeout(20000);
 let pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));
 for(let i=0;i<input.articles.length;i++){
  const entry=input.articles[i];
  pageErrors=[];
  const item={url:entry.url,status:null,issues:[],cover:null,viewport:390,overflowPx:0,tableCount:null,visibleImages:0};
  try{
   const response=await page.goto(entry.url,{waitUntil:'domcontentloaded',timeout:20000});
   item.status=response?.status()||null;
   if(item.status!==200){item.issues.push({severity:'P1',category:'mobile',message:'Navegador retornou HTTP '+item.status});records.push(item);continue;}
   await page.locator('article').waitFor({state:'visible',timeout:10000});
   try{await page.evaluate(async()=>{
    const cover=document.querySelector('main article img.cover');
    if(cover&&typeof cover.decode==='function')await Promise.race([cover.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,4500))]);
   });}catch(e){}
   const render=await page.evaluate(()=>{
    const cover=document.querySelector('article img.cover');
    const visible=el=>{const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0};
    const imgs=Array.from(document.querySelectorAll('main article img'));
    const tables=Array.from(document.querySelectorAll('main article table'));
    return {
     cover:cover?{src:cover.currentSrc||cover.src,naturalWidth:cover.naturalWidth,naturalHeight:cover.naturalHeight,complete:cover.complete,alt:cover.getAttribute('alt'),rect:Math.round(cover.getBoundingClientRect().width)}:null,
     overflowPx:Math.max(0,document.documentElement.scrollWidth-window.innerWidth),
     articleWidth:Math.round(document.querySelector('main article')?.getBoundingClientRect().width||0),
     viewportWidth:window.innerWidth,
     tableCount:tables.length,
     tables:tables.map(t=>({width:Math.round(t.getBoundingClientRect().width),overflow:t.scrollWidth>t.clientWidth+3})),
     images:imgs.filter(visible).map(img=>({src:img.currentSrc||img.src,ok:img.complete&&img.naturalWidth>0,alt:img.getAttribute('alt')})),
     h1:document.querySelector('article h1')?.textContent?.trim()||''
    };
   });
   item.cover=render.cover;
   item.overflowPx=render.overflowPx;
   item.tableCount=render.tableCount;
   item.visibleImages=render.images.length;
   if(render.overflowPx>6)item.issues.push({severity:'P1',category:'mobile',message:'Rolagem horizontal inesperada: '+render.overflowPx+'px'});
   if(!render.cover||render.cover.naturalWidth<1)item.issues.push({severity:'P1',category:'imagens',message:'Capa não renderizada no navegador mobile'});
   for(const img of render.images){if(!img.ok)item.issues.push({severity:'P1',category:'imagens',message:'Imagem visível não carregou: '+img.src});}
   if(!render.articleWidth)item.issues.push({severity:'P1',category:'formatacao',message:'Artigo sem largura visível'});
   if(!render.h1)item.issues.push({severity:'P1',category:'formatacao',message:'H1 invisível/ausente no navegador mobile'});
   if(pageErrors.length)item.issues.push({severity:'P2',category:'javascript',message:'Erro JS: '+pageErrors.slice(0,2).join(' | ').slice(0,220)});
   if(i===0||i===input.articles.length-1)await page.screenshot({path:'hi-audit-output/mobile-sample-'+(i===0?'first':'last')+'.png',fullPage:true});
  }catch(e){item.issues.push({severity:'P1',category:'mobile',message:'Falha na verificação Chromium: '+String(e).slice(0,220)})}
  records.push(item);
  console.log('HI_BROWSER_ARTICLE '+JSON.stringify(item));
 }
 await page.close();
}finally{await browser.close()}
const summary={examined:records.length,scoreless:true,verified200:records.filter(i=>i.status===200).length,withoutFindings:records.filter(i=>i.issues.length===0).length,problems:records.filter(i=>i.issues.length>0).length};
writeFileSync('hi-audit-output/mobile-audit.json',JSON.stringify({summary,articles:records},null,2));
console.log('HI_BROWSER_SUMMARY '+JSON.stringify(summary));
