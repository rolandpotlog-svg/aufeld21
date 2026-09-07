import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/push-worker.js", headers: [
      { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
      { key: "Service-Worker-Allowed", value: "/" },
    ] }];
  },
  async redirects() {
    return [
      { source: "/homepage-preview", destination: "/", permanent: true },
      { source: "/homepage-preview/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
