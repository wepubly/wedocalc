"""Assemble launch assets and public indexing rules without changing CMS data."""
from pathlib import Path
import re,sys,shutil
root=Path(__file__).resolve().parents[2]; out=Path(sys.argv[1]); site=out/'site'
for route,title in [('', 'HomeImprovement — Home Improvement Calculators'),('home-garden','Home & Garden Calculators & Guides | HomeImprovement')]:
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
# Retire the redundant hub and point all public navigation directly to the tool.
shutil.rmtree(site/'paint-calculators')
for page in site.rglob('*.html'):
    html = page.read_text()
    html = html.replace('<a href="../paint-calculators/">Paint Calculators</a><span>›</span>', '')
    html = re.sub(r'href="(?:https://homeimprovement\.tools|\.\.)?/paint-calculators/?"',
                  'href="/paint-calculator/"', html)
    page.write_text(html)
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
print('Launch base preparation applied; public indexing rules are applied after branding')

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

# Keep the same Company navigation and footer styles on the home and inner pages.
footer = site/'teste2/footer.js'
markup = footer.read_text()
markup, count = re.subn(r'<div class=\\"socials\\"[^>]*>.*?</div>', '', markup, count=1, flags=re.S)
assert count == 1
for title in ('Categories', 'Popular Tools', 'Resources'):
    markup, count = re.subn(
        r'<div class=\\"footer-column\\"><h3>'+title+r'</h3>.*?</div>',
        '', markup, count=1, flags=re.S)
    assert count == 1, title
footer.write_text(markup)
for page in [*site.rglob('*.html'), out/'cms/worker/production-render.ts']:
    html = page.read_text()
    if 'id="shared-footer"' not in html:
        continue
    html = html.replace('/teste2/footer.js?v=2', '/teste2/footer.js?v=3')
    html = html.replace('/assets/blog-footer.css?v=4', '/assets/blog-footer.css?v=5')
    if '/assets/blog-footer.css?v=5' not in html:
        html = html.replace('</head>', '<link rel="stylesheet" href="/assets/blog-footer.css?v=5"></head>', 1)
    if 'data-hi-shared-footer' not in html and 'class="hi-blog"' not in html:
        html = re.sub(r'<body\b', '<body data-hi-shared-footer', html, count=1)
    page.write_text(html)

# Approved public indexing release (2026-11-19). Keep CMS, previews and 404 private.
# The Cloudflare environment remains "staging" because the editorial cron and
# publication guard rely on that value; only the public robots directives change.
private_html = {'404.html', 'teste2/index.html', 'print/paint-calculator/index.html'}
public_meta_count = 0
for page in site.rglob('*.html'):
    if page.relative_to(site).as_posix() in private_html:
        continue
    html = page.read_text()
    cleaned, changed = re.subn(r'<meta\s+name="robots"\s+content="noindex,\s*nofollow"\s*/?>',
                               '<meta name="robots" content="index, follow, max-image-preview:large">',
                               html, count=1, flags=re.I)
    if changed:
        page.write_text(cleaned)
        public_meta_count += changed
assert public_meta_count >= 10, 'Expected public pages with former noindex meta directives'

headers_file = site/'_headers'
headers_text = headers_file.read_text()
global_block = '\n/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n'
assert headers_text.count(global_block) == 1, 'Unexpected global X-Robots-Tag policy'
headers_file.write_text(headers_text.replace(global_block,
    '\n/admin*\n  X-Robots-Tag: noindex, nofollow, noarchive\n'
    '/cms*\n  X-Robots-Tag: noindex, nofollow, noarchive\n'
    '/api/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n'
    '/print/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n'
    '/teste2/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n'))
(site/'robots.txt').write_text(
    'User-agent: *\n'
    'Disallow: /admin/\nDisallow: /cms/\nDisallow: /api/\n'
    'Disallow: /print/\nDisallow: /teste2/\n'
    'Sitemap: https://homeimprovement.tools/sitemap.xml\n')

validator_path = out/'cms/worker/homeimprovement-validation.ts'
validator = validator_path.read_text()
def replace_one(previous, updated):
    global validator
    assert validator.count(previous) == 1, f'Indexing guard not found: {previous[:65]}'
    validator = validator.replace(previous, updated, 1)

replace_one("    'X-Robots-Tag':'noindex,nofollow,noarchive',\n    'Cache-Control':'no-store',",
            "    'Cache-Control':'no-store',")  # Retired hub: 308 redirects may be followed.
replace_one("if(url.pathname==='/robots.txt')return new Response('User-agent: *\\nDisallow: /\\n',{headers:{'Content-Type':'text/plain','X-Robots-Tag':'noindex,nofollow,noarchive'}});",
            "if(url.pathname==='/robots.txt')return new Response('User-agent: *\\nDisallow: /admin/\\nDisallow: /cms/\\nDisallow: /api/\\nDisallow: /print/\\nDisallow: /teste2/\\nSitemap: https://homeimprovement.tools/sitemap.xml\\n',{headers:{'Content-Type':'text/plain; charset=utf-8'}});")
replace_one("'Content-Type':'application/xml; charset=utf-8','X-Robots-Tag':'noindex,nofollow,noarchive','Cache-Control':'no-store'",
            "'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-store'")
assert validator.count('Site noindex.') == 2, 'Expected two CMS status notices'
validator = validator.replace('Site noindex.', 'Páginas públicas liberadas à indexação; CMS privado.')
replace_one("  headers.set('X-Robots-Tag','noindex, nofollow, noarchive');headers.set('Cache-Control','no-store');",
            "  const privatePath=/^\\/(?:admin|cms|api|print|teste2)(?:\\/|$)/.test(url.pathname);\n"
            "  if(privatePath||response.status>=400)headers.set('X-Robots-Tag','noindex, nofollow, noarchive');\n"
            "  else headers.delete('X-Robots-Tag');\n"
            "  headers.set('Cache-Control','no-store');")
validator_path.write_text(validator)
print(f'Public indexing release prepared: {public_meta_count} static meta tags updated, CMS/private guards retained')


# GA4 Measurement installation for public HomeImprovement pages (2026-11-19).
# Lazy-load only on canonical production origin; isolated tests and previews
# do not call Google. The shared public CMS renderer includes article pages.
ga4_id='G-ZK02VZNHE7'
ga4_loader='''(function(){
  'use strict';
  if (location.hostname !== 'homeimprovement.tools') return;
  if (/^\\/(?:admin|cms|api|teste2|print)(?:\\/|$)/.test(location.pathname)) return;
  if (window.__hiGa4Initialized) return;
  window.__hiGa4Initialized = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-ZK02VZNHE7');
  var tag = document.createElement('script');
  tag.async = true;
  tag.src = 'https://www.googletagmanager.com/gtag/js?id=G-ZK02VZNHE7';
  document.head.appendChild(tag);
})();
'''
assert ga4_loader.count(ga4_id) == 2
(site/'assets/ga4.js').write_text(ga4_loader)
ga4_injection='<script src="/assets/ga4.js" defer></script>'
static_ga4_count=0
for page in site.rglob('*.html'):
    relative=page.relative_to(site).as_posix()
    if relative in private_html or relative.startswith(('admin/','cms/','print/','teste2/')):
        continue
    html=page.read_text()
    if '<meta name="robots" content="index, follow, max-image-preview:large">' not in html:
        continue
    assert ga4_injection not in html and html.count('</head>')==1, relative
    page.write_text(html.replace('</head>',ga4_injection+'</head>',1))
    static_ga4_count+=1
assert static_ga4_count>=10, 'GA4 public HTML list smaller than expected'
renderer=out/'cms/worker/production-render.ts'
source=renderer.read_text()
assert source.count('</head><body>')==1, 'Unexpected CMS page template; refuse GA4 mutation'
assert ga4_injection not in source, 'CMS renderer already has GA4 loader'
# Preview pages share the CMS template but must not be tracked.
source=source.replace('</head><body>',
    '${preview ? "" : ' + "'" + ga4_injection + "'" + '}</head><body>',1)
renderer.write_text(source)
print('Prepared GA4 measurement on',static_ga4_count,'public HTML pages and CMS articles; private previews excluded')
