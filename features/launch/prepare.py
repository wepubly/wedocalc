"""Narrow launch-readiness changes; never enables indexing or changes CMS data."""
from pathlib import Path
import re,sys,shutil
root=Path(__file__).resolve().parents[2]; out=Path(sys.argv[1]); site=out/'site'
for route,title in [('', 'HomeImprovement — Home Improvement Calculators'),('home-garden','Home & Garden Calculators & Guides | HomeImprovement'),('paint-calculators','Paint Calculators | HomeImprovement')]:
 p=site/route/'index.html';s=p.read_text()
 s=re.sub(r'<title>.*?</title>',lambda m:'<title>'+title+'</title>',s,count=1)
 if 'rel="canonical"' not in s:s=s.replace('</head>','<link rel="canonical" href="https://homeimprovement.tools/'+(route+'/' if route else '')+'"></head>',1)
 p.write_text(s)
# Keep every card, label, class and layout; remove only misleading destinations.
p=site/'index.html';s=p.read_text()
def disable(m):
 a=m.group(0)
 if 'View all categories' in a:return a
 return a.replace(' href="/home-garden/"','').replace('<a ','<a aria-disabled="true" ',1)
s=re.sub(r'<a\b[^>]*href="/home-garden/"[^>]*>.*?</a>',disable,s,flags=re.S)
p.write_text(s)
p=site/'paint-calculator/index.html';s=p.read_text()
def disable_related(m):
 return re.sub(r'\s+href="[^"]+"','',m.group(0)).replace('<a ','<a aria-disabled="true" ',1)
s=re.sub(r'<a\b[^>]*href="(?:\.\./|/)paint-calculators/"[^>]*>.*?</a>',lambda m:disable_related(m) if any(x in m.group(0) for x in ['Paint Cost Calculator','Room Paint Calculator','Ceiling Paint Calculator','Trim Paint Calculator','Exterior Paint Calculator']) else m.group(0),s,flags=re.S)
# Accessible names for all stepper buttons; preserve appearance and behavior.
s=re.sub(r'<button([^>]*data-step="(-?1)"[^>]*)>',lambda m:m.group(0) if 'aria-label=' in m.group(1) else '<button'+m.group(1)+' aria-label="'+('Remove a coat' if m.group(2)=='-1' else 'Add a coat')+'">',s)
# Unit selectors nested alongside inputs need an independent accessible name.
def name_select(m):
 block=m.group(0)
 if '<input' not in block:return block
 label=block.removeprefix('<label>').split('<',1)[0].strip()
 return re.sub(r'<select(?![^>]*aria-label=)',lambda _: '<select aria-label="'+label+' unit"',block)
s=re.sub(r'<label>.*?</label>',name_select,s,flags=re.S)
p.write_text(s)
# Cloudflare Pages uses a root 404 file instead of SPA fallback for absent assets.
(site/'404.html').write_text('''<!doctype html><html lang="en-US" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Page not found | HomeImprovement.tools</title><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/assets/header-brand.css?v=2"><link rel="stylesheet" href="/assets/blog-footer.css?v=4"><style>main{max-width:850px;margin:6rem auto;padding:2rem;font-family:system-ui}main a{color:inherit}</style></head><body data-hi-shared-footer><div id="shared-header" data-variant="inner"></div><main><h1>Page not found</h1><p>This page is not available. You can return home or use our Paint Calculator.</p><p><a href="/">Home</a> · <a href="/paint-calculator/">Paint Calculator</a></p></main><div id="shared-footer"></div><script src="/assets/shared-header.js?v=brand-2" defer></script><script src="/assets/theme.js" defer></script><script src="/teste2/footer.js?v=2" defer></script></body></html>''')
# Apply one light page surface to static pages and to the public editorial renderer.
background_link = '<link rel="stylesheet" href="/assets/page-background.css">'
shutil.copyfile(root/'features/launch/page-background.css', site/'assets/page-background.css')
for page in site.rglob('*.html'):
    html = page.read_text()
    page.write_text(html.replace('</head>', background_link + '</head>', 1))
editorial_renderer = out/'cms/worker/production-render.ts'
html = editorial_renderer.read_text()
assert '</head>' in html
editorial_renderer.write_text(html.replace('</head>', background_link + '</head>', 1))
shutil.copyfile(root/'features/launch/sitemap.mjs',out/'cms/worker/homeimprovement-sitemap.mjs')
print('Launch preparation applied; robots and noindex unchanged')

worker=out/"cms/worker/homeimprovement-validation.ts"
w=worker.read_text().replace("import pages from './pages';", "import pages from './pages';\n// @ts-ignore: pure helper covered by behavior tests.\nimport {sitemapFromPublished} from './homeimprovement-sitemap.mjs';")
w=w.replace("  let response=await pages.fetch(request,env);","  if(url.pathname==='/sitemap.xml'){\n   const source=await production.fetch(new Request('https://homeimprovement.tools/sitemap-blog.xml'),env);\n   if(!source.ok)return new Response('Sitemap temporarily unavailable',{status:503,headers:{'X-Robots-Tag':'noindex,nofollow,noarchive'}});\n   try { const xml=sitemapFromPublished(await source.text());return new Response(request.method==='HEAD'?null:xml,{headers:{'Content-Type':'application/xml; charset=utf-8','X-Robots-Tag':'noindex,nofollow,noarchive','Cache-Control':'no-store'}}); }\n   catch{return new Response('Sitemap temporarily unavailable',{status:503,headers:{'X-Robots-Tag':'noindex,nofollow,noarchive'}});}\n  }\n"+"  let response=await pages.fetch(request,env);")
worker.write_text(w)
# CMS scheduling: visible confirmation, local feedback and verified queue persistence.
p=out/'cms/src/AdminApp.tsx';s=p.read_text()
s=s.replace('  const [reviewer, setReviewer]', '  const [scheduleConfirm,setScheduleConfirm]=useState(false);\n  const [reviewer, setReviewer]',1)
s=s.replace('    setCurrent(row);','    setCurrent(row);setScheduleConfirm(false);',1)
s=s.replace('    setDirty(true);','    setDirty(true);setScheduleConfirm(false);',1)
s,n=re.subn(r'                        <details>\s*<summary>Agendar versão salva</summary>.*?</details>',lambda m:(root/'features/launch/schedule-panel.txt').read_text().rstrip(),s,count=1,flags=re.S)
assert n==1,'Schedule panel not found'
p.write_text(s)
