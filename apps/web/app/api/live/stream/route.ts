const RPC_WS=process.env.SOLANA_WS_URL||'wss://solana-rpc.publicnode.com';
const PROGRAMS=['6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P','pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA'];
export const runtime='edge';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  if(request.headers.get('upgrade')?.toLowerCase()!=='websocket')return new Response('Expected WebSocket',{status:426});
  const pair=new WebSocketPair();
  const client=pair[0],server=pair[1];
  server.accept();
  let closed=false;
  let remote:WebSocket|null=null;
  let reconnectTimer:any=null;
  let heartbeat:any=null;
  let reconnecting=false;
  let delayMs=1000;
  let upstreamGeneration=0;

  const send=(value:any)=>{if(closed)return;try{server.send(JSON.stringify(value));}catch{shutdown(1011,'client send failed')}};
  const closeRemote=(ws?:WebSocket|null)=>{
    const target=ws||remote;
    if(target){try{target.close(1000,'reconnect')}catch{}}
    if(!ws||remote===ws)remote=null;
  };
  const shutdown=(code:number,reason:string)=>{
    if(closed)return;
    closed=true;
    if(reconnectTimer)clearTimeout(reconnectTimer);
    if(heartbeat)clearInterval(heartbeat);
    reconnectTimer=null;heartbeat=null;
    closeRemote();
    try{server.close(code,reason)}catch{}
  };

  const queueReconnect=(reason:string)=>{
    if(closed||reconnecting)return;
    reconnecting=true;
    closeRemote();
    const wait=Math.round(Math.min(30000,delayMs)*(0.75+Math.random()*0.5));
    delayMs=Math.min(30000,delayMs*2);
    send({type:'upstream',state:'reconnecting',reason,delay:wait,source:'solana-pubsub',ts:Date.now()});
    reconnectTimer=setTimeout(async()=>{
      reconnectTimer=null;
      reconnecting=false;
      if(closed)return;
      const ok=await connectUpstream();
      if(!ok)queueReconnect('connection failed');
    },wait);
  };

  const connectUpstream=async():Promise<boolean>=>{
    if(closed)return false;
    const generation=++upstreamGeneration;
    try{
      const response=await fetch(RPC_WS,{headers:{Upgrade:'websocket',Connection:'Upgrade'}});
      const ws=response.webSocket;
      if(!ws)return false;
      remote=ws;
      ws.accept();
      ws.addEventListener('message',event=>{
        if(closed||remote!==ws||generation!==upstreamGeneration)return;
        try{
          const msg=JSON.parse(String(event.data));
          if(msg.method==='logsNotification')send({type:'logs',data:msg.params});
          else if(msg.id===1||msg.id===2){
            if(msg.error)send({type:'upstream',state:'error',reason:String(msg.error.message||'subscription error'),source:'solana-pubsub',ts:Date.now()});
          }
        }catch{}
      });
      ws.addEventListener('error',()=>{if(remote===ws&&generation===upstreamGeneration)queueReconnect('upstream error')});
      ws.addEventListener('close',()=>{if(remote===ws&&generation===upstreamGeneration)queueReconnect('upstream closed')});
      try{
        PROGRAMS.forEach((program,i)=>ws.send(JSON.stringify({jsonrpc:'2.0',id:i+1,method:'logsSubscribe',params:[{mentions:[program]},{commitment:'processed'}]})));
      }catch{
        closeRemote(ws);
        return false;
      }
      delayMs=1000;
      send({type:'upstream',state:'connected',source:'solana-pubsub',programs:PROGRAMS,ts:Date.now()});
      return true;
    }catch{return false}
  };

  server.addEventListener('message',event=>{
    if(closed)return;
    try{
      const msg=JSON.parse(String(event.data));
      if(msg?.type==='ping')send({type:'pong',ts:Date.now()});
    }catch{}
  });
  server.addEventListener('close',()=>shutdown(1000,'client closed'));
  server.addEventListener('error',()=>shutdown(1011,'client error'));

  const ok=await connectUpstream();
  if(!ok)queueReconnect('initial connection failed');
  else send({type:'ready',source:'solana-pubsub',programs:PROGRAMS,commitment:'processed'});

  heartbeat=setInterval(()=>send({type:'ping',ts:Date.now()}),15000);
  return new Response(null,{status:101,webSocket:client});
}
