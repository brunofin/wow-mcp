# ── Build stage ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Runtime stage ────────────────────────────────────────
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Non-root user
RUN addgroup -S mcp && adduser -S mcp -G mcp

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist/ dist/

USER mcp

# Stdio transport — the process itself is the health indicator.
# For HTTP transport, swap this for a proper healthcheck endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD pgrep -x node || exit 1

ENTRYPOINT ["node", "dist/index.js"]
