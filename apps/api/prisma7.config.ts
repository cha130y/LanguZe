import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env automatically; use Node's built-in loader for local development.
// CI and deployed environments provide DATABASE_URL directly.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    /*
     * Migrations need a direct connection. Neon's pooled endpoint cannot run the
     * schema statements `prisma migrate` issues, so production sets the unpooled
     * URL here while the application keeps using the pooled one. Locally the two
     * are the same database and only DATABASE_URL is set.
     */
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  },
});
