import { buildDocumentAppCsp } from "@repro/env/topology";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const documentAppCsp = buildDocumentAppCsp();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Content-Security-Policy", value: documentAppCsp },
];

/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  serverExternalPackages: [
    "@takumi-rs/image-response",
    "takumi-js",
    "@takumi-rs/core",
    "@takumi-rs/helpers",
  ],
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withMDX(config);
