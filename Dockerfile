# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS build-dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN --mount=type=cache,target=/root/.npm npm clean-install

FROM build-dependencies AS build
COPY tsconfig.json ./
COPY client client
COPY server server
COPY shared shared
RUN npm run build

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS runtime-dependencies
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN --mount=type=cache,target=/root/.npm \
  npm clean-install --omit=dev --workspace=server --workspace=shared

FROM node:22-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5 AS app
LABEL org.opencontainers.image.licenses="MIT"
ENV NODE_ENV=production \
  PORT=3001
WORKDIR /app
COPY --from=runtime-dependencies --chown=node:node /workspace/node_modules node_modules
COPY --from=build --chown=node:node /workspace/server/dist server/dist
COPY --from=build --chown=node:node /workspace/client/dist client/dist
COPY --chown=node:node server/package.json server/package.json
COPY --chown=node:node shared/package.json shared/governanceControls.js shared/governanceTiers.json shared/
COPY --chown=node:node LICENSE /licenses/LICENSE
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:3001/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
CMD ["node", "server/dist/index.js"]

FROM postgres:17-bookworm@sha256:051f7b7b3abdd564d5d1bd1e8c4b9c1b6e77087d1dd22020ede611c096a272e0 AS migration
LABEL org.opencontainers.image.licenses="MIT"
RUN apt-get update \
  && apt-get install --no-install-recommends --yes ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY server/src/register/migrations /migrations
COPY scripts/migrate-entrypoint.sh /usr/local/bin/migrate-register
RUN chmod 0555 /usr/local/bin/migrate-register
USER postgres
ENTRYPOINT ["/usr/local/bin/migrate-register"]
