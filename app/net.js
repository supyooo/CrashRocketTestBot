/* Online mode: rounds, bets and the balance come from the game server (play money for now).
   Turns on when a server is configured: ?server=https://… in the URL, a saved choice, or CR_SERVER below.
   Without a server, or if it cannot be reached, the game keeps running its offline demo rounds.
   Loaded after the main game script; uses its globals (S, SC, placeBet internals, renderPlayers, feed, toast…). */
(()=>{
const CR_SERVER = 'https://crashrockettestbot-production.up.railway.app'; // production API
const q=new URLSearchParams(location.search);
let base=q.get('server')||'';try{if(base)localStorage.setItem('cr.server',base);else base=localStorage.getItem('cr.server')||''}catch(e){}
base=(base||CR_SERVER).replace(/\/$/,'');
if(!base){window.BOOT&&(BOOT.done('net'),BOOT.done('round'));return}   // no server: the demo is ready at once

const NET={token:'',uid:'',ws:null,retry:0,off:0,synced:false,rtt:0,req:0,wait:new Map(),busy:false,phaseAt:0};
window.NET=NET;NET.base=base;NET.hist=[];  // NET.hist[i]: {no, hash?} of S.hist[i], for round details
// The balance on the server (USDT). In demo mode the screen shows the DEMO balance and this one waits in the background.
NET.real=0;const setReal=v=>{NET.real=v;if(!NET.demo)S.bal=v};
const clean=n=>String(n||'').replace(/^@/,'');
// Clock: NET.off = server time - performance.now(). Measured from ping round-trips (the reply is stamped roughly in
// the middle), keeping the fastest recent sample: that one has the least network noise. So the rocket on screen
// shows the server's multiplier of this very moment, and a tap can be dated in server time.
const local=serverTs=>serverTs-NET.off;               // server epoch ms -> performance.now() ms
const rough=serverNow=>{if(!NET.synced)NET.off=serverNow-performance.now()};  // until pings have measured it
const pings=new Map(),samples=[];let pingT=0;
function ping(){if(!NET.ws||NET.ws.readyState!==1)return;const id=++NET.req;pings.set(id,performance.now());NET.ws.send(JSON.stringify({t:'ping',id}))}
function onPong(m){const p0=pings.get(m.id);if(p0===undefined)return;pings.delete(m.id);const p1=performance.now();
  samples.push({rtt:p1-p0,off:m.serverNow-(p0+p1)/2});if(samples.length>12)samples.shift();
  const best=samples.reduce((a,b)=>b.rtt<a.rtt?b:a);NET.off=best.off;NET.rtt=Math.round(best.rtt);NET.synced=true;
  if(NET.phaseAt&&S.phase!=='wait')S.t0=local(NET.phaseAt)}
function startSync(){clearInterval(pingT);pings.clear();samples.length=0;NET.synced=false;
  for(let i=0;i<5;i++)setTimeout(ping,i*200);pingT=setInterval(ping,4000)}
const call=(msg)=>new Promise((res,rej)=>{if(!NET.ws||NET.ws.readyState!==1)return rej(new Error('offline'));const id=++NET.req;NET.wait.set(id,{res,rej});NET.ws.send(JSON.stringify({...msg,id}));setTimeout(()=>{if(NET.wait.delete(id))rej(new Error('timeout'))},6000)});

async function login(){
  const body=TG&&TG.initData?{initData:TG.initData}:{dev:q.get('dev')||(()=>{let n='';try{n=localStorage.getItem('cr.dev')||''}catch(e){}if(!n){n='guest-'+Math.random().toString(36).slice(2,7);try{localStorage.setItem('cr.dev',n)}catch(e){}}return n})()};
  const r=await fetch(base+'/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'login failed');
  const d=await r.json();NET.token=d.token;NET.uid=d.user.id;if(d.bot)NET.bot=d.bot;setReal(d.balance);
  NET.pay=!!(d.mode&&d.mode.currency==='usdt');if(NET.pay)payMode();paintMode();
  if(!NET.asked&&asking()&&window.BOOT){NET.asked=true;BOOT.then(()=>showPick(true))}   // ask once per launch, as the game opens
}
function connect(){
  const ws=new WebSocket(base.replace(/^http/,'ws')+'/ws?token='+encodeURIComponent(NET.token));NET.ws=ws;
  ws.onmessage=e=>on(JSON.parse(e.data));ws.onopen=startSync;
  ws.onclose=e=>{window.NET_ON=false;clearInterval(pingT);
    // 1012: planned server update. The round has already finished; the new server takes over in a moment.
    if(e.code===1012){toast(lang==='ru'?'Обновление сервера, раунд доигран. Подключаюсь…':'Server update, round finished. Reconnecting…');setTimeout(()=>connect(),700)}
    else if(e.code===4001){toast(lang==='ru'?'Сессия истекла, вхожу заново…':'Session expired, signing in again…');login().then(connect).catch(()=>setTimeout(()=>connect(),3000))}
    else{const d=Math.min(15000,2000*2**NET.retry++);  // 2, 4, 8, 15 s…: no hammering a server that is down
      if(NET.retry<=1)toast(lang==='ru'?'Нет связи с сервером, переподключаюсь…':'Connection lost, reconnecting…','bad');setTimeout(()=>connect(),d)}};
}
function botFrom(b){return{uid:b.uid,slot:b.slot||0,n:clean(b.name),bet:b.amount,target:Infinity,out:b.cashX100?b.cashX100/100:(b.x||0)}}
const same=(x,m)=>x.uid===m.uid&&x.slot===(m.slot||0);
// The server's hello carries its last 20 rounds; the older ones up to HIST_MAX (the history strip and panel) come from
// /api/rounds, newest first, appended behind the oldest round we have, so S.hist and NET.hist stay in step.
async function moreHist(){if(NET.histFull)return;NET.histFull=true;
  try{const rs=await fetch(base+'/api/rounds?limit='+HIST_MAX).then(q=>{if(!q.ok)throw new Error(q.status);return q.json()});
    const oldest=NET.hist.length?NET.hist[NET.hist.length-1].no:Infinity;let added=0;
    for(const r of rs)if(r.no<oldest&&S.hist.length<HIST_MAX){S.hist.push(r.crash);NET.hist.push({no:r.no});added++}
    if(added)renderHist()}
  catch(e){NET.histFull=false}}   // try again when the panel opens
NET.moreHist=moreHist;
const demoBets=()=>S.bets.map(b=>b&&b.demo?b:null);   // a demo bet lives on this device, the server never sees it

function on(m){const now=performance.now();
  // loading screen: the server has answered; open now, unless a round is mid-flight - then on the next countdown
  if(window.BOOT){if(m.t==='hello'){BOOT.done('net');if(m.phase!=='running')BOOT.done('round')}else if(m.t==='betting')BOOT.done('round')}
  if(m.t==='pong'){onPong(m);return}
  if(m.t==='batch'){for(const x of m.m)on(x);return}   // other players' bets and cash-outs, sent together
  if(m.t==='ok'||m.t==='err'){const w=NET.wait.get(m.id);if(w){NET.wait.delete(m.id);m.t==='ok'?w.res(m):w.rej(new Error(m.error))}return}
  if(m.t==='hello'&&m.phase==='waiting'){ // a fresh server waits for the previous one to finish its round
    rough(m.serverNow);if(m.k)K=m.k;if(m.limits){LIM.min=m.limits.minBet;LIM.max=m.limits.maxBet;LIM.win=m.limits.maxWin;for(const i of [0,1])setAmt(i,getAmt(i))}window.NET_ON=true;setReal(m.balance);S.pend=0;S.bots=[];S.bets=demoBets();S.phase='crash';S.crash=1;S.m=1;S.t0=now;renderPlayers();
    toast(lang==='ru'?'Сервер обновляется, следующий раунд через пару секунд':'Server is updating, next round in a few seconds');return}
  if(m.t==='hello'){NET.retry=0;
    rough(m.serverNow);if(m.k)K=m.k;if(m.limits){LIM.min=m.limits.minBet;LIM.max=m.limits.maxBet;LIM.win=m.limits.maxWin;for(const i of [0,1])setAmt(i,getAmt(i))}NET.phaseAt=m.phaseAt;window.NET_ON=true;setReal(m.balance);S.pend=0;
    S.hist=m.history.map(h=>h.crash);NET.hist=m.history.map(h=>({no:h.no}));NET.histFull=false;renderHist();moreHist();
    S.bots=m.bets.filter(b=>b.uid!==NET.uid).map(botFrom);
    if(!myBets().some(b=>b.demo)){S.bets=[null,null];for(const b of m.bets)if(b.uid===NET.uid)S.bets[b.slot||0]={amt:b.amount,out:b.cashX100?b.cashX100/100:0}}
    if(m.phase==='betting'){S.phase='wait';S.t0=local(m.phaseAt)}
    else if(m.phase==='running'){S.phase='fly';S.t0=local(m.phaseAt);S.crash=Infinity;S.mi=0;SC.onStart()}
    else{S.phase='crash';S.t0=local(m.phaseAt);S.crash=m.crashX100?m.crashX100/100:1;S.m=S.crash}
    renderPlayers();toast(lang==='ru'?'Онлайн: общие раунды с другими игроками':'Online: shared rounds with other players');return}
  if(m.t==='betting'){const queued=S.nexts;S.nexts=[null,null];newRound(now);S.bets=[null,null];NET.phaseAt=m.phaseAt;S.t0=local(m.phaseAt);S.bots=[];
    for(let i=0;i<2;i++){if(queued[i])sendBet(i,queued[i].amt,true);else{const a=autoBetDue(i);if(a)sendBet(i,a,true)}}renderPlayers();return}
  if(m.t==='run'){rough(m.serverNow);if(m.k)K=m.k;if(m.limits){LIM.min=m.limits.minBet;LIM.max=m.limits.maxBet;LIM.win=m.limits.maxWin;for(const i of [0,1])setAmt(i,getAmt(i))}NET.phaseAt=m.startedAt;startFlight(now);S.crash=Infinity;S.t0=local(m.startedAt);return}
  if(m.t==='crash'){S.bets.forEach((b,i)=>{if(b&&b.demo&&b.lock&&!b.out)demoSettle(i,b.lock<m.crash)});   // before the loss is shown
    S.crash=m.crash;S.m=m.crash;if(window.BOOT&&BOOT.on)BOOT.ended(m.crash);if(S.phase!=='crash'){NET.hist.unshift({no:m.no,hash:m.hash});NET.hist.length=Math.min(NET.hist.length,HIST_MAX);doCrash(now)}return}  // doCrash adds to S.hist: keep both in step
  if(m.t==='bet'){if(m.uid===NET.uid)return;const i=S.bots.findIndex(b=>same(b,m));const b=botFrom(m);if(i<0)S.bots.push(b);else S.bots[i]=b;renderPlayers();return}
  if(m.t==='cancel'){S.bots=S.bots.filter(b=>!same(b,m));renderPlayers();return}
  if(m.t==='cashout'){
    if(m.uid===NET.uid){const i=m.slot||0,b=S.bets[i];if(b&&!b.demo&&!b.out){S.m=Math.max(S.m,m.x);cashOut(i,m.x,true)}return}  // auto cash-out done by the server
    const b=S.bots.find(x=>same(x,m));if(b){b.out=m.x;SC.onBotCash(b.n,m.x);feed(b.n,m.x,b.bet*(m.x-1))}renderPlayers();return}
  if(m.t==='balance'){setReal(m.balance);return}
  if(m.t==='pay'){onPay(m);return}
}

/* ---------- demo: the same live rounds with a virtual DEMO balance ----------
   The server supplies the rounds; demo bets, cash-outs and the balance stay on this device and never reach it.
   A demo cash-out counts only if the tap came before the explosion, like on the server: it is confirmed by the
   crash point itself (locked at a lower multiplier = tapped before it) or, if no crash message arrives within a
   network round-trip, the rocket was surely still flying when the finger landed. Demo bets earn no coins. */
const DEMO_START=1000;
const demoBal=()=>{try{const v=parseFloat(localStorage.getItem('cr.demoBal'));return isFinite(v)?v:DEMO_START}catch(e){return DEMO_START}};
const demoSave=()=>{if(!NET.demo)return;S.bal=Math.round(S.bal*100)/100;try{localStorage.setItem('cr.demoBal',String(S.bal))}catch(e){}};
try{NET.demo=localStorage.getItem('cr.demo')==='1'}catch(e){NET.demo=false}
if(NET.demo)S.bal=demoBal();
const DT={ru:{on:'Демо-режим: ставки виртуальные, выигрыши тоже',off:'Реальный счёт',busy:'Переключить можно после раунда',wait:'Пополнить демо можно после раунда',
    refill:'Демо-баланс пополнен',full:'Демо-баланс уже полный',late:'Не успели: ракета взорвалась раньше'},
  en:{on:'Demo mode: virtual bets, virtual wins',off:'Real account',busy:'You can switch after the round',wait:'You can top up demo after the round',
    refill:'Demo balance topped up',full:'Demo balance is already full',late:'Too late: the rocket exploded first'}};
const dt=k=>(DT[lang]||DT.en)[k];
function demoBet(i,a,quiet){
  if(S.bal<a){toast(T('noFunds'),'bad');return}
  S.bal-=a;demoSave();S.bets[i]={amt:a,out:0,demo:true};renderPlayers();if(!quiet)toast(T('accepted'));haptic('light')}
function demoLock(i,b,x){
  b.lock=x;const my=b;
  setTimeout(()=>{if(S.bets[i]===my&&my.lock&&!my.out&&S.phase==='fly')demoSettle(i,true)},Math.max(NET.rtt||0,120)+60)}
function demoSettle(i,win){const b=S.bets[i];if(!b||!b.demo||b.out||!b.lock)return;
  if(win){cashOut(i,b.lock,true);demoSave()}                               // cashOut adds the win to the balance
  else{b.lock=0;toast(dt('late'),'bad');haptic('error')}}
// auto cash-out for demo bets: exactly at the target, like the server does for real ones
(function demoAuto(){requestAnimationFrame(demoAuto);if(!NET.demo||!window.NET_ON||S.phase!=='fly')return;
  for(let i=0;i<2;i++){const b=S.bets[i];if(!b||!b.demo||b.out||b.lock||!autoOn(i))continue;
    const ax=Math.floor(autoX(i)*100)/100;if(xf(S.m)>=ax)demoLock(i,b,ax)}})();
/** Switch between the real account and demo; only between rounds, so a bet never changes currency. */
NET.setDemo=on=>{
  if(on===NET.demo)return;if(myBets().length||S.nexts.some(Boolean)){toast(dt('busy'),'bad');return}
  NET.demo=on;try{localStorage.setItem('cr.demo',on?'1':'0')}catch(e){}
  S.bal=on?demoBal():NET.real;S.pend=0;paintMode();toast(on?dt('on'):dt('off'));haptic('select')};
function paintMode(){
  $('app').classList.toggle('demo',NET.demo);
  const box=$('balBox');let b=box.querySelector('.mode');
  if(!b){b=document.createElement('button');b.className='mode';b.type='button';b.onclick=e=>{e.stopPropagation();showPick(false)};box.insertBefore(b,$('topup'))}
  const tn=box.querySelector('.tnet');if(tn)tn.remove();                   // the mode badge replaces the TESTNET one
  b.textContent=NET.demo?'DEMO':NET.pay?'TESTNET':'REAL';b.classList.toggle('on',NET.demo);
  b.setAttribute('aria-label',(lang==='ru'?'Режим игры: ':'Game mode: ')+(NET.demo?(lang==='ru'?'демо':'demo'):(lang==='ru'?'реальный счёт':'real account'))+(lang==='ru'?'. Сменить':'. Change'))}
NET.paintMode=paintMode;

/* Mode picker: asked on entry (like casino games do) and from the badge next to the balance. */
const PT={ru:{title:'Как будем играть?',sub:'Раунды одни и те же, выбирается только счёт',
    real:'Реальный счёт',realTon:'Тестовые USDT',realNote:'Ставки и выигрыши на вашем балансе, выигрыш можно вывести',
    demo:'Демо-режим',demoNote:'Без риска: те же живые раунды, виртуальные деньги',bal:'Баланс',
    ask:'Не спрашивать при входе',later:'Сменить режим можно по кнопке у баланса',now:'Сейчас'},
  en:{title:'How do you want to play?',sub:'Same rounds either way, only the account differs',
    real:'Real account',realTon:'Test USDT',realNote:'Bets and wins on your balance, wins can be withdrawn',
    demo:'Demo mode',demoNote:'No risk: the same live rounds, virtual money',bal:'Balance',
    ask:'Do not ask on entry',later:'Switch any time with the badge next to the balance',now:'Now'}};
const pt=k=>(PT[lang]||PT.en)[k];
const asking=()=>{try{return localStorage.getItem('cr.modeAsk')!=='0'}catch(e){return true}};
function showPick(entry){
  let el=document.getElementById('pick');if(el)el.remove();
  el=document.createElement('div');el.id='pick';el.className='pick';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','pickT');
  const tonIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#26a17b"/><path fill="#fff" d="M13.3 10.4V8.9h3.5V6.6H7.2v2.3h3.5v1.5c-2.9.1-5 .7-5 1.4s2.1 1.3 5 1.4v4.8h2.6v-4.8c2.9-.1 5-.7 5-1.4s-2.1-1.3-5-1.4zm0 2.4h-2.6c-2.5-.1-4.3-.5-4.3-1s1.8-.9 4.3-1v1.6h2.6v-1.6c2.5.1 4.3.5 4.3 1s-1.8.9-4.3 1z"/></svg>';
  const card=(on,icon,title,bal,note)=>`<button class="pcard${on?' demo':''}${NET.demo===on?' cur':''}" data-demo="${on?1:0}">
      <span class="pi">${icon}</span><span class="pt"><b>${title}</b><small>${note}</small><em>${pt('bal')}: ${bal}</em></span>${NET.demo===on?`<i>${pt('now')}</i>`:''}</button>`;
  el.innerHTML=`<div class="pbox"><h2 id="pickT">${pt('title')}</h2><p>${pt('sub')}</p>
    ${card(false,tonIcon,NET.pay?pt('realTon'):pt('real'),fmtTon(NET.real)+' USDT',pt('realNote'))}
    ${card(true,'<span class="dm">D</span>',pt('demo'),fmtTon(NET.demo?S.bal:demoBal())+' DEMO',pt('demoNote'))}
    <label class="pask"><input type="checkbox" id="pickAsk"${asking()?'':' checked'}> ${pt('ask')}</label>
    <small class="plater">${pt('later')}</small></div>`;
  $('app').appendChild(el);requestAnimationFrame(()=>el.classList.add('on'));haptic('select');
  el.querySelector('#pickAsk').onchange=e=>{try{localStorage.setItem('cr.modeAsk',e.target.checked?'0':'1')}catch(_){}};
  el.addEventListener('click',e=>{const c=e.target.closest('.pcard');
    if(c){NET.setDemo(c.dataset.demo==='1');close()}
    else if(e.target===el&&!entry)close()});                               // outside tap closes it, except on entry
  function close(){el.classList.remove('on');setTimeout(()=>el.remove(),250)}
}
NET.showPick=showPick;

async function sendBet(i,a,quiet){
  if(NET.demo)return demoBet(i,a,quiet);
  const auto=autoOn(i)?autoX(i):undefined;
  try{const r=await call({t:'bet',amount:a,auto,slot:i});S.bets[i]={amt:a,out:0};setReal(r.balance);renderPlayers();if(!quiet)toast(T('accepted'));haptic('light')}
  catch(e){toast(e.message,'bad');if(/insufficient/.test(e.message)&&NET.pay)NET.openPay('deposit')}
}
// the big button: bet / cancel / cash out, all confirmed by the server
const busy=[false,false];
NET.main=async(i)=>{if(busy[i])return;busy[i]=true;try{const a=getAmt(i),b=S.bets[i];
  if(S.phase==='fly'&&b&&!b.out)return cashNow(i);
  if(S.phase==='wait'&&b&&b.demo){S.bal+=b.amt;S.bets[i]=null;demoSave();renderPlayers();return}
  if(S.phase==='wait'&&b){try{const r=await call({t:'cancel',slot:i});S.bets[i]=null;setReal(r.balance);renderPlayers()}catch(e){toast(e.message,'bad')}return}
  if(S.phase!=='wait'&&S.nexts[i]){S.nexts[i]=null;return}
  if(S.phase==='wait')return sendBet(i,a);
  const queued=S.nexts.reduce((s,n)=>s+(n?n.amt:0),0);   // both panels may queue: the balance must cover both
  if(S.bal<a+queued){toast(T('noFunds'),'bad');if(NET.pay&&!NET.demo)NET.openPay('deposit');return}
  S.nexts[i]={amt:a};toast(T('nextQueued'))}finally{busy[i]=false}};
// Cash out at exactly the multiplier on screen when the finger lands: the number drawn in the last frame, dated with
// that frame's time in server time, so the server's floor(100*e^(K*t)) gives the same hundredths. The amount locks
// at once with a buzz and a "your cash-out" tag (the big number keeps running for everyone still in the round);
// the win plays when the server confirms the same number a moment later.
async function cashNow(i){const b=S.bets[i];if(!b||b.out||b.lock)return;
  const sh=S.shown&&S.shown.at>=S.t0?S.shown:{x:xf(Math.exp(K*Math.max(0,(performance.now()-S.t0)/1000))),at:performance.now()};
  const x=Math.min(sh.x,S.crash);
  haptic('medium');pop('safe',(lang==='ru'?'Ваш выход: x':'Your cash-out: x')+x2(x));
  if(b.demo)return demoLock(i,b,x);
  b.lock=x;
  try{const r=await call({t:'cashout',at:sh.at+NET.off,slot:i});if(!b.out){S.m=Math.max(S.m,r.x);cashOut(i,r.x,true)}if(r.balance!==undefined)setReal(r.balance)}   // the server sends the new balance separately
  catch(e){b.lock=0;toast(/too late|not flying/.test(e.message)?(lang==='ru'?'Не успели: ракета взорвалась раньше':'Too late: the rocket exploded first'):e.message,'bad');haptic('error')}}
// react on touch-down, not on release: saves the ~100 ms a finger takes to lift
for(const p of PN){const i=p.i,mainClick=p.main.onclick;let downAt=0;
  p.main.addEventListener('pointerdown',e=>{const b=S.bets[i];if(window.NET_ON&&e.button<=0&&S.phase==='fly'&&b&&!b.out&&!b.lock){downAt=performance.now();cashNow(i)}});
  p.main.onclick=e=>{if(performance.now()-downAt<1000)return;mainClick(e)}}  // the click that follows the same touch
NET.refill=async()=>{
  if(NET.demo){if(myBets().length||S.nexts.some(Boolean)){toast(dt('wait'));return}if(S.bal>=DEMO_START){toast(dt('full'));return}S.bal=DEMO_START;demoSave();toast(dt('refill'));haptic('success');return}
  if(NET.pay)return NET.openPay('deposit');const r=await fetch(base+'/api/refill',{method:'POST',headers:{authorization:'Bearer '+NET.token}});const d=await r.json();if(r.ok){setReal(d.balance);toast(T('refill'))}else toast(d.error,'bad')};

/* ---------- USDT through Crypto Pay (@CryptoBot): top up with an invoice, withdraw to the CryptoBot wallet ----------
   Deposits: the server opens an invoice for the amount, the player pays it in CryptoBot, the balance arrives by
   itself. Withdrawals go to the player's own CryptoBot wallet by Telegram id: no address to type. Requests can be
   cancelled in "Transactions" until they are being sent. */
const PL={
  ru:{dep:'Пополнить',wd:'Вывести',hist:'Детализация',tnet:'Тестовая сеть: платите тестовыми USDT в @CryptoTestnetBot, настоящие деньги не списываются.',
    amount:'Сумма',min:'минимум',pay:'Оплатить в @CryptoBot',opened:'Счёт открыт в CryptoBot. После оплаты деньги придут на баланс сами',
    wdTo:'Вывод на ваш кошелёк в @CryptoBot: адрес не нужен. До {r} USDT — автоматически, больше — после проверки (до 48 рабочих часов).',
    wager:'Оборот для вывода (×{x} от депозитов)',wagerOk:'Условие оборота выполнено',max:'Всё',limit:'в сутки до',
    empty:'Операций пока нет',payNow:'Оплатить',cancel:'Отменить',cancelled:'Вывод отменён, сумма на балансе',
    dep2:'Пополнение',wd2:'Вывод',loadErr:'Не удалось загрузить данные',credited:'+{a} USDT зачислено',
    st:{active:'ждёт оплаты',paid:'зачислено',review:'на проверке',pending:'в очереди',sending:'отправляется',sent:'отправлено',failed:'не прошёл, сумма на балансе',rejected:'отклонён, сумма на балансе',cancelled:'отменён'},
    wdQueued:'Вывод {a} USDT принят',wdReview:'Вывод {a} USDT на проверке',wdSent:'Вывод {a} USDT отправлен в @CryptoBot',wdFailed:'Вывод {a} USDT не прошёл, сумма вернулась на баланс',
    err:{'amount is below the minimum withdrawal':'Сумма меньше минимальной','amount is below the minimum deposit':'Сумма меньше минимальной','wager is not met':'Сначала нужен оборот ставок: см. шкалу ниже',
      'daily withdrawal limit reached':'Достигнут дневной лимит вывода','insufficient funds':'Недостаточно средств','withdrawals need a Telegram account':'Вывод доступен только из Telegram',
      'amount must be in whole cents':'Сумма — до двух знаков после запятой','withdrawals are suspended for this account, contact support':'Вывод для аккаунта приостановлен, напишите в поддержку',
      'this withdrawal can no longer be cancelled':'Этот вывод уже нельзя отменить','too many unpaid deposits, pay or wait for one to expire':'Слишком много неоплаченных счетов: оплатите или подождите час',
      'the payment service is not available, try again in a minute':'Платёжный сервис недоступен, попробуйте через минуту',
      'open @CryptoBot once, then request the withdrawal again':'Откройте @CryptoBot хотя бы раз и повторите вывод'}},
  en:{dep:'Top up',wd:'Withdraw',hist:'Transactions',tnet:'Testnet: pay with test USDT in @CryptoTestnetBot, no real money is charged.',
    amount:'Amount',min:'minimum',pay:'Pay in @CryptoBot',opened:'The invoice is open in CryptoBot. Once paid, the money reaches your balance by itself',
    wdTo:'Withdrawals go to your @CryptoBot wallet: no address needed. Up to {r} USDT automatically, more after a review (up to 48 business hours).',
    wager:'Turnover to withdraw (×{x} of deposits)',wagerOk:'Turnover requirement met',max:'All',limit:'per day up to',
    empty:'No transactions yet',payNow:'Pay',cancel:'Cancel',cancelled:'Withdrawal cancelled, back on your balance',
    dep2:'Deposit',wd2:'Withdrawal',loadErr:'Could not load the data',credited:'+{a} USDT credited',
    st:{active:'awaiting payment',paid:'credited',review:'under review',pending:'queued',sending:'sending',sent:'sent',failed:'failed, back on balance',rejected:'rejected, back on balance',cancelled:'cancelled'},
    wdQueued:'Withdrawal of {a} USDT accepted',wdReview:'Withdrawal of {a} USDT is under review',wdSent:'Withdrawal of {a} USDT sent to @CryptoBot',wdFailed:'Withdrawal of {a} USDT failed, returned to your balance',
    err:{'wager is not met':'Bet the required turnover first: see the bar below','open @CryptoBot once, then request the withdrawal again':'Open @CryptoBot once, then withdraw again'}}};
const tl=k=>(PL[lang]||PL.en)[k];
const terr=m=>(tl('err')[m])||(PL.ru.err[m]&&lang==='ru'?PL.ru.err[m]:m);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const api=async(path,opt={})=>{const r=await fetch(base+path,{...opt,headers:{authorization:'Bearer '+NET.token,'content-type':'application/json'}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'error');return d};
const openLink=u=>{try{if(TG&&TG.openTelegramLink&&/^https:\/\/t\.me\//.test(u)){TG.openTelegramLink(u);return}}catch(e){}window.open(u,'_blank','noopener')};
let psh,tab='deposit',info=null,depAmt=10,pbusy=false;

function payMode(){
  const box=$('balBox');if(box&&!box.querySelector('.tnet')){const b=document.createElement('span');b.className='tnet';b.textContent='TESTNET';box.insertBefore(b,$('topup'))}
  if(psh)return;
  psh=document.createElement('section');psh.className='sheet tsheet';psh.setAttribute('aria-label','USDT');$('app').appendChild(psh);
  psh.addEventListener('click',payAct);psh.addEventListener('input',e=>{if(e.target.id==='tAmt'){depAmt=parseFloat(e.target.value.replace(',','.'))||0;psh.querySelectorAll('.tchip[data-v]').forEach(c=>c.classList.toggle('on',+c.dataset.v===depAmt))}});
  $('scrim').addEventListener('click',closePay);
}
function closePay(){if(!psh||!psh.classList.contains('on'))return;psh.classList.remove('on');if(!document.querySelector('.sheet.on'))$('scrim').classList.remove('on')}
NET.openPay=async(which)=>{if(!NET.pay||!psh)return;tab=['withdraw','history'].includes(which)?which:'deposit';render();psh.classList.add('on');$('scrim').classList.add('on');haptic('select');await load()};
async function load(){try{info=await api('/api/pay/info');setReal(info.balance);render()}catch(e){toast(tl('loadErr'),'bad')}}
const usd=v=>fmtTon(v)+' USDT';

function render(){
  const i=info;
  let h=`<div class="sh-h"><h2>${tl(tab==='deposit'?'dep':tab==='withdraw'?'wd':'hist')}</h2><button data-t="close" aria-label="Close">×</button></div>
  <div class="segs">${['deposit','withdraw','history'].map(v=>`<button data-t="tab" data-v="${v}" aria-pressed="${tab===v}">${tl(v==='deposit'?'dep':v==='withdraw'?'wd':'hist')}</button>`).join('')}</div>
  <div class="tbody">`;
  if(i&&i.network!=='mainnet'&&tab!=='history')h+=`<div class="twarn">${tl('tnet')}</div>`;
  if(!i)h+=`<div class="tload"></div>`;
  else if(tab==='deposit'){
    h+=`<div class="lbl">${tl('amount')} · ${tl('min')} ${usd(i.minDeposit)}</div>
    <div class="tchips">${[10,25,50,100].map(v=>`<button class="tchip${v===depAmt?' on':''}" data-t="amt" data-v="${v}">${v}</button>`).join('')}<input id="tAmt" class="tinp" inputmode="decimal" value="${depAmt}" aria-label="${tl('amount')}"></div>
    <button class="btn green tbig" data-t="pay"${pbusy?' disabled':''}>${tl('pay')}</button>`;
  }else if(tab==='withdraw'){
    const w=i.wager,p=w.need>0?Math.min(1,w.done/w.need):1;
    h+=`<div class="lbl">${tl('amount')} · ${tl('min')} ${usd(i.minWithdraw)}${i.maxWithdrawDay>0?` · ${tl('limit')} ${usd(i.maxWithdrawDay)}`:''}</div>
    <div class="tchips"><input id="tWd" class="tinp" inputmode="decimal" placeholder="0.00" aria-label="${tl('amount')}"><button class="tchip" data-t="max">${tl('max')}</button></div>
    <div class="twager${w.met?' ok':''}"><span>${w.met?tl('wagerOk'):tl('wager').replace('{x}',w.need&&w.deposits?Math.round(w.need/w.deposits):2)}</span><b>${fmtTon(w.done)} / ${fmtTon(w.need)}</b><i style="width:${(p*100).toFixed(1)}%"></i></div>
    <div class="tnote">${tl('wdTo').replace('{r}',fmtTon(i.reviewOver))}</div>
    <button class="btn green tbig" data-t="wd"${pbusy?' disabled':''}>${tl('wd')}</button>`;
  }else{
    h+=i.history.length?i.history.map(t=>`<div class="ttx"><span>${tl(t.kind==='deposit'?'dep2':'wd2')}<small>${new Date(t.at).toLocaleString(lang==='ru'?'ru-RU':'en-US',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small></span>
      <em class="s-${t.status}">${(tl('st')[t.status])||t.status}</em><b class="${t.kind==='deposit'?'in':'out'}">${t.kind==='deposit'?'+':'−'}${fmtTon(t.amount)}</b>
      ${t.cancel?`<button class="tx-x" data-t="cancel" data-v="${t.id}" aria-label="${tl('cancel')}">✕</button>`:t.url?`<button class="tx-pay" data-t="open" data-v="${esc(t.url)}">${tl('payNow')}</button>`:''}</div>`).join(''):`<div class="tnote">${tl('empty')}</div>`;
  }
  psh.innerHTML=h+'</div>';
}
async function pay(){
  if(!info||pbusy)return;const amt=Math.round(depAmt*100)/100;
  if(!(amt>=info.minDeposit)){toast(`${tl('min')} ${usd(info.minDeposit)}`,'bad');return}
  pbusy=true;render();
  try{const d=await api('/api/pay/deposit',{method:'POST',body:JSON.stringify({amount:amt})});openLink(d.url);toast(tl('opened'));haptic('success')}
  catch(e){toast(terr(e.message),'bad');haptic('error')}
  pbusy=false;await load()}
async function withdraw(){
  if(pbusy)return;const amt=Math.floor(parseFloat(($('tWd').value||'').replace(',','.'))*100)/100;if(!(amt>0))return;
  pbusy=true;render();
  try{const d=await api('/api/pay/withdraw',{method:'POST',body:JSON.stringify({amount:amt})});setReal(d.balance);haptic('success');tab='history'}
  catch(e){toast(terr(e.message),'bad');haptic('error')}
  pbusy=false;await load()}
async function cancelWd(id){
  try{const d=await api('/api/pay/cancel',{method:'POST',body:JSON.stringify({id})});setReal(d.balance);toast(tl('cancelled'));haptic('success')}
  catch(e){toast(terr(e.message),'bad');haptic('error')}
  await load()}
function payAct(e){const b=e.target.closest('[data-t]');if(!b)return;const t=b.dataset.t;
  if(t==='close')closePay();
  else if(t==='tab'){tab=b.dataset.v;render();haptic('select')}
  else if(t==='amt'){depAmt=+b.dataset.v;render()}
  else if(t==='pay')pay();
  else if(t==='open')openLink(b.dataset.v);
  else if(t==='max'){$('tWd').value=(Math.floor(NET.real*100)/100).toFixed(2)}
  else if(t==='wd')withdraw();
  else if(t==='cancel')cancelWd(+b.dataset.v);
}
function onPay(m){const a=fmtTon(m.amount);
  if(m.kind==='deposit'){toast(tl('credited').replace('{a}',a));haptic('success')}
  else if(m.status==='review')toast(tl('wdReview').replace('{a}',a));
  else if(m.status==='pending')toast(tl('wdQueued').replace('{a}',a));
  else if(m.status==='sent'){toast(tl('wdSent').replace('{a}',a));haptic('success')}
  else if(m.status==='failed'){toast(m.error?terr(m.error):tl('wdFailed').replace('{a}',a),'bad');haptic('error')}
  if(psh&&psh.classList.contains('on'))load();
}

login().then(connect).catch(e=>{console.warn('online mode unavailable:',e.message);window.BOOT&&(BOOT.done('net'),BOOT.done('round'));toast(lang==='ru'?'Сервер недоступен, демо-режим':'Server unavailable, demo mode')});
})();
