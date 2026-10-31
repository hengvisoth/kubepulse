# Multi-stage Dockerfile for KubePulse Backend
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma picks its query engine by detecting OpenSSL. Alpine ships none, so it
# falls back to openssl-1.1.x, which current Alpine images do not have.
RUN apk add --no-cache openssl

# Install build dependencies
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for tsc)
RUN npm install

# Generate Prisma Client
RUN npx prisma generate

# Copy source code and build
COPY src ./src
RUN npm run build

# Stage 2: Production runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Needed at runtime too: Prisma loads libssl.so.3 from this package
RUN apk add --no-cache openssl

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy package files and install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev && \
    npm cache clean --force

# Reuse the client generated in the builder. The prisma CLI is a devDependency,
# so running `npx prisma generate` here would fetch an unpinned latest CLI.
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Set permissions
USER nodejs

EXPOSE 5000

# Start server
CMD ["node", "dist/index.js"]
