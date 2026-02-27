FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
LABEL org.opencontainers.image.source="https://github.com/scottrobertson/seekarr"
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
RUN npm prune --omit=dev
ENV CONFIG_PATH=/app/config/config.yml
ENV DATA_PATH=/app/data
USER node
CMD ["node", "dist/index.js"]
