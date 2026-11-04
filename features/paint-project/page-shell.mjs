// Mode selection only: do not rebuild forms or reset either calculator's state.
const quick=document.querySelector('#quickPanel'),advanced=document.querySelector('#advancedPanel');
if(quick&&advanced){
 function switchMode(mode,{focus=false}={}){
  const isQuick=mode==='quick';quick.hidden=!isQuick;advanced.hidden=isQuick;
  for(const [id,active] of [['quickChoice',isQuick],['advancedChoice',!isQuick]]){const button=document.getElementById(id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  if(focus){const heading=(isQuick?quick:advanced).querySelector('h2');heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
 }
 document.querySelectorAll('[data-switch-to]').forEach(button=>button.addEventListener('click',()=>switchMode(button.dataset.switchTo,{focus:!button.classList.contains('calculator-option')})));
 switchMode('quick');
}
