"""Assemble an offline demo atop the pinned HomeImprovement frontend. No remote operations."""
from pathlib import Path
import subprocess,sys,shutil
root=Path(__file__).resolve().parents[2]
out=Path(sys.argv[1]).resolve()
subprocess.run([sys.executable,str(root/'migration/homeimprovement/prepare.py'),str(out)],check=True)
feature=root/'features/paint-project';target=out/'site/paint-calculator/project';target.mkdir()
for p in feature.glob('*.mjs'):shutil.copyfile(p,target/p.name)
shutil.copyfile(feature/'planner.css',target/'planner.css')
p=out/'site/paint-calculator/index.html';s=p.read_text();s=s.replace('<div class="calc-bottom">',(feature/'planner.html').read_text()+'\n<div class="calc-bottom">',1)
s=s.replace('</head>','<link rel="stylesheet" href="project/planner.css">\n</head>',1)
s=s.replace('</body>','<script type="module" src="project/planner.mjs"></script>\n</body>',1)
if 'rel="canonical"' not in s:s=s.replace('</head>','<link rel="canonical" href="https://homeimprovement.tools/paint-calculator/">\n</head>',1)
s=s.replace('value="38" min="0"','min="0" placeholder="Your price"').replace('value="25" min="0"','min="0" placeholder="Your cost"')
p.write_text(s)
p=out/'site/paint-calculator/calculator.js';s=p.read_text();s=s.replace("report=null;\n  $('result-value')","report=null;window.HIPaintPlan=null;window.dispatchEvent(new Event('hi:paint-plan'));\n  $('result-value')",1)
s=s.replace('let result,resultLabel,details,explanation,extra=[],modeLabel;','let result,resultLabel,details,explanation,extra=[],modeLabel,planning=null;',1)
s=s.replace('const gallons=(areaSqFt*coats/rate)*(1+waste/100);','planning={areaSqFt,coats,rate,waste};\n    const gallons=(areaSqFt*coats/rate)*(1+waste/100);',1)
s=s.replace("   ['result-value'","   window.HIPaintPlan=planning;window.dispatchEvent(new Event('hi:paint-plan'));\n   ['result-value'",1)
p.write_text(s)
# Demo serves static content only; no D1, R2, runtime bindings or operational CMS.
(out/'demo').mkdir();shutil.copytree(out/'site',out/'demo',dirs_exist_ok=True)
print('Offline demo ready:',out/'demo')
