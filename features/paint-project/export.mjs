// Original, dependency-free, paginated PDF writer using the standard Helvetica font.
const winExtras={'€':128,'‘':145,'’':146,'“':147,'”':148,'–':150,'—':151,'•':149,'×':215,'²':178};
export const unsupported=lines=>lines.some(line=>[...line.text].some(c=>c.codePointAt(0)>255&&!(c in winExtras)));
function hex(text){return [...text].map(c=>(winExtras[c]??c.charCodeAt(0)).toString(16).padStart(2,'0')).join('');}
// Conservative Helvetica width estimates prevent long names from leaving the page.
function textWidth(text,size){return [...text].reduce((sum,c)=>sum+size*(c==='@'?1.02:/[WMÆæ]/.test(c)?.98:/[mw]/.test(c)?.9:/[A-Z]/.test(c)?.8:/[ ilI.,:;!'`|]/.test(c)?.33:c.charCodeAt(0)>127?.9:.65),0);}
function wrap(text,maxWidth,size){
 const lines=[];let line='';
 for(let word of String(text).replace(/[\r\n]+/g,' ').split(/\s+/)){
  if(textWidth((line?line+' ':'')+word,size)>maxWidth&&line){lines.push(line);line='';}
  while(textWidth(word,size)>maxWidth){let cut=1;while(cut<word.length&&textWidth(word.slice(0,cut+1),size)<=maxWidth)cut++;lines.push(word.slice(0,cut));word=word.slice(cut);}
  line+=(line?' ':'')+word;
 }
 if(line)lines.push(line);return lines.length?lines:[''];
}
export function pdf(lines,format='Letter'){
 if(unsupported(lines))throw Error('For names or materials outside the Latin character set, use Print and Save as PDF.');
 const [width,height]=format==='A4'?[595.28,841.89]:[612,792],margin=44,lineHeight=15;
 const pages=[];let page=[],y=height-margin;
 for(const row of lines){const size=row.heading?15:10;const max=width-2*margin;for(const text of wrap(row.text,max,size)){if(y<margin+30){pages.push(page);page=[];y=height-margin;}page.push(`BT /F1 ${size} Tf 1 0 0 1 ${margin} ${y} Tm <${hex(text)}> Tj ET`);y-=row.heading?23:lineHeight;}y-=row.heading?3:1;}
 if(page.length)pages.push(page);
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];const ids=[];
 pages.forEach((commands,i)=>{const pageId=objects.length,streamId=pageId+1;ids.push(pageId);objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);const footer=`BT /F1 9 Tf 1 0 0 1 ${margin} 28 Tm <${hex('HomeImprovement.tools | Page '+(i+1)+' of '+pages.length)}> Tj ET`;const stream=['0.12 0.16 0.22 rg',...commands,footer].join('\n');objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);});
 objects[2]=`<< /Type /Pages /Kids [${ids.map(id=>id+' 0 R').join(' ')}] /Count ${pages.length} >>`;
 let out='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets.push(out.length);out+=`${i} 0 obj\n${objects[i]}\nendobj\n`;}
 const xref=out.length;out+=`xref\n0 ${objects.length}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return new TextEncoder().encode(out);
}
export function reportLines({name,result,inventory,list,budget,measurements,date=new Date()}){
 const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:3}),money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
 const metric=result.units==='metric',area=n=>fmt(n/(metric?10.763910416709722:1))+(metric?' m²':' sq ft'),volume=n=>fmt(n*(metric?3.785411784:1))+(metric?' L':' US gal');
 const lines=[];const add=(text,heading=false)=>lines.push({text:String(text),heading});
 add('HomeImprovement.tools | Paint Project Report',true);add(name||'Untitled painting project');add('Generated '+date.toLocaleString('en-US'));add('Your measurements and quotes only. Not a supplier quote.');
 add('Measurements and assumptions',true);for(const [key,value] of measurements)add(key+': '+value);
 add('Gross wall / supplied net area: '+area(result.gross));add('Openings deducted: '+area(result.deduction));add('Net walls / supplied paintable area: '+area(result.net));add('Separate ceiling: '+area(result.ceiling));
 add('Wall paint: '+volume(result.wallPaint)+'; ceiling paint: '+volume(result.ceilingPaint)+'; primer: '+volume(result.primer));
 add('Wall coats: '+result.coats+'; allowance: '+result.waste+'%; coverage: '+fmt(metric?result.rate/(10.763910416709722*3.785411784):result.rate)+(metric?' m²/L':' sq ft/US gal'));
 add('Ceiling coats: '+result.ceilingCoats+'; primer coats: '+result.primerCoats);add('Ceiling coverage: '+fmt(metric?result.ceilingRate/(10.763910416709722*3.785411784):result.ceilingRate)+(metric?' m²/L':' sq ft/US gal')+'; primer coverage: '+fmt(metric?result.primerRate/(10.763910416709722*3.785411784):result.primerRate)+(metric?' m²/L':' sq ft/US gal'));
 add('Inventory (including excluded and already-owned items)',true);
 for(const item of inventory){add(`${item.name}: ${fmt(item.quantity)} ${item.unit} | ${item.group} | ${item.selected?'Included':'Excluded'} | ${item.owned?'Already owned':'To buy'}`);add('Unit price entered: '+(item.price===''?'Not quoted':money(Number(item.price)))+'. '+(item.note||'User-added material.'));}
 add('Shopping list',true);for(const item of list)add(`${item.name}: ${fmt(item.quantity)} ${item.unit}${item.owned?' (already owned; excluded from budget)':''}`);if(!list.length)add('No materials to buy.');
 add('Budget from user-entered prices',true);for(const item of budget.lines)add(`${item.name}: ${fmt(item.quantity)} × ${item.price===''?'Not quoted':money(Number(item.price))} = ${item.subtotal===null?'Not quoted':money(item.subtotal)}`);
 add('Known materials subtotal: '+(budget.hasPrices?money(budget.known):'Not quoted'));add('Additional costs: '+money(budget.additional)+'; contingency: '+fmt(budget.percent)+'% ('+money(budget.contingency)+')');
 add((budget.complete?'Estimated total: ':'Incomplete budget - known subtotal with extras: ')+(budget.hasPrices?money(budget.total):'Not quoted'));add('Missing unit prices: '+budget.missing+'. No labor, tax or delivery unless entered by you.');
 add('Methodology',true);add('Rectangular walls: 2 × (length + width) × height. Deduct measured openings. Each coating: net area × coats / label coverage × (1 + allowance/100). Round each coating up separately to container size.');add('Accessory quantities are editable planning allowances. Confirm product coverage, surface condition and package sizes. No supplier prices or product endorsements are supplied.');return lines;
}
