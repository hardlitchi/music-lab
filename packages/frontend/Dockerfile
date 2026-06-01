# ---- Build stage ----
FROM node:20-alpine AS builder

# Build-time env var (passed from docker-compose)
ARG VITE_API_BASE_URL=http://localhost:4001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

WORKDIR /app

# Install deps (cache layer)
COPY package*.json ./
COPY packages/frontend/package*.json packages/frontend/
RUN npm install -w packages/frontend

# Copy source and build
COPY packages/frontend packages/frontend
RUN npm run build -w packages/frontend

# ---- Serve stage ----
FROM nginx:1.27-alpine

COPY --from=builder /app/packages/frontend/dist /usr/share/nginx/html
COPY packages/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
