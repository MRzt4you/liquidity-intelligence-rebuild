const RPC_WS_URLS=(process.env.SOLANA_WS_URLS||process.env.SOLANA_WS_URL||'wss://solana-rpc.publicnode.com').split(',').map(x=>x.trim()).filter(Boolean);
const PROGRAMS=['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P','pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'];
export const runtime='edge';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('Expected WebSocket',{status:426});
  const [client,server]=Object.values(new WebSocketPair());
  server.accept();
  let closed=false,remote:WebSocket|null=null,pingTimer:any=null,reconnectTimer:any=null;
  let reconnecting=false,reconnectDelay=1000,providerIndex=0;
  const subscriptions=new Map<number,string>();
  const closeRemote=()=>{try{remote?.close(1000,'reconnect')}catch{};remote=null};
  const shutdown=(code:number,reason:string)=>{if(closed)return;closed=true;if(pingTimer)clearInterval(pingTimer);if(reconnectTimer)clearTimeout(reconnectTimer);closeRemote();try{server.close(code,reason)}catch{}};
  const fail=(reason:string)=>{if(closed||reconnecting)return;reconnecting=true;providerIndex=(providerIndex+1)%Math.max(1,RPC_WS_URLS.length);closeRemote();const delay=Math.min(30000,reconnectDelay)*(0.75+Math.random()*0.5);reconnectDelay=Math.min(30000,reconnectDelay*2);try{server.send(JSON.stringify({type:'upstream',state:'reconnecting',reason,provider:RPC_WS_URLS[providerIndex],delay:Math.round(delay),ts:Date.now()}))}catch{};reconnectTimer=setTimeout(()=>shutdown(1012,'upstream reconnect'),Math.min(1000,Math.max(250,Math.round(delay))));};
  const connectUpstream=async():Promise<boolean>=>{if(closed)return false;const url=RPC_WS_URLS[providerIndex]||RPC_WS_URLS[0];try{const upstream=await fetch(url,{headers:{Upgrade:'websocket',Connection:'Upgrade'}});const ws=upstream.webSocket;if(!ws)return false;remote=ws;ws.accept();reconnecting=false;reconnectDelay=1000;ws.addEventListener('message',event=>{if(closed||remote!==ws)return;try{const msg=JSON.parse(String(event.data));if(msg.id===1||msg.id===2){if(typeof msg.result==='number')subscriptions.set(msg.id,msg.result);if(msg.error)fail(String(msg.error.message||'subscription error'));return}if(msg.method==='logsNotification')server.send(JSON.stringify({type:'logs',data:msg.params}))}catch{}});ws.addEventListener('error',()=>{if(remote===ws)fail('upstream error')});ws.addEventListener('close',()=>{if(remote===ws)fail('upstream closed')});try{PROGRAMS.forEach((program,i)=>ws.send(JSON.stringify({jsonrpc:'2.0',id:i+1,method:'logsSubscribe',params:[{mentions:[program]},{commitment:'processed'}]})))}catch{closeRemote();return false}server.send(JSON.stringify({type:'upstream',state:'connected',source:'solana-pubsub',provider:url,ts:Date.now()}));return true}catch{return false}};
  server.addEventListener('message',event=>{if(closed)return;try{const msg=JSON.parse(String(event.data));if(msg?.type==='ping')server.send(JSON.stringify({type:'pong',ts:Date.now()}))}catch{}});
  server.addEventListener('close',()=>shutdown(1000,'client closed'));server.addEventListener('error',()=>shutdown(1011,'client error'));
  const ok=await connectUpstream();if(!ok)fail('initial connection failed');else server.send(JSON.stringify({type:'ready',source:'solana-pubsub',programs:PROGRAMS,commitment:'processed'}));
  pingTimer=setInterval(()=>{if(!closed)try{server.send(JSON.stringify({type:'ping',ts:Date.now()}))}catch{}},15000);
  return new Response(null,{status:101,webSocket:client});
}
