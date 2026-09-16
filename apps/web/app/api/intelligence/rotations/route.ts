import { buildRotationGraph } from '../../../../lib/stampede-fusion';

export const runtime='edge';
export const dynamic='force-dynamic';

export async function GET(request:Request){
  const u=new URL(request.url);
  const base=u.origin;
  const windowMs=Math.min(2*60*60_000,Math.max(60_000,Number(u.searchParams.get('windowMs')||30*60_000)));
  try{
    const r=await fetch(`${base}/api/live/tokens`,{cache:'no-store'});
    const data=await r.json() as {events?:unknown[];degraded?:boolean;generatedAt?:number};
    const events=Array.isArray(data.events)?data.events:[];
    const edges=buildRotationGraph(events as any,windowMs);
    return Response.json({ok:true,source:'solana-mainnet-rpc',windowMs,generatedAt:new Date().toISOString(),stale:!!data.degraded,edges},{headers:{'cache-control':'no-store'}});
  }catch(e){return Response.json({ok:false,status:'DEGRADED',error:e instanceof Error?e.message:String(e),source:'solana-mainnet-rpc',edges:[]},{status:200,headers:{'cache-control':'no-store'}})}
}
