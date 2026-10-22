import { Snapshot } from "./types";
import { bodyHtml, escape } from "./markdown";
export { bodyHtml, escape };
const css = `:root{color-scheme:light;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--bg:#F1F7FF;--panel:#f8f8f7;--text:#1a191b;--muted:#76717b;--line:rgba(38,38,42,.12);--accent:#0053ff}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);min-height:100vh}body.dark{color-scheme:dark;--bg:#0e1116;--panel:#1b202a;--text:#f6f7fa;--muted:#aab4c4;--line:#39445a;--accent:#0053ff}header,main,footer{max-width:1000px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;gap:20px;border-bottom:1px solid var(--line)}a{color:inherit}a:hover{color:var(--accent)}nav{display:flex;align-items:center;gap:20px}.logo{width:130px;height:auto;display:block}.logo-dark{display:none}body.dark .logo-light{display:none}body.dark .logo-dark{display:block}h1{font-family:Georgia,serif;font-size:clamp(32px,6vw,52px);line-height:1.15}article{margin:24px 0;padding-bottom:24px}p,li{line-height:1.8}blockquote{border-left:3px solid var(--accent);padding-left:20px;margin:24px 0}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid var(--line);padding:10px;text-align:left}pre{overflow-x:auto;padding:16px;background:var(--panel);border-radius:10px}nav.breadcrumb{flex-wrap:wrap;gap:8px;font-size:14px}.sources,.related{margin:32px 0}img.cover{height:auto;width:100%;max-height:460px;object-fit:cover;border-radius:16px}.meta{color:var(--muted)}.card{border-bottom:1px solid var(--line)}footer{border-top:1px solid var(--line);color:var(--muted)}.preview{background:#ffe9aa;color:#30250c;padding:15px}button{padding:8px 12px;border:1px solid var(--line);border-radius:8px;color:var(--text);background:var(--panel);cursor:pointer}button:hover{border-color:var(--accent)}a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}.blog-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;margin:32px 0 48px}.blog-card{display:flex;flex-direction:column;min-width:0;text-decoration:none;color:var(--text);background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;transition:transform .18s,border-color .18s,box-shadow .18s}.blog-card:hover{transform:translateY(-3px);border-color:var(--accent);box-shadow:0 10px 25px rgba(0,0,0,.12);color:var(--text)}.blog-card-cover{width:100%;aspect-ratio:16/9;background:var(--bg);overflow:hidden}.blog-card-cover img{display:block;width:100%;height:100%;object-fit:cover}.blog-card-placeholder{width:100%;height:100%;display:grid;place-items:center;background:linear-gradient(145deg,var(--panel),var(--bg));color:var(--muted);font-weight:700;letter-spacing:.1em}.blog-card-body{display:flex;flex-direction:column;flex:1;padding:18px}.blog-card-category{margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}.blog-card h2{font-size:20px;line-height:1.3;margin:0 0 10px}.blog-card-excerpt{font-size:13px;line-height:1.55;margin:0 0 20px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.blog-card time{margin-top:auto;font-size:12px;color:var(--muted)}@media(max-width:760px){.blog-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.blog-card-body{padding:14px}.blog-card h2{font-size:17px}}@media(max-width:450px){.blog-grid{grid-template-columns:1fr}.blog-card-cover{aspect-ratio:16/9}}@media(max-width:600px){header,main,footer{padding:18px}header{gap:12px}nav{gap:12px}.logo{width:112px}}`;
export function page(
  title: string,
  description: string,
  canonical: string,
  content: string,
  extra = "",
  preview = false,
) {
  return `<!doctype html><html lang="en-US"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Metricpedia</title><meta name="description" content="${escape(description)}">${false ? '<meta name="robots" content="noindex,nofollow">' : `<meta name="robots" content="max-image-preview:large"><link rel="canonical" href="${escape(canonical)}"><meta property="og:url" content="${escape(canonical)}">`}<meta name="robots" content="noindex,nofollow"><meta property="og:locale" content="en_US"><meta property="og:site_name" content="Metricpedia"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta name="twitter:card" content="summary_large_image"><link rel="alternate" type="application/rss+xml" title="Metricpedia Blog" href="/feed.xml"><link rel="icon" href="/favicon.svg"><style>${css}</style>${extra}</head><body>${preview ? '<div class="preview">Pré-visualização privada · esta versão ainda não foi publicada</div>' : ""}<header><a href="https://metricpedia.com/" aria-label="Metricpedia home" style="font-weight:800;font-size:24px;text-decoration:none;color:#0053ff">Metricpedia</a><nav><a href="https://metricpedia.com/">Home</a><a href="/blog">Blog</a><button id="theme" aria-label="Change theme">◐</button></nav></header><main>${content}</main><footer>Metricpedia · Powered by <a href="https://wepubly.com">WePubly</a></footer><script>const t=localStorage.getItem('metricpedia-theme');if(t)document.body.classList.add(t);document.getElementById('theme').onclick=()=>{const dark=!document.body.classList.contains('dark');document.body.classList.toggle('dark',dark);document.body.classList.toggle('light',!dark);localStorage.setItem('metricpedia-theme',dark?'dark':'light')};</script></body></html>`;
}
export interface ArticleContext {
  calculator?: { name: string; path: string };
  related?: { title: string; slug: string }[];
  dimensions?: { width: number; height: number } | null;
}
const jsonLd = (value: unknown) =>
  JSON.stringify(value).replaceAll("<", "\\u003c");
function sourceHtml(s: Snapshot) {
  return s.sources?.length
    ? '<section class="sources"><h2>Sources and references</h2><ul>' +
        s.sources
          .map(
            (source) =>
              `<li><a href="${escape(source.url)}" rel="noopener noreferrer">${escape(source.title || source.url)}</a></li>`,
          )
          .join("") +
        "</ul></section>"
    : "";
}
export const modifiedDate = (publishedAt: string, updatedAt: string) =>
  publishedAt && updatedAt < publishedAt ? publishedAt : updatedAt;
export function articleHtml(
  s: Snapshot,
  origin: string,
  publishedAt: string,
  updatedAt: string,
  preview = false,
  context: ArticleContext = {},
) {
  updatedAt = modifiedDate(publishedAt, updatedAt);
  const url = origin + "/blog/" + s.slug + "/";
  const image = s.coverId
    ? (preview ? "/api/editorial/media/" : "/media/") + s.coverId
    : "";
  const authorType =
    s.authorType ||
    (/^metricpedia/i.test(s.author) ? "Organization" : "Person");
  const publisher = {
    "@type": "Organization",
    name: "Metricpedia",
    url: origin,
  };
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: s.title,
        description: s.description || s.excerpt,
        inLanguage: s.language,
        datePublished: publishedAt,
        dateModified: updatedAt,
        author: { "@type": authorType, name: s.author },
        publisher,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        ...(image && !preview ? { image: origin + image } : {}),
        ...(s.category ? { articleSection: s.category } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: origin + "/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: origin + "/blog/",
          },
          { "@type": "ListItem", position: 3, name: s.title, item: url },
        ],
      },
      ...(s.faq?.length ? [{
        "@type": "FAQPage",
        mainEntity: s.faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      }] : []),
    ],
  };
  const dimensions =
    context.dimensions?.width && context.dimensions.height
      ? ` width="${context.dimensions.width}" height="${context.dimensions.height}"`
      : "";
  const related = context.related?.length
    ? '<section class="related"><h2>Related reading</h2><ul>' +
      context.related
        .map(
          (r) =>
            `<li><a href="/blog/${escape(r.slug)}">${escape(r.title)}</a></li>`,
        )
        .join("") +
      "</ul></section>"
    : "";
  const faqContent = s.faq?.length
    ? '<section class="faq"><h2>Frequently Asked Questions</h2>' +
      s.faq.map((f) => '<h3>'+escape(f.question)+'</h3><p>'+escape(f.answer)+'</p>').join("") +
      '</section>'
    : "";
  const dates = preview
    ? ""
    : ` · Published <time datetime="${escape(publishedAt)}">${escape(publishedAt.slice(0, 10))}</time>${updatedAt.slice(0, 10) !== publishedAt.slice(0, 10) ? ` · Updated <time datetime="${escape(updatedAt)}">${escape(updatedAt.slice(0, 10))}</time>` : ""}`;
  return page(
    s.seoTitle || s.title,
    s.description || s.excerpt,
    url,
    `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="https://metricpedia.com/">Home</a><span>›</span><a href="/blog">Blog</a><span>›</span><span aria-current="page">${escape(s.title)}</span></nav><article><p class="meta">${escape(s.category)}</p><h1>${escape(s.title)}</h1><p class="meta">By ${escape(s.author)}${dates}</p>${image ? `<img class="cover" src="${image}" alt="${escape(s.coverAlt)}"${dimensions} fetchpriority="high" decoding="async">` : ""}${bodyHtml(s.body)}${context.calculator ? `<p><a href="${escape(context.calculator.path)}">${escape(context.calculator.name)}</a></p>` : ""}${faqContent}${sourceHtml(s)}${related}<p class="meta">${s.tags.map((t) => `<a href="/blog?tag=${encodeURIComponent(t)}">${escape(t)}</a>`).join(" · ")}</p></article>`,
    preview
      ? ""
      : `<meta property="og:type" content="article"><meta property="article:published_time" content="${escape(publishedAt)}"><meta property="article:modified_time" content="${escape(updatedAt)}">${image ? `<meta property="og:image" content="${escape(origin + image)}"><meta property="og:image:alt" content="${escape(s.coverAlt)}"><meta name="twitter:image" content="${escape(origin + image)}">` : ""}<link rel="alternate" type="text/markdown" href="${escape(url)}.md"><script type="application/ld+json">${jsonLd(ld)}</script>`,
    preview,
  );
}
export function articleMarkdown(
  s: Snapshot,
  origin: string,
  publishedAt: string,
  updatedAt: string,
  related: { title: string; slug: string }[] = [],
) {
  updatedAt = modifiedDate(publishedAt, updatedAt);
  // Same immutable snapshot as HTML; no parallel content storage.
  return `# ${s.title}\n\nAuthor: ${s.author}\nPublished: ${publishedAt}\nUpdated: ${updatedAt}\nCanonical: ${origin}/blog/${s.slug}\nLanguage: ${s.language}\n\n${s.excerpt}\n\n${s.body}${s.sources?.length ? "\n\n## Sources and references\n" + s.sources.map((r) => `- [${r.title || r.url}](${r.url})`).join("\n") : ""}${related.length ? "\n\n## Related reading\n" + related.map((r) => `- [${r.title}](${origin}/blog/${r.slug})`).join("\n") : ""}\n`;
}
