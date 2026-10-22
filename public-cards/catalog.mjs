// Read only the complete, already-public catalogue. No editorial API or storage binding.
export const PUBLIC_ORIGIN = 'https://metricpedia.com';
export const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const decode=value=>String(value||'').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|#39);/gi,(_,v)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v.toLowerCase()]));
export function normalize(row) {
 row={...row,...Object.fromEntries(['title','description','category','alt'].map(k=>[k,decode(row[k])]))};
 const url=new URL(row.href,PUBLIC_ORIGIN);
 const parts=url.pathname.split('/').filter(Boolean);
 if(url.origin!==PUBLIC_ORIGIN || parts.length!==4 || !parts.every(p=>/^[a-z0-9-]+$/.test(p)) || !row.title?.trim())return null;
 const image=row.image ? new URL(row.image,PUBLIC_ORIGIN) : null;
 if(image && (image.origin!==PUBLIC_ORIGIN || !/^\/media\/[a-f0-9-]+$/.test(image.pathname)))return null;
 return {...row,href:url.href,image:image?.href||'',categoryId:parts[0],subcategoryId:parts[1],calculatorId:parts[2],category:(row.category||'').split(' · ')[0].trim()||parts[0],title:row.title.trim(),description:(row.description||'').trim()};
}
export async function readCatalog(response, Rewriter=HTMLRewriter) {
 if(!response.ok || !response.headers.get('content-type')?.includes('text/html'))throw Error('Public catalogue unavailable');
 const rows=[];let current;
 const reader=new Rewriter()
  .on('a.blog-card',{element(e){current={href:e.getAttribute('href'),title:'',category:'',description:'',image:'',alt:''};rows.push(current);}})
  .on('a.blog-card img',{element(e){current.image=e.getAttribute('src');current.alt=e.getAttribute('alt')||'';}})
  .on('a.blog-card h2',{text(t){current.title+=t.text;}})
  .on('a.blog-card .blog-card-category',{text(t){current.category+=t.text;}})
  .on('a.blog-card .blog-card-body > p:not(.blog-card-category)',{text(t){current.description+=t.text;}});
 await reader.transform(response).text();
 return [...new Map(rows.map(normalize).filter(Boolean).map(r=>[r.href,r])).values()];
}
export const rotationDay = (now=Date.now()) => Math.floor((now-3*3600000)/86400000);
function hash(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const rank=(rows,seed)=>[...rows].sort((a,b)=>hash(seed+a.href)-hash(seed+b.href)||a.href.localeCompare(b.href));
// Round-robin categories, then calculators within each category before repeating.
export function balanced(rows,limit,seed){
 const categories=new Map();
 for(const a of rank(rows,String(seed))){if(!categories.has(a.categoryId))categories.set(a.categoryId,new Map());const calculators=categories.get(a.categoryId);if(!calculators.has(a.calculatorId))calculators.set(a.calculatorId,[]);calculators.get(a.calculatorId).push(a);}
 const queues=[...categories.values()].map(calculators=>{const groups=[...calculators.values()],out=[];while(groups.some(g=>g.length))for(const g of groups)if(g.length)out.push(g.shift());return out;});
 const result=[];while(result.length<limit&&queues.some(q=>q.length))for(const q of queues){if(q.length)result.push(q.shift());if(result.length===limit)break;}return result;
}
export function select(rows,{kind,categoryId,subcategoryId,calculatorId},seed=rotationDay()){
 const matching=rows.filter(a=>(!categoryId||a.categoryId===categoryId)&&(!subcategoryId||a.subcategoryId===subcategoryId)&&(!calculatorId||a.calculatorId===calculatorId));
 // Catalogue order is the current editorial/publication order. Do not rotate calculator guides.
 return kind==='calculator'?matching.slice(0,4):balanced(matching,kind==='home'?9:5,seed);
}
export function card(a,kind){const img=a.image?`<img src="${escape(a.image)}" alt="${escape(a.alt)}" loading="lazy">`:'';
 if(kind==='calculator')return `<a class="related-item" href="${escape(a.href)}">${img}<span><b>${escape(a.title)}</b><small>${escape(a.description)}</small></span><i aria-hidden="true">›</i></a>`;
 if(kind==='category')return `<a class="paint-guide" style="color:inherit;text-decoration:none" href="${escape(a.href)}">${img}<div><h3>${escape(a.title)}</h3><p>${escape(a.description)}</p></div></a>`;
 return `<article class="guide card"><a style="display:flex;flex:1;flex-direction:column;color:inherit;text-decoration:none" href="${escape(a.href)}"><div class="guide-image">${img}<span data-kind="guide">${escape(a.category)}</span></div><div class="guide-copy"><h3>${escape(a.title)}</h3><p>${escape(a.description)}</p></div></a></article>`;
}
export function homeColumns(rows,ad){const cards=rows.map(a=>card(a,'home'));const slots=Array.from({length:10},(_,i)=>i===8?ad:cards[i<8?i:i-1]||'<div aria-hidden="true" data-empty-guide-slot style="visibility:hidden"></div>');return Array.from({length:5},(_,i)=>`<div class="guide-column">${slots[2*i]}${slots[2*i+1]}</div>`).join('');}
