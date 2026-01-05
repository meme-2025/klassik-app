# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
RUN npm install -g pnpm@8.15.4

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY turbo.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/backend ./apps/backend
COPY tsconfig.base.json ./

# Build application
RUN pnpm --filter @kaspa-rush/backend build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/node_modules ./node_modules
COPY --from=builder /app/apps/backend/package.json ./

EXPOSE 4000

CMD ["node", "dist/main.js"]
