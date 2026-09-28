import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/cms", "/admin", "/api", "/login", "/styleguide", "/kabinet", "/oplata", "/ochered", "/sertifikat", "/*?preview=1"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
