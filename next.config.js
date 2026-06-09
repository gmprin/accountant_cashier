/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3000'] }
  },
  transpilePackages: ['@supabase/ssr']
}

module.exports = nextConfig
