const PUMP = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
const RPC = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const CREATE = '1b72a94ddeeb6376';
const TRADE = 'bddb7fd34ee661ee';
const COMPLETE = '5f72619cd42e9808';

type RawEvent = {event:string; mint?:string; wallet?:string; signature:string; slot:number; ts:number; buy?:boolean; sol?:number; token?:number; complete?:boolean; symbol?:string};
type Token = {mint:string;symbol:string;ageMs:number;buys:number;sells:number;volumeSol:number;buySol:number;sellSol:number;buyers:number;sellers:number;wallets:number;rotationWallets:number;rotationOrigins:[string,number][];score:number;risk:string;lastSeen:number};

function b58(bytes: Uint8Array) {
  const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n=0n; for(const b of bytes)n=n*256n+BigInt(b);
  let out=''; while(n){const r=Number(n%58n);out=alphabet[r]+out;n/=58n;}
  for(const b of bytes){if(b!==0)break;out='1'+out;}
  return out||'1';
}
function bytes(s:string){const bin=atob(s);const a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);return a;}
function u32(a:Uint8Array,o:number){return new DataView(a.buffer,a.byteOffset,a.byteLength).getUint32(o,true)}
function u64(a:Uint8Array,o:number){return Number(new DataView(a.buffer,a.byteOffset,a.byteLength).getBigUint64(o,true));}
function str(a:Uint8Array,o:number){const n=u32(a,o);return [new TextDecoder().decode(a.slice(o+4,o+4+n)),o+4+n] as const}
function eventFromLog(log:string, signature:string, slot:number, ts:number):RawEvent|null{
  const m=log.match(/^Program data: (.+)$/); if(!m)return null;
  try{
    const a=bytes(m[1]), hex=Array.from(a.slice(0,8)).map(x=>x.toString(16).padStart(2,'0')).join(''); let o=8;
    if(hex===CREATE){const [name,o1]=str(a,o);o=o1;const [symbol,o2]=str(a,o);o=o2;const [uri,o3]=str(a,o);o=o3;const mint=b58(a.slice(o,o+32));o+=64;const user=b58(a.slice(o,o+32));return {event:'NEW',mint,wallet:user,signature,slot,ts,symbol:symbol||name,};}
    if(hex===TRADE){const mint=b58(a.slice(o,o+32));o+=32;const sol=u64(a,o)/1e9;o+=8;const token=u64(a,o);o+=8;const buy=!!a[o];o+=1;const wallet=b58(a.slice(o,o+32));return {event:buy?'BUY':'SELL',mint,wallet,signature,slot,ts,buy,sol,token};}
    if(hex===COMPLETE){const user=b58(a.slice(o,o+32));o+=32;const mint=b58(a.slice(o,o+32));return {event:'GRADUATION',mint,wallet:user,signature,slot,ts,complete:true};}
  }catch{}
  return null;
}
async function rpc(method:string, params:any[]){const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(!r.ok)throw new Error(`RPC ${r.status}`);const j=await r.json() as any;if(j.error)throw new Error(j.error.message||'RPC error');return j.result;}

export const dynamic='force-dynamic';
export async function GET(){
  try{
    const sigs=await rpc('getSignaturesForAddress',[PUMP,{limit:45,commitment:'confirmed'}]);
    const txs=await Promise.all((sigs||[]).slice(0,30).map(async(s:any)=>{if(s.err)return null;try{return await rpc('getTransaction',[s.signature,{encoding:'json',commitment:'confirmed',maxSupportedTransactionVersion:0}]);}catch{return null;}}));
    const events:RawEvent[]=[];
    txs.forEach((tx:any,i)=>{if(!tx?.meta?.logMessages)return;const sig=sigs[i].signature,slot=tx.slot,ts=(tx.blockTime||Math.floor(Date.now()/1000))*1000;for(const log of tx.meta.logMessages as string[]){const e=eventFromLog(log,sig,slot,ts);if(e)events.push(e);}});
    const by=new Map<string,any>();
    for(const e of events){if(!e.mint)continue;let t=by.get(e.mint);if(!t){t={mint:e.mint,symbol:e.symbol||e.mint.slice(0,6),createdAt:e.ts,lastSeen:e.ts,buys:0,sells:0,buySol:0,sellSol:0,buyers:new Set<string>(),sellers:new Set<string>(),wallets:new Set<string>(),graduated:false};by.set(e.mint,t);}t.lastSeen=Math.max(t.lastSeen,e.ts);if(e.symbol)t.symbol=e.symbol;if(e.event==='NEW')t.createdAt=Math.min(t.createdAt,e.ts);if(e.event==='GRADUATION')t.graduated=true;if(e.event==='BUY'){t.buys++;t.buySol+=e.sol||0;if(e.wallet){t.buyers.add(e.wallet);t.wallets.add(e.wallet);}}if(e.event==='SELL'){t.sells++;t.sellSol+=e.sol||0;if(e.wallet){t.sellers.add(e.wallet);t.wallets.add(e.wallet);}}}
    const actions=events.filter(e=>(e.event==='BUY'||e.event==='SELL')&&e.wallet).sort((a,b)=>a.ts-b.ts);
    const rotations=new Map<string,Map<string,number>>();
    for(let i=0;i<actions.length;i++){const a=actions[i];if(a.event!=='SELL')continue;for(let j=i+1;j<actions.length;j++){const b=actions[j];if(b.ts-a.ts>5*60*1000)break;if(b.wallet===a.wallet&&b.event==='BUY'&&b.mint&&b.mint!==a.mint){if(!rotations.has(b.mint))rotations.set(b.mint,new Map());const m=rotations.get(b.mint)!;m.set(a.mint,(m.get(a.mint)||0)+1);break;}}}
    const now=Date.now();const tokens:Token[]=[];
    for(const t of by.values()){
      const ageMs=Math.max(0,now-t.createdAt), volume=t.buySol+t.sellSol, walletCount=t.wallets.size, rot=rotations.get(t.mint)||new Map();
      const rotCount=Array.from(rot.values()).reduce((a,b)=>a+b,0), flow=volume?Math.round((t.buySol/volume)*100):0;
      const freshness=ageMs<2*60e3?25:ageMs<5*60e3?20:ageMs<15*60e3?12:5;
      const activity=Math.min(25,(t.buys+t.sells)*2), breadth=Math.min(20,walletCount*2), buyFlow=Math.round(flow/100*20), rotation=Math.min(10,rotCount*2);
      const score=Math.min(100,activity+breadth+buyFlow+freshness+rotation);
      const risk=t.sells>t.buys*1.5?'HIGH':walletCount<3?'UNKNOWN':flow>60?'LOW':'MEDIUM';
      tokens.push({mint:t.mint,symbol:t.symbol,ageMs,buys:t.buys,sells:t.sells,volumeSol:Number(volume.toFixed(4)),buySol:Number(t.buySol.toFixed(4)),sellSol:Number(t.sellSol.toFixed(4)),buyers:t.buyers.size,sellers:t.sellers.size,wallets:walletCount,rotationWallets:rotCount,rotationOrigins:Array.from(rot.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5),score,risk,lastSeen:t.lastSeen});
    }
    tokens.sort((a,b)=>b.score-a.score);
    return Response.json({tokens:tokens.slice(0,100),events:events.slice(-120).reverse(),source:'solana-mainnet-rpc',program:PUMP,generatedAt:now},{headers:{'cache-control':'no-store'}});
  }catch(err){return Response.json({tokens:[],events:[],source:'solana-mainnet-rpc',error:String(err),generatedAt:Date.now()},{status:200,headers:{'cache-control':'no-store'}});}
}
