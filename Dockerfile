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
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
ENV CONFIG_PATH=/seekarr/config.yml
ENV DATA_PATH=/seekarr/data
USER node
CMD ["node", "dist/index.js"]
