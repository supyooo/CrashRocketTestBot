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
// The balance on the server (TON). In demo mode the screen shows the DEMO balance and this one waits in the background.
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
  const d=await r.json();NET.token=d.token;NET.uid=d.user.id;setReal(d.balance);
  NET.ton=!!(d.mode&&d.mode.currency==='tton');if(NET.ton)tonMode();paintMode();
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
function botFrom(b){return{uid:b.uid,n:clean(b.name),bet:b.amount,target:Infinity,out:b.cashX100?b.cashX100/100:(b.x||0)}}

function on(m){const now=performance.now();
  // loading screen: the server has answered; open now, unless a round is mid-flight - then on the next countdown
  if(window.BOOT){if(m.t==='hello'){BOOT.done('net');if(m.phase!=='running')BOOT.done('round')}else if(m.t==='betting')BOOT.done('round')}
  if(m.t==='pong'){onPong(m);return}
  if(m.t==='batch'){for(const x of m.m)on(x);return}   // other players' bets and cash-outs, sent together
  if(m.t==='ok'||m.t==='err'){const w=NET.wait.get(m.id);if(w){NET.wait.delete(m.id);m.t==='ok'?w.res(m):w.rej(new Error(m.error))}return}
  if(m.t==='hello'&&m.phase==='waiting'){ // a fresh server waits for the previous one to finish its round
    rough(m.serverNow);if(m.k)K=m.k;window.NET_ON=true;setReal(m.balance);S.pend=0;S.bots=[];if(!(S.bet&&S.bet.demo))S.bet=null;S.phase='crash';S.crash=1;S.m=1;S.t0=now;renderPlayers();
    toast(lang==='ru'?'Сервер обновляется, следующий раунд через пару секунд':'Server is updating, next round in a few seconds');return}
  if(m.t==='hello'){NET.retry=0;
    rough(m.serverNow);if(m.k)K=m.k;NET.phaseAt=m.phaseAt;window.NET_ON=true;setReal(m.balance);S.pend=0;
    S.hist=m.history.map(h=>h.crash);NET.hist=m.history.map(h=>({no:h.no}));renderHist();
    S.bots=m.bets.filter(b=>b.uid!==NET.uid).map(botFrom);
    const mine=m.bets.find(b=>b.uid===NET.uid);
    if(!(S.bet&&S.bet.demo))S.bet=mine?{amt:mine.amount,out:mine.cashX100?mine.cashX100/100:0}:null;   // a demo bet lives on this device
    if(m.phase==='betting'){S.phase='wait';S.t0=local(m.phaseAt)}
    else if(m.phase==='running'){S.phase='fly';S.t0=local(m.phaseAt);S.crash=Infinity;S.mi=0;SC.onStart()}
    else{S.phase='crash';S.t0=local(m.phaseAt);S.crash=m.crashX100?m.crashX100/100:1;S.m=S.crash}
    renderPlayers();toast(lang==='ru'?'Онлайн: общие раунды с другими игроками':'Online: shared rounds with other players');return}
  if(m.t==='betting'){const queued=S.next;S.next=null;newRound(now);S.bet=null;NET.phaseAt=m.phaseAt;S.t0=local(m.phaseAt);S.bots=[];
    if(queued)sendBet(queued.amt,true);else{const a=autoBetDue();if(a)sendBet(a,true)}renderPlayers();return}
  if(m.t==='run'){rough(m.serverNow);if(m.k)K=m.k;NET.phaseAt=m.startedAt;startFlight(now);S.crash=Infinity;S.t0=local(m.startedAt);return}
  if(m.t==='crash'){if(S.bet&&S.bet.demo&&S.bet.lock&&!S.bet.out)demoSettle(S.bet.lock<m.crash);   // before the loss is shown
    S.crash=m.crash;S.m=m.crash;if(window.BOOT&&BOOT.on)BOOT.ended(m.crash);if(S.phase!=='crash'){NET.hist.unshift({no:m.no,hash:m.hash});NET.hist.length=Math.min(NET.hist.length,20);doCrash(now)}return}  // doCrash adds to S.hist: keep both in step
  if(m.t==='bet'){if(m.uid===NET.uid)return;const i=S.bots.findIndex(b=>b.uid===m.uid);const b=botFrom(m);if(i<0)S.bots.push(b);else S.bots[i]=b;renderPlayers();return}
  if(m.t==='cancel'){S.bots=S.bots.filter(b=>b.uid!==m.uid);renderPlayers();return}
  if(m.t==='cashout'){
    if(m.uid===NET.uid){if(S.bet&&!S.bet.out){S.m=Math.max(S.m,m.x);cashOut(m.x,true)}return}  // auto cash-out done by the server
    const b=S.bots.find(x=>x.uid===m.uid);if(b){b.out=m.x;SC.onBotCash(b.n,m.x);feed(b.n,m.x,b.bet*(m.x-1))}renderPlayers();return}
  if(m.t==='balance'){setReal(m.balance);return}
  if(m.t==='ton'){onTon(m);return}
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
function demoBet(a,quiet){
  if(S.bal<a){toast(T('noFunds'),'bad');return}
  S.bal-=a;demoSave();S.bet={amt:a,out:0,demo:true};renderPlayers();if(!quiet)toast(T('accepted'));haptic('light')}
function demoLock(b,x){
  b.lock=x;const my=b;
  setTimeout(()=>{if(S.bet===my&&my.lock&&!my.out&&S.phase==='fly')demoSettle(true)},Math.max(NET.rtt||0,120)+60)}
function demoSettle(win){const b=S.bet;if(!b||!b.demo||b.out||!b.lock)return;
  if(win){cashOut(b.lock,true);demoSave()}                               // cashOut adds the win to the balance
  else{b.lock=0;toast(dt('late'),'bad');haptic('error')}}
// auto cash-out for demo bets: exactly at the target, like the server does for real ones
(function demoAuto(){requestAnimationFrame(demoAuto);const b=S.bet;
  if(!NET.demo||!window.NET_ON||S.phase!=='fly'||!b||!b.demo||b.out||b.lock||!$('autoOn').checked)return;
  const ax=Math.floor((parseFloat($('autoX').value)||2)*100)/100;if(xf(S.m)>=ax)demoLock(b,ax)})();
/** Switch between the real account and demo; only between rounds, so a bet never changes currency. */
NET.setDemo=on=>{
  if(on===NET.demo)return;if(S.bet||S.next){toast(dt('busy'),'bad');return}
  NET.demo=on;try{localStorage.setItem('cr.demo',on?'1':'0')}catch(e){}
  S.bal=on?demoBal():NET.real;S.pend=0;paintMode();toast(on?dt('on'):dt('off'));haptic('select')};
function paintMode(){
  $('app').classList.toggle('demo',NET.demo);
  const box=$('balBox');let b=box.querySelector('.mode');
  if(!b){b=document.createElement('button');b.className='mode';b.type='button';b.onclick=e=>{e.stopPropagation();showPick(false)};box.insertBefore(b,$('topup'))}
  const tn=box.querySelector('.tnet');if(tn)tn.remove();                   // the mode badge replaces the TESTNET one
  b.textContent=NET.demo?'DEMO':NET.ton?'TESTNET':'REAL';b.classList.toggle('on',NET.demo);
  b.setAttribute('aria-label',(lang==='ru'?'Режим игры: ':'Game mode: ')+(NET.demo?(lang==='ru'?'демо':'demo'):(lang==='ru'?'реальный счёт':'real account'))+(lang==='ru'?'. Сменить':'. Change'))}
NET.paintMode=paintMode;

/* Mode picker: asked on entry (like casino games do) and from the badge next to the balance. */
const PT={ru:{title:'Как будем играть?',sub:'Раунды одни и те же, выбирается только счёт',
    real:'Реальный счёт',realTon:'Тестовые TON',realNote:'Ставки и выигрыши на вашем балансе, выигрыш можно вывести',
    demo:'Демо-режим',demoNote:'Без риска: те же живые раунды, виртуальные деньги',bal:'Баланс',
    ask:'Не спрашивать при входе',later:'Сменить режим можно по кнопке у баланса',now:'Сейчас'},
  en:{title:'How do you want to play?',sub:'Same rounds either way, only the account differs',
    real:'Real account',realTon:'Test TON',realNote:'Bets and wins on your balance, wins can be withdrawn',
    demo:'Demo mode',demoNote:'No risk: the same live rounds, virtual money',bal:'Balance',
    ask:'Do not ask on entry',later:'Switch any time with the badge next to the balance',now:'Now'}};
const pt=k=>(PT[lang]||PT.en)[k];
const asking=()=>{try{return localStorage.getItem('cr.modeAsk')!=='0'}catch(e){return true}};
function showPick(entry){
  let el=document.getElementById('pick');if(el)el.remove();
  el=document.createElement('div');el.id='pick';el.className='pick';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','pickT');
  const tonIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#0098ea"/><path d="M7.2 7.5h9.6c.7 0 1.1.8.8 1.4L12.6 17c-.3.5-.9.5-1.2 0L6.4 8.9c-.3-.6.1-1.4.8-1.4zm4.1 1.3H8.3l3 5.4V8.8zm1.4 0v5.4l3-5.4h-3z" fill="#fff"/></svg>';
  const card=(on,icon,title,bal,note)=>`<button class="pcard${on?' demo':''}${NET.demo===on?' cur':''}" data-demo="${on?1:0}">
      <span class="pi">${icon}</span><span class="pt"><b>${title}</b><small>${note}</small><em>${pt('bal')}: ${bal}</em></span>${NET.demo===on?`<i>${pt('now')}</i>`:''}</button>`;
  el.innerHTML=`<div class="pbox"><h2 id="pickT">${pt('title')}</h2><p>${pt('sub')}</p>
    ${card(false,tonIcon,NET.ton?pt('realTon'):pt('real'),fmtTon(NET.real)+' TON',pt('realNote'))}
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

async function sendBet(a,quiet){
  if(NET.demo)return demoBet(a,quiet);
  const auto=$('autoOn').checked?parseFloat($('autoX').value)||2:undefined;
  try{const r=await call({t:'bet',amount:a,auto});S.bet={amt:a,out:0};setReal(r.balance);renderPlayers();if(!quiet)toast(T('accepted'));haptic('light')}
  catch(e){toast(e.message,'bad');if(/insufficient/.test(e.message)&&NET.ton)NET.openTon('deposit')}
}
// the big button: bet / cancel / cash out, all confirmed by the server
NET.main=async()=>{if(NET.busy)return;NET.busy=true;try{const a=getAmt();
  if(S.phase==='fly'&&S.bet&&!S.bet.out)return cashNow();
  if(S.phase==='wait'&&S.bet&&S.bet.demo){S.bal+=S.bet.amt;S.bet=null;demoSave();renderPlayers();return}
  if(S.phase==='wait'&&S.bet){try{const r=await call({t:'cancel'});S.bet=null;setReal(r.balance);renderPlayers()}catch(e){toast(e.message,'bad')}return}
  if(S.phase!=='wait'&&S.next){S.next=null;return}
  if(S.phase==='wait')return sendBet(a);
  if(S.bal<a){toast(T('noFunds'),'bad');if(NET.ton&&!NET.demo)NET.openTon('deposit');return}
  S.next={amt:a};toast(T('nextQueued'))}finally{NET.busy=false}};
// Cash out at exactly the multiplier on screen when the finger lands: the number drawn in the last frame, dated with
// that frame's time in server time, so the server's floor(100*e^(K*t)) gives the same hundredths. The amount locks
// at once with a buzz and a "your cash-out" tag (the big number keeps running for everyone still in the round);
// the win plays when the server confirms the same number a moment later.
async function cashNow(){const b=S.bet;if(!b||b.out||b.lock)return;
  const sh=S.shown&&S.shown.at>=S.t0?S.shown:{x:xf(Math.exp(K*Math.max(0,(performance.now()-S.t0)/1000))),at:performance.now()};
  const x=Math.min(sh.x,S.crash);
  haptic('medium');pop('safe',(lang==='ru'?'Ваш выход: x':'Your cash-out: x')+x2(x));
  if(b.demo)return demoLock(b,x);
  b.lock=x;
  try{const r=await call({t:'cashout',at:sh.at+NET.off});if(!b.out){S.m=Math.max(S.m,r.x);cashOut(r.x,true)}if(r.balance!==undefined)setReal(r.balance)}   // the server sends the new balance separately
  catch(e){b.lock=0;toast(/too late|not flying/.test(e.message)?(lang==='ru'?'Не успели: ракета взорвалась раньше':'Too late: the rocket exploded first'):e.message,'bad');haptic('error')}}
// react on touch-down, not on release: saves the ~100 ms a finger takes to lift
const mainBtn=$('main'),mainClick=mainBtn.onclick;let downAt=0;
mainBtn.addEventListener('pointerdown',e=>{if(window.NET_ON&&e.button<=0&&S.phase==='fly'&&S.bet&&!S.bet.out&&!S.bet.lock){downAt=performance.now();cashNow()}});
mainBtn.onclick=e=>{if(performance.now()-downAt<1000)return;mainClick(e)};  // the click that follows the same touch
NET.refill=async()=>{
  if(NET.demo){if(S.bet||S.next){toast(dt('wait'));return}if(S.bal>=DEMO_START){toast(dt('full'));return}S.bal=DEMO_START;demoSave();toast(dt('refill'));haptic('success');return}
  if(NET.ton)return NET.openTon('deposit');const r=await fetch(base+'/api/refill',{method:'POST',headers:{authorization:'Bearer '+NET.token}});const d=await r.json();if(r.ok){setReal(d.balance);toast(T('refill'))}else toast(d.error,'bad')};

/* ---------- test TON: top up from a wallet, withdraw back to it ----------
   Deposits are matched by the player's personal comment; withdrawals go only to wallets they deposited from. */
const TC_MANIFEST='https://supyooo.github.io/CrashRocketTestBot/tonconnect-manifest.json';
const TC_SCRIPT='https://cdn.jsdelivr.net/npm/@tonconnect/ui@2.4.4/dist/tonconnect-ui.min.js';
const TL={
  ru:{dep:'Пополнить',wd:'Вывести',tnet:'Тестовая сеть TON. Отправляйте только тестовые TON — настоящие пропадут.',amount:'Сумма',
    pay:'Оплатить через кошелёк',connect:'Подключить кошелёк',manual:'Или переводом вручную',addr:'Адрес',comment:'Комментарий (обязательно)',
    noComment:'Без этого комментария перевод не зачислится.',min:'Минимум',copied:'Скопировано',sentW:'Отправлено из кошелька, ждём зачисления (до минуты)',
    mainnet:'Подключён кошелёк основной сети. Нажмите «Сменить» и выберите в Tonkeeper тестовый аккаунт (метка Testnet).',change:'Сменить',to:'На кошелёк',noAddr:'Вывод идёт только на кошелёк, с которого вы пополняли. Сначала пополните баланс.',
    max:'Макс',limit:'Лимит в сутки',history:'Последние переводы',empty:'Переводов пока нет',credited:'+{a} TON зачислено',
    st:{credited:'зачислено',unmatched:'без кода',too_small:'меньше минимума',review:'на проверке',pending:'в очереди',sending:'отправляется',sent:'отправлено',failed:'вернули на баланс',rejected:'отклонён, сумма на балансе',attached:'зачислено'},
    wdQueued:'Вывод {a} TON принят',wdReview:'Вывод {a} TON на проверке: обычно это недолго',wdSent:'Вывод {a} TON отправлен',wdFailed:'Вывод {a} TON не прошёл, сумма вернулась на баланс',
    err:{'amount is below the minimum withdrawal':'Сумма меньше минимальной','withdrawals go only to a wallet you have deposited from':'Вывод только на кошелёк, с которого было пополнение',
      'daily withdrawal limit reached':'Достигнут дневной лимит вывода','insufficient funds':'Недостаточно средств','this is a mainnet address; only testnet addresses are accepted':'Это адрес основной сети, нужен testnet'},
    dep2:'Депозит',wd2:'Вывод',loadErr:'Не удалось загрузить данные кошелька'},
  en:{dep:'Top up',wd:'Withdraw',tnet:'TON testnet. Send test TON only — real TON will be lost.',amount:'Amount',
    pay:'Pay with wallet',connect:'Connect wallet',manual:'Or transfer manually',addr:'Address',comment:'Comment (required)',
    noComment:'Without this comment the transfer will not be credited.',min:'Minimum',copied:'Copied',sentW:'Sent from your wallet, waiting to be credited (up to a minute)',
    mainnet:'A mainnet wallet is connected. Tap Change and pick your Tonkeeper testnet account.',change:'Change',to:'To wallet',noAddr:'Withdrawals go only to a wallet you topped up from. Top up first.',
    max:'Max',limit:'Daily limit',history:'Recent transfers',empty:'No transfers yet',credited:'+{a} TON credited',
    st:{credited:'credited',unmatched:'no code',too_small:'below minimum',review:'under review',pending:'queued',sending:'sending',sent:'sent',failed:'returned',rejected:'rejected, back on balance',attached:'credited'},
    wdQueued:'Withdrawal of {a} TON accepted',wdReview:'Withdrawal of {a} TON is under review, usually it is quick',wdSent:'Withdrawal of {a} TON sent',wdFailed:'Withdrawal of {a} TON failed, returned to your balance',
    err:{},dep2:'Deposit',wd2:'Withdrawal',loadErr:'Could not load wallet data'}};
const tl=k=>(TL[lang]||TL.en)[k];
const terr=m=>(tl('err')[m])||m;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const short=a=>a.slice(0,6)+'…'+a.slice(-6);
const api=async(path,opt={})=>{const r=await fetch(base+path,{...opt,headers:{authorization:'Bearer '+NET.token,'content-type':'application/json'}});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'error');return d};
let tsh,tab='deposit',info=null,depAmt=5,tc=null,tcLoading=null;

function tonMode(){
  const box=$('balBox');if(box&&!box.querySelector('.tnet')){const b=document.createElement('span');b.className='tnet';b.textContent='TESTNET';box.insertBefore(b,$('topup'))}
  if(tsh)return;
  tsh=document.createElement('section');tsh.className='sheet tsheet';tsh.setAttribute('aria-label','TON');$('app').appendChild(tsh);
  tsh.addEventListener('click',tonAct);tsh.addEventListener('input',e=>{if(e.target.id==='tAmt'){depAmt=parseFloat(e.target.value.replace(',','.'))||0;tsh.querySelectorAll('.tchip').forEach(c=>c.classList.toggle('on',+c.dataset.v===depAmt))}});
  $('scrim').addEventListener('click',closeTon);
}
function closeTon(){if(!tsh||!tsh.classList.contains('on'))return;tsh.classList.remove('on');if(!document.querySelector('.sheet.on'))$('scrim').classList.remove('on')}
NET.openTon=async(which)=>{if(!NET.ton||!tsh)return;tab=which==='withdraw'?'withdraw':'deposit';render();tsh.classList.add('on');$('scrim').classList.add('on');haptic('select');await load()};
async function load(){try{info=await api('/api/ton/info');setReal(info.balance);render()}catch(e){toast(tl('loadErr'),'bad')}}

function render(){
  const i=info,dep=tab==='deposit';
  let h=`<div class="sh-h"><h2>${tl(dep?'dep':'wd')}</h2><button data-t="close" aria-label="Close">×</button></div>
  <div class="segs"><button data-t="tab" data-v="deposit" aria-pressed="${dep}">${tl('dep')}</button><button data-t="tab" data-v="withdraw" aria-pressed="${!dep}">${tl('wd')}</button></div>
  <div class="tbody"><div class="twarn">${tl('tnet')}</div>`;
  if(!i)h+=`<div class="tload"></div>`;
  else if(dep){
    h+=`<div class="lbl">${tl('amount')} · ${tl('min')} ${i.minDeposit} TON</div>
    <div class="tchips">${[1,5,10,25].map(v=>`<button class="tchip${v===depAmt?' on':''}" data-t="amt" data-v="${v}">${v}</button>`).join('')}<input id="tAmt" class="tinp" inputmode="decimal" value="${depAmt}" aria-label="${tl('amount')}"></div>
    <button class="btn green tbig" data-t="pay">${tc&&tc.connected?tl('pay'):tl('connect')}</button>${walletLine()}
    <div class="lbl">${tl('manual')}</div>
    <div class="tcopy box" data-t="copy" data-v="${esc(i.house)}"><span>${tl('addr')}</span><b>${esc(short(i.house))}</b><i>⧉</i></div>
    <div class="tcopy box" data-t="copy" data-v="${esc(i.code)}"><span>${tl('comment')}</span><b class="tcode">${esc(i.code)}</b><i>⧉</i></div>
    <div class="tnote">${tl('noComment')}</div>`;
  }else{
    h+=`<div class="lbl">${tl('amount')} · ${tl('min')} ${i.minWithdraw} TON · ${tl('limit')} ${i.maxWithdrawDay} TON</div>
    <div class="tchips"><input id="tWd" class="tinp" inputmode="decimal" placeholder="0.00" aria-label="${tl('amount')}"><button class="tchip" data-t="max">${tl('max')}</button></div>`;
    if(!i.addresses.length)h+=`<div class="tnote">${tl('noAddr')}</div>`;
    else h+=`<div class="lbl">${tl('to')}</div>${i.addresses.map((a,k)=>`<label class="taddr box"><input type="radio" name="tTo" value="${esc(a)}"${k?'':' checked'}><b>${esc(short(a))}</b></label>`).join('')}
      <button class="btn green tbig" data-t="wd">${tl('wd')}</button>`;
  }
  if(i){h+=`<div class="lbl">${tl('history')}</div>`+(i.transfers.length?i.transfers.map(t=>`<div class="ttx"><span>${tl(t.kind==='deposit'?'dep2':'wd2')}</span><em class="s-${t.status}">${(tl('st')[t.status])||t.status}</em><b class="${t.kind==='deposit'?'in':'out'}">${t.kind==='deposit'?'+':'−'}${fmtTon(t.amount)}</b></div>`).join(''):`<div class="tnote">${tl('empty')}</div>`)}
  tsh.innerHTML=h+'</div>';
}

// the connected wallet, its network, and a way to switch to another one
function walletLine(){
  if(!tc||!tc.connected||!tc.account)return '';
  const test=tc.account.chain==='-3';
  let a=tc.account.address;try{a=TON_CONNECT_UI.toUserFriendlyAddress(a,test)}catch(e){}
  return `<div class="twal${test?'':' bad'}"><span>${test?'Testnet':'Mainnet'} · ${esc(short(a))}</span><button data-t="disc">${tl('change')}</button></div>${test?'':`<div class="tnote">${tl('mainnet')}</div>`}`;
}
async function copy(v){try{await navigator.clipboard.writeText(v)}catch(e){const t=document.createElement('textarea');t.value=v;document.body.appendChild(t);t.select();try{document.execCommand('copy')}catch(_){}t.remove()}toast(tl('copied'));haptic('light')}

function loadTc(){
  if(tc)return Promise.resolve(tc);
  return tcLoading||(tcLoading=new Promise((res,rej)=>{const s=document.createElement('script');s.src=TC_SCRIPT;s.onload=()=>{try{
      tc=new TON_CONNECT_UI.TonConnectUI({manifestUrl:TC_MANIFEST});
      tc.uiOptions={language:lang==='ru'?'ru':'en',uiPreferences:{theme:'DARK'},actionsConfiguration:{twaReturnUrl:'https://t.me/CrashRocketTestBot'}};
      tc.onStatusChange(()=>{if(tsh.classList.contains('on'))render()});res(tc)}catch(e){rej(e)}};
    s.onerror=()=>{tcLoading=null;rej(new Error('TON Connect did not load'))};document.head.appendChild(s)}));
}
async function pay(){
  if(!info)return;const amt=depAmt;
  if(!(amt>=info.minDeposit)){toast(`${tl('min')} ${info.minDeposit} TON`,'bad');return}
  let ui;try{ui=await loadTc();await ui.connectionRestored}catch(e){toast(e.message,'bad');return}
  if(!ui.connected){ui.openModal();return}                   // the button turns into "Pay" once connected
  if(ui.account&&ui.account.chain!=='-3'){toast(tl('mainnet'),'bad');return}
  try{
    await ui.sendTransaction({validUntil:Math.floor(Date.now()/1000)+300,network:'-3',
      messages:[{address:info.house,amount:String(Math.round(amt*1000))+'000000',payload:info.payload}]});
    toast(tl('sentW'));haptic('success');
  }catch(e){console.warn(e)}                                  // declined in the wallet: nothing to do
}
async function withdraw(btn){
  const amt=parseFloat(($('tWd').value||'').replace(',','.'));const to=(tsh.querySelector('input[name="tTo"]:checked')||{}).value;
  if(!(amt>0)||!to)return;btn.disabled=true;
  try{const d=await api('/api/ton/withdraw',{method:'POST',body:JSON.stringify({amount:amt,address:to})});setReal(d.balance);haptic('success');await load()}
  catch(e){toast(terr(e.message),'bad');haptic('error');btn.disabled=false}
}
function tonAct(e){const b=e.target.closest('[data-t]');if(!b)return;const t=b.dataset.t;
  if(t==='close')closeTon();
  else if(t==='tab'){tab=b.dataset.v;render();haptic('select')}
  else if(t==='amt'){depAmt=+b.dataset.v;render()}
  else if(t==='copy')copy(b.dataset.v);
  else if(t==='pay')pay();
  else if(t==='disc'){if(tc)tc.disconnect().catch(()=>{}).then(render)}
  else if(t==='max'){$('tWd').value=Math.floor(S.bal*100)/100}
  else if(t==='wd')withdraw(b);
}
function onTon(m){const a=fmtTon(m.amount);
  if(m.kind==='deposit'){toast(tl('credited').replace('{a}',a));haptic('success')}
  else if(m.status==='review')toast(tl('wdReview').replace('{a}',a));
  else if(m.status==='pending')toast(tl('wdQueued').replace('{a}',a));
  else if(m.status==='sent'){toast(tl('wdSent').replace('{a}',a));haptic('success')}
  else if(m.status==='failed'){toast(tl('wdFailed').replace('{a}',a),'bad');haptic('error')}
  if(tsh&&tsh.classList.contains('on'))load();
}

login().then(connect).catch(e=>{console.warn('online mode unavailable:',e.message);window.BOOT&&(BOOT.done('net'),BOOT.done('round'));toast(lang==='ru'?'Сервер недоступен, демо-режим':'Server unavailable, demo mode')});
})();
