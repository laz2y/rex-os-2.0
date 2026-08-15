# REX OS 2.5 — runtime image
# Build context: the extracted release root, which contains:
#   manifest.json  Dockerfile  backend/  dist/  DEPLOY.md
# Build: docker build -t rex-backend:rexos-2.5 .
# Run:   the container is created by REX Updater reusing the previous
#        rex-backend container's env/ports/restart policy (see
#        rex-updater/DESIGN.md). Env vars stay in the container config,
#        never in the image.

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# Backend dependencies first (cached layer). The lockfile is copied so the
# build is reproducible; the image installs production deps only.
COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Application code + built frontend (server.js serves dist/ itself).
COPY backend/ ./backend
COPY dist/ ./dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null 2>&1 || exit 1

CMD ["node", "backend/server.js"]
