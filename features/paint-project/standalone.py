"""Package the isolated static demo as one offline HTML. Does not change deployable site files."""
from pathlib import Path
import re,sys,base64,mimetypes
from urllib.parse import urlsplit
root=Path(sys.argv[1]).resolve();page=root/'paint-calculator/index.html';s=page.read_text()
def local(url,base):
 p=urlsplit(url).path
 return (root/p.lstrip('/')).resolve() if p.startswith('/') else (base/p).resolve()
def data(path):
 raw=path.read_bytes();mime=mimetypes.guess_type(path.name)[0]
 if not mime:
  mime='image/png' if raw.startswith(b'\x89PNG') else 'image/webp' if raw[8:12]==b'WEBP' else 'image/jpeg'
 return 'data:'+mime+';base64,'+base64.b64encode(raw).decode()
def sheet(match):
 path=local(match[1],page.parent);css=path.read_text()
 def replace_url(m):
  url=m[1].strip("\"'")
  if url.startswith('data:'):return m[0]
  if url.startswith('http'):return 'none' # the removed hero's legacy image rule is inactive
  path2=local(url,path.parent)
  return 'url("'+data(path2)+'")' if path2.is_file() else 'none'
 css=re.sub(r'url\(([^)]+)\)',replace_url,css)
 return '<style>'+css+'</style>'
s=re.sub(r'<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>',sheet,s)
s=re.sub(r'<img\b[^>]*src="([^"]+)"[^>]*>',lambda m:m[0].replace(m[1],data(local(m[1],page.parent))) if not m[1].startswith('http') else m[0],s)
def script(match):
 path=local(match[1],page.parent);code=path.read_text()
 if path.name=='calculator.js':
  code=code.replace("printPreviewUrl:'../print/paint-calculator/'",'printPreviewUrl:null')
  code=code.replace("return location.origin+location.pathname+'?'", "return 'https://homeimprovement.tools/paint-calculator/'+'?'")
 return '<script>'+code.replace('</script','<\\/script')+'</script>'
# Inline the existing scripts, preserving their execution order. ES module imports are bundled below.
s=re.sub(r'<script type="module" src="[^"]+"></script>','',s)
s=re.sub(r'<script\b[^>]*src="([^"]+)"[^>]*></script>',script,s)
bundle=[]
for name in ['math.mjs','materials.mjs','budget.mjs','export.mjs','planner.mjs','page-shell.mjs']:
 code=(root/'paint-calculator/project'/name).read_text()
 code=re.sub(r'^import .*?;\s*$', '',code,flags=re.M)
 code=re.sub(r'\bexport (?=(?:const|function))','',code)
 bundle.append(code)
cleanup="""
// In this downloadable demo, links outside this document open the corresponding public page.
for(const a of document.querySelectorAll('a[href]')){const href=a.getAttribute('href');if(href&&!href.startsWith('#')&&!href.startsWith('data:')){a.href=new URL(href,'https://homeimprovement.tools/paint-calculator/').href;}}
for(const el of document.querySelectorAll('[data-switch-to="quick"]'))el.addEventListener('click',()=>document.getElementById('hi-project-print')?.remove());
"""
s=s.replace('</body>','<script>\n'+('\n'.join(bundle)+cleanup).replace('</script','<\\/script')+'\n</script></body>')
output=Path(sys.argv[2]);output.parent.mkdir(parents=True,exist_ok=True);output.write_text(s)
print('Standalone demo:',output,'bytes',output.stat().st_size)
