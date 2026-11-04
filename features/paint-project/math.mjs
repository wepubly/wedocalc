// Original deterministic calculation module. All internal areas are square feet; volumes US gallons.
export const SQFT_PER_SQM=1/(0.3048**2), L_PER_GAL=3.785411784;
export function number(value,label,{min=0,max=1e8,integer=false}={}){
 if(value===''||value===null||value===undefined)throw Error(`${label} is required.`);
 const n=Number(value);if(!Number.isFinite(n)||n<min||n>max||(integer&&!Number.isInteger(n)))throw Error(`${label} must be ${integer?'a whole number ':''}between ${min} and ${max}.`);return n;
}
export function packages(volume,size){number(volume,'Volume');number(size,'Package size',{min:0.001});return volume===0?0:Math.max(1,Math.ceil(volume/size-1e-10));}
export function calculate(input){
 const metric=input.units==='metric',scale=metric?1/0.3048:1,areaScale=scale**2;
 const coats=number(input.coats,'Coats',{min:1,max:10,integer:true}),waste=number(input.waste,'Allowance',{max:100});
 const rate=number(input.rate,'Coverage',{min:0.01})*(metric?SQFT_PER_SQM*L_PER_GAL:1);
 let gross,deduction,net,ceiling=0,perimeter=0,floor=0,height=0;
 if(input.method==='area'){
  gross=number(input.area,'Paintable area',{min:0.01})*areaScale;deduction=0;net=gross;
 }else{
  const length=number(input.length,'Length',{min:0.01,max:10000})*scale,width=number(input.width,'Width',{min:0.01,max:10000})*scale;
  height=number(input.height,'Height',{min:0.01,max:1000})*scale;perimeter=2*(length+width);gross=perimeter*height;floor=length*width;
  deduction=0;
  for(const [key,label] of [['doors','Doors'],['windows','Windows']]){
   const count=number(input[key+'Count'],label,{integer:true,max:1000});
   if(count)deduction+=count*number(input[key+'Width'],label+' width',{min:0.01,max:10000})*number(input[key+'Height'],label+' height',{min:0.01,max:10000})*areaScale;
  }
  if(deduction>=gross)throw Error('Door and window areas must be smaller than the gross wall area.');
  net=gross-deduction;ceiling=input.ceiling?floor:0;
 }
 const ceilingCoats=ceiling?number(input.ceilingCoats,'Ceiling coats',{min:1,max:10,integer:true}):0;
 const ceilingRate=ceiling?number(input.ceilingRate,'Ceiling coverage',{min:0.01})*(metric?SQFT_PER_SQM*L_PER_GAL:1):rate;
 const primerCoats=input.primer?number(input.primerCoats,'Primer coats',{min:1,max:10,integer:true}):0;
 const primerRate=input.primer?number(input.primerRate,'Primer coverage',{min:0.01})*(metric?SQFT_PER_SQM*L_PER_GAL:1):rate;
 const wallPaint=net*coats/rate*(1+waste/100),ceilingPaint=ceiling*ceilingCoats/ceilingRate*(1+waste/100),primer=(net+ceiling)*primerCoats/primerRate*(1+waste/100);
 const packageSize=number(input.packageSize,'Package size',{min:0.01,max:1000})/(metric?L_PER_GAL:1);
 if([gross,net,wallPaint,ceilingPaint,primer].some(n=>!Number.isFinite(n)||n>1e10))throw Error('Project is too large.');
 return {gross,deduction,net,ceiling,perimeter,floor,height,coats,waste,rate,ceilingCoats,ceilingRate,primerCoats,primerRate,wallPaint,ceilingPaint,paint:wallPaint+ceilingPaint,primer,packageSize,units:input.units,method:input.method,kind:input.kind||'interior'};
}
