import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // A self-contained server for the container image, with only the files it needs.
  output: 'standalone',
  // Tracing starts at the workspace root, or pnpm's linked packages are missed.
  outputFileTracingRoot: join(here, '..', '..'),
  /*
   * The development server only serves its scripts and live-reload channel to
   * localhost unless told otherwise. Through the tunnel the browser arrives as
   * languze.com, so without this the page renders but its JavaScript never runs:
   * buttons appear and do nothing. Development only — production has no dev server.
   */
  allowedDevOrigins: ['languze.com'],
};

export default nextConfig;
