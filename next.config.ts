import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/homepage-preview", destination: "/", permanent: true },
      { source: "/homepage-preview/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
