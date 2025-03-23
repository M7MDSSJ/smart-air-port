# Build Stage
FROM node:18-alpine AS builder

# Install necessary packages including bash
RUN apk add --no-cache curl bash

# Install Bun using bash
RUN curl -fsSL https://bun.sh/install | bash && \
    if [ ! -f /root/.bun/bin/bun ]; then echo "Bun installation failed" && exit 1; fi && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy package files and install dependencies with Bun
COPY package*.json ./
RUN bun install

# Copy source files and build the application
COPY . .
RUN bun run build

# Production Stage
FROM node:18-alpine

# Install necessary packages including bash
RUN apk add --no-cache curl bash

# Install Bun using bash
RUN curl -fsSL https://bun.sh/install | bash && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

WORKDIR /app

# Copy only the built files and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN bun install --production

# Run as a non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose the port (default 443 for HTTPS)
EXPOSE 443

# Start the application with Bun
CMD ["bun", "dist/main.js"]