/* Paint Calculator visual prototype. Tabs and stepper change presentation only.
   All displayed results are sample figures, NOT calculated output. */
(() => {
 const root=document.querySelector('.calculator-page');
 if(!root)return;
 const tabs=[...root.querySelectorAll('[data-mode]')], panels=[...root.querySelectorAll('[data-panel]')];
 const examples={
  needed:['3.14 gallons','Illustrative paint needed','500 sq ft','350 sq ft/gal','2','3.14 gallons'],
  coverage:['350 sq ft','Illustrative area covered','2 gallons','350 sq ft/gal','2','350 sq ft'],
  cost:['$177.00','Illustrative project cost','4 gallons','$38 per gallon','—','$177.00']
 };
 function setMode(mode){
  tabs.forEach(t=>{const chosen=t.dataset.mode===mode;t.classList.toggle('active',chosen);t.setAttribute('aria-selected',String(chosen));});
  panels.forEach(p=>p.classList.toggle('is-hidden',p.dataset.panel!==mode));
  const example=examples[mode];
  ['result-value','result-label','detail-area','detail-rate','detail-coats','detail-total'].forEach((id,i)=>{document.getElementById(id).textContent=example[i]});
 }
 tabs.forEach(tab=>tab.addEventListener('click',()=>setMode(tab.dataset.mode)));
 root.querySelectorAll('[data-area-mode]').forEach(button=>button.addEventListener('click',()=>{
  root.querySelectorAll('[data-area-mode]').forEach(b=>b.classList.toggle('chosen',b===button));
  root.querySelectorAll('[data-fields]').forEach(p=>p.classList.toggle('is-hidden',p.dataset.fields!==button.dataset.areaMode));
 }));
 root.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{
  const output=button.parentElement.querySelector('output');
  output.textContent=String(Math.max(1,Math.min(10,Number(output.textContent)+Number(button.dataset.step))));
 }));
 root.querySelectorAll('[data-calc-action]').forEach(button=>button.addEventListener('click',()=>{
  const note=root.querySelector('.calc-advice');
  note.textContent='Visual preview only — results above are sample values. Real calculations will be enabled after the template is approved.';
  note.scrollIntoView({behavior:'smooth',block:'nearest'});
 }));
})();
