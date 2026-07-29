# Multi-stage build for FreshGuard → Google Cloud Run
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Production client + bundled server
ENV NODE_ENV=production
RUN npm run build

# --- runtime ---
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Cloud Run expects the process to listen on $PORT
EXPOSE 8080

USER node
CMD ["node", "dist/server.cjs"]
