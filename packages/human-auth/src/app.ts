import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { authorizeRoutes } from './routes/authorize';
import { streamRoutes } from './routes/stream';

export async function buildApp(opts: { testMode?: boolean } = {}) {
  const app = Fastify({
    logger: opts.testMode ? false : { level: 'info' },
  });

  await app.register(websocket);

  app.get('/health', async () => ({ status: 'ok', service: 'human-auth' }));

  await app.register(authorizeRoutes);
  await app.register(streamRoutes);

  return app;
}
