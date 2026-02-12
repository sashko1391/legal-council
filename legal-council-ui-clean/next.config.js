/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Experimental features
  experimental: {
    // Server actions enabled for forms
    serverActions: {
      bodySizeLimit: '5mb', // For contract uploads
    },
  },
  
  // Optimize fonts
  optimizeFonts: true,
  
  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Environment variables available on client
  env: {
    NEXT_PUBLIC_APP_NAME: 'Legal Council',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
}

module.exports = nextConfig
