import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rockflix.com"

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/arike/", "/auth/", "/community/auth/", "/settings", "/profile/edit", "/notifications"],
      },
      {
        userAgent: ["Googlebot", "Bingbot"],
        allow: "/",
        disallow: ["/api/", "/arike/", "/auth/", "/community/auth/", "/settings", "/notifications"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
