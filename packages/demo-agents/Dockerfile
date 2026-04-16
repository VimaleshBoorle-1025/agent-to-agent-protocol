FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/demo-agents/package.json ./packages/demo-agents/
RUN npm install --workspaces --if-present
COPY packages/demo-agents ./packages/demo-agents
RUN npm run build --workspace=packages/demo-agents

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/demo-agents/dist ./packages/demo-agents/dist
COPY --from=builder /app/packages/demo-agents/package.json ./packages/demo-agents/
ENV AGENT_NAME=demo.echo.agent
ENV AGENT_PORT=9001
ENV REGISTRY_URL=http://registry:3001
EXPOSE 9001
CMD ["node", "packages/demo-agents/dist/server.js"]
