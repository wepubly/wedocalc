"""Assemble an isolated local copy. No network, deploy, provisioning or D1 writes."""
from pathlib import Path
import subprocess, tarfile, io, json, sys, re
root=Path(__file__).resolve().parents[2]
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'homeimprovement-prepared'
if out.exists(): raise SystemExit('Refusing to overwrite an existing output directory')
public='3ba04d587568812621ead97287d0d1d98f5693f1'
cms='7225ec0545cc4602ffec5ca3de30e8ae12ddca82'
out.mkdir(parents=True)
def archive(ref,paths,dest):
 data=subprocess.check_output(['git','archive',ref,*paths],cwd=root)
 with tarfile.open(fileobj=io.BytesIO(data)) as tar: tar.extractall(dest,filter='data')
archive(public,['index.html','teste2','css','assets','home-garden','paint-calculators','paint-calculator','print','_headers'],out/'site')
archive(cms,['cms'],out)
# Operational scripts target the old environment; exclude them from the isolated package.
import shutil
shutil.rmtree(out/'cms/scripts')
# Brand only the copied CMS; preserve the uploaded PNG bytes and original CMS branch.
admin=out/'cms/src/AdminApp.tsx'
a=admin.read_text().replace('Metricpedia','HomeImprovement')
old='<strong style={{fontSize:24}}>HomeImprovement</strong>'
assert old in a,'CMS brand header changed; inspect before replacing'
a=a.replace(old,'<span className="hi-cms-brand"><img src="/admin-assets/homeimprovement-logo.png" alt="HomeImprovement" width="1772" height="1772" /></span>',1)
admin.write_text(a)
with (out/'cms/src/admin.css').open('a') as f:
 f.write('\n/* Official uploaded PNG, displayed on white in both themes. CSS trims transparent margins only. */\n.hi-cms-brand{display:block;position:relative;width:160px;height:104px;overflow:hidden;background:#fff;border-radius:6px;flex-shrink:0}\n.hi-cms-brand img{position:absolute;width:176px;height:176px;max-width:none;left:-10px;top:-34px}\n')
shutil.copyfile(root/'migration/homeimprovement/assets/homeimprovement-logo.png',out/'cms/public/homeimprovement-logo.png')

for p in (out/'site').rglob('*'):
 if p.is_file() and p.suffix in ['.html','.js','.css','.xml','.txt']:
  s=p.read_text(); s=s.replace('metricpedia.com','homeimprovement.tools').replace('Metricpedia.com','homeimprovement.tools').replace('wedocalc.com','homeimprovement.tools').replace('Metricpedia','HomeImprovement')
  p.write_text(s)
with (out/'site/_headers').open('a') as f:f.write('\n/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n')
(out/'site/robots.txt').write_text('User-agent: *\nDisallow: /\n')
shutil.copyfile(root/'migration/homeimprovement/validation.ts',out/'cms/worker/homeimprovement-validation.ts')
shutil.copyfile(root/'migration/homeimprovement/cards-catalog.mjs',out/'cms/worker/homeimprovement-cards.mjs')
# Adapt only the article slots in the copied front end.
home=out/'site/index.html'; text=home.read_text()
if 'id="guides"' not in text:
 text=text.replace('</main>','<section id="guides" class="content"><h2>Ideas, Tips &amp; Guides</h2><div class="guides-grid" data-hi-cards="home"></div></section></main>',1)

logo_before='<a class="new-logo" href="/" aria-label="HomeImprovement home"><img class="light-logo" src="/teste2/assets/logo-light.png?v=3" alt="HomeImprovement"><img class="dark-logo" src="/teste2/assets/logo-dark.png?v=3" alt="HomeImprovement"></a>'
logo_after='<a class="new-logo homeimprovement-logo" href="/" aria-label="HomeImprovement.tools home"><img class="light-logo" src="/teste2/assets/homeimprovement-logo-light.webp" alt="" width="640" height="359"><img class="dark-logo" src="/teste2/assets/homeimprovement-logo-dark.webp" alt="" width="640" height="359"></a>'
assert text.count(logo_before)==1
text=text.replace(logo_before,logo_after).replace('/teste2/page.css?v=15','/teste2/page.css?v=16').replace('/teste2/footer.js?v=1','/teste2/footer.js?v=2')
css=out/'site/teste2/page.css'
with css.open('a') as f:f.write('\n.teste2 .hero-copy .homeimprovement-logo img{max-height:156px}\n')
footer=out/'site/teste2/footer.js'
footer_before='src=\\"/teste2/assets/logo-dark.png?v=3\\" alt=\\"HomeImprovement\\" width=\\"260\\" height=\\"70\\"'
footer_after='src=\\"/teste2/assets/homeimprovement-logo-dark.webp\\" alt=\\"HomeImprovement.tools\\" width=\\"640\\" height=\\"359\\"'
footer_script=footer.read_text()
assert footer_script.count(footer_before)==1
footer.write_text(footer_script.replace(footer_before,footer_after))
for logo in (root/'migration/homeimprovement/assets').glob('homeimprovement-logo-*.webp'):
 shutil.copyfile(logo,out/'site/teste2/assets'/logo.name)
text,removed=re.subn(r'<section class="tools-showcase"[^>]*>.*?</section>', '', text, flags=re.S)
assert removed==1, 'Expected one calculator preview section on the homepage'
home.write_text(text)

# Apply the same wordmark to the shared tools header and the public blog header.
brand_assets=root/'migration/homeimprovement/assets'
for name in ['header-logo-light.webp','header-logo-dark.webp','header-brand.css','blog-footer.css']:
 shutil.copyfile(brand_assets/name,out/'site/assets'/name)
brand_css='<link rel="stylesheet" href="/assets/header-brand.css?v=2">'
brand_link='<a class="hi-header-brand" href="/" aria-label="HomeImprovement.tools home">' + ''.join(
 f'<img class="hi-header-brand-{theme}" src="/assets/header-logo-{theme}.webp" alt="" width="640" height="{height}">'
 for theme,height in [('light',78),('dark',75)]
) + '</a>'
header=out/'site/assets/shared-header.js'
script=header.read_text()
old_brand='<a class="compact-brand" href="../" aria-label="HomeImprovement home"><strong>HomeImprovement</strong></a>'
assert script.count(old_brand)==1
header.write_text(script.replace(old_brand,brand_link).replace("const root=inner?'../':'';", "const root='/';"))
for route in ['home-garden','paint-calculators','paint-calculator']:
 page=out/'site'/route/'index.html'
 html=page.read_text()
 assert html.count('../assets/shared-header.js')==1
 assert html.count('../assets/shared-footer.js')==1
 html=html.replace('../assets/shared-footer.js','/teste2/footer.js?v=2')
 html=re.sub(r'<body([^>]*)>',lambda m:'<body'+m.group(1)+' data-hi-shared-footer>',html,count=1)
 page.write_text(html.replace('</head>',brand_css+'<link rel="stylesheet" href="/assets/blog-footer.css?v=2"></head>',1).replace('../assets/shared-header.js','/assets/shared-header.js?v=brand-2'))
blog=out/'cms/worker/production-render.ts'
template=blog.read_text()
blog_header, replacements=re.subn(
 r'<header><a href="/" aria-label="Metricpedia home">.*?</header>',
 '<div id="shared-header" data-variant="inner"></div>', template, count=1
)
assert replacements==1
blog_theme, replacements=re.subn(
 r"<script>const t=localStorage.getItem\('metricpedia-theme'\);.*?</script>",
 '<script src="/assets/shared-header.js?v=brand-2" defer></script><script src="/assets/theme.js" defer></script>',
 blog_header, count=1
)
assert replacements==1
blog_css='<link rel="stylesheet" href="/css/tokens.css">'+brand_css
# Reuse the home footer verbatim; only scoped CSS is added to blog pages.
old_footer='<footer>Metricpedia · Powered by <a href="https://wepubly.com">WePubly</a></footer>'
assert blog_theme.count(old_footer)==1
blog_theme=blog_theme.replace(old_footer,'<div id="shared-footer"></div><script src="/teste2/footer.js?v=2" defer></script>',1)
blog_css+='<link rel="stylesheet" href="/assets/blog-footer.css?v=2">'
blog.write_text(blog_theme.replace('body.dark','html[data-theme="dark"] body')
 .replace('</style>${extra}','</style>'+blog_css+'${extra}',1)
 .replace('<body>${preview','<body class="hi-blog">${preview',1))

category=out/'site/paint-calculators/index.html';text=category.read_text()
text,n=re.subn(r'<aside class="paint-guides">.*?</aside>','<aside class="paint-guides"><h2>Paint Guides &amp; Tips</h2><div data-hi-cards="category"></div></aside>',text,count=1,flags=re.S)
assert n==1,'Category article slot changed; inspect before preparing'
category.write_text(text)
calculator=out/'site/paint-calculator/index.html';text=calculator.read_text()
text,n=re.subn(r'<section class="calc-panel calc-info"><h2>Popular Paint Guides</h2>.*?</section>','<section class="calc-panel calc-info"><h2>Popular Paint Guides</h2><div data-hi-cards="calculator"></div></section>',text,count=1,flags=re.S)
assert n==1,'Calculator article slot changed; inspect before preparing'
calculator.write_text(text)

for name in ['build-local.mjs','configure-isolated.mjs','wrangler.template.json','pages.target.template.json']:
 shutil.copyfile(root/'migration/homeimprovement'/name,out/'cms'/name)
config=json.loads((root/'migration/homeimprovement/wrangler.template.json').read_text())
(out/'cms/wrangler.homeimprovement.template.json').write_text(json.dumps(config,indent=2)+'\n')
(out/'SOURCE-REFS.json').write_text(json.dumps({'public':public,'cms':cms,'cardsCandidate':'2c252b7e8d0234ca8df571a866ad97cff1cc4986','deployedWorkerVersion':'dda5078a-3413-4f91-9f02-e39ad362df43','productionPagesDeployment':'08983672-ebdc-47a3-b4b7-f246cb9d22be','status':'LOCAL PREPARATION ONLY; no data copied; cards adapted locally; remote validation pending'},indent=2))
print(out)
