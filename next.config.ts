import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // lib/db/sqlite.ts reads schema.sql via readFileSync(path.join(process.cwd(), ...)) —
  // process.cwd() is a runtime value, so Next's build-time file tracer can't see the
  // reference and won't copy it into .next/standalone by default. Force it in.
  outputFileTracingIncludes: {
    "/**": ["./lib/db/schema.sql"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
