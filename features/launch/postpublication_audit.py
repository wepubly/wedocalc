#!/usr/bin/env python3
"""Read-only public post-publication audit for homeimprovement.tools articles."""
import concurrent.futures
import datetime
import json
import pathlib
import re
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from bs4 import BeautifulSoup

ORIGIN = "https://homeimprovement.tools"
OUT = pathlib.Path("hi-audit-output")
OUT.mkdir(exist_ok=True)
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; HI-Work-TechnicalAudit/1.0; read-only)",
    "Accept": "text/html,application/xml,image/avif,image/webp,*/*",
}
SEVERITY = {"P0": 0, "P1": 1, "P2": 2}


def fetch(url, method="GET"):
    req = urllib.request.Request(url, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=26) as r:
            content_type = r.headers.get("Content-Type", "")
            data = r.read() if method == "GET" else b""
            return {"status": r.status, "url": r.url, "data": data, "type": content_type, "xrobots": r.headers.get("X-Robots-Tag", ""), "error": ""}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "url": e.geturl(), "data": b"", "type": "", "xrobots": "", "error": str(e)}
    except Exception as e:
        return {"status": None, "url": url, "data": b"", "type": "", "xrobots": "", "error": str(e)[:180]}


def check_target(url):
    # Headers suffice for image/link existence; fall back to GET on unsupported HEAD.
    r = fetch(url, "HEAD")
    if r["status"] in (403, 405, 501, None):
        r = fetch(url, "GET")
    return {"status": r["status"], "url": r["url"], "error": r["error"], "type": r["type"], "redirect": r["url"].rstrip("/") != url.rstrip("/")}


def add(rec, severity, category, message, target=None):
    rec["issues"].append({"severity": severity, "category": category, "message": message, **({"target": target} if target else {})})


def meta(doc, key, kind="name"):
    node = doc.find("meta", attrs={kind: key})
    return str(node.get("content", "")).strip() if node else ""


def full_url(href, page):
    try:
        u = urllib.parse.urljoin(page, href.strip())
        parts = urllib.parse.urlsplit(u)
        return u if parts.scheme in ("https", "http") else None
    except Exception:
        return None


def audit_article(url):
    res = fetch(url)
    rec = {
        "url": url, "status": res["status"], "final_url": res["url"], "title": "",
        "h1": "", "published": "", "text_chars": 0, "tables": 0,
        "internal": [], "external_count": 0, "images": [], "issues": [],
    }
    if res["status"] != 200:
        add(rec, "P0", "http", "Artigo não respondeu HTTP 200", url)
        return rec
    if res["url"].rstrip("/") != url.rstrip("/"):
        add(rec, "P1", "http", "Redirecionamento inesperado do artigo", res["url"])
    doc = BeautifulSoup(res["data"], "html.parser")
    rec["title"] = doc.title.get_text(" ", strip=True) if doc.title else ""
    canonical = doc.find("link", rel="canonical")
    canonical_url = canonical.get("href", "") if canonical else ""
    if canonical_url != url:
        add(rec, "P1", "canonical", "Canonical ausente ou divergente: " + canonical_url)
    desc = meta(doc, "description")
    if not desc or not (65 <= len(desc) <= 320):
        add(rec, "P2", "seo", "Meta description ausente ou comprimento atípico (" + str(len(desc)) + ")")
    if not rec["title"] or "Metricpedia" in rec["title"]:
        add(rec, "P1", "seo", "Title ausente ou marca anterior")
    robots = meta(doc, "robots").lower() + " " + (res["xrobots"] or "").lower()
    if "noindex" in robots or "nofollow" in robots:
        add(rec, "P0", "indexacao", "Diretiva que bloqueia indexação: " + robots)
    h1 = doc.select("h1")
    rec["h1"] = h1[0].get_text(" ", strip=True) if h1 else ""
    if len(h1) != 1:
        add(rec, "P1", "formatacao", "Quantidade de H1 diferente de 1: " + str(len(h1)))
    if not rec["h1"]:
        add(rec, "P1", "formatacao", "H1 vazio")
    article = doc.select_one("main article")
    if not article:
        add(rec, "P0", "formatacao", "Elemento main article ausente")
        return rec
    body_text = article.get_text(" ", strip=True)
    rec["text_chars"] = len(body_text)
    if len(body_text) < 1200:
        add(rec, "P1", "formatacao", "Conteúdo de artigo curto/vazio: " + str(len(body_text)) + " caracteres")
    if any(term in body_text for term in ("EDITORIAL NOTES START", "PUBLISHABLE ARTICLE START", "status: V1 ENTREGUE", "keyword_metrics:")):
        add(rec, "P0", "conteudo", "Vazamento de notas internas do editor")
    headings = article.find_all(re.compile(r"^h[1-6]$"))
    rec["heading_count"] = len(headings)
    if len(headings) < 4:
        add(rec, "P2", "formatacao", "Poucas seções HTML identificadas")
    if any(not h.get_text(" ", strip=True) for h in headings):
        add(rec, "P1", "formatacao", "Cabeçalho HTML vazio")
    rec["tables"] = len(article.select("table"))
    for idx, table in enumerate(article.select("table"), 1):
        rows = table.select("tr")
        sizes = [len(row.find_all(["th", "td"], recursive=False)) for row in rows]
        if len(rows) < 2 or any(sz == 0 for sz in sizes):
            add(rec, "P1", "tabelas", "Tabela " + str(idx) + " sem linhas/células adequadas")
        elif max(sizes) - min(sizes) > 1:
            add(rec, "P2", "tabelas", "Tabela " + str(idx) + " com quantidade de colunas irregular: " + str(sizes))
    if not doc.select_one(".author-profile"):
        add(rec, "P2", "estrutura", "Perfil do autor ausente")
    og_url = meta(doc, "og:url", "property")
    if og_url != url:
        add(rec, "P1", "seo", "og:url incorreta: " + og_url)
    og_img = meta(doc, "og:image", "property")
    tw_img = meta(doc, "twitter:image")
    if not og_img or not tw_img:
        add(rec, "P1", "imagens", "Imagem social OG/Twitter ausente")
    rec["social_image"] = og_img
    ld = []
    for n in doc.select('script[type="application/ld+json"]'):
        try:
            obj = json.loads(n.get_text())
            ld.extend(obj.get("@graph", [obj]))
        except Exception:
            add(rec, "P1", "schema", "JSON-LD inválido")
    types = {str(o.get("@type", "")) for o in ld if isinstance(o, dict)}
    if not {"BlogPosting", "BreadcrumbList"}.issubset(types):
        add(rec, "P1", "schema", "BlogPosting/BreadcrumbList ausentes; tipos: " + str(sorted(types)))
    for o in ld:
        if isinstance(o, dict) and o.get("@type") == "BlogPosting":
            rec["published"] = o.get("datePublished", "")
            if o.get("mainEntityOfPage", {}).get("@id") != url:
                add(rec, "P1", "schema", "mainEntityOfPage divergente")
            if not rec["published"] or not o.get("dateModified"):
                add(rec, "P2", "schema", "Datas de publicação/atualização ausentes")
    for img in doc.select("main article img"):
        src = full_url(img.get("src", ""), url)
        alt = img.get("alt")
        item = {"src": src, "alt": alt, "srcset": bool(img.get("srcset")), "width": img.get("width"), "height": img.get("height")}
        rec["images"].append(item)
        if not src:
            add(rec, "P1", "imagens", "Imagem sem src válido")
        if alt is None or (img.get("class") and "cover" in img.get("class") and not alt.strip()):
            add(rec, "P1", "imagens", "Imagem do corpo ou capa sem alt")
    cover = doc.select_one("main article img.cover")
    if not cover:
        add(rec, "P1", "imagens", "Capa principal ausente")
    elif not cover.get("srcset") or not cover.get("sizes"):
        add(rec, "P2", "imagens", "Capa sem srcset/sizes responsivos")
    if not og_img:
        add(rec, "P1", "imagens", "Imagem social original não definida")
    for a in article.select("a[href]"):
        href = a.get("href", "").strip()
        if href.startswith("#") or href.startswith("mailto:") or href.startswith("tel:"):
            continue
        full = full_url(href, url)
        if not full:
            add(rec, "P2", "links", "Link inválido: " + href)
            continue
        if urllib.parse.urlsplit(full).hostname == "homeimprovement.tools":
            path = urllib.parse.urlsplit(full).path
            if path.startswith("/cdn-cgi/l/email-protection"):
                continue
            rec["internal"].append(full.split("#")[0])
        else:
            rec["external_count"] += 1
    rec["internal"] = sorted(set(rec["internal"]))
    if not rec["internal"]:
        add(rec, "P1", "links", "Artigo sem links internos para outras páginas")
    return rec


def main():
    sitemap = fetch(ORIGIN + "/sitemap.xml")
    if sitemap["status"] != 200:
        raise RuntimeError("Sitemap indisponível HTTP " + str(sitemap["status"]))
    root = ET.fromstring(sitemap["data"])
    urls = [el.text.strip() for el in root.iter() if el.tag.endswith("}loc") or el.tag == "loc"]
    article_urls = [u for u in urls if "/home-garden/paint-calculators/paint-calculator/" in u and u.endswith("/")]
    # In case future articles use standard /blog/ slugs, include those, not the /blog/ listing.
    article_urls += [u for u in urls if "/blog/" in urllib.parse.urlsplit(u).path and urllib.parse.urlsplit(u).path != "/blog/" and u not in article_urls]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        records = list(pool.map(audit_article, article_urls))
    targets = set()
    for r in records:
        targets.update(r["internal"])
        for img in r["images"]:
            if img["src"]:
                targets.add(img["src"])
        if r.get("social_image"):
            targets.add(r["social_image"])
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        responses = dict(zip(sorted(targets), pool.map(check_target, sorted(targets))))
    image_targets = set()
    for rec in records:
        image_targets.update(img["src"] for img in rec["images"] if img["src"])
        if rec.get("social_image"):
            image_targets.add(rec["social_image"])
        for url in rec["internal"]:
            result = responses.get(url, {})
            if result.get("status") != 200:
                add(rec, "P1", "links", "Destino interno com status " + str(result.get("status")), url)
            elif result.get("redirect"):
                add(rec, "P2", "links", "Link interno redireciona para " + str(result["url"]), url)
        for img in rec["images"]:
            if not img["src"]:
                continue
            result = responses.get(img["src"], {})
            if result.get("status") != 200 or (result.get("type") and not result["type"].startswith("image/")):
                add(rec, "P1", "imagens", "Recurso de imagem com status/tipo inválido: " + str(result.get("status")), img["src"])
        if rec.get("social_image"):
            result = responses.get(rec["social_image"], {})
            if result.get("status") != 200:
                add(rec, "P1", "imagens", "Imagem OG não acessível: " + str(result.get("status")), rec["social_image"])
        rec["issue_counts"] = dict(Counter(i["severity"] for i in rec["issues"]))
        rec["verified_internal"] = len(rec["internal"])
        rec["verified_images"] = len(rec["images"]) + (1 if rec.get("social_image") else 0)
    robots = fetch(ORIGIN + "/robots.txt")
    robots_txt = robots["data"].decode("utf-8", "replace")
    site_warnings = []
    if robots["status"] != 200 or "Disallow: /" in robots_txt.splitlines() or ORIGIN + "/sitemap.xml" not in robots_txt:
        site_warnings.append("robots.txt requer inspeção: " + str(robots["status"]))
    if len(urls) != len(set(urls)):
        site_warnings.append("Sitemap contém URLs duplicadas.")
    if len(article_urls) == 0:
        site_warnings.append("Sitemap não retornou URLs editoriais.")
    summary = {
        "audited_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sitemap_urls": len(urls),
        "editorial_articles": len(article_urls),
        "articles_http_200": sum(r["status"] == 200 for r in records),
        "articles_without_findings": sum(not r["issues"] for r in records),
        "links_checked_unique": len(targets - image_targets),
        "image_resources_checked_unique": len(image_targets),
        "issues": dict(Counter(i["severity"] for r in records for i in r["issues"])),
        "site_warnings": site_warnings,
    }
    result = {"summary": summary, "articles": records, "checked_targets": responses}
    (OUT / "audit-report.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    md = ["# Home Improvement — Auditoria técnica retroativa", "",
          "Execução UTC: " + summary["audited_utc"], "",
          "URLs no sitemap: " + str(summary["sitemap_urls"]),
          "Artigos editoriais: " + str(summary["editorial_articles"]),
          "Artigos HTTP 200: " + str(summary["articles_http_200"]),
          "Artigos sem apontamentos: " + str(summary["articles_without_findings"]),
          "Links internos únicos: " + str(summary["links_checked_unique"]),
          "Imagens únicas: " + str(summary["image_resources_checked_unique"]),
          "Ocorrências por criticidade: " + str(summary["issues"]), ""]
    for r in records:
        md += ["## " + r["url"], "",
               "HTTP: " + str(r["status"]) + " | H1: " + r["h1"] +
               " | links internos: " + str(r["verified_internal"]) + " | imagens: " + str(r["verified_images"]), ""]
        if r["issues"]:
            for issue in sorted(r["issues"], key=lambda i: SEVERITY[i["severity"]]):
                md.append("- **" + issue["severity"] + " · " + issue["category"] + "**: " + issue["message"] + (" — " + issue["target"] if issue.get("target") else ""))
        else:
            md.append("- OK — sem achados nos testes automatizados de HTML, SEO, links e imagens.")
        md.append("")
    (OUT / "audit-report.md").write_text("\n".join(md))
    print("HI_AUDIT_SUMMARY " + json.dumps(summary, ensure_ascii=False))
    for r in records:
        print("HI_AUDIT_ARTICLE " + json.dumps({
            "url": r["url"], "status": r["status"], "title": r["title"], "h1": r["h1"],
            "internal_links": r["verified_internal"], "images": r["verified_images"],
            "tables": r["tables"], "issue_counts": r["issue_counts"], "issues": r["issues"],
        }, ensure_ascii=False))
    print("HI_AUDIT_DONE -- no CMS or Cloudflare writes performed")


if __name__ == "__main__":
    main()
