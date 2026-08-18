import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `output: "standalone"` only turns on for the electron:*/build:electron scripts
  // (which set ELECTRON_BUILD=1 before calling `next build`). Plain `next dev` and
  // `next build` never set it, so Turbopack dev never walks a `.next/standalone`
  // tree — that's what previously left a `release/win-unpacked/.../app.asar` copy
  // on disk and made Turbopack panic with "os error 1392 / file corrupted".
  // electron/main.js and scripts/prepare-electron-build.js require this output for
  // the packaged app's server.
  ...(process.env.ELECTRON_BUILD === "1" ? { output: "standalone" as const } : {}),
  // lib/db/sqlite.ts reads schema.sql via readFileSync(path.join(process.cwd(), ...)) —
  // process.cwd() is a runtime value, so Next's build-time file tracer can't see the
  // reference and won't copy it into .next by default. Force it in.
  outputFileTracingIncludes: {
    "/**": ["./lib/db/schema.sql"],
  },
  outputFileTracingExcludes: {
    "/**": ["./release/**", "./dist/**", "./build/**", "./.next_trash/**"],
  },
  turbopack: {
    ignoreIssue: [
      {
        path: "**/next.config.ts",
      },
      {
        path: "./next.config.ts",
      },
    ],
  },
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
  allowedDevOrigins: [
    "localhost:3308",
    "127.0.0.1:3308",
    "192.168.0.154:3308",
    "192.168.0.154",
  ],
  async redirects() {
    return [
      {
        source: "/crm",
        destination: "/network",
        permanent: true,
      },
      {
        source: "/links",
        destination: "/resources",
        permanent: true,
      },
      {
        source: "/preferences/ai-prompts",
        destination: "/prompts",
        permanent: true,
      },
      {
        source: "/ai-prompts",
        destination: "/prompts",
        permanent: true,
      },
      {
        source: "/resume",
        destination: "/documents",
        permanent: true,
      },
      {
        source: "/document",
        destination: "/documents",
        permanent: true,
      },
    ];
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
      allowedOrigins: [
        "localhost:3308",
        "127.0.0.1:3308",
        "localhost:3000",
        "localhost:3147",
        "192.168.0.154:3308",
        "192.168.0.154",
      ],
    },
  },
};

export default nextConfig;
