import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.londonbite.com";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/order`, changeFrequency: "daily", priority: 0.95 },
  ];
}
