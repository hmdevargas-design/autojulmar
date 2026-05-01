import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source:      '/americo10',
        destination: 'https://wa.me/351935446700?text=AMERICO10',
        permanent:   false,
      },
    ]
  },
};

export default nextConfig;
