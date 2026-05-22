import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "span",
  "div",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td"
];

export function sanitizeDescription(html) {
  const sanitized = sanitizeHtml(String(html || ""), {
    allowedTags,
    allowedAttributes: {
      a: ["href", "target", "rel"],
      table: ["summary"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: "a",
        attribs: {
          href: attribs.href || "#",
          target: "_blank",
          rel: "noopener noreferrer"
        }
      })
    }
  }).trim();

  return normalizeLegacyFallback(compactDescriptionHtml(sanitized));
}

export function normalizeDescriptionHtml(html) {
  let candidate = String(html || "").trim();
  if (!candidate) return "";

  for (let index = 0; index < 2; index += 1) {
    if (!looksLikeEscapedHtml(candidate)) break;
    candidate = decodeHtmlEntities(candidate);
  }

  return sanitizeDescription(candidate);
}

export function richTextToHtml(content) {
  const raw = String(content || "").trim();
  if (!raw) return "";
  if (containsAllowedHtml(raw) || looksLikeEscapedHtml(raw)) {
    return normalizeDescriptionHtml(raw);
  }

  return sanitizeDescription(
    raw
      .split(/\n{2,}/)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("\n")
  );
}

export function stripHtml(html) {
  return sanitizeHtml(String(html || ""), { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

function containsAllowedHtml(value) {
  return /<\/?(p|br|strong|b|em|i|u|ul|ol|li|span|div|h2|h3|h4|blockquote|a|table|thead|tbody|tr|th|td)(\s|>|\/)/i.test(value);
}

function looksLikeEscapedHtml(value) {
  return /&(amp;)?lt;\/?(p|br|strong|b|em|i|u|ul|ol|li|span|div|h2|h3|h4|blockquote|a|table|thead|tbody|tr|th|td)(\s|&(amp;)?gt;|\/)/i.test(value);
}

function compactDescriptionHtml(html) {
  return String(html || "")
    .replace(/<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "")
    .replace(
      /(<\/(?:p|h2|h3|h4|li|ul|ol|div|blockquote)>)\s*(?:<br\s*\/?>\s*)+(?=<(?:p|h2|h3|h4|ul|ol|div|blockquote)\b)/gi,
      "$1"
    )
    .replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .trim();
}

function normalizeLegacyFallback(html) {
  const key = stripHtml(html)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (key === "oferta bookloft dostepna na allegro. zakup, platnosc i obsluga zamowienia odbywaja sie w serwisie allegro.") {
    return "<p>Oferta BookLoft dostępna na Allegro. Zakup, płatność i obsługa zamówienia odbywają się w serwisie Allegro.</p>";
  }

  return html;
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
