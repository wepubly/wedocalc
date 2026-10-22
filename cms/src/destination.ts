import type {Snapshot} from "./editorial-types";
export function articlePath(s:Pick<Snapshot,"slug"|"destination">):string {
 const d=s.destination;
 return d ? "/"+[d.category.path,d.subcategory.path,d.calculator.path,s.slug].map(p=>p.replace(/^\/+|\/+$/g,"")).join("/")+"/" : "/blog/"+s.slug+"/";
}
