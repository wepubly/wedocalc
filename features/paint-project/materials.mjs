import {packages} from './math.mjs';
export function recommendations(r,{mask=true,repair=false}={}){
 const metric=r.units==='metric',unit=metric?'L':'US gal',size=metric?r.packageSize*3.785411784:r.packageSize;
 const rows=[];
 const add=(id,name,quantity,unit,group,note,selected=true)=>rows.push({id,name,quantity,unit,group,note,selected,owned:false,price:'',custom:false});
 const paint=(id,name,volume)=>{if(volume>0)add(id,name,packages(volume,r.packageSize),`${Number(size.toFixed(4))} ${unit} container`,'Consumable','Rounded up separately for each coating. Confirm actual can sizes and coverage.');};
 paint('paint',r.kind==='exterior'?'Exterior wall paint':'Interior wall paint',r.wallPaint);paint('ceiling','Ceiling paint',r.ceilingPaint);paint('primer','Primer',r.primer);
 if(r.paint>0){
  add('roller','Roller frame and suitable cover',1,'set','Reusable tool','One working set; choose nap for the surface. Covers are replaceable consumables.');
  add('brush','Cut-in paint brush',1,'brush','Reusable tool','Choose a brush compatible with the coating.');
  add('tray','Paint tray',1,'tray','Reusable tool','One tray per active painter.');
  add('stir','Paint stir sticks',packages(r.wallPaint,r.packageSize)+packages(r.ceilingPaint,r.packageSize)+packages(r.primer,r.packageSize),'stick','Consumable','Planning allowance of one per container; suppliers may include these.');
  if(mask){add('tape',"Painter's tape",Math.max(1,Math.ceil((r.perimeter?2*r.perimeter:90)/180)), '180 ft roll','Optional','Rough masking allowance: twice the room perimeter. Measure edges and openings; adjust roll count.');add('cloth','Drop cloths',Math.max(1,Math.ceil((r.floor||120)/120)),'9 × 12 ft cloth','Reusable tool','Conservative 120 sq ft planning area per cloth. Allow overlap; verify furniture and access.');}
  if(r.height>=9||r.ceiling)add('pole','Extension pole',1,'pole','Optional','Consider for tall walls or ceilings; select compatible equipment.');
  if(repair){add('sandpaper','Sandpaper',1,'pack','Consumable','Choose grit and quantity for the actual repair area.');add('spackle','Surface-appropriate patching compound',1,'container','Consumable','Optional minor-repair allowance; product must suit interior/exterior substrate.');add('knife','Putty knife',1,'knife','Reusable tool','For patching only.');}
 }
 return rows;
}
export function reconcile(suggested,previous){const byId=new Map(previous.map(x=>[x.id,x]));return [...suggested.map(x=>{const old=byId.get(x.id);return old?{...x,selected:old.selected,owned:old.owned,price:old.unit!==x.unit?'':old.price,...(old.overridden?{quantity:old.quantity,overridden:true}:{})}:x;}),...previous.filter(x=>x.custom)];}
export function shopping(items,includeOwned=false){return items.filter(x=>x.selected&&x.quantity>0&&(includeOwned||!x.owned));}
