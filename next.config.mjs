/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    unoptimized: true,
  },
  // Disable server-side features for Electron
  trailingSlash: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data: https://cdn.jsdelivr.net",
              "connect-src 'self' blob: http://localhost:* ws://localhost:*",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

export default nextConfig
