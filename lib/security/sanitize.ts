import sanitizeHtml from "sanitize-html"

const defaultOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "iframe",
    "script",
    "style",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "div",
    "span",
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ul",
    "ol",
    "li",
  ]),
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading", "class", "style"],
    iframe: [
      "src",
      "width",
      "height",
      "allow",
      "allowfullscreen",
      "loading",
      "title",
      "frameborder",
      "class",
      "style",
    ],
    script: ["src", "async", "defer", "type", "charset"],
    style: ["type"],
    div: ["class", "style", "id"],
    span: ["class", "style", "id"],
    p: ["class", "style"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel", "data"],
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "player.vimeo.com", "www.vimeo.com", "vimeo.com"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    iframe: (tagName, attribs) => {
      // Make iframes responsive by default
      return {
        tagName: "iframe",
        attribs: {
          ...attribs,
          style: attribs.style
            ? `${attribs.style}; max-width: 100%; height: auto;`
            : "max-width: 100%; height: auto;",
          loading: attribs.loading || "lazy",
        },
      }
    },
  },
  enforceHtmlBoundary: false,
}

export function sanitizeAdminHtml(input: string, options: sanitizeHtml.IOptions = {}) {
  return sanitizeHtml(input, { ...defaultOptions, ...options })
}

