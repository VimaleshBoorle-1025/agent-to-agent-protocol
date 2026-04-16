import dotenv from 'dotenv';
dotenv.config();
import { buildApp } from './app';

async function start() {
  const app = await buildApp({ logger: true });
  const port = parseInt(process.env.AUDIT_PORT || '3003');
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`AAP Audit Server running on port ${port}`);
}

start().catch(err => { console.error(err); process.exit(1); });
