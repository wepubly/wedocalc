import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {sitemapFromPublished,readyPaths} from './sitemap.mjs';
const origin='https://homeimprovement.tools';
test('Sitemap includes ready pages plus published painting articles only',()=>{const xml=sitemapFromPublished(`<urlset><url><loc>${origin}/blog/</loc></url><url><loc>${origin}/home-garden/paint-calculators/paint-calculator/test-guide/</loc><lastmod>2026-11-12</lastmod></url><url><loc>https://evil.invalid/home-garden/paint-calculators/paint-calculator/test-guide/</loc></url><url><loc>${origin}/admin</loc></url><url><loc>${origin}/privacy-policy/</loc></url></urlset>`);assert.equal((xml.match(/<url>/g)||[]).length,readyPaths.length+1);assert.ok(xml.includes('<lastmod>2026-11-12</lastmod>'));assert.ok(!xml.includes('evil.invalid'));assert.ok(!xml.includes('/admin'));assert.ok(!xml.includes('privacy-policy'));assert.ok(!xml.includes('terms-of-service'));});
test('Fail closed if published sitemap unavailable',()=>assert.throws(()=>sitemapFromPublished('<html>fallback</html>')));
if(process.env.SITE){const site=process.env.SITE;const text=p=>readFileSync(site+p,'utf8');
test('Public indexing enabled while CMS and previews remain private',()=>{
 const robots=text('/robots.txt');
 assert.ok(robots.startsWith('User-agent: *\n'));
 assert.doesNotMatch(robots,/^Disallow: \/$/m);
 assert.match(robots,/^Sitemap: https:\/\/homeimprovement\.tools\/sitemap\.xml$/m);
 for(const p of ['/index.html','/home-garden/index.html','/paint-calculator/index.html','/paint-cost-calculator/index.html','/about/index.html']){
  assert.match(text(p),/name="robots" content="index, follow, max-image-preview:large"/,p);
  assert.doesNotMatch(text(p),/noindex/i,p);
 }
 for(const p of ['/404.html','/teste2/index.html','/print/paint-calculator/index.html'])assert.match(text(p),/name="robots" content="noindex/i,p);
 const headers=text('/_headers');assert.doesNotMatch(headers,/^\/\*\s*\n\s*X-Robots-Tag: noindex/m);
 assert.match(headers,/^\/admin\*/m);
 const validator=readFileSync(site+'/../cms/worker/homeimprovement-validation.ts','utf8');
 assert.match(validator,/headers\.delete\('X-Robots-Tag'\)/);
 assert.match(validator,/privatePath\|\|response\.status>=400/);
 assert.doesNotMatch(validator,/Site noindex/);
});
test('Real 404 asset; canonical metadata and no preview titles',()=>{assert.match(text('/404.html'),/<h1>Page not found/);for(const p of ['/index.html','/home-garden/index.html']){assert.match(text(p),/rel="canonical"/);assert.doesNotMatch(text(p),/<title>[^<]*Visual Preview/);}});
test('Cards preserved with missing-tool destinations removed',()=>{assert.match(text('/index.html'),/Concrete slab size/);assert.match(text('/index.html'),/Flooring cost/);assert.equal((text('/index.html').match(/href="\/home-garden\/"/g)||[]).length,1);assert.match(text('/index.html'),/href="\/paint-calculator\/"/);assert.match(text('/paint-calculator/index.html'),/Paint Cost Calculator/);assert.doesNotMatch(text('/paint-calculator/index.html'),/<a[^>]+href="[^\"]*paint-calculators\/"[^>]*>\s*(?:<[^>]*>)*Paint Cost Calculator/);});}

if(process.env.SITE)test('Retired hub is omitted and Painting & Walls opens the calculator',()=>{
 const site=process.env.SITE;
 assert.equal(existsSync(site+'/paint-calculators/index.html'),false);
 const home=readFileSync(site+'/index.html','utf8');
 assert.match(home,/<a[^>]+href="\/paint-calculator\/"[^>]*>[^<]*<img[^>]+alt="Painting &amp; Walls"/);
 assert.equal(readyPaths.includes('/paint-calculators/'),false);
});


if(process.env.SITE)test('GA4 ID is deployed exactly once per public page and excluded from CMS previews',()=>{
 const site=process.env.SITE,html=p=>readFileSync(site+p,'utf8');
 const loader=html('/assets/ga4.js');
 assert.match(loader,/G-ZK02VZNHE7/);
 assert.match(loader,/location\.hostname !== 'homeimprovement\.tools'/);
 assert.match(loader,/__hiGa4Initialized/);
 for(const path of ['/index.html','/paint-calculator/index.html','/paint-cost-calculator/index.html','/home-garden/index.html','/about/index.html']){
  assert.equal((html(path).match(/src="\/assets\/ga4\.js"/g)||[]).length,1,path);
 }
 for(const path of ['/404.html','/print/paint-calculator/index.html','/teste2/index.html'])
  assert.doesNotMatch(html(path),/src="\/assets\/ga4\.js"/,path);
 const cms=readFileSync(site+'/../cms/worker/production-render.ts','utf8');
 assert.ok(cms.includes('${preview ? "" : '),'Public-only CMS conditional missing');
 assert.ok(cms.includes('<script src="/assets/ga4.js" defer></script>'));
});


if(process.env.SITE)test('Mobile blog cards prioritize first cover and lazy-load all below, without indexing regression',()=>{
 const root=process.env.SITE+'/../cms/worker/';
 const production=readFileSync(root+'production.ts','utf8');
 const validator=readFileSync(root+'homeimprovement-validation.ts','utf8');
 assert.match(production,/list\.map\(\(r,i\)=>/);
 assert.ok(production.includes('width="480" height="270"'));
 assert.ok(production.includes('/cdn-cgi/image/width=480,quality=75,format=auto/media/${r.data.coverId}'),'Blog thumbnails must use image transformations');
 assert.equal(production.split('/cdn-cgi/image/width=480,quality=75,format=auto/media/${r.data.coverId}').length-1,1,'Only blog cards should use the transformed image URL');
 assert.ok(production.includes('loading="${i===0?\'eager\':\'lazy\'}"'));
 assert.ok(production.includes('fetchpriority="${i===0?\'high\':\'low\'}"'));
 assert.match(validator,/isPublicHost=url\.hostname===\'homeimprovement\.tools\'/);
 assert.match(validator,/publishedMedia=/);
 assert.match(validator,/max-age=86400/);
 assert.match(validator,/else headers\.set\('Cache-Control','no-store'\)/);
 assert.match(validator,/privatePath\|\|response\.status>=400/);
 assert.match(readFileSync(process.env.SITE+'/robots.txt','utf8'),/Sitemap: https:\/\/homeimprovement\.tools\/sitemap\.xml/);
});


if(process.env.SITE)test('Blog/article CSS inlined in original order without render-blocking screen stylesheets',()=>{
 const root=process.env.SITE+'/../cms/worker/';
 const source=readFileSync(root+'production-render.ts','utf8');
 for(const [label,href] of [
  ['tokens','/css/tokens.css'],
  ['brand','/assets/header-brand.css?v=2'],
  ['footer','/assets/blog-footer.css?v=5'],
  ['page','/assets/page-background.css']
 ]){
  assert.equal(source.split('data-hi-critical-css="'+label+'"').length-1,1,label);
  assert.ok(source.includes('href="'+href+'" media="print"'),'Expected print-only link '+href);
  assert.ok(!source.includes('href="'+href+'">'),'Unexpected render-blocking link '+href);
 }
});


if(process.env.SITE)test('Public article LCP images use Cloudflare responsive covers with canonical SEO image preserved',()=>{
 const src=readFileSync(process.env.SITE+'/../cms/worker/production-render.ts','utf8');
 assert.ok(src.includes("'/cdn-cgi/image/width=960,quality=75,format=auto'+image"));
 assert.ok(src.includes('[480,960,1280].map(w=>'));
 assert.ok(src.includes('image&&!preview'));
 assert.ok(src.includes('src="${coverUrl}"${coverSrcset}'));
 assert.ok(src.includes('image:origin+image'),'Structured data must retain canonical original image URL');
 assert.ok(src.includes('href="/admin"')===false || !src.includes('/cdn-cgi/image/width=960,quality=75,format=auto/api/editorial/media/'));
});
if(process.env.SITE)test('Home category responsive images and inlined CSS preserve layout and SEO',()=>{
 const html=readFileSync(process.env.SITE+'/index.html','utf8');
 const imgs=[...html.matchAll(/src="(\/cdn-cgi\/image\/width=400,quality=70,format=auto\/assets\/category-covers\/[a-z0-9-]+\.webp)"[^>]*srcset="([^"]+)"[^>]*sizes="([^"]+)"/g)];
 assert.ok(imgs.length>=10,'Expected optimized public category images');
 for(const m of imgs){
  assert.match(m[2],/width=200,quality=70,format=auto/);
  assert.match(m[2],/width=640,quality=70,format=auto/);
  assert.match(m[3],/45vw/);
 }
 for(const label of ['base','tokens','ads','background','footer'])
  assert.equal(html.split('data-hi-home-css="'+label+'"').length-1,1,'Missing critical CSS '+label);
 assert.equal((html.match(/media="print"/g)||[]).length,5);
 assert.match(html,/<link rel="stylesheet" href="\/teste2\/page\.css\?v=16">/);
 assert.match(html,/<link rel="canonical" href="https:\/\/homeimprovement\.tools\/"/);
 assert.match(html,/<meta name="robots" content="index, follow, max-image-preview:large"/);
 assert.match(html,/src="\/assets\/ga4\.js"/);
 assert.match(html,/id="guides"/);
});


if(process.env.SITE)test('Ceiling Paint Calculator inlines safe CSS without changing its engine and keeps image-URL stylesheets',()=>{
 const html=readFileSync(process.env.SITE+'/ceiling-paint-calculator/index.html','utf8');
 for(const name of ['base','tokens','brand','footer','shell','special','background'])
  assert.equal(html.split('data-hi-ceiling-css="'+name+'"').length-1,1,'Missing inlined ceiling CSS: '+name);
 assert.equal((html.match(/media="print"/g)||[]).length,7);
 assert.match(html,/<link rel="stylesheet" href="\/home-garden\/category\.css">/);
 assert.match(html,/<link rel="stylesheet" href="\/paint-calculator\/calculator\.css">/);
 assert.match(html,/<script type="module" src="\/paint-calculator\/project\/specialized\/ui\.mjs"><\/script>/);
 assert.match(html,/<link rel="canonical" href="https:\/\/homeimprovement\.tools\/ceiling-paint-calculator\/">/);
 assert.match(html,/G-ZK02VZNHE7/);
 assert.match(html,/id="specialized-form"/);
 const other=readFileSync(process.env.SITE+'/room-paint-calculator/index.html','utf8');
 assert.doesNotMatch(other,/data-hi-ceiling-css/);
});
