import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Allows safe HTML tags and attributes but blocks scripts and dangerous code
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return ""

  return DOMPurify.sanitize(dirty, {
    // Allow common HTML tags
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "h1", "h2", "h3", "h4", "h5", "h6",
      "a", "img", "div", "span", "ul", "ol", "li", "blockquote", "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td", "hr", "iframe"
    ],
    // Allow safe attributes
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class", "id", "width", "height",
      "style", "target", "rel", "frameborder", "allowfullscreen",
      "allow", "sandbox"
    ],
    // Allow data attributes for some ad networks (but sanitize them)
    ALLOW_DATA_ATTR: false,
    // Block all scripts
    FORBID_TAGS: ["script", "object", "embed", "form", "input", "button"],
    // Block dangerous attributes
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur"],
    // Keep relative URLs
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // Sanitize URLs
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
}

/**
 * Sanitizes HTML for ad content - more restrictive
 * Only allows safe ad formats (no iframes, no scripts)
 */
export function sanitizeAdHtml(dirty: string | null | undefined): string {
  if (!dirty) return ""

  return DOMPurify.sanitize(dirty, {
    // Very limited tags for ads
    ALLOWED_TAGS: ["div", "span", "a", "img", "p"],
    // Very limited attributes
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "id", "width", "height", "target", "rel"],
    // Block all scripts and dangerous elements
    FORBID_TAGS: ["script", "object", "embed", "form", "input", "button", "iframe", "frame"],
    // Block all event handlers
    FORBID_ATTR: [
      "onerror", "onload", "onclick", "onmouseover", "onfocus", "onblur",
      "onchange", "onsubmit", "onreset", "onselect", "onkeydown", "onkeypress",
      "onkeyup", "onmousedown", "onmousemove", "onmouseout", "onmouseup"
    ],
    // No data attributes
    ALLOW_DATA_ATTR: false,
    // No unknown protocols
    ALLOW_UNKNOWN_PROTOCOLS: false,
    // Strict URL validation
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
}

