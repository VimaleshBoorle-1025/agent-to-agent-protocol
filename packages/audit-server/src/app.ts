import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { auditRoutes } from './routes/audit';

export interface AppOptions { testMode?: boolean; logger?: boolean; }

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });
  await app.register(cors, { origin: true });
  await app.register(rateLimit, { max: 500, timeWindow: '1 minute' });
  await app.register(auditRoutes, { prefix: '/v1' });
  app.get('/health', async () => ({ status: 'ok', service: 'aap-audit', timestamp: new Date().toISOString() }));
  return app;
}
