/* Online mode: rounds, bets and the balance come from the game server (play money for now).
   Turns on when a server is configured: ?server=https://… in the URL, a saved choice, or CR_SERVER below.
   Without a server, or if it cannot be reached, the game keeps running its offline demo rounds.
   Loaded after the main game script; uses its globals (S, SC, placeBet internals, renderPlayers, feed, toast…). */
(()=>{
const CR_SERVER = ''; // production API, e.g. 'https://crash-rocket.up.railway.app'
const q=new URLSearchParams(location.search);
let base=q.get('server')||'';try{if(base)localStorage.setItem('cr.server',base);else base=localStorage.getItem('cr.server')||''}catch(e){}
base=(base||CR_SERVER).replace(/\/$/,'');
if(!base)return;

const NET={token:'',uid:'',ws:null,offset:0,req:0,wait:new Map(),busy:false};
window.NET=NET;
const clean=n=>String(n||'').replace(/^@/,'');
const local=serverTs=>serverTs-NET.offset+(performance.now()-Date.now());   // server epoch ms -> performance.now() ms
const call=(msg)=>new Promise((res,rej)=>{if(!NET.ws||NET.ws.readyState!==1)return rej(new Error('offline'));const id=++NET.req;NET.wait.set(id,{res,rej});NET.ws.send(JSON.stringify({...msg,id}));setTimeout(()=>{if(NET.wait.delete(id))rej(new Error('timeout'))},6000)});

async function login(){
  const body=TG&&TG.initData?{initData:TG.initData}:{dev:q.get('dev')||(()=>{let n='';try{n=localStorage.getItem('cr.dev')||''}catch(e){}if(!n){n='guest-'+Math.random().toString(36).slice(2,7);try{localStorage.setItem('cr.dev',n)}catch(e){}}return n})()};
  const r=await fetch(base+'/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'login failed');
  const d=await r.json();NET.token=d.token;NET.uid=d.user.id;S.bal=d.balance;
}
function connect(){
  const ws=new WebSocket(base.replace(/^http/,'ws')+'/ws?token='+encodeURIComponent(NET.token));NET.ws=ws;
  ws.onmessage=e=>on(JSON.parse(e.data));
  ws.onclose=()=>{window.NET_ON=false;toast(lang==='ru'?'Нет связи с сервером, переподключаюсь…':'Connection lost, reconnecting…','bad');setTimeout(()=>connect(),2000)};
}
function botFrom(b){return{uid:b.uid,n:clean(b.name),bet:b.amount,target:Infinity,out:b.cashX100?b.cashX100/100:(b.x||0)}}

function on(m){const now=performance.now();
  if(m.t==='ok'||m.t==='err'){const w=NET.wait.get(m.id);if(w){NET.wait.delete(m.id);m.t==='ok'?w.res(m):w.rej(new Error(m.error))}return}
  if(m.t==='hello'){
    NET.offset=m.serverNow-Date.now();window.NET_ON=true;S.bal=m.balance;S.pend=0;
    S.hist=m.history.map(h=>h.crash);renderHist();
    S.bots=m.bets.filter(b=>b.uid!==NET.uid).map(botFrom);
    const mine=m.bets.find(b=>b.uid===NET.uid);S.bet=mine?{amt:mine.amount,out:mine.cashX100?mine.cashX100/100:0}:null;
    if(m.phase==='betting'){S.phase='wait';S.t0=local(m.phaseAt)}
    else if(m.phase==='running'){S.phase='fly';S.t0=local(m.phaseAt);S.crash=Infinity;S.mi=0;SC.onStart()}
    else{S.phase='crash';S.t0=local(m.phaseAt);S.crash=m.crashX100?m.crashX100/100:1;S.m=S.crash}
    renderPlayers();toast(lang==='ru'?'Онлайн: общие раунды с другими игроками':'Online: shared rounds with other players');return}
  if(m.t==='betting'){const queued=S.next;S.next=null;newRound(now);S.bet=null;S.t0=local(m.phaseAt);S.bots=[];
    if(queued)sendBet(queued.amt,true);renderPlayers();return}
  if(m.t==='run'){NET.offset=m.serverNow-Date.now();startFlight(now);S.crash=Infinity;S.t0=local(m.startedAt);return}
  if(m.t==='crash'){S.crash=m.crash;S.m=m.crash;if(S.phase!=='crash')doCrash(now);return}
  if(m.t==='bet'){if(m.uid===NET.uid)return;const i=S.bots.findIndex(b=>b.uid===m.uid);const b=botFrom(m);if(i<0)S.bots.push(b);else S.bots[i]=b;renderPlayers();return}
  if(m.t==='cancel'){S.bots=S.bots.filter(b=>b.uid!==m.uid);renderPlayers();return}
  if(m.t==='cashout'){
    if(m.uid===NET.uid){if(S.bet&&!S.bet.out){S.m=Math.max(S.m,m.x);cashOut(m.x)}return}  // auto cash-out done by the server
    const b=S.bots.find(x=>x.uid===m.uid);if(b){b.out=m.x;SC.onBotCash(b.n,m.x);feed(b.n,m.x,b.bet*(m.x-1))}renderPlayers();return}
  if(m.t==='balance'){S.bal=m.balance;return}
}

async function sendBet(a,quiet){
  const auto=$('autoOn').checked?parseFloat($('autoX').value)||2:undefined;
  try{const r=await call({t:'bet',amount:a,auto});S.bet={amt:a,out:0};S.bal=r.balance;renderPlayers();if(!quiet)toast(T('accepted'));haptic('light')}
  catch(e){toast(e.message,'bad')}
}
// the big button: bet / cancel / cash out, all confirmed by the server
NET.main=async()=>{if(NET.busy)return;NET.busy=true;try{const a=getAmt();
  if(S.phase==='fly'&&S.bet&&!S.bet.out){try{const r=await call({t:'cashout'});if(S.bet&&!S.bet.out){S.m=Math.max(S.m,r.x);cashOut(r.x)}S.bal=r.balance}catch(e){toast(e.message,'bad')}return}
  if(S.phase==='wait'&&S.bet){try{const r=await call({t:'cancel'});S.bet=null;S.bal=r.balance;renderPlayers()}catch(e){toast(e.message,'bad')}return}
  if(S.phase!=='wait'&&S.next){S.next=null;return}
  if(S.phase==='wait')return sendBet(a);
  if(S.bal<a){toast(T('noFunds'),'bad');return}
  S.next={amt:a};toast(T('nextQueued'))}finally{NET.busy=false}};
NET.refill=async()=>{const r=await fetch(base+'/api/refill',{method:'POST',headers:{authorization:'Bearer '+NET.token}});const d=await r.json();if(r.ok){S.bal=d.balance;toast(T('refill'))}else toast(d.error,'bad')};

login().then(connect).catch(e=>{console.warn('online mode unavailable:',e.message);toast(lang==='ru'?'Сервер недоступен, демо-режим':'Server unavailable, demo mode')});
})();
