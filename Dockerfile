# wa-edu-bot — production image
# Runs the app via tsx (no compile step; tsconfig has noEmit).
FROM node:22-slim

# Prisma on Debian slim needs OpenSSL for the query engine.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

# 1) Install deps first for better layer caching.
#    devDependencies are needed at runtime because we run with tsx.
COPY package.json package-lock.json* ./
RUN npm ci

# 2) Prisma needs the schema present BEFORE `prisma generate`.
#    Copy it (and seed) before generating the client.
COPY prisma ./prisma
RUN npx prisma generate

# 3) Copy the rest of the source.
COPY . .

# The webhook server listens on PORT (default 3000).
EXPOSE 3000

# Always-on process: hosts the webhook server AND node-cron jobs.
CMD ["npm", "start"]
