# REX OS 2.6 — runtime image
# Build context: the extracted release root, which contains:
#   manifest.json  Dockerfile  DEPLOY.md  backend/  dist/
# Build: docker build -t rex-backend:rexos-2.6 .
#
# RUNTIME LAYOUT — standardized to match the live production container.
# The backend runs directly under /app, NOT under /app/backend:
#
#   /app/server.js            ← node backend/server.js
#   /app/version.js           ← release version (single source of truth)
#   /app/package.json         ← the BACKEND package (npm start → node server.js)
#   /app/routes/  /app/controllers/  /app/services/  /app/middleware/
#   /app/dist/                ← built frontend, served by server.js
#   /app/.auth-secrets.json   ← NOT baked in; production bind-mounts the real
#                               credentials here (read-only)
#   /app/data/                ← NOT baked in; production bind-mounts the
#                               persistent state volume here (read-write)
#
# /app/data and /app/.auth-secrets.json are deliberately absent from the image:
# no runtime state and no credentials are shipped in it. server.js resolves
# both relative to its own directory, so mounting them over /app is enough.
#
# Expected run (as created by REX Updater — env stays in the container config):
#   docker run -d --name rex-backend -p 4000:4000 --restart unless-stopped \
#     --env-file <container env> \
#     -v /volume1/docker/rex/config/.auth-secrets.json:/app/.auth-secrets.json:ro \
#     -v /volume1/docker/rex/runtime:/app/data:rw \
#     rex-backend:rexos-2.6

FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=4000

WORKDIR /app

# Runtime npm package = the BACKEND package. The repo/frontend package.json is
# never copied, so `npm start` here can only mean the backend's
# "start": "node server.js".
COPY backend/package.json backend/package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund

# Backend runtime, flattened into /app. Copied as an explicit list so that
# backend/data (runtime state), backend/tests, backend/node_modules and
# backend/bun.lock can never be baked into the image, whatever the build
# context happens to contain.
COPY backend/server.js ./
COPY backend/version.js ./
COPY backend/middleware/ ./middleware/
COPY backend/routes/ ./routes/
COPY backend/controllers/ ./controllers/
COPY backend/services/ ./services/

# Built frontend — server.js serves it from <dirname>/dist (= /app/dist) and
# still falls back to <dirname>/../dist for the development layout.
COPY dist/ ./dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/health >/dev/null 2>&1 || exit 1

CMD ["npm", "start"]
