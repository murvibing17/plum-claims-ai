import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "tesseract.js",
    "tesseract.js-core",
  ],

  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/tesseract.js/src/worker-script/**/*",
      "./node_modules/tesseract.js/src/worker/**/*",
      "./node_modules/tesseract.js-core/**/*",
    ],
  },
};

export default nextConfig;