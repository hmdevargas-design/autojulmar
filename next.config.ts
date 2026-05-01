import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source:      '/americo10',
        destination: 'https://wa.me/351935446700?text=Vim%20pelo%20Am%C3%A9rico%20e%20quero%20aproveitar%20o%20desconto%20de%2010%E2%82%AC%20com%20o%20cup%C3%A3o%20AMERICO10',
        permanent:   false,
      },
      {
        source:      '/saas',
        destination: '/login',
        permanent:   false,
      },
    ]
  },
};

export default nextConfig;
