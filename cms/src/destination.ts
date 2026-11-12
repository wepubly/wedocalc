import type {Snapshot} from "./editorial-types";
export function articlePath(s:Pick<Snapshot,"slug"|"destination">):string {
 const d=s.destination;
 return d ? "/"+[d.category.path,d.subcategory.path,d.calculator.path,s.slug].map(p=>p.replace(/^\/+|\/+$/g,"")).join("/")+"/" : "/blog/"+s.slug+"/";
}
export interface DestinationRoute {id:string;kind:string;name:string;path:string;parent_id:string|null;state:string}
export function selectDestination(routes:DestinationRoute[],draft:Snapshot):Snapshot {
 const live=routes.filter(r=>r.state==='live');
 const choose=(options:DestinationRoute[],id?:string)=>options.find(r=>r.id===id);
 const category=choose(live.filter(r=>r.kind==='category'),draft.categoryId);
 const subcategory=choose(live.filter(r=>r.kind==='subcategory'&&r.parent_id===category?.id),draft.subcategoryId);
 const calculator=choose(live.filter(r=>r.kind==='calculator'&&r.parent_id===subcategory?.id),draft.calculatorId);
 return {...draft,categoryId:category?.id||'',category:category?.name||'',subcategoryId:subcategory?.id||'',calculatorId:calculator?.id||'',destination:category&&subcategory&&calculator?{category,subcategory,calculator}:undefined};
}
