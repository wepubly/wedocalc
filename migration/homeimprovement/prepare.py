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
home.write_text(text)
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
