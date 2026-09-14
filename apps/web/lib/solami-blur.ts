export type SolamiEvent={event:string;mint?:string;wallet?:string;signature?:string;slot?:number;ts:number;sol?:number;usd?:number;priceUsd?:number;liquidityUsd?:number;volumeUsd?:number;symbol?:string;source:'solami-blur';rawType:string;eventId?:string};

const pick=(o:any,...keys:string[])=>{for(const k of keys){const v=o?.[k];if(v!==undefined&&v!==null&&v!=='')return v}return undefined};
const num=(v:any)=>{const n=typeof v==='number'?v:Number(v);return Number.isFinite(n)?n:undefined};

export function buildSolamiUrl(base:string,key:string){try{const u=new URL(base);if(key&&!u.searchParams.has('api_key'))u.searchParams.set('api_key',key);return u.toString()}catch{return base}}

function candidates(raw:any):any[]{
  const out:any[]=[];
  const walk=(v:any)=>{
    if(v==null)return;
    if(Array.isArray(v)){for(const x of v)walk(x);return}
    if(typeof v!=='object')return;
    if(v.type||v.event||v.kind||v.data_type)out.push(v);
    for(const k of ['data','event','result','events','items']){const child=v[k];if(child&&typeof child==='object')walk(child)}
  };
  walk(raw);
  return out.length?out:[raw];
}

export function normalizeSolami(raw:any):SolamiEvent|null{
  for(const item of candidates(raw)){
    const d=item?.data&&typeof item.data==='object'&&!Array.isArray(item.data)?item.data:item;
    const type=String(pick(item,'type','event','kind','data_type')||pick(d,'type','event','kind','data_type')||'').toLowerCase();
    const mint=pick(d,'mint','token_address','tokenAddress','base_token_address','baseTokenAddress','token_mint','tokenMint');
    if(!mint)continue;
    const wallet=pick(d,'wallet','user','trader','owner','maker','user_address','trader_address');
    const signature=pick(d,'signature','tx_signature','txSignature','transaction','transaction_signature','txid');
    const slot=num(pick(d,'slot','block_slot','blockSlot'))||0;
    const rawTs=pick(d,'timestamp','block_time','blockTime','ts','time');
    const ts=typeof rawTs==='number'?(rawTs<1e12?rawTs*1000:rawTs):Number(rawTs)?(Number(rawTs)<1e12?Number(rawTs)*1000:Number(rawTs)):Date.now();
    let event='';
    if(type==='token_create'||type==='token_created'||type==='launch'||type==='token_launch'||type==='new_token')event='NEW';
    else if(type==='swap'||type==='trade'){const side=String(pick(d,'side','direction','trade_side')||'').toLowerCase();event=side==='sell'||d?.is_buy===false?'SELL':'BUY'}
    else if(type==='pool_create'||type==='pool_created'||type==='pool')event='POOL';
    else if(type==='liquidity'||type==='liquidity_add'||type==='liquidity_remove')event='LIQUIDITY';
    else if(type==='complete'||type==='graduation'||type==='graduated')event='GRADUATION';
    if(!event)continue;
    const sol=num(pick(d,'volume_sol','sol_amount','solAmount','amount_sol','amountSol','quote_amount_sol','quoteAmountSol'));
    const usd=num(pick(d,'volume_usd','volumeUsd','amount_usd','amountUsd','notional_usd','notionalUsd'));
    const priceUsd=num(pick(d,'price_usd','priceUsd','usd_price','usdPrice'));
    const liquidityUsd=num(pick(d,'liquidity_usd','liquidityUsd'));
    return {event,mint:String(mint),wallet:wallet?String(wallet):undefined,signature:signature?String(signature):undefined,slot,ts,sol,usd,priceUsd,liquidityUsd,volumeUsd:usd,symbol:pick(d,'symbol','token_symbol','tokenSymbol')?.toString(),source:'solami-blur',rawType:type,eventId:pick(item,'id','event_id','eventId')?.toString()};
  }
  return null;
}

function b58bytes(s:string){const abc='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(const c of s){const i=abc.indexOf(c);if(i<0)return null;n=n*58n+BigInt(i)}const out:number[]=[];while(n){out.unshift(Number(n&255n));n>>=8n}for(let i=0;i<s.length&&s[i]==='1';i++)out.unshift(0);return out.length===32?Uint8Array.from(out):null}
function putU64(a:number[],n:number){let x=BigInt(Math.max(0,Math.round(n)));for(let i=0;i<8;i++){a.push(Number(x&255n));x>>=8n}}
function putI64(a:number[],n:number){let x=BigInt(Math.round(n));if(x<0)x=(1n<<64n)+x;for(let i=0;i<8;i++){a.push(Number(x&255n));x>>=8n}}
function b64(a:number[]){let s='';for(const x of a)s+=String.fromCharCode(x);return btoa(s)}

export function syntheticLog(e:SolamiEvent){
  const mint=b58bytes(String(e.mint||''))||new Uint8Array(32),wallet=b58bytes(String(e.wallet||''))||new Uint8Array(32);
  const head=e.event==='NEW'?'1b72a94ddeeb6376':e.event==='GRADUATION'?'5f72619cd42e9808':'bddb7fd34ee661ee';
  const a:number[]=Array.from(new Uint8Array(head.match(/../g)!.map(x=>parseInt(x,16))));
  if(e.event==='NEW'){
    const name=String(e.symbol||'TOKEN');
    const put=(v:string)=>{const b=new TextEncoder().encode(v);a.push(b.length&255,(b.length>>8)&255,(b.length>>16)&255,(b.length>>24)&255,...Array.from(b))};
    put(name);put(name);put('');a.push(...mint,...new Uint8Array(32),...wallet);
  }else if(e.event==='GRADUATION')a.push(...mint);
  else{a.push(...mint);putU64(a,(e.sol||0)*1e9);putU64(a,0);a.push(e.event==='BUY'?1:0,...wallet);putI64(a,(e.ts||Date.now())/1000);a.push(...new Uint8Array(32));}
  return `Program data: ${b64(a)}`;
}
