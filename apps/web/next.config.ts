import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // A self-contained server for the container image, with only the files it needs.
  output: 'standalone',
  // Tracing starts at the workspace root, or pnpm's linked packages are missed.
  outputFileTracingRoot: join(here, '..', '..'),
};

export default nextConfig;
