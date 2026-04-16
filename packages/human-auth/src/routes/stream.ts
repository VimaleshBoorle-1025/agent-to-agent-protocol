/**
 * WebSocket stream — human operators connect here to receive real-time
 * approval requests as they arrive (Cat 3/4 actions).
 */

import { FastifyInstance } from 'fastify';
import { approvalQueue } from '../queue';

export async function streamRoutes(app: FastifyInstance) {
  app.get('/v1/authorize/stream', { websocket: true }, (socket) => {
    const unsub = approvalQueue.subscribe((request) => {
      if (socket.readyState === 1 /* OPEN */) {
        socket.send(JSON.stringify({ type: 'APPROVAL_REQUESTED', data: request }));
      }
    });

    socket.on('close', () => unsub());
  });
}
