/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      // Redirect parent domain to canonical MirrorSite AI subdomain
      {
        source: "/:path*",
        has: [{ type: "host", value: "atai.ink" }],
        destination: "https://mirrorsite.atai.ink/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.atai.ink" }],
        destination: "https://mirrorsite.atai.ink/:path*",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
