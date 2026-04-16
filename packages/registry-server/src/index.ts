import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './routes/register';
import { lookupRoutes } from './routes/lookup';
import { collabRoutes } from './routes/collab';
import { db } from './db/client';

const app = Fastify({ logger: true });

async function start() {
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX_READS || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  });

  await app.register(registerRoutes, { prefix: '/v1' });
  await app.register(lookupRoutes,   { prefix: '/v1' });
  await app.register(collabRoutes,   { prefix: '/v1' });

  app.get('/health', async () => ({ status: 'ok', service: 'aap-registry' }));

  const port = parseInt(process.env.REGISTRY_PORT || '3001');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`AAP Registry running on port ${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
