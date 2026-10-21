/* Visual prototype: sorting only. Calculators are linked when implemented. */
(() => {
 const control=document.querySelector('#sort-paint');
 const grid=document.querySelector('#paint-grid');
 control?.addEventListener('change',()=>{
  if(!grid) return;
  const slot=grid.querySelector('[data-ad-slot="SUBCATEGORY-CALCULATORS-01"]');
  const cards=[...grid.querySelectorAll('.paint-card:not(.mp-ad-placeholder)')];
  if(control.value==='az')cards.sort((a,b)=>a.dataset.title.localeCompare(b.dataset.title));
  else cards.sort((a,b)=>Number(a.dataset.originalOrder)-Number(b.dataset.originalOrder));
  if(slot)cards.splice(2,0,slot);
  cards.forEach(el=>grid.append(el));
 });
 document.querySelectorAll('.paint-card').forEach((el,i)=>el.dataset.originalOrder=String(i));
})();