# syntax=docker/dockerfile:1

# ---------- Build stage: frontend ----------
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- Build stage: backend deps ----------
FROM node:20-slim AS backend-deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

# ---------- Runtime stage ----------
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /workspace

# OpenSSL is required by Prisma on Debian slim images
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy backend source + deps
COPY --from=backend-deps /app/backend/node_modules ./backend/node_modules
COPY backend/ ./backend/
# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Regenerate Prisma client for the Linux (debian-openssl-3.0.x) runtime
WORKDIR /workspace/backend
RUN npx prisma generate

# Persistent volume mount points (SQLite data lives here)
RUN mkdir -p /data
ENV DATABASE_URL="file:/data/clinic.db"
ENV UPLOADS_DIR="/data/uploads"
ENV BACKUPS_DIR="/data/backups"
ENV PORT=5000
ENV CORS_ORIGIN=""

WORKDIR /workspace/backend

EXPOSE 5000
CMD ["sh", "-c", "mkdir -p /data/uploads /data/backups && npx prisma db push --skip-generate && node src/utils/seed.js && node src/index.js"]