const RPC=process.env.SOLANA_RPC_URL||'https://api.mainnet-beta.solana.com';
const PUMP='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const dynamic='force-dynamic';

async function rpc(method:string,params:any[]){const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store'});if(!r.ok)throw Error(`RPC ${r.status}`);const j=await r.json() as any;if(j.error)throw Error(j.error.message||'RPC error');return j.result}
function wsFallbackCount(){return (process.env.SOLANA_WS_URLS||process.env.SOLANA_WS_URL||'').split(',').map(x=>x.trim()).filter(Boolean).length||2}

export async function GET(){
 const started=Date.now();
 const solamiConfigured=!!process.env.SOLAMI_API_KEY;
 const solamiWsConfigured=!!process.env.SOLAMI_DATA_WS_URL||solamiConfigured;
 try{
  const [slot,blockhash]=await Promise.all([rpc('getSlot',[{commitment:'confirmed'}]),rpc('getLatestBlockhash',[{commitment:'confirmed'}])]);
  const signatures=await rpc('getSignaturesForAddress',[PUMP,{limit:1,commitment:'confirmed'}]) as any[];
  return Response.json({status:'RPC_OK',source:'solana-mainnet-rpc',latencyMs:Date.now()-started,slot,latestPumpSignature:signatures[0]?.signature||null,latestPumpBlockTime:signatures[0]?.blockTime||null,providers:{solanaRpc:true,solamiBlur:solamiWsConfigured,solamiApiKey:solamiConfigured,dexscreener:true,jupiter:!!process.env.JUPITER_API_KEY,birdeye:!!process.env.BIRDEYE_API_KEY,goplus:!!process.env.GOPLUS_API_KEY,helius:!!process.env.HELIUS_API_KEY,yellowstone:!!process.env.YELLOWSTONE_GRPC_URL},realtime:{primary:solamiConfigured?'solami-blur':'solana-pubsub',fallbacks:wsFallbackCount()},note:'HTTP RPC health does not prove a persistent realtime stream; the browser stream reports upstream state separately.'},{headers:{'cache-control':'no-store'}})
 }catch(error){return Response.json({status:'RPC_ERROR',source:'solana-mainnet-rpc',latencyMs:Date.now()-started,error:String(error),providers:{solanaRpc:false,solamiBlur:solamiWsConfigured,solamiApiKey:solamiConfigured,dexscreener:true,jupiter:!!process.env.JUPITER_API_KEY,birdeye:!!process.env.BIRDEYE_API_KEY,goplus:!!process.env.GOPLUS_API_KEY,helius:!!process.env.HELIUS_API_KEY,yellowstone:!!process.env.YELLOWSTONE_GRPC_URL}},{status:503,headers:{'cache-control':'no-store'}})}
}
