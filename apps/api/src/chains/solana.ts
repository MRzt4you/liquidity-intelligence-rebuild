import WebSocket from 'ws';

const PUMP_FUN_PROGRAM='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const PUMPSWAP_PROGRAM='pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
const LAMPORTS=1_000_000_000;

type Callback=(x:unknown)=>void;

export class SolanaAdapter {
  private cb:Callback; private stopped=false; private ws?:WebSocket;
  constructor(cb:Callback){this.cb=cb;}
  start(){this.connect();}
  stop(){this.stopped=true; this.ws?.close();}

  private connect(){
    if(this.stopped)return;
    const url=process.env.SOLANA_WS_URL||'wss://api.mainnet-beta.solana.com';
    const ws=new WebSocket(url); this.ws=ws;
    ws.on('open',()=>{
      ws.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'logsSubscribe',params:[{mentions:[PUMP_FUN_PROGRAM]},{commitment:'confirmed'}]}));
      ws.send(JSON.stringify({jsonrpc:'2.0',id:2,method:'logsSubscribe',params:[{mentions:[PUMPSWAP_PROGRAM]},{commitment:'confirmed'}]}));
      this.cb({type:'chain_status',chain:'solana',status:'connected',sources:['pump.fun','pumpswap'],live:true});
    });
    ws.on('message',raw=>{ try { const msg=JSON.parse(raw.toString()); if(msg.method!=='logsNotification')return; const r=msg.params?.result; const signature=r?.value?.signature; if(!signature)return; const logs=r?.value?.logs||[]; const joined=logs.join(' '); const source=/pAMMBay/i.test(joined)?'pumpswap':'pump.fun'; let event='TRADE'; if(/Instruction: Create/i.test(joined))event='NEW'; else if(/Instruction: Buy/i.test(joined))event='BUY'; else if(/Instruction: Sell/i.test(joined))event='SELL'; else if(/Instruction: Migrate|Instruction: Complete/i.test(joined))event='GRADUATION'; this.cb({type:'pump_event',chain:'solana',source,event,signature,slot:r?.context?.slot,logs}); if(event==='BUY'||event==='SELL'||event==='NEW')void this.enrich(signature,event); } catch {} });
    ws.on('error',()=>this.cb({type:'chain_status',chain:'solana',status:'error',live:false}));
    ws.on('close',()=>{this.cb({type:'chain_status',chain:'solana',status:'disconnected',live:false}); if(!this.stopped)setTimeout(()=>this.connect(),2500);});
  }

  private async enrich(signature:string,event:string){
    try {
      const rpc=process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com';
      const res=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getTransaction',params:[signature,{encoding:'jsonParsed',commitment:'confirmed',maxSupportedTransactionVersion:0}]} )});
      const body=await res.json() as any; const tx=body?.result; if(!tx)return;
      const keys=tx.transaction?.message?.accountKeys||[]; const wallet=keys.find((k:any)=>k.signer)?.pubkey||'';
      const balances=tx.meta?.postTokenBalances||[]; const pre=tx.meta?.preTokenBalances||[];
      const mints=[...new Set(balances.map((b:any)=>b.mint).concat(pre.map((b:any)=>b.mint)).filter(Boolean))];
      const candidates=mints.filter((m:string)=>!/^So11111111111111111111111111111111111111112$/.test(m));
      for(const mint of candidates){
        const p=pre.filter((b:any)=>b.mint===mint&&b.owner===wallet).reduce((n:number,b:any)=>n+Number(b.uiTokenAmount?.uiAmount||0),0);
        const q=balances.filter((b:any)=>b.mint===mint&&b.owner===wallet).reduce((n:number,b:any)=>n+Number(b.uiTokenAmount?.uiAmount||0),0);
        const tokenDelta=q-p;
        const accountIndex=keys.findIndex((k:any)=>k.pubkey===wallet);
        const preLam=accountIndex>=0?Number(tx.meta?.preBalances?.[accountIndex]||0):0;
        const postLam=accountIndex>=0?Number(tx.meta?.postBalances?.[accountIndex]||0):0;
        const solDelta=(postLam-preLam)/LAMPORTS;
        this.cb({type:'token_activity',chain:'solana',source:'pump.fun',event,mint,wallet,tokenDelta,solDelta:Math.abs(solDelta),signature,slot:tx.slot,blockTime:tx.blockTime||Math.floor(Date.now()/1000)});
        if(event==='NEW')this.cb({type:'token_launch',chain:'solana',mint,wallet,signature,slot:tx.slot,blockTime:tx.blockTime||Math.floor(Date.now()/1000)});
      }
    } catch(e){ this.cb({type:'decode_error',chain:'solana',signature,message:e instanceof Error?e.message:'decode failed'}); }
  }
}
