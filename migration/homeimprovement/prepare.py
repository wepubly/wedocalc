"""Assemble an isolated local copy. No network, deploy, provisioning or D1 writes."""
from pathlib import Path
import subprocess, tarfile, io, json, sys
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
  s=p.read_text(); s=s.replace('https://metricpedia.com','https://homeimprovement.tools').replace('https://wedocalc.com','https://homeimprovement.tools')
  p.write_text(s)
with (out/'site/_headers').open('a') as f:f.write('\n/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n')
(out/'site/robots.txt').write_text('User-agent: *\nDisallow: /\n')
shutil.copyfile(root/'migration/homeimprovement/validation.ts',out/'cms/worker/homeimprovement-validation.ts')
config=json.loads((root/'migration/homeimprovement/wrangler.template.json').read_text())
(out/'cms/wrangler.homeimprovement.template.json').write_text(json.dumps(config,indent=2)+'\n')
(out/'SOURCE-REFS.json').write_text(json.dumps({'public':public,'cms':cms,'cardsCandidate':'2c252b7e8d0234ca8df571a866ad97cff1cc4986','deployedWorkerVersion':'dda5078a-3413-4f91-9f02-e39ad362df43','productionPagesDeployment':'08983672-ebdc-47a3-b4b7-f246cb9d22be','status':'LOCAL PREPARATION ONLY; no data copied; cards integration pending'},indent=2))
print(out)
