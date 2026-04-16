FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/intent-compiler/package.json ./packages/intent-compiler/
COPY packages/mailbox-server/package.json ./packages/mailbox-server/
RUN npm install --workspaces --if-present
COPY packages/crypto ./packages/crypto
COPY packages/intent-compiler ./packages/intent-compiler
COPY packages/mailbox-server ./packages/mailbox-server
RUN npm run build --workspace=packages/crypto
RUN npm run build --workspace=packages/intent-compiler
RUN npm run build --workspace=packages/mailbox-server

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/crypto/dist ./packages/crypto/dist
COPY --from=builder /app/packages/crypto/package.json ./packages/crypto/
COPY --from=builder /app/packages/intent-compiler/dist ./packages/intent-compiler/dist
COPY --from=builder /app/packages/intent-compiler/package.json ./packages/intent-compiler/
COPY --from=builder /app/packages/mailbox-server/dist ./packages/mailbox-server/dist
COPY --from=builder /app/packages/mailbox-server/package.json ./packages/mailbox-server/
EXPOSE 3002
CMD ["node", "packages/mailbox-server/dist/index.js"]
