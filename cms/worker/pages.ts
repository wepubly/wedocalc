import production from './production';
import type {Env} from './types';
export default {fetch(request:Request,env:Env){
 const p=new URL(request.url).pathname;
 if(p.startsWith('/admin')||p==='/cms'||p==='/cms/'||p.startsWith('/api/editorial/')||p==='/api/public/latest-articles'||p.startsWith('/blog')||p.startsWith('/media/')||p==='/feed.xml'||p==='/sitemap-blog.xml'||/^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/?(?:\.md)?$/.test(p))return production.fetch(request,env);
 return env.ASSETS.fetch(request);
}};
