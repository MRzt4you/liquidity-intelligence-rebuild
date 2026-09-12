'use client';
import { useEffect, useMemo, useState } from 'react';

type Signal = { token:string; name:string; price:string; change:string; score:number; liq:number; vol:number; flow:number; mom:number; risk:string };
type LiveEvent = { id:number; kind:string; signature:string; slot?:number; ts:number };

const signals: Signal[] = [
  {token:'STINK',name:'Stinkcoin',price:'$0.000407',change:'+237.00%',score:74,liq:66,vol:82,flow:62,mom:99,risk:'MEDIUM'},
  {token:'pep',name:'Smol Pep',price:'$0.000162',change:'+27.18%',score:65,liq:63,vol:55,flow:51,mom:99,risk:'MEDIUM'},
  {token:'CLCTV',name:'Collective',price:'$4.81e-5',change:'+10.54%',score:63,liq:59,vol:68,flow:55,mom:71,risk:'MEDIUM'},
  {token:'Pumpoween',name:'Pumpoween',price:'$0.000404',change:'-5.15%',score:62,liq:66,vol:77,flow:54,mom:40,risk:'MEDIUM'},
  {token:'Clussy',name:'Clown Pussy',price:'$0.000109',change:'-0.41%',score:59,liq:63,vol:61,flow:56,mom:49,risk:'MEDIUM'},
  {token:'PUMPKIT',name:'PumpKit',price:'LIVE',change:'—',score:58,liq:52,vol:71,flow:64,mom:76,risk:'WATCH'},
  {token:'WOJAK',name:'Wojak',price:'LIVE',change:'—',score:57,liq:49,vol:69,flow:59,mom:73,risk:'WATCH'},
  {token:'CIGCAT',name:'CigCat',price:'LIVE',change:'—',score:56,liq:46,vol:66,flow:57,mom:68,risk:'WATCH'},
  {token:'SMOLPHIN',name:'The Smol Dolphin',price:'LIVE',change:'—',score:55,liq:44,vol:62,flow:61,mom:71,risk:'WATCH'},
  {token:'LEONA',name:'Leona',price:'LIVE',change:'—',score:54,liq:42,vol:59,flow:55,mom:64,risk:'WATCH'},
  {token:'MEME',name:'The Perfect Memecoin',price:'LIVE',change:'—',score:53,liq:48,vol:58,flow:52,mom:61,risk:'WATCH'},
  {token:'PEPPER',name:'Peppercoin',price:'LIVE',change:'—',score:52,liq:39,vol:55,flow:54,mom:63,risk:'WATCH'},
];

const wallets = [
  ['4Wmm...G113','CLCTV','94','87%','$7.06K','56','$967.07'],
  ['4GBd...pump','SNIPE','90','83%','$176.78','48','$0.00'],
  ['nWnd...pump','CLUSSY','89','83%','$2.11K','48','$1.60K'],
  ['Drdw...STNK','STINK','87','80%','$60.40K','43','$2.42K'],
  ['5Gef...pump','PUMPOWEEN','86','81%','$29.34K','45','$2.54K'],
  ['4GBd...pump','SNIPE','83','77%','$147.28','38','$0.00'],
];

const PUMP_PROGRAM='6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

export default function Home(){
  const [chain,setChain]=useState('SOLANA');
  const [events,setEvents]=useState<LiveEvent[]>([]);
  const [status,setStatus]=useState<'CONNECTING'|'LIVE'|'OFFLINE'>('CONNECTING');
  const [scanner,setScanner]=useState<'ALL'|'NEW'|'HOT'|'WHALES'|'GRADUATING'>('ALL');

  useEffect(()=>{
    if(chain!=='SOLANA') return;
    let ws: WebSocket | null=null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed=false;
    const connect=()=>{
      if(closed) return;
      setStatus('CONNECTING');
      try{
        ws=new WebSocket('wss://api.mainnet-beta.solana.com');
        ws.onopen=()=>{
          setStatus('LIVE');
          ws?.send(JSON.stringify({jsonrpc:'2.0',id:1,method:'logsSubscribe',params:[{mentions:[PUMP_PROGRAM]},{commitment:'confirmed'}]}));
        };
        ws.onmessage=e=>{
          try{
            const msg=JSON.parse(e.data);
            const result=msg?.params?.result;
            if(!result) return;
            const logs=(result.value?.logs||[]).join(' ');
            let kind='TRADE';
            if(/Instruction: Create/i.test(logs)) kind='NEW';
            else if(/Instruction: Migrate|Complete/i.test(logs)) kind='GRADUATION';
            else if(/Instruction: Buy/i.test(logs)) kind='BUY';
            else if(/Instruction: Sell/i.test(logs)) kind='SELL';
            setEvents(v=>[{id:Date.now()+Math.random(),kind,signature:result.value?.signature||'unknown',slot:result.context?.slot,ts:Date.now()},...v].slice(0,40));
          }catch{}
        };
        ws.onerror=()=>setStatus('OFFLINE');
        ws.onclose=()=>{ setStatus('OFFLINE'); if(!closed) retry=setTimeout(connect,2500); };
      }catch{setStatus('OFFLINE'); retry=setTimeout(connect,2500);}
    };
    connect();
    return()=>{closed=true; if(retry) clearTimeout(retry); ws?.close();};
  },[chain]);

  const activeSignals=useMemo(()=>events.length,[events]);
  const visibleSignals=useMemo(()=>{
    if(scanner==='NEW') return signals.filter(s=>s.score>=55);
    if(scanner==='HOT') return [...signals].sort((a,b)=>b.mom-a.mom);
    if(scanner==='WHALES') return [...signals].sort((a,b)=>b.liq-a.liq);
    if(scanner==='GRADUATING') return signals.filter(s=>s.score>=58);
    return signals;
  },[scanner]);

  return <main>
    <header className="topbar terminal-grid">
      <div className="brand"><div className="brandmark">⌁</div><div><div className="eyebrow">ANONYCRYPT // MARKET TERMINAL</div><h1>Liquidity Intelligence</h1></div></div>
      <div className="chain-switch"><button className={chain==='SOLANA'?'selected':''} onClick={()=>setChain('SOLANA')}>SOLANA</button><button className={chain==='BNB'?'selected':''} onClick={()=>setChain('BNB')}>BNB</button></div>
      <div className={`live-status ${status.toLowerCase()}`}><i/> {status} · PUMP.FUN</div>
    </header>
    <section className="marketbar terminal-grid">
      <div className="market"><span className="coin sol">SOL</span><div><small>SOL / USD</small><strong>$101.48</strong></div><span className="down">↘ -0.82%</span><small>VOL $1.97B</small></div>
      <div className="market"><span className="coin bnb">BNB</span><div><small>BNB / USD</small><strong>$726.00</strong></div><span className="up">↗ LIVE</span></div>
      <div className="market compact"><div><small>PUMP PROGRAM</small><strong>{PUMP_PROGRAM.slice(0,8)}…</strong></div><span className="up">ON-CHAIN</span></div>
    </section>
    <section className="stats"><Stat title="LIVE PUMP EVENTS" value={String(activeSignals)} icon="⌁" /><Stat title="PUMP.FUN WATCHLIST" value={String(signals.length)} icon="PF" /><Stat title="SMART MONEY TRACKED" value="6" icon="W" /></section>
    <section className="terminal-columns">
      <section className="card pumpfeed"><div className="section-head"><div><span>PUMP.FUN // REAL-TIME</span><h2>Event Stream</h2></div><b className="stream">● {status}</b></div><div className="event-list">{events.length?events.slice(0,18).map(e=><div className="liveevent" key={e.id}><b className={`event-kind ${e.kind.toLowerCase()}`}>{e.kind}</b><code>{e.signature.slice(0,10)}…{e.signature.slice(-8)}</code><small>slot {e.slot??'—'} · {new Date(e.ts).toLocaleTimeString()}</small></div>):<div className="empty">Connecting to Solana logs for Pump.fun…</div>}</div></section>
      <section className="card feed"><div className="section-head"><div><span>LIQUIDITY INTELLIGENCE</span><h2>Confluence Feed</h2></div><b className="stream">● STREAMING</b></div>{signals.slice(0,6).map(s=><SignalRow key={s.token} s={s}/>)}</section>
    </section>
    <section className="matrix card">
      <div className="section-title"><div><span>LIQUIDITY MATRIX · {chain}</span><h2>STINK <em>Stinkcoin</em></h2></div><div className="price">$0.000407 <b>↗ +237.00%</b></div></div>
      <div className="levels"><Level label="BSL" value="$0.001370" score="70" pct={70}/><Level label="EQH" value="$0.001363" score="50" pct={50}/><Level label="FVG" value="$0.000329" score="UNFILLED" muted/><Level label="HTF" value="$0.001370" score="WEEKLY" muted/><Level label="EQL" value="$-5.60e-4" score="50" pct={50} danger/><Level label="SSL" value="$-5.57e-4" score="61" pct={61} danger/></div>
      <div className="flow"><div><b>BUY FLOW</b><strong>62%</strong><i><span style={{width:'62%'}}/></i></div><div><b>SELL FLOW</b><strong className="red">38%</strong><i><span className="redbar" style={{width:'38%'}}/></i></div></div>
      <div className="depth"><div className="depthrow"><span>BSL&nbsp;&nbsp;70</span><i><b style={{width:'70%'}}/></i></div><div className="depthrow"><span>EQH&nbsp;&nbsp;50</span><i><b style={{width:'50%'}}/></i></div><div className="depthprice">PRICE&nbsp;&nbsp; $0.000407&nbsp; ↑</div><div className="depthrow mutedrow"><span>FVG&nbsp;&nbsp; UNFILLED</span></div><div className="depthrow"><span>EQL&nbsp;&nbsp;50</span><i><b style={{width:'50%'}}/></i></div><div className="depthrow"><span>SSL&nbsp;&nbsp;61</span><i><b style={{width:'61%'}}/></i></div></div>
      <div className="mini"><Mini title="CONFLUENCE" value="74"/><Mini title="LIQUIDITY" value="$54.29K"/><Mini title="24H VOL" value="$804.32K"/></div>
      <div className="risk"><div><span>RISK ENGINE</span><h3>Risk score 25/100</h3><p>Derived from LP depth, price action, buy/sell imbalance.</p></div><b className="badge medium">▲ MEDIUM</b></div>
    </section>
    <section className="card scanner"><div className="section-head"><div><span>PUMP.FUN // TOKEN INTELLIGENCE</span><h2>Expanded Token Scanner</h2></div><b className="stream">{signals.length} TRACKED</b></div><div className="scanner-tabs">{(['ALL','NEW','HOT','WHALES','GRADUATING'] as const).map(t=><button key={t} className={scanner===t?'active':''} onClick={()=>setScanner(t)}>{t}</button>)}</div><div className="tablehead"><span>TOKEN</span><span>PRICE</span><span>BUY%</span><span>CONFLUENCE</span><span>RISK</span></div>{visibleSignals.map(s=><div className="tablerow" key={s.token}><div><b>{s.token}</b><small>{s.name}</small></div><code>{s.price}</code><span>{s.flow}%</span><b>{s.score}</b><span className={`badge ${s.risk==='HIGH'?'critical':'medium'}`}>{s.risk}</span></div>)}</section>
    <section className="card wallets"><div className="section-head"><div><span>SMART MONEY</span><h2>Top Wallets by Composite Score</h2></div><span className="trend">↗</span></div>{wallets.map((w,i)=><div className="walletrow" key={i}><div className="walletname">{w[0]} <small>ON {w[1]}</small></div><b className="walletscore">{w[2]}</b><div className="walletbar"><i style={{width:`${w[2]}%`}}/></div><div className="walletmetrics"><span>WIN<strong>{w[3]}</strong></span><span>PNL<strong className="green">{w[4]}</strong></span><span>EARLY<strong>{w[5]}</strong></span><span>POSITION<strong>{w[6]}</strong></span></div></div>)}</section>
    <section className="events card"><div className="section-head"><div><span>BACKEND / ON-CHAIN BRIDGE</span><h2>System Events</h2></div><span className="eventcount">{events.length}</span></div><p className="empty">The browser is subscribed directly to Solana logs for the Pump.fun program. Decoded token metadata, OHLCV, whale labels and historical storage still require the backend market-data adapter.</p></section>
    <footer className="ticker">PUMP.FUN · SOLANA · PUMPSWAP · LIQUIDITY INTELLIGENCE · REAL-TIME ON-CHAIN LOGS</footer>
  </main>
}
function Stat({title,value,icon}:{title:string,value:string,icon:string}){return <div className="stat card"><div><span>{title}</span><strong>{value}</strong></div><b className="icon">{icon}</b></div>}
function Level({label,value,score,pct,danger}:{label:string,value:string,score:string,pct?:number,danger?:boolean}){return <div className="level"><b>{label}</b><span>{value}</span>{pct!==undefined?<i><b className={danger?'redbar':''} style={{width:`${pct}%`}}/></i>:<em>{score}</em>} {pct!==undefined&&<strong>{score}</strong>}</div>}
function Mini({title,value}:{title:string,value:string}){return <div><span>{title}</span><strong>{value}</strong></div>}
function SignalRow({s}:{s:Signal}){return <div className="signalrow"><div className="siglabel"><span>● WATCH · {s.risk}</span><h3>{s.token} <small>{s.name}</small></h3></div><div className="sigprice">{s.price} <b className={s.change.startsWith('-')?'red':'green'}>{s.change}</b></div><b className="sigscore">{s.score}</b><div className="signalmetrics"><span>LIQ<strong>{s.liq}</strong></span><span>VOL<strong>{s.vol}</strong></span><span>FLO<strong>{s.flow}</strong></span><span>MOM<strong>{s.mom}</strong></span></div></div>}
