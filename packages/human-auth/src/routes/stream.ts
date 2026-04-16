/**
 * WebSocket stream — human operators connect here to receive real-time
 * approval requests as they arrive (Cat 3/4 actions).
 */

import { FastifyInstance } from 'fastify';
import { approvalQueue } from '../queue';

export async function streamRoutes(app: FastifyInstance) {
  app.get('/v1/authorize/stream', { websocket: true }, (connection) => {
    const ws = connection.socket;
    const unsub = approvalQueue.subscribe((request) => {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(JSON.stringify({ type: 'APPROVAL_REQUESTED', data: request }));
      }
    });

    ws.on('close', () => unsub());
  });
}
