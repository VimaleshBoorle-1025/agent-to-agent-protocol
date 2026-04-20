import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import { messageRoutes } from './routes/messages';
import { streamRoutes }  from './routes/stream';
import { sessionRoutes } from './routes/session';
import { pollRoutes }    from './routes/poll';

export interface AppOptions {
  testMode?: boolean;
  logger?: boolean;
}

export async function buildApp(opts: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? false });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  });
  await app.register(websocket);

  await app.register(messageRoutes, { prefix: '/v1', testMode: opts.testMode });
  await app.register(streamRoutes,  { prefix: '/v1' });
  await app.register(sessionRoutes, { prefix: '/v1' });
  await app.register(pollRoutes,    { prefix: '/v1', testMode: opts.testMode });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'aap-mailbox',
    timestamp: new Date().toISOString(),
  }));

  return app;
}
