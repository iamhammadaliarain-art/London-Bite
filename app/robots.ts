import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/order"],
      disallow: ["/management/", "/ipos/", "/kitchen/", "/rider/", "/employee/", "/api/"],
    },
    sitemap: "https://www.londonbite.com/sitemap.xml",
  };
}
