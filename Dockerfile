# syntax=docker/dockerfile:1
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm test && pnpm check && pnpm build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=3099
ENV VISUAL_RADAR_DATA_DIR=/app/data
WORKDIR /app
RUN addgroup -S visualradar && adduser -S visualradar -G visualradar
COPY --from=build --chown=visualradar:visualradar /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build --chown=visualradar:visualradar /app/node_modules ./node_modules
COPY --from=build --chown=visualradar:visualradar /app/dist ./dist
COPY --from=build --chown=visualradar:visualradar /app/data ./data
USER visualradar
VOLUME ["/app/data"]
EXPOSE 3099
CMD ["node", "dist/index.js"]
