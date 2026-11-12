"""Render four static calculator pages using the approved Paint Calculator shell."""
from html import escape
from pathlib import Path
import re
import shutil
from urllib.parse import urljoin

from .content import TOOLS

FEATURE = Path(__file__).resolve().parent
ORIGIN = 'https://homeimprovement.tools'


INSTANT_ESTIMATE = """<div class="instant-estimate">
  <span class="instant-estimate-icon" aria-hidden="true">
    <svg width="34" height="34" viewBox="0 0 32 32" fill="currentColor" focusable="false">
      <path d="M18 2 8 17h7l-1 13 11-16h-8z"/>
      <path d="m3 9 4 3-1 2-4-3zm24 4 4-3 1 2-4 3zM2 23l4-3 1 2-4 3zm25-3 4 3-1 2-4-3z"/>
    </svg>
  </span>
  <span><strong>Instant estimate</strong><span>Results update as you type.</span></span>
</div>"""


PAINT_CAN = """<svg class="paint-result-can" viewBox="0 0 48 48" width="36" height="36" aria-hidden="true" focusable="false" hidden>
  <defs><linearGradient id="paint-can-steel">
    <stop stop-color="#61768a"/><stop offset=".25" stop-color="#e9f2f9"/>
    <stop offset=".54" stop-color="#b6c6d4"/><stop offset=".76" stop-color="#f4f8fb"/>
    <stop offset="1" stop-color="#7b91a4"/>
  </linearGradient></defs>
  <path d="M9 13v25c0 4 30 4 30 0V13z" fill="url(#paint-can-steel)" stroke="#526a80" stroke-width="1.4"/>
  <ellipse cx="24" cy="13" rx="16" ry="5" fill="url(#paint-can-steel)" stroke="#526a80" stroke-width="1.4"/>
  <ellipse cx="24" cy="12" rx="12" ry="2.5" fill="none" stroke="#eef6fc" stroke-width="1.4"/>
  <path d="M8 20c-6 0 1 14 16 14s22-14 16-14" fill="none" stroke="#566e84" stroke-width="2"/>
  <path d="M21 34h6" stroke="#344f68" stroke-width="3" stroke-linecap="round"/>
</svg>"""


def cards(exclude=None):
    result = []
    for key, slug, name, description, *_ in TOOLS:
        photo = f'/paint-calculator/project/photos/{key}.webp'
        if key == exclude:
            slug, name = 'paint-calculator', 'Paint Calculator'
            description = 'Estimate paint quantity and coverage, or plan your entire painting project.'
            photo = '/assets/category-covers/01-painting-walls.webp'
        result.append(f'''<article class="paint-tool-card">
  <img src="{photo}" alt="" width="512" height="280" loading="lazy" decoding="async">
  <div><h3>{escape(name)}</h3><p>{escape(description)}</p>
    <a class="paint-tool-action" href="/{slug}/" aria-label="Open {escape(name)}">Open Calculator</a>
  </div>
</article>''')
    result.append("""<article class="paint-tool-card">
  <img src="/paint-calculator/project/photos/interior-wall.webp" alt="" width="512" height="280" loading="lazy" decoding="async">
  <div><h3>Interior Wall Paint Calculator</h3><p>Estimate paint for individual interior walls.</p>
    <span class="paint-tool-unavailable">Coming Soon</span>
  </div>
</article>""")
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
        if key == 'room':
            fields_html += '<label class="room-ceiling"><input type="checkbox" name="ceiling"> Include the ceiling with the same paint</label>'
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
          {INSTANT_ESTIMATE}
        </form>
      </section>
      <section class="calc-panel calc-results" aria-labelledby="results-title">
        <h2 id="results-title">Results</h2>
        <p>{result_label}</p>
        <div class="calc-answer">{PAINT_CAN}<strong id="specialized-result" aria-live="polite">—</strong></div>
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
