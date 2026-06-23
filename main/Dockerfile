# FreshGuard frontend — Vite SPA + Express proxy (Cloud Run)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY . .
ARG GOOGLE_MAPS_PLATFORM_KEY=""
ENV GOOGLE_MAPS_PLATFORM_KEY=$GOOGLE_MAPS_PLATFORM_KEY
ENV NODE_ENV=production
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
