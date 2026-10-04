import { blogPosts } from "./blog";
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.aufeld21.at").replace(/\/$/, "");
export const publicPages = ["/", "/buero-service", "/community", "/ueber-uns", "/presse/aufeld21-im-trauner", "/impressum", "/datenschutz", "/blog", ...blogPosts.map((post) => `/blog/${post.slug}`)];
