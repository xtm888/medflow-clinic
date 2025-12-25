# MedFlow Backend Dockerfile
# Multi-stage build for security and size optimization

# =====================
# Stage 1: Builder
# =====================
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production

# =====================
# Stage 2: Production
# =====================
FROM node:18-alpine AS production

# Security: Run as non-root user
RUN addgroup -g 1001 -S medflow && \
    adduser -S medflow -u 1001 -G medflow

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy application code
COPY --chown=medflow:medflow . .

# Remove dev files
RUN rm -rf tests/ *.test.js *.spec.js .env.* scripts/seed*.js scripts/create*.js

# Security: Set NODE_ENV
ENV NODE_ENV=production
ENV PORT=5001

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5001/api/health || exit 1

# Switch to non-root user
USER medflow

# Start the application
CMD ["node", "server.js"]
