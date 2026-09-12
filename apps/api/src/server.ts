import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { SignalEngine } from './engines/signal';
import { SolanaAdapter } from './chains/solana';
import { BnbAdapter } from './chains/bnb';
import { StampedeEngine } from './engines/stampede';

const app=Fastify({logger:true});
const signal=new SignalEngine();
const stampede=new StampedeEngine();
const recent:any[]=[];
const MAX=1000;

async function main(){
  await app.register(cors,{origin:true});
  app.get('/health',async()=>({ok:true,service:'liquidity-api',data:'live-on-chain'}));
  app.get('/api/signals',async()=>[]);
  app.get('/api/live/tokens',async()=>stampede.snapshot(150));
  app.get('/api/live/events',async()=>recent.slice(0,200));
  const server=await app.listen({port:Number(process.env.API_PORT||4000),host:'0.0.0.0'});
  const wss=new WebSocketServer({server:app.server});
  wss.on('connection',ws=>ws.send(JSON.stringify({type:'connected',ts:Date.now(),mode:'LIVE',mock:false})));
  const broadcast=(event:any)=>{
    if(event?.type==='token_activity') stampede.observe({wallet:event.wallet,mint:event.mint,side:event.tokenDelta>=0?'BUY':'SELL',sol:event.solDelta,ts:Number(event.blockTime||Math.floor(Date.now()/1000))*1000,signature:event.signature});
    if(event?.type==='token_launch') stampede.observe({wallet:event.wallet,mint:event.mint,side:'BUY',sol:0,ts:Number(event.blockTime||Math.floor(Date.now()/1000))*1000,signature:event.signature});
    const enriched=event?.type==='token_activity'||event?.type==='token_launch'?{...event,tokens:stampede.snapshot(150)}:event;
    recent.unshift(enriched); if(recent.length>MAX)recent.length=MAX;
    const data=JSON.stringify(enriched); wss.clients.forEach(c=>c.readyState===1&&c.send(data));
  };
  const sol=new SolanaAdapter(broadcast); sol.start();
  const bnb=new BnbAdapter(broadcast); bnb.start();
  app.log.info(`LIVE API listening at ${server}`);
}
main().catch(err=>{app.log.error(err);process.exit(1)});
