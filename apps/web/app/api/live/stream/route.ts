const RPC_WS=process.env.SOLANA_WS_URL||'wss://solana-rpc.publicnode.com';
const PROGRAMS=['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P','pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'];
export const runtime='edge';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('Expected WebSocket',{status:426});
  const [client,server]=Object.values(new WebSocketPair());
  server.accept({allowHalfOpen:true});

  let closed=false;
  let remote:WebSocket|null=null;
  let pingTimer:any=null;
  const subscriptions=new Map<number,string>();

  const shutdown=(code:number,reason:string)=>{
    if(closed)return;
    closed=true;
    if(pingTimer)clearInterval(pingTimer);
    try{remote?.close(1000,'client closed')}catch{}
    try{server.close(code,reason)}catch{}
  };

  try{
    const upstream=await fetch(RPC_WS,{headers:{Upgrade:'websocket','Connection':'Upgrade'}});
    remote=upstream.webSocket||null;
    if(!remote){shutdown(1011,'upstream websocket unavailable');return new Response('Upstream WebSocket unavailable',{status:502});}
    remote.accept({allowHalfOpen:true});

    remote.addEventListener('message',event=>{
      if(closed)return;
      try{
        const msg=JSON.parse(String(event.data));
        if(msg.id===1||msg.id===2){
          if(typeof msg.result==='number')subscriptions.set(msg.id,msg.result);
          return;
        }
        if(msg.method==='logsNotification')server.send(JSON.stringify({type:'logs',data:msg.params}));
      }catch{}
    });

    remote.addEventListener('close',()=>shutdown(1012,'upstream closed'));
    remote.addEventListener('error',()=>shutdown(1011,'upstream error'));

    server.addEventListener('message',event=>{
      if(closed)return;
      try{
        const msg=JSON.parse(String(event.data));
        if(msg?.type==='ping')server.send(JSON.stringify({type:'pong',ts:Date.now()}));
      }catch{}
    });

    server.addEventListener('close',()=>shutdown(1000,'client closed'));

    PROGRAMS.forEach((program,i)=>remote!.send(JSON.stringify({jsonrpc:'2.0',id:i+1,method:'logsSubscribe',params:[{mentions:[program]},{commitment:'processed'}]})));
    server.send(JSON.stringify({type:'ready',source:'solana-pubsub',programs:PROGRAMS,commitment:'processed'}));

    // Keep the browser/Cloudflare/upstream path active. The client also sends pings,
    // but this server heartbeat prevents an otherwise idle socket from being dropped.
    pingTimer=setInterval(()=>{if(!closed)try{server.send(JSON.stringify({type:'ping',ts:Date.now()}))}catch{}},15000);

    return new Response(null,{status:101,webSocket:client});
  }catch(error){
    shutdown(1011,'upstream connection failed');
    return new Response('Upstream WebSocket connection failed',{status:502});
  }
}