export type RotationEvent = { mint?: string; wallet?: string; event?: string; signature?: string; ts?: number; sol?: number; symbol?: string };
export type RotationEdge = { fromMint:string; toMint:string; walletCount:number; sequences:number; avgGapMs:number|null; wallets:string[]; evidence:Array<{wallet:string;sellSignature:string;buySignature:string;gapMs:number}> };

export function buildRotationGraph(events: RotationEvent[], windowMs = 30 * 60_000, maxEvidence = 20): RotationEdge[] {
  const trades = events.filter(e => (e.event === 'BUY' || e.event === 'SELL') && e.mint && e.wallet && e.signature && Number.isFinite(e.ts)).sort((a,b)=>(a.ts||0)-(b.ts||0));
  const byWallet = new Map<string, RotationEvent[]>();
  for (const e of trades) { const list=byWallet.get(e.wallet! )||[]; list.push(e); byWallet.set(e.wallet!,list); }
  const edges = new Map<string, {fromMint:string;toMint:string;wallets:Set<string>;gaps:number[];evidence:RotationEdge['evidence'];sequences:number}>();
  for (const [wallet, list] of byWallet) {
    for (let i=0;i<list.length;i++) {
      const sell=list[i]; if(sell.event!=='SELL') continue;
      for(let j=i+1;j<list.length;j++) {
        const buy=list[j]; const gap=(buy.ts||0)-(sell.ts||0);
        if(gap>windowMs) break;
        if(buy.event!=='BUY'||buy.mint===sell.mint) continue;
        const key=`${sell.mint}->${buy.mint}`; let edge=edges.get(key);
        if(!edge){edge={fromMint:sell.mint!,toMint:buy.mint!,wallets:new Set(),gaps:[],evidence:[],sequences:0};edges.set(key,edge)}
        edge.wallets.add(wallet); edge.gaps.push(gap); edge.sequences++;
        if(edge.evidence.length<maxEvidence) edge.evidence.push({wallet,sellSignature:sell.signature!,buySignature:buy.signature!,gapMs:gap});
        break;
      }
    }
  }
  return [...edges.values()].map(e=>({fromMint:e.fromMint,toMint:e.toMint,walletCount:e.wallets.size,sequences:e.sequences,avgGapMs:e.gaps.length?Math.round(e.gaps.reduce((a,b)=>a+b,0)/e.gaps.length):null,wallets:[...e.wallets].slice(0,100),evidence:e.evidence})).sort((a,b)=>b.walletCount-a.walletCount||b.sequences-a.sequences);
}
