export type ProviderRisk={source:string;score?:number;flags:string[];available:boolean;raw?:Record<string,unknown>};
export type CrossMarket={jupiterPriceUsd?:number;priceDislocationPct?:number;providerCount:number;providers:string[]};

const JUP='https://lite-api.jup.ag/price/v3';
const BIRDEYE='https://public-api.birdeye.so';
const GOPLUS='https://api.gopluslabs.io';

async function json(url:string,init?:RequestInit){const r=await fetch(url,{...init,cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${url}`);return await r.json() as any;}

export async function jupiterPrice(mints:string[]):Promise<Map<string,number>>{
 const out=new Map<string,number>(); if(!mints.length)return out;
 try{const q=mints.join(',');const j=await json(`${JUP}?ids=${encodeURIComponent(q)}`);for(const [mint,v] of Object.entries(j?.data||{})){const p=Number((v as any)?.usdPrice);if(Number.isFinite(p))out.set(mint,p);}}catch{}
 return out;
}

export async function birdeyeTokenStats(mints:string[]):Promise<Map<string,Record<string,unknown>>>{
 const out=new Map<string,Record<string,unknown>>(); const key=process.env.BIRDEYE_API_KEY; if(!key)return out;
 for(const mint of mints.slice(0,20)){try{const j=await json(`${BIRDEYE}/defi/token_overview?address=${encodeURIComponent(mint)}`,{headers:{'X-API-KEY':key,'x-chain':'solana'}});if(j?.data)out.set(mint,j.data);}catch{}}
 return out;
}

export async function goPlusRisk(mints:string[]):Promise<Map<string,ProviderRisk>>{
 const out=new Map<string,ProviderRisk>(); const key=process.env.GOPLUS_API_KEY; if(!key)return out;
 for(const mint of mints.slice(0,20)){try{const j=await json(`${GOPLUS}/api/v1/solana/token_security?contract_addresses=${encodeURIComponent(mint)}`,{headers:{Authorization:`Bearer ${key}`}});const d=j?.result?.[mint]||j?.result?.data?.[mint]||j?.result?.[mint.toLowerCase()];if(d)out.set(mint,{source:'goplus',available:true,flags:Object.entries(d).filter(([,v])=>v==='1'||v===true).map(([k])=>k).slice(0,12),raw:d});}catch{}}
 return out;
}

export function buildCrossMarket(mint:string,dexUsd:number|undefined,jup:Map<string,number>):CrossMarket{
 const jp=jup.get(mint);const providers=['pump.fun'];if(dexUsd!=null)providers.push('dexscreener');if(jp!=null)providers.push('jupiter');
 const dis=dexUsd!=null&&jp!=null&&jp>0?Math.abs(dexUsd-jp)/jp*100:undefined;
 return {jupiterPriceUsd:jp,priceDislocationPct:dis,providerCount:providers.length,providers};
}

export function providerConfig(){return {helius:!!process.env.HELIUS_API_KEY,birdeye:!!process.env.BIRDEYE_API_KEY,goplus:!!process.env.GOPLUS_API_KEY,jupiter:true,dexscreener:true,solanaRpc:true};}
