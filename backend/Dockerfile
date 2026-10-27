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
CMD ["sh", "-c", "S=\"${STORAGE_DIR:-./storage}\"; mkdir -p \"$S\" && cp -rn storage-seed/. \"$S\"/ ; exec node dist/main.js"]
