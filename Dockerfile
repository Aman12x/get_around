# syntax=docker/dockerfile:1

# ---- build: compile the game (Vite) and the server (esbuild) ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- runtime: production dependencies + build output only ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY drizzle ./drizzle
USER node
# Railway provides PORT; 8787 is the local default.
EXPOSE 8787
CMD ["node", "dist-server/index.js"]
