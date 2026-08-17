# Build stage — compile TypeScript.
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

# Runtime stage — production deps only.
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
# Cloud Run injects PORT; the server reads it (defaults to 8080).
CMD ["node", "dist/index.js"]
