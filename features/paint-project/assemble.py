"""Assemble an offline demo atop the pinned HomeImprovement frontend. No remote operations."""
from pathlib import Path
import subprocess,sys,shutil,re
from specialized.render import INSTANT_ESTIMATE, PAINT_CAN, cards, render
root=Path(__file__).resolve().parents[2]
out=Path(sys.argv[1]).resolve()
subprocess.run([sys.executable,str(root/'migration/homeimprovement/prepare.py'),str(out)],check=True)
feature=root/'features/paint-project';target=out/'site/paint-calculator/project';target.mkdir()
for name in ['math.mjs','materials.mjs','budget.mjs','export.mjs','commercial.mjs','planner.mjs','page-shell.mjs']:shutil.copyfile(feature/name,target/name)
for name in ['planner.css','page-shell.css']:shutil.copyfile(feature/name,target/name)
p=out/'site/paint-calculator/index.html';s=p.read_text()
# Preserve FAQ, metadata, sharing and CMS slots. Reorganize only this calculator's static UI.
s,n=re.subn(r'<section class="mp-calculator-top-slot".*?</section>','',s,count=1,flags=re.S);assert n==1
s=re.sub(r'<style>\s*/\* Critical placement sizing:.*?</style>','',s,count=1,flags=re.S)
s=re.sub(r'<style>\s*/\* Match the approved Paint Calculators background and yellow calculation action\. \*/.*?</style>','',s,count=1,flags=re.S)
crumb=re.search(r'<div class="calc-crumb">.*?</div>',s,re.S).group(0)
intro='<section class="calc-hero"><div class="calc-hero-inner">'+crumb+'<div class="calculator-intro"><p class="intro-eyebrow">Home Improvement Calculators</p><h1>Paint Calculator</h1><p>Calculate paint quickly or plan your entire painting project.</p></div></div></section>'
s,n=re.subn(r'<section class="calc-hero">.*?</section>',lambda _:intro,s,count=1,flags=re.S);assert n==1
s,n=re.subn(r'<aside class="calc-panel calc-related">.*?</aside>','',s,count=1,flags=re.S);assert n==1
s,n=re.subn(r'<section class="calc-panel calc-info"><h2>Tips for Accurate Results</h2>.*?</section>','',s,count=1,flags=re.S);assert n==1
shutil.copytree(feature/'photos',target/'photos')
explore='<section class="paint-explore" aria-labelledby="paint-explore-title"><h2 id="paint-explore-title">Explore More Paint Calculators</h2><p>Find the right tool for every painting project.</p><div class="paint-tools">'+cards()+'</div></section>'
help_card=re.search(r'<section class="calc-panel calc-info"><h2>How Paint Calculation Works</h2>.*?</section>',s,re.S).group(0)
help_card_new=help_card.replace('</section>','<p class="help-summary">For accurate results, measure each surface and deduct openings you will not paint. Use the coverage on your product label, allow for texture and extra coats, and keep paint from the same batch for touch-ups.</p></section>')
s=s.replace(help_card,help_card_new,1)
options=(feature/'mode-selection.html').read_text()
s=s.replace('<div class="calc-top">',options+'\n<div class="calc-top" id="quickPanel" role="region" aria-label="Quick Calculator">',1)
s=s.replace('<h2>Paint Calculator</h2>','<h2 id="quick-title">Quick Paint Calculator</h2>',1)
share='<div id="mp-share" class="mp-share" aria-label="Save or share calculation results"></div>'
assert share in s;s=s.replace(share,share+'<button type="button" class="hi-textlink" data-switch-to="advanced">Continue to Project Planner →</button>',1)
s=s.replace('<div class="calc-bottom">','<section id="advancedPanel" aria-label="Project Planner" hidden>'+(feature/'planner.html').read_text()+'</section>\n'+explore+'\n<div class="calc-bottom">',1)
s=s.replace('</head>','<link rel="stylesheet" href="project/planner.css"><link rel="stylesheet" href="project/page-shell.css">\n</head>',1)
s=s.replace('</body>','<script type="module" src="project/planner.mjs"></script><script type="module" src="project/page-shell.mjs"></script>\n</body>',1)
if 'rel="canonical"' not in s:s=s.replace('</head>','<link rel="canonical" href="https://homeimprovement.tools/paint-calculator/">\n</head>',1)
s=s.replace('Free paint calculator for paint needed, coverage and cost.','Estimate paint needed, coverage and cost, or plan measurements, materials and a budget with the Paint Project Planner.')
s=s.replace('depending on surface and application.</p></details></section>','depending on surface and application.</p></details><details><summary>What can I do in the Project Planner?</summary><p>Use your Paint Needed result or enter room dimensions. Then choose materials, enter your own prices and review the shopping list and budget. You can print the project report or download it in A4 or US Letter format.</p></details></section>')
s=s.replace('value="38" min="0"','min="0" placeholder="Your price"').replace('value="25" min="0"','min="0" placeholder="Your cost"')
# Existing shared cost estimates still open their original panel via ?mode=cost.
s,n=re.subn(r'(<button[^>]*data-mode="cost")',r'\1 hidden',s,count=1);assert n==1
s=s.replace('<div class="calc-tabs"','<p class="paint-cost-link"><a href="/paint-cost-calculator/">Open the dedicated Paint Cost Calculator →</a></p><div class="calc-tabs"',1)
s=s.replace('Estimate paint needed, coverage and cost, or plan measurements, materials and a budget with the Paint Project Planner.','Estimate paint quantity and coverage, or plan measurements, materials and a budget with the Paint Project Planner.')
s,n=re.subn(r'<button[^>]*data-calc-action[^>]*>.*?</button>',lambda _:INSTANT_ESTIMATE,s,flags=re.S)
assert n==3
s,n=re.subn(r'(<div class="calc-answer">)<span class="result-symbol".*?</span>',lambda m:m[1]+PAINT_CAN,s,count=1,flags=re.S)
assert n==1
p.write_text(s)
render(out/'site',s)
p=out/'site/paint-calculator/calculator.js';s=p.read_text();s=s.replace("report=null;\n  $('result-value')","report=null;window.HIPaintPlan=null;if(mode==='needed')window.HILastPaintPlan=null;window.dispatchEvent(new Event('hi:paint-plan'));\n  $('result-value')",1)
s=s.replace('let result,resultLabel,details,explanation,extra=[],modeLabel;','let result,resultLabel,details,explanation,extra=[],modeLabel,planning=null;',1)
s=s.replace('const gallons=(areaSqFt*coats/rate)*(1+waste/100);','planning={areaSqFt,coats,rate,waste};\n    const gallons=(areaSqFt*coats/rate)*(1+waste/100);',1)
s=s.replace("   ['result-value'","   window.HIPaintPlan=planning;if(planning)window.HILastPaintPlan=planning;window.dispatchEvent(new Event('hi:paint-plan'));\n   ['result-value'",1)
s=s.replace(" restore();setAreaMode", ' restore();\n const costTab=tabs.find(tab=>tab.dataset.mode==="cost");\n if(costTab && mode==="cost")costTab.hidden=false;\n setAreaMode',1)
s=s.replace("  report=null;", "  root.querySelector('.paint-result-can').hidden=true;\n  report=null;",1)
s=s.replace("   const labels=mode", "   root.querySelector('.paint-result-can').hidden=mode!=='needed';\n   const labels=mode",1)
p.write_text(s)
subprocess.run([sys.executable,str(root/'features/launch/prepare.py'),str(out)],check=True)
# Demo serves static content only; no D1, R2, runtime bindings or operational CMS.
(out/'demo').mkdir();shutil.copytree(out/'site',out/'demo',dirs_exist_ok=True)
print('Offline demo ready:',out/'demo')
