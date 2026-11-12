import {calculate,SQFT_PER_SQM,L_PER_GAL,number} from './math.mjs';
import {recommendations,reconcile,shopping} from './materials.mjs';
import {budget} from './budget.mjs';
import {pdf,reportLines} from './export.mjs';
const root=document.querySelector('#project-planner');
if(root){
 const $=key=>root.querySelector('#pp-'+key),fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:3}),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 let result=null,items=[],removed=new Set(),valid=false,lastUnits='imperial',lastExport=null;
 const steps=[...root.querySelectorAll('[data-planner-step]')];
 const progress=[...root.querySelectorAll('.planner-steps li')];
 const viewport=root.querySelector('.planner-viewport');
 let step=0;

 function showStep(index){
  step=index;
  for(const [i,panel] of steps.entries()){
   panel.hidden=i!==index;
   if(i===index)progress[i].setAttribute('aria-current','step');
   else progress[i].removeAttribute('aria-current');
  }
  const heading=steps[index].querySelector('h3');
  viewport.setAttribute('aria-labelledby',heading.id);
  $('back').disabled=index===0;
  $('next').textContent=index===steps.length-1?'Edit measurements':'Next →';
  viewport.scrollTop=0;
  heading.focus({preventScroll:true});
 }

 $('back').addEventListener('click',()=>showStep(step-1));
 $('next').addEventListener('click',()=>{
  if(step===steps.length-1){showStep(0);return;}
  try{
   if(step===0){
    // Measurements can be corrected independently of package size or primer.
    calculate({...input(),packageSize:1,primer:false});
   }else if(step===1){
    if(!valid)return;
    for(const row of items)number(row.quantity,'Quantity for '+row.name,{max:1e6});
   }else if(!valid||!totals()){
    return;
   }
   showStep(step+1);
  }catch(e){error(e.message);}
 });
 const value=key=>$(key).type==='checkbox'?$(key).checked:$(key).value;
 const error=message=>{$('error').hidden=!message;$('error').textContent=message||'';for(const id of ['print','letter','a4'])$(id).disabled=!!message;};
 const text=(tag,content,parent)=>{const el=document.createElement(tag);el.textContent=content;parent?.append(el);return el;};
 function input(){
  const data={};for(const key of ['kind','units','length','width','height','doorsCount','doorsWidth','doorsHeight','windowsCount','windowsWidth','windowsHeight','coats','rate','waste','ceiling','ceilingCoats','ceilingRate','primer','primerCoats','primerRate','packageSize'])data[key]=value(key);
  data.method=value('method');
  if(data.method==='existing'){
   const base=window.HIPaintPlan||window.HILastPaintPlan;if(!base)throw Error('Enter valid Paint Needed measurements in Quick Calculator, or select Detailed room.');
   const metric=data.units==='metric';data.method='area';data.area=base.areaSqFt/(metric?SQFT_PER_SQM:1);data.coats=base.coats;data.rate=base.rate/(metric?SQFT_PER_SQM*L_PER_GAL:1);data.waste=base.waste;data.ceiling=false;
  }
  return data;
 }
 function quote(){return budget(shopping(items),{additional:value('additional'),contingency:value('contingency')});}
 function totals(){
  try{
   for(const row of items){number(row.quantity,'Quantity for '+row.name,{max:1e6});if(row.price!=='')number(row.price,'Price for '+row.name,{max:1e7});}
   const b=quote();$('shopping').replaceChildren();for(const row of shopping(items,value('includeOwned')))text('li',`${row.name}: ${fmt(row.quantity)} ${row.unit}${row.owned?' — already owned (no budget charge)':''}`, $('shopping'));
   if(!$('shopping').children.length)text('li','No materials to buy.', $('shopping'));
   for(const row of b.lines){const subtotal=root.querySelector(`[data-subtotal="${row.id}"]`);if(subtotal)subtotal.textContent=row.subtotal===null?'Not quoted':money(row.subtotal);}
   for(const row of items.filter(x=>!x.selected||x.owned)){const node=root.querySelector(`[data-subtotal="${row.id}"]`);if(node)node.textContent='Excluded from budget';}
   $('budget').textContent=!b.hasPrices?`Not quoted — enter your own unit prices. ${b.missing} purchase item(s) without prices.`:!b.complete?`Incomplete budget: ${money(b.total)} known subtotal including extras and contingency. ${b.missing} item(s) still need prices.`:`Estimated total: ${money(b.total)}. Materials ${money(b.known)} + extras ${money(b.additional)} + contingency ${money(b.contingency)}.`;
   if(valid)error('');return b;
  }catch(e){error(e.message);$('budget').textContent='Check quantities and prices before exporting.';return null;}
 }
 function materialCards(){
  const node=$('materials'),prices=$('prices');node.replaceChildren();prices.replaceChildren();
  for(const row of items){
   const card=document.createElement('div');card.className='hi-material';node.append(card);
   const head=document.createElement('div');head.className='hi-material-head';card.append(head);text('strong',row.name,head);text('span',row.group,head);
   text('small',row.note,card);
   const fields=document.createElement('div');fields.className='hi-grid';card.append(fields);
   const pricing=document.createElement('div');pricing.className='hi-material';prices.append(pricing);
   text('strong',row.name,pricing);
   for(const [key,label,type] of [['selected','Include','checkbox'],['owned','I already own this','checkbox'],['quantity','Purchase quantity ('+row.unit+')','number'],['price','Unit price USD / '+row.unit,'number']]){
    const wrap=text('label',label,key==='price'?pricing:fields),field=document.createElement('input');field.type=type;field.setAttribute('aria-label',label+' — '+row.name);wrap.append(field);
    if(type==='checkbox'){wrap.className='hi-check';field.checked=row[key];}else{field.min='0';field.step=key==='price'?'0.01':'any';field.max=key==='price'?'10000000':'1000000';field.value=row[key];field.placeholder='Not entered';}
    field.addEventListener(type==='checkbox'?'change':'input',()=>{row[key]=type==='checkbox'?field.checked:field.value;if(key==='quantity')row.overridden=true;totals();});
   }
   const subtotal=text('p','Not quoted',pricing);subtotal.dataset.subtotal=row.id;
   const remove=text('button','Remove '+row.name,card);remove.type='button';remove.addEventListener('click',()=>{removed.add(row.id);items=items.filter(x=>x.id!==row.id);materialCards();totals();$('add').focus();});
  }
 }
 function refresh(reset=false){
  try{
   $('room').hidden=value('method')!=='room';$('source').hidden=value('method')!=='existing';$('ceiling-options').hidden=!value('ceiling');$('primer-options').hidden=!value('primer');
   result=calculate(input());const next=recommendations(result,{mask:value('mask'),repair:value('repair')}).filter(x=>!removed.has(x.id));items=reset?[...next,...items.filter(x=>x.custom)]:reconcile(next,items);valid=true;
   const metric=result.units==='metric',area=n=>fmt(n/(metric?SQFT_PER_SQM:1))+(metric?' m²':' sq ft'),volume=n=>fmt(n*(metric?L_PER_GAL:1))+(metric?' L':' US gal');
   if($('result-total'))$('result-total').textContent=volume(result.paint);
   $('breakdown').replaceChildren();for(const [label,value] of [['Gross / supplied net area',area(result.gross)],['Openings deducted',area(result.deduction)],['Net paintable walls / area',area(result.net)],['Separate ceiling',area(result.ceiling)],['Wall paint',volume(result.wallPaint)],['Ceiling paint',volume(result.ceilingPaint)],['Primer',volume(result.primer)],['Coating allowance',result.waste+'%']]){const div=document.createElement('div');text('dt',label,div);text('dd',value,div);$('breakdown').append(div);}
   materialCards();totals();
  }catch(e){valid=false;result=null;$('breakdown').replaceChildren();$('shopping').replaceChildren();$('budget').textContent='Enter valid measurements to see your estimate.';if($('result-total'))$('result-total').textContent='—';error(e.message);}
 }
 function changeUnits(){
  const now=value('units');if(now===lastUnits)return;
  const toMetric=now==='metric',factor=toMetric?0.3048:1/0.3048;
  for(const key of ['length','width','height','doorsWidth','doorsHeight','windowsWidth','windowsHeight'])if($(key).value!=='')$(key).value=String(Number((Number($(key).value)*factor).toPrecision(12)));
  for(const key of ['rate','ceilingRate','primerRate'])if($(key).value!=='')$(key).value=String(Number((Number($(key).value)*(toMetric?1/(SQFT_PER_SQM*L_PER_GAL):SQFT_PER_SQM*L_PER_GAL)).toPrecision(12)));
  if($('packageSize').value!=='')$('packageSize').value=String(Number((Number($('packageSize').value)*(toMetric?L_PER_GAL:1/L_PER_GAL)).toPrecision(12)));
  for(const el of root.querySelectorAll('[data-length-unit]'))el.textContent=toMetric?'m':'ft';for(const el of root.querySelectorAll('[data-coverage-unit]'))el.textContent=toMetric?'m² / L':'sq ft / US gal';for(const el of root.querySelectorAll('[data-volume-unit]'))el.textContent=toMetric?'L':'US gal';lastUnits=now;$('export-status').textContent='Units converted. Re-enter prices if the purchase unit changed.';
 }
 function measurements(){const data=input();if(value('method')==='existing')return [['Source','Paint Needed result (already net area)'],['Project type',value('kind')],['Units',value('units')]];return Object.entries(data).map(([key,val])=>[key,String(val)]);}
 function lines(){if(!valid||!result)throw Error('Calculate a valid project first.');const b=totals();if(!b)throw Error('Check quantities and prices before exporting.');return reportLines({name:value('name'),result,inventory:items,list:shopping(items,value('includeOwned')),budget:b,measurements:measurements()});}
 root.addEventListener('input',e=>{if(e.target.closest('.hi-material')||e.target.id.startsWith('pp-new')||e.target.id==='pp-name')return;if(['pp-additional','pp-contingency','pp-includeOwned'].includes(e.target.id))totals();else if(e.target.id==='pp-units')return;else refresh();});
 root.addEventListener('change',e=>{if(e.target.closest('.hi-material')||e.target.id!=='pp-units')return;changeUnits();refresh();});
 $('reset').addEventListener('click',()=>{removed.clear();refresh(true);});
 $('add').addEventListener('click',()=>{try{const name=value('newName').trim();if(!name)throw Error('Enter a material name.');if(items.length>=100)throw Error('Limit: 100 materials per report.');const quantity=number(value('newQuantity'),'Material quantity',{min:0.01,max:1e6}),unit=value('newUnit').trim();if(!unit)throw Error('Enter a purchase unit.');items.push({id:'custom-'+crypto.randomUUID(),name,quantity,unit,group:'User-added',note:'Quantity and unit entered by you.',selected:true,owned:false,price:'',custom:true});$('newName').value='';materialCards();totals();$('newName').focus();}catch(e){error(e.message);}});
 for(const [id,format] of [['letter','Letter'],['a4','A4']])$(id).addEventListener('click',()=>{try{const data=pdf(lines(),format);if(lastExport)URL.revokeObjectURL(lastExport);lastExport=URL.createObjectURL(new Blob([data],{type:'application/pdf'}));const a=document.createElement('a');a.href=lastExport;a.download='painting-project-'+format.toLowerCase()+'.pdf';a.click();$('export-status').textContent=format+' PDF downloaded. Blank quotes remain marked as missing.';}catch(e){$('export-status').textContent=e.message;}});
 $('print').addEventListener('click',()=>{try{let report=document.getElementById('hi-project-print');if(!report){report=document.createElement('article');report.id='hi-project-print';document.body.append(report);}report.replaceChildren();for(const row of lines())text(row.heading?'h2':'p',row.text,report);window.print();}catch(e){error(e.message);}});
 window.addEventListener('hi:paint-plan',()=>{if(value('method')==='existing')refresh();});
 refresh();
}
