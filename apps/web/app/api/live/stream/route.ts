import {buildSolamiUrl,normalizeSolami} from '../../../../lib/solami-blur';

const PUBLIC_WS=['wss://api.mainnet-beta.solana.com','wss://solana-rpc.publicnode.com'];
const ENV_WS=(process.env.SOLANA_WS_URLS||process.env.SOLANA_WS_URL||'').split(',').map(x=>x.trim()).filter(Boolean);
const HeliusWs=process.env.HELIUS_API_KEY?`wss://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`:'';
const AlchemyWs=process.env.ALCHEMY_API_KEY?`wss://solana-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`:'';
const WS_URLS=Array.from(new Set([HeliusWs,AlchemyWs,...ENV_WS,...PUBLIC_WS].filter(Boolean)));
const SOLAMI_KEY=process.env.SOLAMI_API_KEY||'';
const SOLAMI_URL=buildSolamiUrl(process.env.SOLAMI_DATA_WS_URL||'wss://ws.solami.dev/data/subscribe?chain=solana',SOLAMI_KEY);
const USE_SOLAMI=!!SOLAMI_KEY;
const PROGRAMS=['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P','pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'];
const PUMPPORTAL_URL='wss://pumpportal.fun/api/data';
export const runtime='edge'; export const dynamic='force-dynamic';

export async function GET(request:Request){
 if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('Expected WebSocket',{status:426});
 const [client,server]=Object.values(new WebSocketPair()); server.accept();
 let closed=false,remote:WebSocket|null=null,reconnectTimer:any=null,healthTimer:any=null,watchdog:any=null;
 let reconnectDelay=500,providerIndex=0,reconnecting=false,events=0,lastEventAt=0,connectedAt=0,attempt=0;
 const providers=Array.from(new Set([PUMPPORTAL_URL,...(USE_SOLAMI?[SOLAMI_URL]:[]),...WS_URLS]));
 const source=(url:string)=>url.includes('pumpportal')?'pumpportal-ws':USE_SOLAMI&&url===SOLAMI_URL?'solami-blur':providerName(url);
 const providerName=(url:string)=>url.includes('helius')?'helius-ws':url.includes('alchemy')?'alchemy-ws':url.includes('publicnode')?'publicnode-ws':url.includes('mainnet-beta.solana')?'solana-public-ws':url?'custom-ws':'none';
 const send=(x:any)=>{if(!closed)try{server.send(JSON.stringify({...x,serverTime:Date.now()}))}catch{}};
 const closeRemote=()=>{const ws=remote;remote=null;try{ws?.close(1000,'reconnect')}catch{}};
 const cleanup=()=>{if(reconnectTimer)clearTimeout(reconnectTimer);if(healthTimer)clearInterval(healthTimer);if(watchdog)clearInterval(watchdog);reconnectTimer=healthTimer=watchdog=null};
 const shutdown=(code:number,reason:string)=>{if(closed)return;closed=true;cleanup();closeRemote();try{server.close(code,reason)}catch{}};
 const scheduleReconnect=(reason:string)=>{
   if(closed||reconnecting)return;
   reconnecting=true; providerIndex=(providerIndex+1)%providers.length; closeRemote();
   const delay=Math.min(12000,reconnectDelay); reconnectDelay=Math.min(12000,Math.round(reconnectDelay*1.7));
   send({type:'upstream',state:'reconnecting',reason,source:source(providers[providerIndex]),events,lastEventAt:lastEventAt||null,delay,attempt:++attempt});
   reconnectTimer=setTimeout(async()=>{reconnectTimer=null;reconnecting=false;const ok=await connectUpstream();if(!ok)scheduleReconnect('retry after failed connection')},delay);
 };
 const connectUpstream=async():Promise<boolean>=>{
   if(closed)return false;
   const url=providers[providerIndex]||providers[0]; const solami=USE_SOLAMI&&url===SOLAMI_URL; const pumpPortal=url===PUMPPORTAL_URL;
   try{
     const upstream=await fetch(url,{headers:{Upgrade:'websocket',Connection:'Upgrade'}}); const ws=upstream.webSocket;
     if(!ws){scheduleReconnect(`websocket upgrade unavailable: ${source(url)}`);return false}
     remote=ws; ws.accept(); connectedAt=Date.now(); reconnecting=false; reconnectDelay=500;
     send({type:'upstream',state:'connected',source:source(url),provider:url,events,lastEventAt:lastEventAt||null});
     ws.addEventListener('message',event=>{
       if(closed||remote!==ws)return;
       try{const msg=JSON.parse(String(event.data));
         if(solami){if(msg?.type==='error'||msg?.error){scheduleReconnect(String(msg?.error?.message||msg?.message||'Solami stream error'));return}const parsed=normalizeSolami(msg);if(!parsed)return;events++;lastEventAt=Date.now();send({type:'event',event:parsed,eventType:parsed.event,source:'solami-blur',events,lastEventAt});return}
         if(pumpPortal){if(msg?.message?.toLowerCase?.().includes('error')){scheduleReconnect(String(msg.message));return}const eventType=msg?.txType==='create'?'TOKEN_CREATE':msg?.txType==='buy'?'BUY':msg?.txType==='sell'?'SELL':msg?.txType==='addLiquidity'?'LIQUIDITY_ADD':msg?.txType==='removeLiquidity'?'LIQUIDITY_REMOVE':msg?.signature?'PUMP_EVENT':'PUMP_EVENT';if(!msg?.signature&&!msg?.mint&&!msg?.token&&!msg?.txType)return;events++;lastEventAt=Date.now();send({type:'event',eventType,source:'pumpportal-ws',events,lastEventAt,event:msg});return}
         if(msg.id===1||msg.id===2){if(msg.error){scheduleReconnect(String(msg.error.message||'subscription error'));return}if(msg.result!==undefined)send({type:'subscription',id:msg.id,result:msg.result});return}
         if(msg.method==='logsNotification'){events++;lastEventAt=Date.now();send({type:'event',eventType:'ONCHAIN_LOG',source:source(url),events,lastEventAt,log:msg.params});send({type:'logs',data:msg.params})}
       }catch{}
     });
     ws.addEventListener('error',()=>{if(remote===ws)scheduleReconnect(`${source(url)} upstream error`)});
     ws.addEventListener('close',()=>{if(remote===ws)scheduleReconnect(`${source(url)} upstream closed`)});
     if(pumpPortal){try{ws.send(JSON.stringify({method:'subscribeNewToken'}));ws.send(JSON.stringify({method:'subscribeAccountTrade',keys:[]}));}catch{try{ws.send(JSON.stringify({method:'subscribeNewToken'}))}catch{scheduleReconnect('pumpportal subscription send failed');return false}}}
     else if(solami){for(const filter of [{type:'token_create'},{type:'swap',dex:'pumpswap'},{type:'liquidity',dex:'pumpswap'},{type:'pool_create',dex:'pumpswap'}])try{ws.send(JSON.stringify(filter))}catch{scheduleReconnect('subscription send failed');return false}}
     else try{PROGRAMS.forEach((program,i)=>ws.send(JSON.stringify({jsonrpc:'2.0',id:i+1,method:'logsSubscribe',params:[{mentions:[program]},{commitment:'confirmed'}]})))}catch{scheduleReconnect('subscription send failed');return false}
     return true;
   }catch(error){scheduleReconnect(error instanceof Error?error.message:'upstream fetch failed');return false}
 };
 server.addEventListener('message',(event:any)=>{try{const msg=JSON.parse(String(event.data));if(msg?.type==='ping')send({type:'pong',events,lastEventAt:lastEventAt||null,source:source(providers[providerIndex]||'')})}catch{}});
 server.addEventListener('close',()=>shutdown(1000,'client closed')); server.addEventListener('error',()=>shutdown(1011,'client error'));
 const ok=await connectUpstream();if(!ok&&!reconnecting)scheduleReconnect('initial connection failed');
 send({type:'ready',source:source(providers[providerIndex]||''),providers:providers.length,mode:'multi-provider-event-verified'});
 healthTimer=setInterval(()=>{if(closed)return;const sinceEvent=lastEventAt?Date.now()-lastEventAt:null;const sinceConnect=connectedAt?Date.now()-connectedAt:null;send({type:'health',state:remote?(lastEventAt&&sinceEvent<30000?'LIVE':'CONNECTED_NO_EVENTS'):'RECONNECTING',source:source(providers[providerIndex]||''),events,lastEventAt:lastEventAt||null,silentMs:sinceEvent,connectedMs:sinceConnect,reconnecting,providerIndex,providers:providers.length})},5000);
 watchdog=setInterval(()=>{if(closed||reconnecting||!remote)return;const silent=lastEventAt?Date.now()-lastEventAt:Date.now()-connectedAt;if(silent>30000)scheduleReconnect(lastEventAt?'upstream silent for 30s':'upstream connected without events for 30s')},5000);
 return new Response(null,{status:101,webSocket:client});
}
