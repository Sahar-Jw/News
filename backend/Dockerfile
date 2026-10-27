FROM node:22.23.4-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.23.4-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
RUN mkdir -p storage
# keep a copy of the committed images; copied into the mounted volume on start (never overwrites)
COPY --from=build /app/storage ./storage-seed
EXPOSE 3001
COPY docker-entrypoint.sh ./
# ENTRYPOINT (not CMD) so a start command set in the hosting panel cannot skip the copy step
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
