# AAP Monorepo — unified build image
# Each Railway service sets SERVICE= env var to select which package to run.
# Supported values: registry-server | mailbox-server | audit-server | identity-service | human-auth

FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package*.json ./
COPY packages/crypto/package.json            ./packages/crypto/
COPY packages/intent-compiler/package.json   ./packages/intent-compiler/
COPY packages/registry-server/package.json   ./packages/registry-server/
COPY packages/mailbox-server/package.json    ./packages/mailbox-server/
COPY packages/audit-server/package.json      ./packages/audit-server/
COPY packages/identity-service/package.json  ./packages/identity-service/
COPY packages/human-auth/package.json        ./packages/human-auth/

RUN npm ci --ignore-scripts

# Copy source
COPY packages/crypto/           ./packages/crypto/
COPY packages/intent-compiler/  ./packages/intent-compiler/
COPY packages/registry-server/  ./packages/registry-server/
COPY packages/mailbox-server/   ./packages/mailbox-server/
COPY packages/audit-server/     ./packages/audit-server/
COPY packages/identity-service/ ./packages/identity-service/
COPY packages/human-auth/       ./packages/human-auth/

# Build all packages
RUN npm run build --workspace=packages/crypto && \
    npm run build --workspace=packages/intent-compiler && \
    npm run build --workspace=packages/registry-server && \
    npm run build --workspace=packages/mailbox-server && \
    npm run build --workspace=packages/audit-server && \
    npm run build --workspace=packages/identity-service && \
    npm run build --workspace=packages/human-auth

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules            ./node_modules
COPY --from=builder /app/packages/crypto/dist    ./packages/crypto/dist
COPY --from=builder /app/packages/crypto/package.json ./packages/crypto/
COPY --from=builder /app/packages/intent-compiler/dist   ./packages/intent-compiler/dist
COPY --from=builder /app/packages/intent-compiler/package.json ./packages/intent-compiler/
COPY --from=builder /app/packages/registry-server/dist   ./packages/registry-server/dist
COPY --from=builder /app/packages/registry-server/package.json ./packages/registry-server/
COPY --from=builder /app/packages/mailbox-server/dist    ./packages/mailbox-server/dist
COPY --from=builder /app/packages/mailbox-server/package.json ./packages/mailbox-server/
COPY --from=builder /app/packages/audit-server/dist      ./packages/audit-server/dist
COPY --from=builder /app/packages/audit-server/package.json ./packages/audit-server/
COPY --from=builder /app/packages/identity-service/dist  ./packages/identity-service/dist
COPY --from=builder /app/packages/identity-service/package.json ./packages/identity-service/
COPY --from=builder /app/packages/human-auth/dist        ./packages/human-auth/dist
COPY --from=builder /app/packages/human-auth/package.json ./packages/human-auth/

COPY start.sh ./start.sh
RUN chmod +x ./start.sh

ENV NODE_ENV=production
CMD ["sh", "start.sh"]
