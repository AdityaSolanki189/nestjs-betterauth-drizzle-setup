# syntax=docker/dockerfile:1
FROM oven/bun:1.4.3-slim AS bun

FROM node:24.22.0-bookworm-slim AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

FROM base AS development
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache HUSKY=0 bun install --frozen-lockfile
COPY . .
EXPOSE 43127
CMD ["bun", "run", "start:dev"]

FROM development AS build
RUN bun run build

FROM base AS production-dependencies
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production --ignore-scripts

FROM node:24.22.0-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 43127
CMD ["node", "--enable-source-maps", "dist/main.js"]
