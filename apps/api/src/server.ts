import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { SignalEngine } from './engines/signal';
import { SolanaAdapter } from './chains/solana';
import { BnbAdapter } from './chains/bnb';

const app = Fastify({ logger: true });
const signal = new SignalEngine();

async function main() {
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ ok: true, service: 'liquidity-api' }));
  app.get('/api/signals', async () => signal.recent());

  const server = await app.listen({ port: Number(process.env.API_PORT || 4000), host: '0.0.0.0' });
  const wss = new WebSocketServer({ server: app.server });

  wss.on('connection', ws => {
    ws.send(JSON.stringify({ type: 'connected', ts: Date.now() }));
  });

  const broadcast = (event: unknown) => {
    const data = JSON.stringify(event);
    wss.clients.forEach(c => c.readyState === 1 && c.send(data));
  };

  const sol = new SolanaAdapter(broadcast);
  const bnb = new BnbAdapter(broadcast);
  sol.start();
  bnb.start();

  app.log.info(`API listening at ${server}`);
}
main().catch(err => { app.log.error(err); process.exit(1); });
