import {number} from './math.mjs';
const cents=n=>Math.round((n+Number.EPSILON)*100);
export function budget(items,{additional='',contingency=''}={}){
 let knownCents=0,missing=0;
 const lines=items.map(item=>{const quantity=number(item.quantity,'Quantity',{max:1e6});const price=item.price===''?null:number(item.price,'Unit price',{max:1e7});const subtotal=price===null?null:cents(quantity*price);if(subtotal!==null&&!Number.isSafeInteger(subtotal))throw Error('Item subtotal is too large.');if(quantity&&price===null)missing++;else knownCents+=subtotal||0;return {...item,subtotal:subtotal===null?null:subtotal/100};});
 const extra=additional===''?0:number(additional,'Additional costs',{max:1e8}),percent=contingency===''?0:number(contingency,'Contingency',{max:100});
 if(!Number.isSafeInteger(knownCents)||knownCents>1e14)throw Error('Budget is too large.');
 const baseCents=knownCents+cents(extra),contingencyCents=Math.round(baseCents*percent/100);
 return {lines,missing,complete:missing===0,known:knownCents/100,additional:extra,percent,contingency:contingencyCents/100,total:(baseCents+contingencyCents)/100,hasPrices:lines.some(x=>x.price!=='')||additional!==''};
}
