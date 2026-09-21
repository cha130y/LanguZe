# The API image. Built from the workspace root:
#   docker build -f apps/api/Dockerfile .
# Runtime configuration comes from environment variables (production deployment, section 5).

FROM node:24-alpine AS builder
# Husky installs git hooks on `pnpm install`; there is no git repository here.
ENV HUSKY=0
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @languze/api build

# Copies the API and only its production dependencies into a self-contained folder.
# `--legacy` is required from pnpm 10 unless workspace packages are injected; the API
# depends on no workspace package, so there is nothing to inject.
RUN pnpm --filter @languze/api deploy --prod --legacy /out

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV HUSKY=0
RUN corepack enable
WORKDIR /app

COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /out/package.json ./package.json
COPY --from=builder /repo/apps/api/dist ./dist
# `prisma migrate deploy` runs from this image, so it needs the schema and migrations.
COPY --from=builder /repo/apps/api/prisma ./prisma
COPY --from=builder /repo/apps/api/prisma7.config.ts ./prisma7.config.ts

# Railway supplies PORT; this matches the local default.
EXPOSE 4001
CMD ["node", "dist/main.js"]
