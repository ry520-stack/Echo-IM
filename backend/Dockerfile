FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci
COPY . .
COPY prisma/schema.prod.prisma prisma/schema.prisma
RUN npx prisma generate && npm run build

FROM node:20 AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
