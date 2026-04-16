import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { certificateRoutes } from './routes/certificates';

dotenv.config();

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  await app.register(cors, { origin: true });
  await app.register(certificateRoutes, { prefix: '/v1' });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'aap-identity-service',
  }));

  return app;
}

// Only start server when run directly (not imported by tests)
if (require.main === module) {
  buildApp().then((app) => {
    const port = parseInt(process.env.IDENTITY_PORT || '3004');
    app.listen({ port, host: '0.0.0.0' }).then(() => {
      console.log(`AAP Identity Service running on port ${port}`);
    });
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
