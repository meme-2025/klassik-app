# Multi-stage Production Backend Dockerfile
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency caching
COPY rest-server/package*.json ./rest-server/
COPY rest-server/ ./rest-server/

# Install dependencies and build
RUN cd rest-server && npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production

# Install security updates and health check tools
RUN apk update && apk upgrade && apk add --no-cache curl dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S kaspa -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=kaspa:nodejs /app/rest-server ./rest-server
COPY --chown=kaspa:nodejs middleware/ ./middleware/

# Install middleware dependencies
RUN cd middleware && npm ci --only=production && npm cache clean --force

# Create logs directory with proper permissions
RUN mkdir -p logs && chown kaspa:nodejs logs

# Switch to non-root user
USER kaspa

# Health check for application readiness
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Expose application port
EXPOSE 8080

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the middleware application
CMD ["sh", "-c", "cd middleware && node src/index.js"]