import WebSocket from 'ws';

const PUMP_FUN_PROGRAM='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMPSWAP_PROGRAM='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

export class SolanaAdapter {
  private cb:(x:unknown)=>void;
  private stopped=false;
  constructor(cb:(x:unknown)=>void){this.cb=cb;}

  start(){ this.connect(); }
  stop(){ this.stopped=true; }

  private connect(){
    if(this.stopped) return;
    const url=process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';
    const ws=new WebSocket(url);
    let retry:NodeJS.Timeout|undefined;

    ws.on('open',()=>{
      ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'logsSubscribe',params:[{mentions:[PUMP_FUN_PROGRAM]},{commitment:'confirmed'}]}));
      ws.send(JSON.stringify({jsonrpc:'2.0',id:2,method:'logsSubscribe',params:[{mentions:[PUMPSWAP_PROGRAM]},{commitment:'confirmed'}]}));
      this.cb({type:'chain_status',chain:'solana',status:'connected',sources:['pump.fun','pumpswap']});
    });

    ws.on('message',raw=>{
      try{
        const msg=JSON.parse(raw.toString());
        if(msg.method!=='logsNotification') return;
        const result=msg.params?.result;
        const logs=(result?.value?.logs||[]).join(' ');
        const source=/pAMMBay/i.test(logs)?'pumpswap':'pump.fun';
        let event='trade';
        if(/Instruction: Create/i.test(logs)) event='create';
        else if(/Instruction: Buy/i.test(logs)) event='buy';
        else if(/Instruction: Sell/i.test(logs)) event='sell';
        else if(/Instruction: Migrate|Instruction: Complete/i.test(logs)) event='graduation';
        this.cb({type:'pump_event',chain:'solana',source,event,signature:result?.value?.signature,slot:result?.context?.slot,logs:result?.value?.logs||[]});
      }catch{}
    });

    ws.on('error',()=>this.cb({type:'chain_status',chain:'solana',status:'error'}));
    ws.on('close',()=>{
      this.cb({type:'chain_status',chain:'solana',status:'disconnected'});
      if(!this.stopped) retry=setTimeout(()=>this.connect(),2500);
    });
  }
}
