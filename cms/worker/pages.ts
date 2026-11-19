import production from './production';
import type {Env} from './types';
export default {fetch(request:Request,env:Env){
 const url=new URL(request.url),p=url.pathname;
 const aliases:Record<string,string>={'/home-garden/paint-calculators':'/paint-calculators/','/home-garden/paint-calculators/paint-calculator':'/paint-calculator/'};
 const destination=aliases[p.replace(/\/$/,'')];
 if(destination)return Response.redirect(url.origin+destination+url.search,308);
 if(p.startsWith('/admin')||p==='/cms'||p==='/cms/'||p.startsWith('/api/editorial/')||p==='/api/public/latest-articles'||p.startsWith('/blog')||p.startsWith('/media/')||p==='/feed.xml'||p==='/sitemap-blog.xml'||/^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/?(?:\.md)?$/.test(p))return production.fetch(request,env);
 return env.ASSETS.fetch(request);
}};
