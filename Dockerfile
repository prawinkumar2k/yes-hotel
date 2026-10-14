# Multi-stage Dockerfile for YES HOTELS PMS
FROM node:22-slim AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies required for vite build)
RUN pnpm install --frozen-lockfile

# Copy application source code
COPY . .

# Build client and server bundles
RUN pnpm run build

# ── Runner Stage ──
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3100

RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files and install production dependencies + tsx for seeding/scripts
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm add -D tsx

# Copy built bundles and required runtime assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/server/src ./server/src
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3100

CMD ["node", "dist/server/node-build.mjs"]
