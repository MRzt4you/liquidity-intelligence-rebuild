const RPC_WS=process.env.SOLANA_WS_URL||'wss://solana-rpc.publicnode.com';
const PROGRAMS=['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P','pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'];
export const runtime='edge';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('Expected WebSocket',{status:426});
  const [client,server]=Object.values(new WebSocketPair());
  server.accept({allowHalfOpen:true});
  const upstream=await fetch(RPC_WS,{headers:{Upgrade:'websocket'}});
  const remote=upstream.webSocket;
  if(!remote){server.close(1011,'upstream websocket unavailable');return new Response('Upstream WebSocket unavailable',{status:502});}
  remote.accept({allowHalfOpen:true});
  const subscriptions=new Map<number,string>();
  remote.addEventListener('message',event=>{
    try{
      const msg=JSON.parse(String(event.data));
      if(msg.id===1||msg.id===2){if(typeof msg.result==='number')subscriptions.set(msg.id,msg.result);return;}
      if(msg.method==='logsNotification')server.send(JSON.stringify({type:'logs',data:msg.params}));
    }catch{}
  });
  remote.addEventListener('close',()=>{try{server.close(1012,'upstream closed')}catch{}});
  remote.addEventListener('error',()=>{try{server.close(1011,'upstream error')}catch{}});
  server.addEventListener('message',event=>{try{const msg=JSON.parse(String(event.data));if(msg?.type==='ping')server.send(JSON.stringify({type:'pong',ts:Date.now()}))}catch{}});
  PROGRAMS.forEach((program,i)=>remote.send(JSON.stringify({jsonrpc:'2.0',id:i+1,method:'logsSubscribe',params:[{mentions:[program]},{commitment:'processed'}]})));
  server.addEventListener('close',()=>{for(const id of subscriptions.values())try{remote.send(JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'logsUnsubscribe',params:[id]}))}catch{}try{remote.close(1000,'client closed')}catch{}});
  server.send(JSON.stringify({type:'ready',source:'solana-pubsub',programs:PROGRAMS,commitment:'processed'}));
  return new Response(null,{status:101,webSocket:client});
}