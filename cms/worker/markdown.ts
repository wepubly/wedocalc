// Small restricted Markdown grammar. HTML is always escaped, never interpreted.
export const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function safeUrl(value: string): string | null {
  if (!value || /[\s\u0000-\u001f\u007f\\<>"']/.test(value)) return null;
  if (value.startsWith("#")) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function markdownLinks(body: string): string[] {
  const content = body
    .replace(/```[\s\S]*?(?:```|$)/g, "")
    .replace(/`[^`\n]+`/g, "");
  return [...content.matchAll(/(?<!!)\[([^\]\n]+)\]\(([^\s)]+)\)/g)].map(
    (m) => m[2],
  );
}
function inline(value: string, depth = 0): string {
  if (depth > 8) return escape(value);
  const tokens =
    /`([^`\n]+)`|(?<!!)\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|__([^_\n]+)__|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let result = "",
    offset = 0;
  for (const m of value.matchAll(tokens)) {
    result += escape(value.slice(offset, m.index));
    offset = m.index! + m[0].length;
    if (m[1] !== undefined) result += "<code>" + escape(m[1]) + "</code>";
    else if (m[2] !== undefined) {
      const url = safeUrl(m[3]);
      result += url
        ? `<a href="${escape(url)}"${url.startsWith("http") ? ' rel="noopener noreferrer"' : ""}>${inline(m[2], depth + 1)}</a>`
        : escape(m[0]);
    } else if (m[4] || m[5])
      result += "<strong>" + inline(m[4] || m[5], depth + 1) + "</strong>";
    else result += "<em>" + inline(m[6] || m[7], depth + 1) + "</em>";
  }
  return result + escape(value.slice(offset));
}
const tableCells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((s) => s.trim());
export function bodyHtml(body: string, depth = 0): string {
  if (depth > 8) return "<p>" + escape(body) + "</p>";
  const lines = body.replaceAll("\r", "").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = Math.max(2, heading[1].length);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }
    if (/^```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      if (i < lines.length) i++;
      out.push("<pre><code>" + escape(code.join("\n")) + "</code></pre>");
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]))
        quote.push(lines[i++].replace(/^>\s?/, ""));
      out.push(
        "<blockquote>" +
          bodyHtml(quote.join("\n"), depth + 1) +
          "</blockquote>",
      );
      continue;
    }
    if (/^\s*(?:[-+*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line),
        items: string[] = [];
      const pattern = ordered ? /^\s*\d+\.\s+(.+)$/ : /^\s*[-+*]\s+(.+)$/;
      while (i < lines.length) {
        const item = pattern.exec(lines[i]);
        if (!item) break;
        items.push("<li>" + inline(item[1]) + "</li>");
        i++;
      }
      out.push(
        `<${ordered ? "ol" : "ul"}>${items.join("")}</${ordered ? "ol" : "ul"}>`,
      );
      continue;
    }
    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[i + 1])
    ) {
      const heads = tableCells(line);
      i += 2;
      const rows: string[] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        const cells = tableCells(lines[i++]);
        rows.push(
          "<tr>" +
            heads
              .map((_, n) => "<td>" + inline(cells[n] || "") + "</td>")
              .join("") +
            "</tr>",
        );
      }
      out.push(
        '<div class="table-scroll"><table><thead><tr>' +
          heads.map((h) => '<th scope="col">' + inline(h) + "</th>").join("") +
          "</tr></thead><tbody>" +
          rows.join("") +
          "</tbody></table></div>",
      );
      continue;
    }
    const paragraph: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(?:#{1,6}\s|>\s?|```|\s*(?:[-+*]|\d+\.)\s|---+\s*$)/.test(lines[i])
    )
      paragraph.push(lines[i++]);
    out.push("<p>" + paragraph.map((l) => inline(l)).join("<br>") + "</p>");
  }
  return out.join("\n");
}
