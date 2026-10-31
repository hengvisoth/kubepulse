# Multi-stage Dockerfile for KubePulse Backend
# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

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

# Security: Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy package files and install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev && \
    npx prisma generate && \
    npm cache clean --force

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Set permissions
USER nodejs

EXPOSE 5000

# Start server
CMD ["node", "dist/index.js"]
