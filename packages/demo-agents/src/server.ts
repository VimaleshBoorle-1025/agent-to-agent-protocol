/**
 * Entrypoint — reads AGENT_NAME / AGENT_PORT / REGISTRY_URL from env.
 */

import { buildAgentServer } from './agent-server';

const agentName   = process.env.AGENT_NAME   ?? 'demo.echo.agent';
const registryUrl = process.env.REGISTRY_URL ?? 'http://localhost:3001';
const port        = parseInt(process.env.AGENT_PORT ?? '9001', 10);

buildAgentServer({ agentName, registryUrl, port }).then(async (app) => {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`🤖 ${agentName} listening on :${port}`);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
