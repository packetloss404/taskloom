# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build:web
RUN npm run typecheck
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=8484 \
    TASKLOOM_STORE=sqlite \
    TASKLOOM_DB_PATH=/app/data/taskloom.sqlite \
    TASKLOOM_SANDBOX_DRIVER=docker \
    TASKLOOM_ARTIFACT_SERVING_ENABLED=false

WORKDIR /app
RUN groupadd --system taskloom \
  && useradd --system --gid taskloom --home-dir /app taskloom \
  && mkdir -p /app/data/artifacts \
  && chown -R taskloom:taskloom /app

COPY --from=build --chown=taskloom:taskloom /app/package.json /app/package-lock.json ./
COPY --from=build --chown=taskloom:taskloom /app/node_modules ./node_modules
COPY --from=build --chown=taskloom:taskloom /app/src ./src
COPY --from=build --chown=taskloom:taskloom /app/web/dist ./web/dist

USER taskloom
EXPOSE 8484
VOLUME ["/app/data"]
CMD ["node", "--import", "tsx", "src/server.ts"]
