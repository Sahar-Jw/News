FROM node:22.23.4-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.23.4-alpine
WORKDIR /app
ENV NODE_ENV=production
# su-exec: the entrypoint fixes the volume's owner, then runs the API as the unprivileged "node" user
RUN apk add --no-cache su-exec
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p storage backups && chown node:node storage backups
# keep a copy of the committed images; copied into the mounted volume on start (never overwrites)
COPY --from=build /app/storage ./storage-seed
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:${PORT:-3001}/api/health || exit 1
COPY docker-entrypoint.sh ./
# ENTRYPOINT (not CMD) so a start command set in the hosting panel cannot skip the copy step
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
