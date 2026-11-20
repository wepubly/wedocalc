import test from 'node:test';
import assert from 'node:assert/strict';
import {select,homeColumns,normalize} from '../cards-catalog.mjs';
const rows=Array.from({length:15},(_,i)=>({href:`https://homeimprovement.tools/home-garden/paint-calculators/paint-calculator/guide-${i}/`,title:`Guide ${i}`,categoryId:'home-garden',subcategoryId:'paint-calculators',calculatorId:'paint-calculator',category:'Paint',description:'Test'}));
const count=s=>(s.match(/<article class="guide card">/g)||[]).length;
test('ten unique guides without advertisement',()=>{const chosen=select(rows,{kind:'home'},1),html=homeColumns(chosen,'');assert.equal(chosen.length,10);assert.equal(count(html),10);assert.equal(new Set(chosen.map(r=>r.href)).size,10);assert.equal((html.match(/guide-column/g)||[]).length,5);assert.doesNotMatch(html,/data-empty-guide-slot/);});
test('nine guides plus a real advertisement',()=>{const ad='<aside data-test-ad>Advertisement</aside>',chosen=select(rows,{kind:'home',ad},1),html=homeColumns(chosen,ad);assert.equal(chosen.length,9);assert.equal(count(html),9);assert.equal((html.match(/data-test-ad/g)||[]).length,1);assert.equal((html.match(/guide-column/g)||[]).length,5);assert.ok(html.indexOf(ad)>html.indexOf(chosen[7].title));assert.ok(html.indexOf(ad)<html.indexOf(chosen[8].title));});
test('blank ad and sparse catalog do not reserve invisible cards',()=>{for(const n of [0,1,9,10,15]){const chosen=select(rows.slice(0,n),{kind:'home',ad:'  '},1),html=homeColumns(chosen,'  ');assert.equal(count(html),Math.min(10,n));assert.doesNotMatch(html,/data-empty-guide-slot/);}});
test('category and calculator limits are unchanged',()=>{assert.equal(select(rows,{kind:'category'},1).length,5);assert.equal(select(rows,{kind:'calculator'},1).length,4);});


test('transformed blog cover preserves the original safe media path for homepage cards',()=>{
 const id='cdb1444a-5183-43b4-a562-4a193e312691';
 const row={href:'/home-garden/paint-calculators/paint-calculator/test-guide/',title:'Test guide',description:'A useful guide',category:'Home & Garden',image:'/cdn-cgi/image/width=480,quality=75,format=auto/media/'+id};
 const normalized=normalize(row);
 assert.ok(normalized,'Cloudflare thumbnail should not remove published guide from catalogue');
 assert.equal(normalized.image,'https://homeimprovement.tools/media/'+id);
 assert.equal(normalize({...row,image:'/media/'+id}).image,'https://homeimprovement.tools/media/'+id);
 assert.equal(normalize({...row,image:'/cdn-cgi/image/width=1200,quality=90,format=auto/media/'+id}),null,'Only known image transformation should be accepted');
 assert.equal(normalize({...row,image:'https://example.com/media/'+id}),null,'Foreign image hosts remain blocked');
});
