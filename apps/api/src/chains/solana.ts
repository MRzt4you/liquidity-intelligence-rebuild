import WebSocket from 'ws';

export class SolanaAdapter {
  private cb: (x: unknown) => void;
  constructor(cb: (x: unknown) => void) { this.cb = cb; }

  start() {
    const url = process.env.SOLANA_WS_URL;
    if (!url) return;
    const ws = new WebSocket(url);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        jsonrpc:'2.0', id:1, method:'logsSubscribe',
        params:[{mentions:[]},{commitment:'confirmed'}]
      }));
      this.cb({type:'chain_status', chain:'solana', status:'connected'});
    });
    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.method === 'logsNotification') {
          this.cb({type:'chain_event', chain:'solana', event:msg.params.result});
        }
      } catch {}
    });
    ws.on('close', () => this.cb({type:'chain_status',chain:'solana',status:'disconnected'}));
  }
}
