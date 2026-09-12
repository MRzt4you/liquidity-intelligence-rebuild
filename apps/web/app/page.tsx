'use client';
import { useEffect, useMemo, useState } from 'react';

type Signal = { token:string; name:string; price:string; change:string; score:number; liq:number; vol:number; flow:number; mom:number; risk:string };

const signals: Signal[] = [
  {token:'STINK',name:'Stinkcoin',price:'$0.000407',change:'+237.00%',score:74,liq:66,vol:82,flow:62,mom:99,risk:'MEDIUM'},
  {token:'pep',name:'Smol Pep',price:'$0.000162',change:'+27.18%',score:65,liq:63,vol:55,flow:51,mom:99,risk:'MEDIUM'},
  {token:'CLCTV',name:'Collective',price:'$4.81e-5',change:'+10.54%',score:63,liq:59,vol:68,flow:55,mom:71,risk:'MEDIUM'},
  {token:'Pumpoween',name:'Pumpoween',price:'$0.000404',change:'-5.15%',score:62,liq:66,vol:77,flow:54,mom:40,risk:'MEDIUM'},
  {token:'Clussy',name:'Clown Pussy',price:'$0.000109',change:'-0.41%',score:59,liq:63,vol:61,flow:56,mom:49,risk:'MEDIUM'},
];

const wallets = [
  ['4Wmm...G113','CLCTV','94','87%','$7.06K','56','$967.07'],
  ['4GBd...pump','SNIPE','90','83%','$176.78','48','$0.00'],
  ['nWnd...pump','CLUSSY','89','83%','$2.11K','48','$1.60K'],
  ['Drdw...STNK','STINK','87','80%','$60.40K','43','$2.42K'],
  ['5Gef...pump','PUMPOWEEN','86','81%','$29.34K','45','$2.54K'],
  ['4GBd...pump','SNIPE','83','77%','$147.28','38','$0.00'],
];

export default function Home(){
  const [chain,setChain]=useState('SOLANA');
  const [events,setEvents]=useState<any[]>([]);
  useEffect(()=>{
    const api=(process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000');
    const wsUrl=api.replace(/^http/,'ws');
    try{
      const ws=new WebSocket(wsUrl);
      ws.onmessage=e=>setEvents(v=>[JSON.parse(e.data),...v].slice(0,8));
      return()=>ws.close();
    }catch{return;}
  },[]);
  const activeSignals=useMemo(()=>events.filter(e=>e.type!=='connected').length,[events]);
  return <main>
    <header className="topbar">
      <div className="brand"><div className="brandmark">⌁</div><div><div className="eyebrow">ANONYCRYPT</div><h1>Liquidity<br/>Intelligence</h1></div></div>
      <div className="chain-switch"><button className={chain==='SOLANA'?'selected':''} onClick={()=>setChain('SOLANA')}>SOLANA</button><button className={chain==='BNB'?'selected':''} onClick={()=>setChain('BNB')}>BNB</button></div>
      <button className="wallet">▣ &nbsp; Connect Wallet</button>
    </header>
    <section className="marketbar">
      <div className="market"><span className="coin sol">SOL</span><div><small>SOL / USD</small><strong>$101.48</strong></div><span className="down">↘ -0.82%</span><small>VOL $1.97B</small></div>
      <div className="market"><span className="coin bnb">BNB</span><div><small>BNB / USD</small><strong>$726.00</strong></div></div>
    </section>
    <section className="stats"><Stat title="ACTIVE SIGNALS" value={String(activeSignals)} icon="⌁" /><Stat title="HIGH-RISK POOLS" value="8" icon="!" danger /><Stat title="SMART MONEY TRACKED" value="6" icon="WALLETS" /></section>
    <section className="matrix card">
      <div className="section-title"><div><span>LIQUIDITY MATRIX · {chain}</span><h2>STINK <em>Stinkcoin</em></h2></div><div className="price">$0.000407 <b>↗ +237.00%</b></div></div>
      <div className="levels"><Level label="BSL" value="$0.001370" score="70" pct={70}/><Level label="EQH" value="$0.001363" score="50" pct={50}/><Level label="FVG" value="$0.000329" score="UNFILLED" muted/><Level label="HTF" value="$0.001370" score="WEEKLY" muted/><Level label="EQL" value="$-5.60e-4" score="50" pct={50} danger/><Level label="SSL" value="$-5.57e-4" score="61" pct={61} danger/></div>
      <div className="flow"><div><b>BUY FLOW</b><strong>62%</strong><i><span style={{width:'62%'}}/></i></div><div><b>SELL FLOW</b><strong className="red">38%</strong><i><span className="redbar" style={{width:'38%'}}/></i></div></div>
      <div className="depth"><div className="depthrow"><span>BSL&nbsp;&nbsp;70</span><i><b style={{width:'70%'}}/></i></div><div className="depthrow"><span>EQH&nbsp;&nbsp;50</span><i><b style={{width:'50%'}}/></i></div><div className="depthprice">PRICE&nbsp;&nbsp; $0.000407&nbsp; ↑</div><div className="depthrow mutedrow"><span>FVG&nbsp;&nbsp; UNFILLED</span></div><div className="depthrow"><span>EQL&nbsp;&nbsp;50</span><i><b style={{width:'50%'}}/></i></div><div className="depthrow"><span>SSL&nbsp;&nbsp;61</span><i><b style={{width:'61%'}}/></i></div></div>
      <div className="mini"><Mini title="CONFLUENCE" value="74"/><Mini title="LIQUIDITY" value="$54.29K"/><Mini title="24H VOL" value="$804.32K"/></div>
      <div className="risk"><div><span>RISK ENGINE</span><h3>Risk score 25/100</h3><p>Derived from LP depth, price action, buy/sell imbalance.</p></div><b className="badge medium">▲ MEDIUM</b></div>
    </section>
    <section className="card feed"><div className="section-head"><div><span>LIVE SIGNALS</span><h2>Confluence Feed</h2></div><b className="stream">● STREAMING</b></div>{signals.map(s=><SignalRow key={s.token} s={s}/>)}</section>
    <section className="card wallets"><div className="section-head"><div><span>SMART MONEY</span><h2>Top Wallets by Composite Score</h2></div><span className="trend">↗</span></div>{wallets.map((w,i)=><div className="walletrow" key={i}><div className="walletname">{w[0]} <small>ON {w[1]}</small></div><b className="walletscore">{w[2]}</b><div className="walletbar"><i style={{width:`${w[2]}%`}}/></div><div className="walletmetrics"><span>WIN<strong>{w[3]}</strong></span><span>PNL<strong className="green">{w[4]}</strong></span><span>EARLY<strong>{w[5]}</strong></span><span>POSITION<strong>{w[6]}</strong></span></div></div>)}</section>
    <section className="card scanner"><div className="section-head"><div><span>TOKEN / POOL SCANNER</span><h2>Trending Pools · Risk-Gated</h2></div></div><div className="tablehead"><span>BUY%</span><span>CONFLUENCE</span><span>RISK</span><span>SIGNAL</span></div>{signals.concat([{token:'X',name:'',price:'',change:'',score:51,liq:0,vol:0,flow:0,mom:0,risk:'HIGH'}]).map((s,i)=><div className="tablerow" key={i}><span>{[62,54,56,59,44,55][i]||62}%</span><b>{s.score}</b><span className={`badge ${i===4||i===7?'critical':i===3||i===5?'high':'medium'}`}>{i===4||i===7?'CRITICAL':i===3||i===5?'HIGH':'MEDIUM'}</span><span className={`badge ${i===4||i===7?'critical':'watch'}`}>{i===4||i===7?'INVALID':'WATCH'}</span><span>☆ ↗</span></div>)}</section>
    <section className="events card"><div className="section-head"><div><span>BACKEND STREAM</span><h2>Recent events</h2></div><span className="eventcount">{events.length}</span></div>{events.length?events.map((e,i)=><pre key={i}>{JSON.stringify(e,null,2)}</pre>):<p className="empty">Waiting for WebSocket events… UI remains usable in demo mode.</p>}</section>
  </main>
}
function Stat({title,value,icon,danger=false}:{title:string,value:string,icon:string,danger?:boolean}){return <div className="stat card"><div><span>{title}</span><strong>{value}</strong></div><b className={danger?'danger icon':'icon'}>{icon}</b></div>}
function Level({label,value,score,pct,muted,danger}:{label:string,value:string,score:string,pct?:number,muted?:boolean,danger?:boolean}){return <div className="level"><b>{label}</b><span>{value}</span>{pct!==undefined?<i><b className={danger?'redbar':''} style={{width:`${pct}%`}}/></i>:<em>{score}</em>} {pct!==undefined&&<strong>{score}</strong>}</div>}
function Mini({title,value}:{title:string,value:string}){return <div><span>{title}</span><strong>{value}</strong></div>}
function SignalRow({s}:{s:Signal}){return <div className="signalrow"><div className="siglabel"><span>● WATCH · WATCH</span><h3>{s.token} <small>{s.name}</small></h3></div><div className="sigprice">{s.price} <b className={s.change.startsWith('-')?'red':'green'}>{s.change}</b></div><b className="sigscore">{s.score}</b><div className="signalmetrics"><span>LIQ<strong>{s.liq}</strong></span><span>VOL<strong>{s.vol}</strong></span><span>FLO<strong>{s.flow}</strong></span><span>MOM<strong>{s.mom}</strong></span></div></div>}
