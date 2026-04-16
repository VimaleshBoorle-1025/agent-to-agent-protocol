FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/audit-server/package.json ./packages/audit-server/
RUN npm install --workspaces --if-present
COPY packages/crypto ./packages/crypto
COPY packages/audit-server ./packages/audit-server
RUN npm run build --workspace=packages/crypto
RUN npm run build --workspace=packages/audit-server

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/crypto/dist ./packages/crypto/dist
COPY --from=builder /app/packages/crypto/package.json ./packages/crypto/
COPY --from=builder /app/packages/audit-server/dist ./packages/audit-server/dist
COPY --from=builder /app/packages/audit-server/package.json ./packages/audit-server/
EXPOSE 3003
CMD ["node", "packages/audit-server/dist/index.js"]
