const basePath = process.env.PAGES_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { 
    unoptimized: true,
    // images.domains → images.remotePatterns 로 변경 권장
    remotePatterns: []
  },
  ...(basePath && { 
    basePath, 
    assetPrefix: basePath 
  }),
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;