# The web image. Built from the workspace root:
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.languze.com .
#
# NEXT_PUBLIC_API_URL is baked in at build time, not read at startup: Next.js inlines
# every NEXT_PUBLIC_ value into the browser bundle while building. Setting it only as a
# runtime variable leaves the browser calling localhost.

FROM node:24-alpine AS builder
ENV HUSKY=0
RUN corepack enable
WORKDIR /repo

COPY . .
RUN pnpm install --frozen-lockfile

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @languze/web build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# `output: 'standalone'` writes a server with only the files it traced as needed.
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3003
ENV PORT=3003
CMD ["node", "apps/web/server.js"]
