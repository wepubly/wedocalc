/* Metricpedia Paint Calculator — real, client-side calculations.
   Units are converted before arithmetic. No server calls or stored data. */
(() => {
 'use strict';
 const root=document.querySelector('.calculator-page');if(!root)return;
 const SQFT_PER_SQM=10.76391041671, L_PER_GAL=3.785411784;
 const fmt=(n,d=2)=>Number(n).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:0});
 const currency=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 const modes=['needed','coverage','cost'];
 const tabs=[...root.querySelectorAll('[data-mode]')];
 const panels=[...root.querySelectorAll('[data-panel]')];
 let mode='needed', areaMode='area',report=null;
 const $=id=>document.getElementById(id);
 const panel=()=>root.querySelector('[data-panel="'+mode+'"]');
 const fieldSet=()=>mode==='needed'?panel().querySelector('[data-fields="'+areaMode+'"]'):panel().querySelector('.calc-fields');
 const rowsIn=el=>[...el.querySelectorAll(':scope > label')];
 const getFields=el=>rowsIn(el).map(row=>({
   label:row.childNodes[0].textContent.trim(),
   value:Number(row.querySelector('input')?.value??row.querySelector('output')?.textContent),
   raw:row.querySelector('input')?.value,
   unit:row.querySelector('select')?.value||'',
   input:row.querySelector('input'),
   output:row.querySelector('output'),
   row
 }));
 const fail=message=>{
  report=null;
  $('result-value').textContent='—';$('result-label').textContent='Check your input';
  $('detail-area').textContent='—';$('detail-rate').textContent='—';$('detail-coats').textContent='—';$('detail-total').textContent='—';
  const note=root.querySelector('.calc-advice');note.textContent=message;note.classList.add('input-warning');
 };
 const positive=(n,label)=>{if(!Number.isFinite(n)||n<=0)throw Error(label+' must be greater than zero.')};
 const nonnegative=(n,label)=>{if(!Number.isFinite(n)||n<0)throw Error(label+' cannot be negative.')};
 const toSqFt=(area,unit)=>unit==='sq m'?area*SQFT_PER_SQM:area;
 const toGallons=(volume,unit)=>unit==='liters'?volume/L_PER_GAL:volume;
 const coverageToSqFtGal=(value,unit)=>unit==='sq m per liter'?value*SQFT_PER_SQM*L_PER_GAL:value;
 function calculate(){
  try{
   const fields=getFields(fieldSet());if(fields.some(f=>f.input&&f.raw===''))throw Error('Complete all fields to calculate.');
   let result,resultLabel,details,explanation,extra=[],modeLabel;
   if(mode==='needed'){
    let areaSqFt,coats,rate,waste=10;
    if(areaMode==='area'){
     const [area,rateField,coatsField,wasteField]=fields;
     positive(area.value,'Total area');positive(rateField.value,'Coverage rate');
     positive(coatsField.value,'Coats');nonnegative(wasteField.value,'Extra allowance');
     if(wasteField.value>100)throw Error('Extra allowance must be between 0% and 100%.');
     areaSqFt=toSqFt(area.value,area.unit);rate=coverageToSqFtGal(rateField.value,rateField.unit);
     coats=coatsField.value;waste=wasteField.value;
    }else{
     const [length,width,height,rateField,coatsField,wasteField,openingsField]=fields;
     positive(length.value,'Room length');positive(width.value,'Room width');positive(height.value,'Wall height');positive(rateField.value,'Coverage rate');positive(coatsField.value,'Coats');
     nonnegative(wasteField.value,'Extra allowance');nonnegative(openingsField.value,'Doors and windows area');
     if(wasteField.value>100)throw Error('Extra allowance must be between 0% and 100%.');
     const meters=length.unit==='m';
     const L=length.value*(meters?Math.sqrt(SQFT_PER_SQM):1);
     const W=width.value*(width.unit==='m'?Math.sqrt(SQFT_PER_SQM):1);
     const H=height.value*(height.unit==='m'?Math.sqrt(SQFT_PER_SQM):1);
     const deduction=toSqFt(openingsField.value,openingsField.unit);
     const gross=2*(L+W)*H;
     areaSqFt=gross-deduction;
     positive(areaSqFt,'Net wall area');
     rate=coverageToSqFtGal(rateField.value,rateField.unit);
     coats=coatsField.value;waste=wasteField.value;
     extra.push(['Gross wall area',fmt(gross)+' sq ft'],['Openings deducted',fmt(deduction)+' sq ft']);
    }
    const gallons=(areaSqFt*coats/rate)*(1+waste/100);
    if(!Number.isFinite(gallons)||gallons>1e12)throw Error('The calculated value is too large.');
    result=fmt(gallons)+' gallons';resultLabel='Estimated paint needed';
    details=[fmt(areaSqFt)+' sq ft',fmt(rate)+' sq ft/gal',fmt(coats),result];
    extra.push(['Extra allowance',fmt(waste)+'%'],['Purchase suggestion',fmt(Math.ceil(gallons),0)+' whole gallons']);
    explanation='Estimate includes a '+fmt(waste)+'% allowance. Round up based on the sizes actually sold.';
    modeLabel='Paint Needed'+(areaMode==='room'?' — Room Dimensions':' — Total Area');
   }else if(mode==='coverage'){
    const [paint,rateField,coatsField]=fields;
    positive(paint.value,'Available paint');positive(rateField.value,'Coverage rate');positive(coatsField.value,'Coats');
    const gal=toGallons(paint.value,paint.unit),rate=coverageToSqFtGal(rateField.value,rateField.unit);
    const area=gal*rate/coatsField.value;
    if(!Number.isFinite(area)||area>1e12)throw Error('The calculated value is too large.');
    result=fmt(area)+' sq ft';resultLabel='Estimated area covered';
    details=[fmt(gal)+' gallons',fmt(rate)+' sq ft/gal',fmt(coatsField.value),result];
    explanation='Available paint covers approximately '+fmt(area)+' square feet at '+fmt(coatsField.value)+' coat(s).';
    modeLabel='Paint Coverage';
   }else{
    const [volume,unitPrice,supplies]=fields;
    positive(volume.value,'Paint quantity');nonnegative(unitPrice.value,'Paint price');nonnegative(supplies.value,'Supplies cost');
    const cost=volume.value*unitPrice.value+supplies.value;
    if(!Number.isFinite(cost)||cost>1e12)throw Error('The estimated cost is too large.');
    result=currency(cost);resultLabel='Estimated project cost';
    details=[fmt(volume.value)+' '+volume.unit,currency(unitPrice.value)+' per '+(volume.unit==='liters'?'liter':'gallon'),'—',result];
    extra.push(['Paint subtotal',currency(volume.value*unitPrice.value)],['Additional supplies',currency(supplies.value)]);
    explanation='Estimate excludes taxes, labor and any unlisted materials.';
    modeLabel='Paint Cost';
   }
   const fieldRows=fields.map(f=>[f.label,fmt(f.value)+(f.unit?' '+f.unit:'')]);
   report={valid:true,title:'Paint Calculator',mode:modeLabel,resultLabel,result,rows:[...fieldRows,...extra],note:explanation};
   ['result-value','result-label','detail-area','detail-rate','detail-coats','detail-total'].forEach((id,i)=>$(id).textContent=[result,resultLabel,...details][i]);
   const labels=mode==='coverage'?['Paint available','Coverage rate','Number of coats','Area covered']:mode==='cost'?['Paint quantity','Unit paint price','—','Estimated cost']:['Estimated area','Coverage rate','Number of coats','Estimated paint'];
   const breakdown=root.querySelectorAll('.calc-result-breakdown > div > span');breakdown.forEach((el,i)=>el.textContent=labels[i]);
   const note=root.querySelector('.calc-advice');note.textContent=explanation;note.classList.remove('input-warning');
   return true;
  }catch(error){fail(error.message||'Please check the input values.');return false;}
 }
 function setMode(next){
  if(!modes.includes(next))return;
  mode=next;
  tabs.forEach(t=>{const active=t.dataset.mode===next;t.classList.toggle('active',active);t.setAttribute('aria-selected',String(active));});
  panels.forEach(p=>p.classList.toggle('is-hidden',p.dataset.panel!==next));
  calculate();
 }
 function setAreaMode(next){
  areaMode=next==='room'?'room':'area';
  root.querySelectorAll('[data-area-mode]').forEach(button=>button.classList.toggle('chosen',button.dataset.areaMode===areaMode));
  root.querySelectorAll('[data-fields]').forEach(el=>el.classList.toggle('is-hidden',el.dataset.fields!==areaMode));
  calculate();
 }
 function stateUrl(){
  const query=new URLSearchParams();
  query.set('mode',mode);if(mode==='needed')query.set('method',areaMode);
  for(const input of fieldSet().querySelectorAll('input,select,output')){
   if(input.tagName==='OUTPUT')query.append('v',input.textContent);
   else query.append(input.tagName==='SELECT'?'u':'v',input.value);
  }
  return location.origin+location.pathname+'?'+query.toString();
 }
 function restore(){
  const params=new URLSearchParams(location.search);
  if(!modes.includes(params.get('mode')))return;
  mode=params.get('mode');
  if(params.get('method')==='room')areaMode='room';
  const values=params.getAll('v'),units=params.getAll('u');
  if(values.length!==fieldSet().querySelectorAll('input,output').length||units.length!==fieldSet().querySelectorAll('select').length)return;
  if(values.some(v=>!Number.isFinite(Number(v))||v.length>18))return;
  let vi=0,ui=0;
  fieldSet().querySelectorAll('input,select,output').forEach(el=>{
   if(el.tagName==='SELECT'){const val=units[ui++];if([...el.options].some(o=>o.value===val))el.value=val;}
   else if(el.tagName==='OUTPUT')el.textContent=String(Math.max(1,Math.min(10,Number(values[vi++]))));
   else el.value=values[vi++];
  });
 }
 root.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{
  const output=button.parentElement.querySelector('output');
  output.textContent=String(Math.max(1,Math.min(10,Number(output.textContent)+Number(button.dataset.step))));
  calculate();
 }));
 tabs.forEach(tab=>tab.addEventListener('click',()=>setMode(tab.dataset.mode)));
 root.querySelectorAll('[data-area-mode]').forEach(button=>button.addEventListener('click',()=>setAreaMode(button.dataset.areaMode)));
 root.querySelectorAll('[data-calc-action]').forEach(button=>button.addEventListener('click',()=>{if(calculate())root.querySelector('.calc-results').scrollIntoView({block:'nearest',behavior:'smooth'});}));
 root.querySelectorAll('.calc-mode input,.calc-mode select').forEach(el=>el.addEventListener(el.tagName==='SELECT'?'change':'input',()=>{
  if(mode==='cost' && el===panel().querySelector('.calc-fields label:first-child select')){
   const unit=el.value==='liters'?'liter':'gallon';
   panel().querySelector('.calc-fields label:nth-child(2)').childNodes[0].textContent='Price per '+unit+' ';
  }
  calculate();
 }));
 restore();setAreaMode(areaMode);setMode(mode);
 if(window.MetricpediaSharing) window.MetricpediaSharing.mount({
  container:root.querySelector('#mp-share'),
  getReport:()=>report,
  getLink:stateUrl,
  printPreviewUrl:'../print/paint-calculator/'
 });
})();
