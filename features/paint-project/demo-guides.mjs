// Read public articles for the isolated demo only. Never call editorial APIs or write production.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';
import {normalize,select,card,decode} from '../../migration/homeimprovement/cards-catalog.mjs';
const dir=resolve(process.argv[2]),origin='https://homeimprovement.tools';
const response=await fetch(origin+'/blog/');assert.equal(response.status,200);const html=await response.text(),rows=[];
const clean=s=>decode(s.replace(/<[^>]+>/g,'').trim());
for(const m of html.matchAll(/<a\b([^>]*class="blog-card"[^>]*)>([\s\S]*?)<\/a>/g)){
 const body=m[2],href=m[1].match(/href="([^"]+)"/)?.[1],title=body.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1];
 if(!href||!title)continue;
 const row=normalize({href,title:clean(title),image:body.match(/<img[^>]+src="([^"]+)"/)?.[1]||'',alt:body.match(/<img[^>]+alt="([^"]*)"/)?.[1]||'',description:clean([...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].at(-1)?.[1]||'')});if(row)rows.push(row);
}
assert.ok(rows.length,'Public catalogue parse returned no articles');const chosen=select(rows,{kind:'calculator',categoryId:'home-garden',subcategoryId:'paint-calculators',calculatorId:'paint-calculator'});assert.ok(chosen.length);
const report={at:new Date().toISOString(),publicCatalogueCount:rows.length,guides:[],related:[]};mkdirSync(dir+'/paint-calculator/project/demo-media',{recursive:true});
for(const row of chosen){
 const r=await fetch(row.href);assert.equal(r.status,200);const body=await r.text();assert.ok(body.includes('href="'+row.href+'"'),'Article canonical must match card');assert.ok(body.includes(row.title.replaceAll('&','&amp;'))||clean(body).includes(row.title),'Title must match the card');
 report.guides.push({title:row.title,href:row.href,status:r.status,canonicalMatches:true});
 if(row.image){const r=await fetch(row.image);assert.equal(r.status,200);const id=new URL(row.image).pathname.split('/').pop();writeFileSync(dir+'/paint-calculator/project/demo-media/'+id,Buffer.from(await r.arrayBuffer()));row.image='project/demo-media/'+id;}
}
const pagePath=dir+'/paint-calculator/index.html';let page=readFileSync(pagePath,'utf8');for(const match of page.matchAll(/<section class="calc-panel calc-info calc-related">([\s\S]*?)<\/section>/g))for(const [,href] of match[1].matchAll(/href="([^"]+)"/g)){const url=new URL(href,origin+'/paint-calculator/'),r=await fetch(url);assert.equal(r.status,200);await r.body.cancel();report.related.push({href:url.href,status:200,destination:'Existing Paint Calculators directory'});}
page=page.replace('<div data-hi-cards="calculator"></div>','<div data-hi-cards="calculator">'+chosen.map(row=>card(row,'calculator')).join('')+'</div>');writeFileSync(pagePath,page);
writeFileSync('test-output/public-links.json',JSON.stringify(report,null,2));console.log('PUBLIC_LINKS '+JSON.stringify(report));
