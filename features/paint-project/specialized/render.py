"""Render four static calculator pages using the approved Paint Calculator shell."""
from html import escape
from pathlib import Path
import re
import shutil
from urllib.parse import urljoin

from .content import TOOLS

FEATURE = Path(__file__).resolve().parent
ORIGIN = 'https://homeimprovement.tools'


def cards(exclude=None):
    result = []
    for key, slug, name, description, *_ in TOOLS:
        if key == exclude:
            continue
        result.append(f'''<article class="paint-tool-card">
  <img src="/paint-calculator/project/photos/{key}.webp" alt="" width="512" height="280" loading="lazy" decoding="async">
  <div><h3>{escape(name)}</h3><p>{escape(description)}</p>
    <a class="paint-tool-action" href="/{slug}/" aria-label="Open {escape(name)}">Open Calculator</a>
  </div>
</article>''')
    return ''.join(result)


def render(site, source):
    project = site/'paint-calculator/project/specialized'
    project.mkdir()
    for file in ('engine.mjs', 'ui.mjs', 'style.css'):
        shutil.copyfile(FEATURE/file, project/file)

    links = []
    for href in re.findall(r'<link rel="stylesheet" href="([^"]+)">', source):
        if href.endswith(('planner.css', 'results-sharing.css')) or '/ad-slots.css' in href:
            continue
        links.append(f'<link rel="stylesheet" href="{escape(urljoin("/paint-calculator/", href))}">')
    header = re.search(r'<div id="shared-header"[^>]*></div>', source).group()
    footer = re.search(r'<div id="shared-footer"></div>', source).group()
    shell_scripts = ''.join(
        re.findall(r'<script src="[^"]*(?:shared-header\.js|theme\.js|footer\.js)[^"]*" defer></script>', source)
    )
    for key, slug, name, description, fields, explanation, faq in TOOLS:
        directory = site/slug
        directory.mkdir()
        fields_html = ''.join(
            f'<label for="{field}">{escape(label)}'
            f'<input id="{field}" name="{field}" type="number" inputmode="decimal" '
            f'value="{default}" min="{minimum}" max="{maximum}" step="{step}" required></label>'
            for field, label, default, minimum, maximum, step in fields
        )
        questions = ''.join(f'<details><summary>{escape(question)}</summary><p>{escape(answer)}</p></details>'
                            for question, answer in faq)
        result_label = 'Estimated project cost' if key == 'cost' else 'Estimated paint needed'
        related = cards(exclude=key)
        (directory/'index.html').write_text(f'''<!doctype html>
<html lang="en-US" data-theme="light"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{name} | HomeImprovement.tools</title>
<meta name="description" content="{escape(description)}">
<link rel="canonical" href="{ORIGIN}/{slug}/">
{''.join(links)}
<link rel="stylesheet" href="/paint-calculator/project/specialized/style.css">
</head>
<body class="category-page calculator-page specialized-paint" data-hi-shared-footer>
{header}
<main>
  <section class="calc-hero"><div class="calc-hero-inner">
    <nav class="calc-crumb" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">›</span>
      <a href="/paint-calculator/">Paint Calculator</a><span aria-hidden="true">›</span>
      <span aria-current="page">{name}</span>
    </nav>
    <div class="calculator-intro"><h1>{name}</h1><p>{escape(description)}</p></div>
  </div></section>
  <div class="calc-shell">
    <section class="calculator-options" aria-label="Calculator modes">
      <div class="calculator-option active">
        <span class="option-copy"><span class="option-title">Quick Calculator</span>
        <span class="option-description">Enter your project details for an instant estimate.</span></span>
      </div>
      <button class="calculator-option" type="button" disabled>
        <span class="option-copy"><span class="option-title">Project Planner <span class="option-tag">Advanced</span></span>
        <span class="option-description">Coming Soon</span></span>
      </button>
    </section>
    <div class="calc-top">
      <section class="calc-panel calc-workspace" aria-labelledby="quick-title">
        <h2 id="quick-title">Quick Calculator</h2>
        <form id="specialized-form" data-kind="{key}">
          <div class="calc-fields specialized-fields">{fields_html}</div>
          <button class="calc-submit" type="submit">Calculate Estimate</button>
        </form>
      </section>
      <section class="calc-panel calc-results" aria-labelledby="results-title">
        <h2 id="results-title">Results</h2>
        <p>{result_label}</p>
        <div class="calc-answer"><strong id="specialized-result" aria-live="polite">—</strong></div>
        <div id="specialized-details" class="calc-result-breakdown"></div>
        <p id="specialized-error" class="specialized-error" role="status"></p>
        <button id="specialized-print" class="paint-tool-action" type="button" disabled>Print Results</button>
      </section>
    </div>
    <section class="calc-panel specialized-explanation"><h2>How the estimate works</h2>
      <p>{escape(explanation)}</p><p><a href="/paint-calculator/">Back to the main Paint Calculator</a></p>
    </section>
    <section class="paint-explore"><h2>Explore More Paint Calculators</h2><div class="paint-tools">{related}</div></section>
    <section class="calc-panel calc-faq"><h2>Frequently Asked Questions</h2>{questions}</section>
  </div>
</main>
{footer}
{shell_scripts}
<script type="module" src="/paint-calculator/project/specialized/ui.mjs"></script>
</body></html>''')
