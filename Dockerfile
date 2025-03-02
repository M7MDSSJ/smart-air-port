# Use a lightweight base image
FROM ubuntu:20.04

# Install dependencies and Bun
RUN apt-get update && apt-get install -y curl unzip && \
    curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/bun

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN bun install

# Copy application files
COPY . .

# Build the application
RUN bun run build

# Expose port
EXPOSE 3000

# Run with Bun
CMD ["bun", "run", "dist/main.js"]