# Kaspa REST Server Dockerfile
# Production-ready - Optimized for 10 BPS Crescendo mode
FROM node:20-alpine

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files
COPY package.json ./
RUN npm install --production && \
    npm cache clean --force

# Copy server
COPY server.js ./

# Create logs directory with proper permissions
RUN mkdir -p /app/logs && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 8081

# Robust health check using curl
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8081/health || exit 1

# Run with explicit error handling
CMD ["node", "--max-old-space-size=512", "server.js"]
