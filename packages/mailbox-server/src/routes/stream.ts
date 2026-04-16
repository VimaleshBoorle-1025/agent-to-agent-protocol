import { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';

/**
 * WebSocket real-time inbox stream.
 * Client connects with Authorization header; server pushes NEW_MESSAGE events
 * whenever a message arrives for their DID.
 *
 * Message format: { type: 'NEW_MESSAGE', message_id: string, from_did: string }
 */
export async function streamRoutes(app: FastifyInstance) {
  // In-memory subscriber map: DID → Set of WebSocket connections
  const subscribers = new Map<string, Set<any>>();

  app.get('/messages/inbox/stream', { websocket: true }, (connection: SocketStream, req) => {
    const ws = connection.socket;
    const authHeader = req.headers['authorization'] as string | undefined;
    if (!authHeader?.startsWith('DID ')) {
      ws.send(JSON.stringify({ type: 'ERROR', error: 'UNAUTHORIZED' }));
      ws.close();
      return;
    }

    const colonIdx = authHeader.indexOf(':', 4);
    const did = authHeader.slice(4, colonIdx > 4 ? colonIdx : undefined);

    if (!did?.startsWith('did:')) {
      ws.send(JSON.stringify({ type: 'ERROR', error: 'INVALID_DID' }));
      ws.close();
      return;
    }

    // Register subscriber
    if (!subscribers.has(did)) subscribers.set(did, new Set());
    subscribers.get(did)!.add(ws);

    ws.send(JSON.stringify({ type: 'CONNECTED', did, message: 'Inbox stream active' }));

    ws.on('close', () => {
      subscribers.get(did)?.delete(ws);
      if (subscribers.get(did)?.size === 0) subscribers.delete(did);
    });
  });

  // Export notifier so message routes can call it on new message
  (app as any).notifyInbox = (to_did: string, event: object) => {
    const sockets = subscribers.get(to_did);
    if (sockets) {
      const payload = JSON.stringify(event);
      sockets.forEach(s => { try { s.send(payload); } catch {} });
    }
  };
}
