# Build context is the REPOSITORY ROOT (see docker-compose.yml), because the
# server depends on the `@presight/shared` workspace and on the root lockfile.
#
# Base image choice is load-bearing, for one reason: `better-sqlite3` ships
# prebuilt bindings *inside its npm tarball* (`prebuilds/linux-<arch>.node`) and
# `lib/binding.js` always prefers them over anything node-gyp compiles. Those
# glibc prebuilds require GLIBC_2.38, so on bookworm-slim (2.36) the install
# succeeds and the binding then fails at runtime with
# `libm.so.6: version GLIBC_2.38 not found`. trixie-slim ships glibc 2.41.

# ---------- deps ----------
FROM node:22-trixie-slim AS deps
WORKDIR /repo

# node-gyp resolves the Node headers from here instead of downloading them from
# https://nodejs.org — the official images already ship a complete set
# (including common.gypi/config.gypi) under /usr/local/include/node. That makes
# the install work on networks that cannot reach nodejs.org, and saves a
# download on every build.
ENV npm_config_nodedir=/usr/local

# `better-sqlite3`'s install script is a bare `node-gyp rebuild`. On the
# architectures it prebuilds for, binding.gyp detects the bundled binary and
# skips the compile; anywhere else it builds from source and needs a toolchain.
# Keeping it here means the image is not silently tied to those architectures.
# The toolchain stays in this stage and never reaches the runtime image.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy only manifests first so `yarn install` is cached until a dependency
# actually changes.
COPY package.json yarn.lock ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN yarn install --frozen-lockfile

# ---------- build ----------
FROM deps AS build
WORKDIR /repo

COPY tsconfig.base.json ./
COPY shared shared
COPY server server

RUN yarn workspace @presight/shared build \
  && yarn workspace presight-server build

# ---------- prod-deps ----------
# A second, production-only install. Without it the runtime image would carry
# the whole monorepo tree — Vite, Vitest, Playwright, Lerna, TypeScript, the
# client's React — because Yarn 1 installs every workspace into one hoisted
# `node_modules` and the runtime stage copies it wholesale. The server needs
# four packages to run.
FROM node:22-trixie-slim AS prod-deps
WORKDIR /repo
ENV npm_config_nodedir=/usr/local

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json yarn.lock ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

RUN yarn install --frozen-lockfile --production

# ---------- runtime ----------
FROM node:22-trixie-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

# Production dependencies only, resolved against the same base image as the
# better-sqlite3 binding they contain.
COPY --from=prod-deps /repo/node_modules node_modules
COPY --from=build /repo/package.json package.json
COPY --from=build /repo/shared/package.json shared/package.json
COPY --from=build /repo/shared/dist shared/dist
COPY --from=build /repo/server/package.json server/package.json
COPY --from=build /repo/server/dist server/dist

# The SQLite volume is mounted at /data and must be writable by the unprivileged
# runtime user. Creating and chowning it here also fixes the ownership Docker
# gives the named volume when it initialises it from the image.
RUN mkdir -p /data && chown -R node:node /data

WORKDIR /repo/server
EXPOSE 4000
USER node

CMD ["node", "dist/index.js"]
