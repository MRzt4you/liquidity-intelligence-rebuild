const RPC_WS=process.env.SOLANA_WS_URL||'wss://solana-rpc.publicnode.com';
const PROGRAMS=['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P','pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'];
export const runtime='edge';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('Expected WebSocket',{status:426});
  const [client,server]=Object.values(new WebSocketPair());
  server.accept();
  let closed=false;
  let remote:WebSocket|null=null;
  let pingTimer:any=null;
  let reconnectTimer:any=null;
  let reconnecting=false;
  let reconnectDelay=1000;
  const subscriptions=new Map<number,string>();

  const closeRemote=()=>{try{remote?.close(1000,'reconnect')}catch{};remote=null};
  const shutdown=(code:number,reason:string)=>{
    if(closed)return;
    closed=true;
    if(pingTimer)clearInterval(pingTimer);
    if(reconnectTimer)clearTimeout(reconnectTimer);
    closeRemote();
    try{server.close(code,reason)}catch{}
  };
  const queueReconnect=(reason:string)=>{
    if(closed||reconnecting)return;
    reconnecting=true;
    closeRemote();
    const delay=Math.min(30000,reconnectDelay)*(0.75+Math.random()*0.5);
    reconnectDelay=Math.min(30000,reconnectDelay*2);
    try{server.send(JSON.stringify({type:'upstream',state:'reconnecting',reason,delay:Math.round(delay),ts:Date.now()}))}catch{}
    /* The browser owns the retry loop. Closing here prevents the UI from falsely staying LIVE while the upstream is down. */
    reconnectTimer=setTimeout(()=>shutdown(1012,'upstream reconnect'),Math.min(1000,Math.max(250,Math.round(delay))));
  };

  const connectUpstream=async():Promise<boolean>=>{
    if(closed)return false;
    try{
      const upstream=await fetch(RPC_WS,{headers:{Upgrade:'websocket',Connection:'Upgrade'}});
      const ws=upstream.webSocket;
      if(!ws)return false;
      remote=ws;
      ws.accept();
      reconnecting=false;
      reconnectDelay=1000;
      ws.addEventListener('message',event=>{
        if(closed||remote!==ws)return;
        try{
          const msg=JSON.parse(String(event.data));
          if(msg.id===1||msg.id===2){
            if(typeof msg.result==='number')subscriptions.set(msg.id,msg.result);
            if(msg.error)queueReconnect(String(msg.error.message||'subscription error'));
            return;
          }
          if(msg.method==='logsNotification')server.send(JSON.stringify({type:'logs',data:msg.params}));
        }catch{}
      });
      ws.addEventListener('error',()=>{if(remote===ws)queueReconnect('upstream error')});
      ws.addEventListener('close',()=>{if(remote===ws)queueReconnect('upstream closed')});
      try{
        PROGRAMS.forEach((program,i)=>ws.send(JSON.stringify({jsonrpc:'2.0',id:i+1,method:'logsSubscribe',params:[{mentions:[program]},{commitment:'processed'}]})));
      }catch{closeRemote();return false}
      server.send(JSON.stringify({type:'upstream',state:'connected',source:'solana-pubsub',ts:Date.now()}));
      return true;
    }catch{return false}
  };

  server.addEventListener('message',event=>{
    if(closed)return;
    try{
      const msg=JSON.parse(String(event.data));
      if(msg?.type==='ping')server.send(JSON.stringify({type:'pong',ts:Date.now()}));
    }catch{}
  });
  server.addEventListener('close',()=>shutdown(1000,'client closed'));
  server.addEventListener('error',()=>shutdown(1011,'client error'));

  const ok=await connectUpstream();
  if(!ok)queueReconnect('initial connection failed');
  else server.send(JSON.stringify({type:'ready',source:'solana-pubsub',programs:PROGRAMS,commitment:'processed'}));

  pingTimer=setInterval(()=>{if(!closed)try{server.send(JSON.stringify({type:'ping',ts:Date.now()}))}catch{}},15000);
  return new Response(null,{status:101,webSocket:client});
}
