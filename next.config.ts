import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: `output: "standalone"` was removed. It generated
  // `.next/standalone/release/win-unpacked/resources/app.asar` (an Electron
  // packaging artifact from the project's early scaffold). Next's dev server
  // (Turbopack) walks the whole project for CSS asset tracing and panics with
  // "os error 1392 / file corrupted" when a previously-renamed `.next_trash`
  // copy of that asar is present on disk. There is no Dockerfile or deployment
  // consuming the standalone output, so disabling it removes the corrupt-file
  // trigger entirely.
  // lib/db/sqlite.ts reads schema.sql via readFileSync(path.join(process.cwd(), ...)) —
  // process.cwd() is a runtime value, so Next's build-time file tracer can't see the
  // reference and won't copy it into .next by default. Force it in.
  outputFileTracingIncludes: {
    "/**": ["./lib/db/schema.sql"],
  },
  outputFileTracingExcludes: {
    "/**": ["./release/**", "./dist/**", "./build/**", "./.next_trash/**"],
  },
  // pino resolves its transports through worker threads (thread-stream), a
  // shape Turbopack cannot bundle. Externalizing keeps it a plain runtime
  // require, exactly as sqlite-vec's native binding needs.
  serverExternalPackages: ["sqlite-vec", "pino"],
  images: {
    unoptimized: true,
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: ["localhost:3308", "127.0.0.1:3308", "localhost:3000", "localhost:3147"],
    },
  },
};

export default nextConfig;
