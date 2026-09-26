/* Online mode: rounds, bets and the balance come from the game server (play money for now).
   Turns on when a server is configured: ?server=https://… in the URL, a saved choice, or CR_SERVER below.
   Without a server, or if it cannot be reached, the game keeps running its offline demo rounds.
   Loaded after the main game script; uses its globals (S, SC, placeBet internals, renderPlayers, feed, toast…). */
(()=>{
const CR_SERVER = 'https://crashrockettestbot-production.up.railway.app'; // production API
const q=new URLSearchParams(location.search);
let base=q.get('server')||'';try{if(base)localStorage.setItem('cr.server',base);else base=localStorage.getItem('cr.server')||''}catch(e){}
base=(base||CR_SERVER).replace(/\/$/,'');
if(!base)return;

const NET={token:'',uid:'',ws:null,retry:0,off:0,synced:false,rtt:0,req:0,wait:new Map(),busy:false,phaseAt:0};
window.NET=NET;NET.base=base;NET.hist=[];  // NET.hist[i]: {no, hash?} of S.hist[i], for round details
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
  const d=await r.json();NET.token=d.token;NET.uid=d.user.id;S.bal=d.balance;
  NET.ton=!!(d.mode&&d.mode.currency==='tton');if(NET.ton)tonMode();
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
  if(m.t==='pong'){onPong(m);return}
  if(m.t==='ok'||m.t==='err'){const w=NET.wait.get(m.id);if(w){NET.wait.delete(m.id);m.t==='ok'?w.res(m):w.rej(new Error(m.error))}return}
  if(m.t==='hello'&&m.phase==='waiting'){ // a fresh server waits for the previous one to finish its round
    rough(m.serverNow);if(m.k)K=m.k;window.NET_ON=true;S.bal=m.balance;S.pend=0;S.bots=[];S.bet=null;S.phase='crash';S.crash=1;S.m=1;S.t0=now;renderPlayers();
    toast(lang==='ru'?'Сервер обновляется, следующий раунд через пару секунд':'Server is updating, next round in a few seconds');return}
  if(m.t==='hello'){NET.retry=0;
    rough(m.serverNow);if(m.k)K=m.k;NET.phaseAt=m.phaseAt;window.NET_ON=true;S.bal=m.balance;S.pend=0;
    S.hist=m.history.map(h=>h.crash);NET.hist=m.history.map(h=>({no:h.no}));renderHist();
    S.bots=m.bets.filter(b=>b.uid!==NET.uid).map(botFrom);
    const mine=m.bets.find(b=>b.uid===NET.uid);S.bet=mine?{amt:mine.amount,out:mine.cashX100?mine.cashX100/100:0}:null;
    if(m.phase==='betting'){S.phase='wait';S.t0=local(m.phaseAt)}
    else if(m.phase==='running'){S.phase='fly';S.t0=local(m.phaseAt);S.crash=Infinity;S.mi=0;SC.onStart()}
    else{S.phase='crash';S.t0=local(m.phaseAt);S.crash=m.crashX100?m.crashX100/100:1;S.m=S.crash}
    renderPlayers();toast(lang==='ru'?'Онлайн: общие раунды с другими игроками':'Online: shared rounds with other players');return}
  if(m.t==='betting'){const queued=S.next;S.next=null;newRound(now);S.bet=null;NET.phaseAt=m.phaseAt;S.t0=local(m.phaseAt);S.bots=[];
    if(queued)sendBet(queued.amt,true);else{const a=autoBetDue();if(a)sendBet(a,true)}renderPlayers();return}
  if(m.t==='run'){rough(m.serverNow);if(m.k)K=m.k;NET.phaseAt=m.startedAt;startFlight(now);S.crash=Infinity;S.t0=local(m.startedAt);return}
  if(m.t==='crash'){S.crash=m.crash;S.m=m.crash;if(S.phase!=='crash'){NET.hist.unshift({no:m.no,hash:m.hash});NET.hist.length=Math.min(NET.hist.length,20);doCrash(now)}return}  // doCrash adds to S.hist: keep both in step
  if(m.t==='bet'){if(m.uid===NET.uid)return;const i=S.bots.findIndex(b=>b.uid===m.uid);const b=botFrom(m);if(i<0)S.bots.push(b);else S.bots[i]=b;renderPlayers();return}
  if(m.t==='cancel'){S.bots=S.bots.filter(b=>b.uid!==m.uid);renderPlayers();return}
  if(m.t==='cashout'){
    if(m.uid===NET.uid){if(S.bet&&!S.bet.out){S.m=Math.max(S.m,m.x);cashOut(m.x,true)}return}  // auto cash-out done by the server
    const b=S.bots.find(x=>x.uid===m.uid);if(b){b.out=m.x;SC.onBotCash(b.n,m.x);feed(b.n,m.x,b.bet*(m.x-1))}renderPlayers();return}
  if(m.t==='balance'){S.bal=m.balance;return}
  if(m.t==='ton'){onTon(m);return}
}

async function sendBet(a,quiet){
  const auto=$('autoOn').checked?parseFloat($('autoX').value)||2:undefined;
  try{const r=await call({t:'bet',amount:a,auto});S.bet={amt:a,out:0};S.bal=r.balance;renderPlayers();if(!quiet)toast(T('accepted'));haptic('light')}
  catch(e){toast(e.message,'bad');if(/insufficient/.test(e.message)&&NET.ton)NET.openTon('deposit')}
}
// the big button: bet / cancel / cash out, all confirmed by the server
NET.main=async()=>{if(NET.busy)return;NET.busy=true;try{const a=getAmt();
  if(S.phase==='fly'&&S.bet&&!S.bet.out)return cashNow();
  if(S.phase==='wait'&&S.bet){try{const r=await call({t:'cancel'});S.bet=null;S.bal=r.balance;renderPlayers()}catch(e){toast(e.message,'bad')}return}
  if(S.phase!=='wait'&&S.next){S.next=null;return}
  if(S.phase==='wait')return sendBet(a);
  if(S.bal<a){toast(T('noFunds'),'bad');if(NET.ton)NET.openTon('deposit');return}
  S.next={amt:a};toast(T('nextQueued'))}finally{NET.busy=false}};
// Cash out at the multiplier on screen at the moment of the tap. The number and the amount lock at once (with a
// buzz); the win plays when the server confirms the same number a moment later.
async function cashNow(){const b=S.bet;if(!b||b.out||b.lock)return;
  const tap=performance.now(),x=Math.min(xf(Math.exp(K*Math.max(0,(tap-S.t0)/1000))),S.crash);
  b.lock=x;haptic('medium');
  try{const r=await call({t:'cashout',at:Math.round(tap+NET.off)});if(!b.out){S.m=Math.max(S.m,r.x);cashOut(r.x,true)}S.bal=r.balance}
  catch(e){b.lock=0;toast(/too late/.test(e.message)?(lang==='ru'?'Не успели: ракета взорвалась раньше':'Too late: the rocket exploded first'):e.message,'bad');haptic('error')}}
// react on touch-down, not on release: saves the ~100 ms a finger takes to lift
const mainBtn=$('main'),mainClick=mainBtn.onclick;let downAt=0;
mainBtn.addEventListener('pointerdown',e=>{if(window.NET_ON&&e.button<=0&&S.phase==='fly'&&S.bet&&!S.bet.out&&!S.bet.lock){downAt=performance.now();cashNow()}});
mainBtn.onclick=e=>{if(performance.now()-downAt<1000)return;mainClick(e)};  // the click that follows the same touch
NET.refill=async()=>{if(NET.ton)return NET.openTon('deposit');const r=await fetch(base+'/api/refill',{method:'POST',headers:{authorization:'Bearer '+NET.token}});const d=await r.json();if(r.ok){S.bal=d.balance;toast(T('refill'))}else toast(d.error,'bad')};

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
    st:{credited:'зачислено',unmatched:'без кода',too_small:'меньше минимума',pending:'в очереди',sending:'отправляется',sent:'отправлено',failed:'вернули на баланс'},
    wdQueued:'Вывод {a} TON принят',wdSent:'Вывод {a} TON отправлен',wdFailed:'Вывод {a} TON не прошёл, сумма вернулась на баланс',
    err:{'amount is below the minimum withdrawal':'Сумма меньше минимальной','withdrawals go only to a wallet you have deposited from':'Вывод только на кошелёк, с которого было пополнение',
      'daily withdrawal limit reached':'Достигнут дневной лимит вывода','insufficient funds':'Недостаточно средств','this is a mainnet address; only testnet addresses are accepted':'Это адрес основной сети, нужен testnet'},
    dep2:'Депозит',wd2:'Вывод',loadErr:'Не удалось загрузить данные кошелька'},
  en:{dep:'Top up',wd:'Withdraw',tnet:'TON testnet. Send test TON only — real TON will be lost.',amount:'Amount',
    pay:'Pay with wallet',connect:'Connect wallet',manual:'Or transfer manually',addr:'Address',comment:'Comment (required)',
    noComment:'Without this comment the transfer will not be credited.',min:'Minimum',copied:'Copied',sentW:'Sent from your wallet, waiting to be credited (up to a minute)',
    mainnet:'A mainnet wallet is connected. Tap Change and pick your Tonkeeper testnet account.',change:'Change',to:'To wallet',noAddr:'Withdrawals go only to a wallet you topped up from. Top up first.',
    max:'Max',limit:'Daily limit',history:'Recent transfers',empty:'No transfers yet',credited:'+{a} TON credited',
    st:{credited:'credited',unmatched:'no code',too_small:'below minimum',pending:'queued',sending:'sending',sent:'sent',failed:'returned'},
    wdQueued:'Withdrawal of {a} TON accepted',wdSent:'Withdrawal of {a} TON sent',wdFailed:'Withdrawal of {a} TON failed, returned to your balance',
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
async function load(){try{info=await api('/api/ton/info');S.bal=info.balance;render()}catch(e){toast(tl('loadErr'),'bad')}}

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
  try{const d=await api('/api/ton/withdraw',{method:'POST',body:JSON.stringify({amount:amt,address:to})});S.bal=d.balance;haptic('success');await load()}
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
  else if(m.status==='pending')toast(tl('wdQueued').replace('{a}',a));
  else if(m.status==='sent'){toast(tl('wdSent').replace('{a}',a));haptic('success')}
  else if(m.status==='failed'){toast(tl('wdFailed').replace('{a}',a),'bad');haptic('error')}
  if(tsh&&tsh.classList.contains('on'))load();
}

login().then(connect).catch(e=>{console.warn('online mode unavailable:',e.message);toast(lang==='ru'?'Сервер недоступен, демо-режим':'Server unavailable, demo mode')});
})();
