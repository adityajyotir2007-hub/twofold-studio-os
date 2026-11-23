/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/state",
        destination: "/api/transactions",
      },
      {
        source: "/api/records/:collection",
        destination: "/api/transactions?__collection=:collection",
      },
      {
        source: "/api/realtime",
        destination: "/api/transactions?__mode=realtime",
      },
      {
        source: "/api/documents",
        destination: "/api/transactions?__mode=documents",
      },
      {
        source: "/api/documents/:id/file",
        destination: "/api/transactions?__mode=documents&fileId=:id",
      },
      {
        source: "/api/auth",
        destination: "/api/integrations?__auth=1",
      },
      {
        source: "/api/integrations/oauth/callback",
        destination: "/api/integrations?oauth_callback=1",
      },
      {
        source: "/api/webhooks/:provider",
        destination: "/api/integrations?__webhook=:provider",
      },
    ];
  },
};

export default nextConfig;
