# Build context is the REPOSITORY ROOT (see docker-compose.yml): the client
# imports the `@presight/shared` workspace, so the whole monorepo manifest set
# has to be present for the install to resolve.

# ---------- build ----------
# Same base as the server image so both sides build against one Node version.
FROM node:22-trixie-slim AS build
WORKDIR /repo

COPY package.json yarn.lock ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Yarn 1 always installs every workspace, so the server's native
# `better-sqlite3` is part of this tree — but the client never loads it, and
# building it would pull in a whole C++ toolchain for nothing. `--ignore-scripts`
# skips its (and every other package's) install hooks; nothing in the client
# build depends on one.
RUN yarn install --frozen-lockfile --ignore-scripts

COPY tsconfig.base.json ./
COPY shared shared
COPY client client

# `shared` must be compiled before the client type-checks against it.
RUN yarn workspace @presight/shared build \
  && yarn workspace presight-client build

# ---------- runtime ----------
# The client is a static bundle; nginx serves it and proxies /api to the API
# container so the browser keeps talking to a single origin (identical to the
# Vite dev proxy).
FROM nginx:1.27-alpine AS runtime

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/client/dist /usr/share/nginx/html

EXPOSE 80
