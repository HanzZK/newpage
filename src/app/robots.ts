import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Guest conversations and the host dashboard are private surfaces.
      disallow: ["/chat/", "/dashboard/", "/api/"],
    },
  };
}
