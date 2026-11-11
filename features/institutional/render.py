"""Render approved institutional copy into an assembled site, locally only.
Usage: python render.py SITE CONTENT.json [--review]
Review mode permits pending pages and adds a conspicuous review banner.
Production mode refuses incomplete/unapproved content.
"""
from pathlib import Path
import json,sys,html,re
site=Path(sys.argv[1]).resolve(); source=Path(sys.argv[2]); review='--review' in sys.argv[3:]
pages=json.loads(source.read_text())
expected=({'about','our-mission','contact','privacy-policy','terms-of-service'} if review else {'about','our-mission','contact'})
assert {p['slug'] for p in pages}==expected
if not review:
 assert all(p.get('approved') is True and not p.get('pending') for p in pages), 'Owner review and factual verification required before publication'
assert (site/'assets/shared-header.js').is_file()
assert (site/'teste2/footer.js').is_file()
for page in pages:
 title=html.escape(page['title']); desc=html.escape(page['description'],quote=True)
 pending=page.get('pending',[])
 banner='<aside class="review-note" role="note"><strong>Draft for review, not a published policy.</strong>'+('<ul>'+''.join('<li>'+html.escape(p)+'</li>' for p in pending)+'</ul>' if pending else '')+'</aside>' if review else ''
 path=site/page['slug'];path.mkdir(exist_ok=True)
 (path/'index.html').write_text(f'''<!doctype html>
<html lang="en-US" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>{title} | HomeImprovement.tools</title><meta name="description" content="{desc}"><link rel="canonical" href="https://homeimprovement.tools/{page['slug']}/"><link rel="stylesheet" href="/css/styles.css"><link rel="stylesheet" href="/css/tokens.css"><link rel="stylesheet" href="/assets/header-brand.css?v=2"><link rel="stylesheet" href="/assets/blog-footer.css?v=4"><link rel="stylesheet" href="/assets/institutional.css"></head>
<body class="hi-institutional" data-hi-shared-footer><a class="skip-link" href="#main-content">Skip to content</a><div id="shared-header" data-variant="inner"></div><main id="main-content"><nav aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">{title}</span></nav>{banner}<article><h1>{title}</h1>{page['body_html']}</article></main><div id="shared-footer"></div><script src="/assets/shared-header.js?v=brand-2" defer></script><script src="/assets/theme.js" defer></script><script src="/teste2/footer.js?v=2" defer></script></body></html>''')
css=Path(__file__).with_name('institutional.css')
(site/'assets/institutional.css').write_text(css.read_text())
footer=site/'teste2/footer.js';text=footer.read_text()
for page in pages:
 label=page['title'];old='<button type=\\"button\\" class=\\"footer-link\\" aria-disabled=\\"true\\" title=\\"Page coming soon\\">'+label+'</button>'
 new='<a class=\\"footer-link\\" href=\\"/'+page['slug']+'/\\">'+label+'</a>'
 assert text.count(old)==1, 'Footer changed: '+label
 text=text.replace(old,new)
footer.write_text(text)
print('Rendered '+str(len(pages))+' institutional pages ('+('REVIEW ONLY' if review else 'approved content')+')')
