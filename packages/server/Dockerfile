# ---- Build stage ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps (cache layer)
COPY package*.json ./
COPY packages/server/package*.json packages/server/
RUN npm install -w packages/server

# Copy source and compile TypeScript
COPY packages/server packages/server
RUN npm run build -w packages/server

# ---- Runtime stage ----
FROM node:20-alpine

WORKDIR /app

# Copy compiled output and production deps only
COPY package*.json ./
COPY packages/server/package*.json packages/server/
RUN npm install -w packages/server --omit=dev

COPY --from=builder /app/packages/server/dist packages/server/dist

ENV PORT=8001
ENV NODE_ENV=production
ENV AUDIO_OUTPUT_DIR=/app/outputs
EXPOSE 8001

RUN apk add --no-cache wget && mkdir -p /app/outputs

# ACE-Step と共有する音声出力ディレクトリ
VOLUME ["/app/outputs"]

CMD ["node", "packages/server/dist/index.js"]
