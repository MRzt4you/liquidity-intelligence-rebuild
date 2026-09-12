import WebSocket from 'ws';

export class BnbAdapter {
  private cb: (x: unknown) => void;
  constructor(cb: (x: unknown) => void) { this.cb = cb; }

  start() {
    const url = process.env.BNB_WS_URL;
    if (!url) return;
    const ws = new WebSocket(url);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        jsonrpc:'2.0', id:1, method:'eth_subscribe', params:['newHeads']
      }));
      this.cb({type:'chain_status', chain:'bnb', status:'connected'});
    });
    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.method === 'eth_subscription') {
          this.cb({type:'chain_event',chain:'bnb',event:msg.params.result});
        }
      } catch {}
    });
    ws.on('close', () => this.cb({type:'chain_status',chain:'bnb',status:'disconnected'}));
  }
}
