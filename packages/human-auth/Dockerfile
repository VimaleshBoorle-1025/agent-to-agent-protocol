FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/human-auth/package.json ./packages/human-auth/
RUN npm install --workspaces --if-present
COPY packages/human-auth ./packages/human-auth
RUN npm run build --workspace=packages/human-auth

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/human-auth/dist ./packages/human-auth/dist
COPY --from=builder /app/packages/human-auth/package.json ./packages/human-auth/
EXPOSE 3005
CMD ["node", "packages/human-auth/dist/index.js"]
