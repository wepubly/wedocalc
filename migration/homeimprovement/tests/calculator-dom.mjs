import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {parseHTML}=require(process.env.HI_LINKEDOM_PATH||'linkedom');
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const site=resolve(process.argv[2]);const storage=new Map();let navigated='',printed=0;
const sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
function context(html,url){
 const {window}=parseHTML(html);const location=Object.assign(new URL(url),{assign:v=>navigated=v});
 Object.assign(window,{location,history:{replaceState(){}},sessionStorage,URL,URLSearchParams,console});
 window.print=()=>printed++;
 for(const select of window.document.querySelectorAll('select'))if(!select.querySelector('[selected]'))select.firstElementChild?.setAttribute('selected','');
 const ctx=vm.createContext({window,document:window.document,location,history:window.history,sessionStorage,URL,URLSearchParams,console,navigator:{},Intl,Date});return {window,ctx};
}
const {window,ctx}=context(readFileSync(site+'/paint-calculator/index.html','utf8'),'https://homeimprovement.tools/paint-calculator/');
for(const f of ['assets/results-sharing.js','paint-calculator/calculator.js'])vm.runInContext(readFileSync(site+'/'+f,'utf8'),ctx);
const fields=window.document.querySelectorAll('[data-panel="needed"] [data-fields="area"] input');
function set(n,v){fields[n].value=v;fields[n].dispatchEvent(new window.Event('input',{bubbles:true}));}
['1000','400','10'].forEach((v,i)=>set(i,v));
assert.equal(window.document.querySelector('#result-value').textContent,'5.5 gallons');
set(0,'-1');assert.equal(window.document.querySelector('#result-label').textContent,'Check your input');set(0,'1000');
window.document.querySelector('[data-mp-share="print"]').dispatchEvent(new window.Event('click',{bubbles:true}));
assert.equal(navigated,'../print/paint-calculator/');
const payload=JSON.parse(storage.get('metricpedia:print-report:v1'));assert.equal(payload.report.result,'5.5 gallons');assert.ok(payload.link.startsWith('https://homeimprovement.tools/'));
const html=readFileSync(site+'/print/paint-calculator/index.html','utf8');const print=context(html,'https://homeimprovement.tools/print/paint-calculator/');
for(const script of print.window.document.querySelectorAll('script:not([src])'))vm.runInContext(script.textContent,print.ctx);
assert.equal(print.window.document.querySelector('.result-value').textContent,'5.5 gallons');
for(const button of print.window.document.querySelectorAll('.actions button')){assert.equal(button.disabled,false);vm.runInContext(button.getAttribute('onclick'),print.ctx);}
assert.equal(printed,2);
console.log('PASS DOM: 1000 sq ft, 400 coverage, 2 coats, 10% => 5.5 gallons; rejects negative area; print preview receives result; Print and PDF invoke print dialog. Native PDF layout not tested.');
