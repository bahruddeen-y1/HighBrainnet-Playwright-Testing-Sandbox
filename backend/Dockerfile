# HighBrainnet backend — production image
FROM node:22-alpine AS base
WORKDIR /app

# ---- deps ----
FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
COPY src ./src

EXPOSE 4000

# migrate on boot then start
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
