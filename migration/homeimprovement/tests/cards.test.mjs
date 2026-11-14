import test from 'node:test';
import assert from 'node:assert/strict';
import {select,homeColumns} from '../cards-catalog.mjs';
const rows=Array.from({length:15},(_,i)=>({href:`https://homeimprovement.tools/home-garden/paint-calculators/paint-calculator/guide-${i}/`,title:`Guide ${i}`,categoryId:'home-garden',subcategoryId:'paint-calculators',calculatorId:'paint-calculator',category:'Paint',description:'Test'}));
const count=s=>(s.match(/<article class="guide card">/g)||[]).length;
test('ten unique guides without advertisement',()=>{const chosen=select(rows,{kind:'home'},1),html=homeColumns(chosen,'');assert.equal(chosen.length,10);assert.equal(count(html),10);assert.equal(new Set(chosen.map(r=>r.href)).size,10);assert.equal((html.match(/guide-column/g)||[]).length,5);assert.doesNotMatch(html,/data-empty-guide-slot/);});
test('nine guides plus a real advertisement',()=>{const ad='<aside data-test-ad>Advertisement</aside>',chosen=select(rows,{kind:'home',ad},1),html=homeColumns(chosen,ad);assert.equal(chosen.length,9);assert.equal(count(html),9);assert.equal((html.match(/data-test-ad/g)||[]).length,1);assert.equal((html.match(/guide-column/g)||[]).length,5);assert.ok(html.indexOf(ad)>html.indexOf(chosen[7].title));assert.ok(html.indexOf(ad)<html.indexOf(chosen[8].title));});
test('blank ad and sparse catalog do not reserve invisible cards',()=>{for(const n of [0,1,9,10,15]){const chosen=select(rows.slice(0,n),{kind:'home',ad:'  '},1),html=homeColumns(chosen,'  ');assert.equal(count(html),Math.min(10,n));assert.doesNotMatch(html,/data-empty-guide-slot/);}});
test('category and calculator limits are unchanged',()=>{assert.equal(select(rows,{kind:'category'},1).length,5);assert.equal(select(rows,{kind:'calculator'},1).length,4);});
