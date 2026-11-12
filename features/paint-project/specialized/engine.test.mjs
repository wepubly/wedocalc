import test from 'node:test';
import assert from 'node:assert/strict';
import {estimate} from './engine.mjs';

const coating = {coverage:400, coats:2, waste:10};
const cost = {gallons:4,price:35,supplies:15,labor:100,tax:8};
const exterior = {...coating,perimeter:120,height:10,gable:100,openings:100};
const ceiling = {...coating,length:20,width:10,rooms:2};
const trim = {...coating,length:240,face:6};
const close = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-9, String(actual));

test('cost applies materials tax and adds labor',()=>{
  assert.deepEqual(estimate('cost',cost),{paint:140,materials:155,tax:12.4,labor:100,total:267.4});
  assert.equal(estimate('cost',{gallons:2.5,price:1.23,supplies:0,labor:0,tax:0}).total,3.08);
});
test('exterior adds gables and subtracts openings',()=>{
  const r=estimate('exterior',exterior);
  assert.equal(r.gross,1300);
  assert.equal(r.area,1200);
  close(r.gallons,6.6);
  assert.equal(r.whole,7);
});
test('ceiling multiplies matching rooms',()=>close(estimate('ceiling',ceiling).gallons,2.2));
test('trim converts inches to feet before calculating coverage',()=>{
  assert.equal(estimate('trim',trim).area,120);
  close(estimate('trim',trim).gallons,.66);
});
test('invalid, empty and extreme values cannot produce an estimate',()=>{
  assert.throws(()=>estimate('cost',{...cost,gallons:''}));
  assert.throws(()=>estimate('cost',{...cost,labor:-1}));
  assert.throws(()=>estimate('cost',{...cost,tax:101}));
  assert.throws(()=>estimate('cost',{...cost,gallons:1e7,price:1e7}));
  assert.throws(()=>estimate('exterior',{...exterior,openings:1300}));
  assert.throws(()=>estimate('ceiling',{...ceiling,rooms:1.5}));
  assert.throws(()=>estimate('trim',{...trim,coverage:0}));
  assert.throws(()=>estimate('trim',{...trim,length:Infinity}));
  assert.throws(()=>estimate('exterior',{...exterior,perimeter:1e7,height:1e7}));
});
