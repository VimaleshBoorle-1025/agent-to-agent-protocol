import { buildApp } from './app';

const PORT = parseInt(process.env.PORT ?? '3005', 10);

buildApp().then(async (app) => {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🔐 human-auth service listening on :${PORT}`);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
