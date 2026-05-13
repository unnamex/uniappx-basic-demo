ARG  NODE_VERSION=22
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# Enable Corepack and install pnpm (Corepack reads packageManager from package.json)
RUN corepack enable && \
    corepack prepare pnpm@10.28.0 --activate && \
    pnpm --version

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build
RUN pnpm run build

#FROM nginxinc/nginx-unprivileged:stable-alpine
#COPY --from=builder /app/dist /usr/share/nginx/html

FROM joseluisq/static-web-server:latest
COPY --from=builder /app/dist /public
