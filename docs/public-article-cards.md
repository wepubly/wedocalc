# Metricpedia — public article cards (preview only)

## Inspection and scope

Production CMS stores immutable snapshots in D1 `article_versions`; `articles.published_version` selects the publicly served snapshot. The existing `publicArticles()` reads that pointer, not draft/review/scheduling state. Destination snapshots contain category, subcategory and calculator; public URLs encode their paths. No editorial ordering field exists: public catalogue order is descending publication date.

`GET /api/public/latest-articles` exposes only six items and omits subcategory: insufficient for nine home cards or a full category listing. `GET /blog/` already renders the **complete public catalogue** with real title, excerpt, cover, alt, category label and hierarchical URL. The integration reads this existing public HTML with Cloudflare HTMLRewriter. It never requests the editorial API, opens a database, or alters content. Malformed/external/legacy URLs without calculator destinations are excluded rather than inventing associations. `/blog/` is a read contract; a future CMS blog markup change must update parser tests.

All three original sections were static placeholders. They are now annotated with reusable `data-article-scope` and destination path attributes. Existing styles, headings and surrounding markup are retained. No CSS changes. Home advertising `HOME-GUIDES-01` remains the ninth cell in its original column and its exact original markup is retained. Fewer than nine real articles produce fewer editorial cards without replacing the advertising slot with content.

## Selection and public HTML

- Calculator: first four articles matching category + subcategory + calculator paths, in existing publication order. No rotation here.
- Category/subcategory: five articles, round-robin calculator groups before repeating. The Paint page filters both `home-garden` and `paint-calculators`.
- Home: nine articles, round-robin categories, then calculators within each category.
- Stable deterministic ranking changes daily at midnight in Brasília. No client-side reshuffle, tracking, cookies or per-article requests.
- A source-cache miss makes **one public GET** to `/blog/`. Edge cache TTL is 60 seconds, with no stale fallback. Publication/withdrawal can take up to 60 seconds to appear/disappear. HTML uses the current cached catalogue and a stable daily seed. It contains real anchor links and escaped text, available without JavaScript.
- Zero publications or failed source: no fake cards. Existing sections retain their heading and (where applicable) an empty state; the home ad remains intact.
- Full category listings: `/guides/?category=home-garden&subcategory=paint-calculators`; general listing `/guides/`. They use the same full catalogue and existing card design. Article links and media use the production origin; canonical and editorial metadata are never changed.
- Additional calculator/category pages reuse the same markers with their own destination paths; only Paint Calculator currently exists as a working calculator page in this repository.

## Shared-runtime impact, before any production integration

Production static Pages and CMS share an advanced-mode `_worker.js`. Deploying only static assets to production would overwrite that runtime. **This branch does not run that production workflow, does not bundle/deploy the CMS, and does not modify its worker or configuration.**

The new worker is strictly a **preview entry point**, with public rendering only. The existing Pages project's preview environment is reused; no project, domain, database, bucket or cron is created. Existing preview bindings, if inherited by Pages, are never used. `/admin` redirects to the official CMS; mutations cannot be forwarded by this preview. No configuration PATCH is executed.

A production release requires owner approval and a reviewed public-only composition with the existing Pages dispatcher, preserving its CMS handler unchanged. This is a documented integration point, **not authorization to deploy or replace that shared runtime**. Preview `noindex` and its preview-only redirects must not be copied as the production dispatcher. Existing production noindex and canonical decisions are outside this mission.

## Validation and deployment guard

`tests/public-cards.mjs` uses local fixtures only, with Miniflare's native HTMLRewriter. It checks complete-source parsing, calculator isolation/order/limits, 5/9 counts, diversity, daily stability/variation, escaping, empty/error states, cache reads, complete filtered listings, ad placement and read-only boundaries. Chromium checks desktop/mobile HTML layout and actual card image dimensions. No fixtures are created in the operational CMS.

Workflow `article-cards-preview.yml` runs only on `work/metricpedia-public-article-cards`, deploys to the **existing Pages preview branch**, and records/verifies the unchanged production deployment ID. It copies public assets only, excludes admin/CMS, and never calls the CMS workflow or cron. Existing `main` and CMS workflows are untouched. Guard reads Cloudflare Pages deployment metadata with GET and checks the official CMS still responds.

Live production may have zero articles or articles from only one calculator; fixture coverage of multiple categories does not claim that real content already exists. Bot-created drafts and scheduled content remain private and are not used to fill preview spaces.

## Changed components

- `index.html`, `paint-calculator/index.html`, `paint-calculators/index.html`: replace placeholder sections with public-rendering markers and listing links.
- `public-cards/catalog.mjs`: parser, validation, stable selection and existing card markup.
- `public-cards/worker.mjs`: preview-only server rendering and public listings.
- `public-cards/preview-guard.mjs`: preview/production verification using GET only.
- `public-cards/package*.json`, `tests/public-cards.mjs`: isolated build/test tooling.
- `.github/workflows/article-cards-preview.yml`: isolated preview pipeline.
- `.gitignore`: generated build/dependency files only.

CMS code, database schemas, data, article snapshots, approvals, schedules, cron, administrative layout and production deployment are not modified.
