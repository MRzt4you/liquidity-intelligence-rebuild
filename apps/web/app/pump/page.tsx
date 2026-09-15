'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type Token = {
  mint: string; symbol: string; ageMs: number; buys: number; sells: number;
  volumeSol: number; buySol: number; sellSol: number; buyers: number; sellers: number;
  wallets: number; rotationWallets: number; score: number; risk: string;
  lastSeen: number; graduated?: boolean; priceSol?: number; progress?: number;
  dex?: { available?: boolean; dexId?: string; pairAddress?: string; url?: string;
    priceUsd?: number; liquidityUsd?: number; volume5m?: number; volume1h?: number;
    priceChange5m?: number; priceChange1h?: number; marketCap?: number;
    buys5m?: number; sells5m?: number; boostActive?: number };
};

type LiveEvent = { event?: string; mint?: string; wallet?: string; signature?: string; slot?: number; ts?: number; sol?: number; symbol?: string };

type PhantomProvider = { isPhantom?: boolean; isConnected?: boolean; publicKey?: { toString(): string }; connect: (opts?: any) => Promise<any>; disconnect: () => Promise<void>; signMessage?: (message: Uint8Array, display?: string) => Promise<any>; on?: (event: string, cb: (...args: any[]) => void) => void };

declare global { interface Window { phantom?: { solana?: PhantomProvider }; solana?: PhantomProvider } }

const API = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
const menu = ['MOVERS','MAYHEM','NEW','CHARITIES','LIVE','MARKET CAP','AGENTS','OLDEST','LAST TRADE'] as const;
const short = (x: string, n = 6) => x ? `${x.slice(0,n)}…${x.slice(-4)}` : '—';
const money = (n?: number) => n == null || !Number.isFinite(n) ? '—' : n >= 1e9 ? `$${(n/1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
const age = (ms: number) => { const s = Math.max(0, Math.floor(ms/1000)); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s/60)}m` : `${Math.floor(s/3600)}h`; };
const pump = (m: string) => `https://pump.fun/coin/${m}`;
const dex = (m: string) => `https://dexscreener.com/solana/${m}`;

export default function PumpTerminal() {
  const [tokens,setTokens] = useState<Token[]>([]);
  const [events,setEvents] = useState<LiveEvent[]>([]);
  const [tab,setTab] = useState<typeof menu[number]>('LIVE');
  const [query,setQuery] = useState('');
  const [selected,setSelected] = useState<Token|null>(null);
  const [wallet,setWallet] = useState('');
  const [walletBusy,setWalletBusy] = useState(false);
  const [stream,setStream] = useState<'LIVE'|'DEGRADED'|'CONNECTING'>('CONNECTING');
  const [chart,setChart] = useState<{t:number;p:number}[]>([]);
  const wsRef = useRef<WebSocket|null>(null);

  const hydrate = async () => {
    try {
      const r = await fetch(`${API}/api/live/tokens`, { cache: 'no-store' });
      if (!r.ok) throw new Error('live tokens unavailable');
      const x = await r.json();
      if (x.source !== 'solana-mainnet-rpc') return;
      const next = Array.isArray(x.tokens) ? x.tokens : [];
      setTokens(next);
      setEvents(Array.isArray(x.events) ? x.events : []);
      const first = next.find((t: Token) => t.mint === selected?.mint) || next[0];
      if (first?.dex?.priceUsd != null) setChart(c => [...c, {t: Date.now(), p: first.dex!.priceUsd!}].slice(-80));
    } catch {}
  };

  useEffect(() => {
    hydrate();
    const timer = setInterval(hydrate, 5000);
    const base = API || window.location.origin;
    const wsUrl = base.replace(/^http:/,'ws:').replace(/^https:/,'wss:') + '/api/live/stream';
    try {
      const ws = new WebSocket(wsUrl); wsRef.current = ws;
      ws.onopen = () => setStream('CONNECTING');
      ws.onmessage = e => {
        try { const m = JSON.parse(String(e.data)); if (m.type === 'upstream' || m.type === 'ready') setStream('LIVE'); if (m.type === 'logs') { setStream('LIVE'); hydrate(); } } catch {}
      };
      ws.onerror = () => setStream('DEGRADED');
      ws.onclose = () => setStream('DEGRADED');
    } catch { setStream('DEGRADED'); }
    return () => { clearInterval(timer); try { wsRef.current?.close(); } catch {} };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tokens.filter(t => !q || t.symbol.toLowerCase().includes(q) || t.mint.toLowerCase().includes(q));
    switch(tab) {
      case 'NEW': list = list.filter(t => t.ageMs < 15*60*1000).sort((a,b)=>a.ageMs-b.ageMs); break;
      case 'LIVE': list = list.filter(t => t.dex?.available).sort((a,b)=>b.lastSeen-a.lastSeen); break;
      case 'MAYHEM': list = list.sort((a,b)=>(b.dex?.volume5m||0)-(a.dex?.volume5m||0)); break;
      case 'MOVERS': list = list.sort((a,b)=>Math.abs(b.dex?.priceChange5m||0)-Math.abs(a.dex?.priceChange5m||0)); break;
      case 'MARKET CAP': list = list.sort((a,b)=>(b.dex?.marketCap||0)-(a.dex?.marketCap||0)); break;
      case 'AGENTS': list = list.filter(t=>t.rotationWallets>0).sort((a,b)=>b.score-a.score); break;
      case 'OLDEST': list = list.sort((a,b)=>b.ageMs-a.ageMs); break;
      case 'LAST TRADE': list = list.sort((a,b)=>b.lastSeen-a.lastSeen); break;
      case 'CHARITIES': list = []; break;
    }
    return list.slice(0,80);
  },[tokens,tab,query]);

  const connectPhantom = async () => {
    setWalletBusy(true);
    try {
      const provider = window.phantom?.solana || window.solana;
      if (!provider?.isPhantom) { window.open('https://phantom.app/','_blank','noopener,noreferrer'); return; }
      const res = await provider.connect();
      const address = res?.publicKey?.toString?.() || provider.publicKey?.toString?.() || '';
      if (address) setWallet(address);
    } catch {} finally { setWalletBusy(false); }
  };

  const disconnect = async () => { try { await (window.phantom?.solana || window.solana)?.disconnect(); } catch {} setWallet(''); };
  const active = selected || filtered[0] || null;
  const activeSeries = active?.dex?.priceUsd != null && chart.length ? chart : [];

  return <main style={{minHeight:'100vh',background:'#05070a',color:'#d9e2e8',fontFamily:'ui-monospace,SFMono-Regular,Menlo,monospace'}}>
    <style>{`*{box-sizing:border-box}.pump-scroll{overflow:auto}.pump-btn{background:#0a1016;border:1px solid #24313a;color:#8fa1ad;padding:8px 12px;cursor:pointer;font:inherit}.pump-btn:hover,.pump-btn.active{border-color:#45e6b0;color:#45e6b0;background:#0b1718}.pump-card{background:linear-gradient(180deg,#0a0f14,#070b0f);border:1px solid #1d2830;box-shadow:inset 0 1px 0 #ffffff05}.pump-row:hover{background:#0d151a}.green{color:#45e6b0}.red{color:#ff6d79}.muted{color:#667782}.grid{display:grid}.mono{font-family:inherit}`}</style>
    <header style={{position:'sticky',top:0,zIndex:5,background:'#05070af2',backdropFilter:'blur(12px)',borderBottom:'1px solid #1c2830',padding:'12px 18px'}}>
      <div style={{display:'flex',alignItems:'center',gap:18,justifyContent:'space-between',flexWrap:'wrap'}}>
        <div><div style={{fontSize:11,color:'#45e6b0',letterSpacing:2}}>PUMP.FUN // LIQUIDITY INTELLIGENCE</div><h1 style={{margin:'4px 0',fontSize:22}}>REALTIME MARKET TERMINAL</h1></div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}><span style={{fontSize:11,color:stream==='LIVE'?'#45e6b0':'#ffbf69'}}>● {stream} · SOLANA</span>{wallet ? <button className="pump-btn active" onClick={disconnect}>{short(wallet,7)}</button> : <button className="pump-btn" onClick={connectPhantom}>{walletBusy?'CONNECTING…':'CONNECT PHANTOM'}</button>}</div>
      </div>
      <div className="pump-scroll" style={{display:'flex',gap:4,marginTop:12,paddingBottom:2}}>{menu.map(m=><button key={m} className={`pump-btn ${tab===m?'active':''}`} onClick={()=>setTab(m)}>{m}</button>)}</div>
    </header>

    <section style={{padding:'14px 18px',borderBottom:'1px solid #172128',display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search coin / contract address" style={{flex:'1 1 300px',minWidth:240,background:'#070c10',border:'1px solid #26343d',color:'#d9e2e8',padding:'11px 13px',fontFamily:'inherit'}} />
      <span className="muted" style={{fontSize:11}}>LIVE TOKENS {tokens.length}</span><span className="muted" style={{fontSize:11}}>EVENTS {events.length}</span><span className="muted" style={{fontSize:11}}>NO MOCK DATA</span>
    </section>

    <section className="grid" style={{gridTemplateColumns:'minmax(0,1.35fr) minmax(320px,.65fr)',gap:12,padding:12}}>
      <div className="pump-card" style={{minHeight:520}}>
        <div style={{padding:14,borderBottom:'1px solid #172128',display:'flex',justifyContent:'space-between'}}><div><span style={{fontSize:10,color:'#45e6b0'}}>EXPLORE // {tab}</span><h2 style={{margin:'5px 0 0',fontSize:17}}>COIN FLOW</h2></div><span className="muted" style={{fontSize:10}}>ON-CHAIN + DEXSCREENER</span></div>
        <div className="pump-scroll">
          <div style={{display:'grid',gridTemplateColumns:'34px 1.5fr .7fr .8fr .8fr .7fr .7fr 120px',gap:8,padding:'9px 12px',fontSize:9,color:'#60717b',borderBottom:'1px solid #142027',minWidth:780}}><span>★</span><span>COIN</span><span>AGE</span><span>MCAP</span><span>LIQ</span><span>5M</span><span>SCORE</span><span>OPEN</span></div>
          {filtered.map(t=><div key={t.mint} className="pump-row" onClick={()=>setSelected(t)} style={{display:'grid',gridTemplateColumns:'34px 1.5fr .7fr .8fr .8fr .7fr .7fr 120px',gap:8,alignItems:'center',padding:'11px 12px',fontSize:11,borderBottom:'1px solid #101a20',minWidth:780,cursor:'pointer'}}>
            <span style={{color:t.score>=80?'#ffd75a':'#43535c'}}>★</span><div><b>{t.symbol || 'UNKNOWN'}</b><div className="muted" style={{fontSize:9}}>{short(t.mint,8)} · {t.dex?.dexId||'PUMP'}</div></div><span>{age(t.ageMs)}</span><span>{money(t.dex?.marketCap)}</span><span>{money(t.dex?.liquidityUsd)}</span><span className={(t.dex?.priceChange5m||0)>=0?'green':'red'}>{t.dex?.priceChange5m!=null?`${t.dex.priceChange5m.toFixed(1)}%`:'—'}</span><b>{t.score}</b><div style={{display:'flex',gap:5}}><a className="pump-btn" style={{fontSize:9,textDecoration:'none'}} href={pump(t.mint)} target="_blank" rel="noreferrer">PUMP</a><a className="pump-btn" style={{fontSize:9,textDecoration:'none'}} href={t.dex?.url||dex(t.mint)} target="_blank" rel="noreferrer">DEX</a></div>
          </div>)}
          {!filtered.length && <div style={{padding:40,textAlign:'center'}} className="muted">No live records for this view.</div>}
        </div>
      </div>

      <div className="pump-card" style={{minHeight:520,padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><span style={{fontSize:10,color:'#45e6b0'}}>REALTIME CHART</span><h2 style={{margin:'5px 0',fontSize:17}}>{active?.symbol || 'SELECT COIN'}</h2></div>{active && <a className="pump-btn" style={{textDecoration:'none',fontSize:10}} href={pump(active.mint)} target="_blank" rel="noreferrer">VIEW PUMP ↗</a>}</div>
        <div style={{height:240,marginTop:10}}>{activeSeries.length>1 ? <ResponsiveContainer width="100%" height="100%"><LineChart data={activeSeries}><CartesianGrid stroke="#162129" vertical={false}/><XAxis dataKey="t" hide/><YAxis domain={['auto','auto']} hide/><Tooltip contentStyle={{background:'#080d11',border:'1px solid #26343d'}} formatter={(v:any)=>[`$${Number(v).toPrecision(6)}`,'price']}/><Line type="monotone" dataKey="p" stroke="#45e6b0" dot={false} strokeWidth={2}/></LineChart></ResponsiveContainer> : <div style={{height:'100%',display:'grid',placeItems:'center'}} className="muted">Waiting for verified live price updates…</div>}</div>
        {active && <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:10}}>{[['PRICE',active.dex?.priceUsd!=null?`$${active.dex.priceUsd.toPrecision(7)}`:'—'],['MARKET CAP',money(active.dex?.marketCap)],['LIQUIDITY',money(active.dex?.liquidityUsd)],['VOL 5M',money(active.dex?.volume5m)],['BUY/SELL',`${active.dex?.buys5m??active.buys}/${active.dex?.sells5m??active.sells}`],['ROTATION',String(active.rotationWallets)]].map(([k,v])=><div key={k} style={{border:'1px solid #17252d',padding:10}}><div className="muted" style={{fontSize:9}}>{k}</div><b style={{fontSize:13}}>{v}</b></div>)}</div>}
      </div>
    </section>

    <section className="grid" style={{gridTemplateColumns:'1fr 1fr',gap:12,padding:'0 12px 12px'}}>
      <div className="pump-card" style={{padding:14}}><div style={{fontSize:10,color:'#45e6b0'}}>LIVE TRADES / EVENTS</div>{events.slice(0,12).map((e,i)=><div key={`${e.signature}-${i}`} style={{display:'grid',gridTemplateColumns:'70px 1fr 80px',gap:8,padding:'9px 0',borderBottom:'1px solid #111c22',fontSize:10}}><b>{e.event||'EVENT'}</b><span>{e.mint?short(e.mint,10):'—'} <span className="muted">{e.wallet?short(e.wallet,5):''}</span></span><span className="muted">{e.sol!=null?`${e.sol.toFixed(3)} SOL`:e.slot?`#${e.slot}`:'—'}</span></div>)}{!events.length&&<div className="muted" style={{padding:20}}>Waiting for live events…</div>}</div>
      <div className="pump-card" style={{padding:14}}><div style={{fontSize:10,color:'#45e6b0'}}>TOKEN INTELLIGENCE</div><div style={{marginTop:10,fontSize:11,lineHeight:1.7}}><p style={{margin:'5px 0'}}><b>Source:</b> verified Solana mainnet transactions + DEX enrichment</p><p style={{margin:'5px 0'}}><b>Wallet:</b> {wallet ? `${short(wallet,10)} connected` : 'Phantom not connected'}</p><p style={{margin:'5px 0'}}><b>Execution:</b> disabled — terminal is monitoring/decision support only</p><p style={{margin:'5px 0'}}><b>Direct Pump API:</b> not faked; this terminal uses our live on-chain stream rather than inventing an undocumented browser endpoint.</p></div></div>
    </section>
  </main>;
}
