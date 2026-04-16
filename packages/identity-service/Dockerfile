FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/identity-service/package.json ./packages/identity-service/
RUN npm install --workspaces --if-present
COPY packages/crypto ./packages/crypto
COPY packages/identity-service ./packages/identity-service
RUN npm run build --workspace=packages/crypto
RUN npm run build --workspace=packages/identity-service

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/crypto/dist ./packages/crypto/dist
COPY --from=builder /app/packages/crypto/package.json ./packages/crypto/
COPY --from=builder /app/packages/identity-service/dist ./packages/identity-service/dist
COPY --from=builder /app/packages/identity-service/package.json ./packages/identity-service/
EXPOSE 3004
CMD ["node", "packages/identity-service/dist/index.js"]
