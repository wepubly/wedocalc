from pathlib import Path
from html.parser import HTMLParser
import sys,json
site=Path(sys.argv[1]);pages=json.loads(Path(sys.argv[2]).read_text())
class Page(HTMLParser):
 def __init__(self): super().__init__();self.ids=[];self.assets=[];self.h1=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='h1':self.h1+=1
  if tag=='script' and a.get('src','').startswith('/'):self.assets.append(a['src'])
  if tag=='link' and a.get('rel')=='stylesheet':self.assets.append(a['href'])
for page in pages:
 text=(site/page['slug']/'index.html').read_text();p=Page();p.feed(text)
 assert p.h1==1
 assert len(p.ids)==len(set(p.ids))
 assert 'noindex,nofollow' in text
 assert 'data-hi-shared-footer' in text
 assert all((site/a.split('?')[0].lstrip('/')).is_file() for a in p.assets),p.assets
 assert 'Metricpedia' not in text and 'Ublong' not in text
 assert text.count('id="shared-header"')==1 and text.count('id="shared-footer"')==1
footer=(site/'teste2/footer.js').read_text()
for page in pages:assert '/'+page['slug']+'/' in footer
print('PASS: '+str(len(pages))+' pages, headings, IDs, shared assets, footer links and noindex preservation')
