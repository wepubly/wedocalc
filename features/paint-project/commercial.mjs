// Empty by default; editorial recommendations require real reviewed products and a disclosure.
export const recommendations=[];
export function approvedLinks(items){return items.filter(item=>item.reviewed===true&&item.disclosure&&/^https:\/\//.test(item.href)).map(item=>({...item,rel:item.affiliate?'sponsored noopener':'noopener'}));}
