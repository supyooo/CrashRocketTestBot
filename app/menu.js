/* Burger menu (top right): player, sound / vibration / animations, language, and links to the rules, fairness,
   bet history and support. The rules open in their own sheet. Loaded last; uses the game's globals. */
(()=>{
const M={
  ru:{menu:'Меню',player:'Игрок',sound:'Звук',vibro:'Вибрация',anim:'Анимации',lang:'Язык',rules:'Правила игры',fair:'Честность раундов',hist:'История ставок',support:'Поддержка',soon:'Поддержка появится к запуску',
    docs:'Правила игры',toc:'Разделы'},
  en:{menu:'Menu',player:'Player',sound:'Sound',vibro:'Vibration',anim:'Animations',lang:'Language',rules:'Game rules',fair:'Provably fair',hist:'Bet history',support:'Support',soon:'Support arrives with the launch',
    docs:'Game rules',toc:'Sections'}};
const m=k=>(M[lang]||M.en)[k];

// the rules: [id, title, paragraphs]; numbers match the server config
const DOCS={
 ru:[
  ['how','Как играть',['Ракета взлетает, множитель растёт от 1.00x. Чем дольше летит ракета, тем больше множитель.','Забери ставку до взрыва: выигрыш равен ставке, умноженной на множитель в момент вывода. Если ракета взорвалась раньше, ставка сгорает.','В какой момент будет взрыв, не знает никто, включая нас: точка краша каждого раунда зафиксирована заранее (см. «Честность раундов»).']],
  ['round','Раунд',['Перед стартом 5 секунд на ставки. Ставку можно сделать и во время полёта: она уйдёт на следующий раунд (кнопка «След. ставка»).','После взрыва 5 секунд пауза, затем открывается приём ставок на новый раунд.','Ставка от 0,1 до 1 000 TON. Максимальный выигрыш с одной ставки 10 000 TON: на этой сумме ставка забирается автоматически.']],
  ['auto','Автовывод и автоставка',['Автовывод: задай множитель в меню «Авто», и ставка заберётся сама, когда ракета до него долетит.','Автоставка: та же сумма ставится каждый раунд, пока ты её не выключишь или пока хватает баланса.','На компьютере пробел делает ставку и забирает выигрыш.']],
  ['fair','Честность раундов',['Результаты всех раундов заранее записаны в цепочку хэшей SHA-256. Её конец опубликован до начала игры, поэтому подменить раунд задним числом нельзя.','Множитель раунда вычисляется из хэша раунда и публичной соли по формуле HMAC-SHA256. Преимущество игры заложено в формулу и составляет 3% (возврат игрокам 97%).','Нажми на любой множитель в истории над ракетой: приложение само проверит формулу и цепочку прямо в браузере.']],
  ['demo','Демо-режим',['В демо играешь на DEMO вместо TON в тех же живых раундах. Демо-баланс пополняется в один клик.','Демо-ставки не дают монет и не идут в статистику.']],
  ['coins','Монеты и скины',['Монеты начисляются за ставки в TON (50 монет за каждый поставленный TON), за задания дня и недели и за вход подряд.','За монеты в Ангаре покупаются скины: персонажи, ракеты, хвосты, парашюты, фоны и эмоции. Собранная коллекция даёт +5% к монетам.','Монеты нельзя вывести или обменять на TON.']],
  ['ton','Пополнение и вывод',['Сейчас игра работает в тестовой сети TON: настоящие деньги не используются.','Пополнение от 0,1 TON. Вывод от 0,5 TON, не больше 100 TON в сутки.']],
  ['play','Ответственная игра',['Играй только на те деньги, которые готов потерять. Выигрыш в прошлых раундах не влияет на следующие.','Если игра перестала быть развлечением, сделай перерыв.']]],
 en:[
  ['how','How to play',['The rocket takes off and the multiplier climbs from 1.00x. The longer it flies, the higher the multiplier.','Cash out before it blows up: you win your bet times the multiplier at that moment. If the rocket blows up first, the bet is lost.','Nobody knows when it will blow up, including us: the crash point of every round is fixed in advance (see "Provably fair").']],
  ['round','The round',['Bets are open for 5 seconds before the start. You can also bet during a flight: it goes to the next round (the "Next bet" button).','After the crash there is a 5 second pause, then bets open for the new round.','A bet is 0.1 to 1,000 TON. The largest payout of one bet is 10,000 TON: the bet is cashed out automatically at that amount.']],
  ['auto','Auto cash-out and auto bet',['Auto cash-out: set a multiplier in the "Auto" menu and the bet is cashed out as soon as the rocket reaches it.','Auto bet: the same amount is placed every round until you switch it off or the balance runs short.','On a computer, Space places a bet and cashes out.']],
  ['fair','Provably fair',['The results of all rounds are fixed in advance in a SHA-256 hash chain. Its end was published before play started, so no round can be changed afterwards.','A round multiplier comes from the round hash and a public salt by the HMAC-SHA256 formula. The house edge is built into the formula: 3% (97% return to players).','Tap any multiplier in the history above the rocket: the app checks the formula and the chain itself, in your browser.']],
  ['demo','Demo mode',['In demo you play with DEMO instead of TON in the same live rounds. The demo balance refills in one tap.','Demo bets earn no coins and do not count in the stats.']],
  ['coins','Coins and skins',['Coins come from TON bets (50 coins per TON bet), daily and weekly quests and login streaks.','Spend them in the Hangar on skins: riders, rockets, trails, parachutes, backdrops and emotes. A completed collection gives +5% coins.','Coins cannot be withdrawn or exchanged for TON.']],
  ['ton','Deposits and withdrawals',['The game currently runs on the TON testnet: no real money is used.','Deposits from 0.1 TON. Withdrawals from 0.5 TON, up to 100 TON a day.']],
  ['play','Play responsibly',['Only play with money you can afford to lose. Past rounds do not affect the next ones.','If the game stops being fun, take a break.']]]};

const css=document.createElement('style');css.textContent=`
.mnu{position:absolute;top:calc(56px + max(env(safe-area-inset-top,0px),var(--tg-safe-area-inset-top,0px)) + var(--tg-content-safe-area-inset-top,0px));right:12px;z-index:9;width:min(300px,calc(100% - 24px));max-height:75%;overflow:auto;
  border-radius:18px;background:#141029;border:1px solid #3a3266;box-shadow:0 18px 40px rgba(0,0,0,.5);transform-origin:top right;transform:scale(.92);opacity:0;pointer-events:none;transition:transform .18s,opacity .18s}
.mnu.on{transform:none;opacity:1;pointer-events:auto}
.mnu .who{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line)}
.mnu .av{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:var(--violet);font:800 16px 'Unbounded',sans-serif;flex:none}
.mnu .who b{font-weight:700;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mnu .grp{padding:6px 0;border-bottom:1px solid var(--line)}.mnu .grp:last-child{border-bottom:0}
.mnu .row{display:flex;align-items:center;gap:12px;width:100%;padding:10px 16px;border:0;background:transparent;font-family:inherit;font-weight:600;font-size:14.5px;color:var(--text);text-align:left;cursor:pointer}
.mnu .row svg{width:20px;height:20px;flex:none;color:var(--muted)}
.mnu .row span{flex:1}
.mnu .row:active{background:var(--panel)}
.mnu .tg{width:38px;height:22px;border-radius:99px;background:var(--panel-2);border:1px solid var(--line);position:relative;flex:none;transition:.2s}
.mnu .tg::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--muted);transition:.2s}
.mnu .tg.on{background:var(--green);border-color:var(--green)}.mnu .tg.on::after{left:18px;background:#06210f}
.mnu .lg{display:flex;gap:3px;padding:3px;border-radius:999px;background:var(--panel);border:1px solid var(--line)}
.mnu .lg button{border:0;background:transparent;padding:4px 10px;border-radius:999px;font-family:inherit;font-weight:700;font-size:12px;color:var(--muted);cursor:pointer}
.mnu .lg button[aria-pressed="true"]{background:var(--panel-2);color:var(--text)}
.dsheet{max-height:88%}
.dsheet .dbody{overflow:auto;padding:4px 16px 20px;display:flex;flex-direction:column;gap:14px}
.dsheet .toc{display:flex;flex-wrap:wrap;gap:6px}
.dsheet .toc button{padding:6px 10px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--muted);font-family:inherit;font-weight:600;font-size:12.5px;cursor:pointer}
.dsheet section{display:flex;flex-direction:column;gap:6px;padding:14px;border-radius:14px;background:var(--panel);border:1px solid var(--line);scroll-margin-top:8px}
.dsheet h3{margin:0;font:800 15px 'Unbounded',sans-serif}
.dsheet p{margin:0;font-size:14px;line-height:1.55;color:#cfd2ec}`;
document.head.appendChild(css);

const I={
  sound:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  vibro:'<rect x="8" y="4" width="8" height="16" rx="2"/><path d="M4.5 9v6M19.5 9v6"/>',
  anim:'<path d="M12 3l2.2 5.3L20 9l-4.4 3.8L17 18.5 12 15.6 7 18.5l1.4-5.7L4 9l5.8-.7z"/>',
  lang:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>',
  rules:'<path d="M6 3.5h9l3 3v14H6z"/><path d="M9 10h6M9 13.5h6M9 17h4"/>',
  fair:'<path d="M12 3.5l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9v-5z"/><path d="M9 12l2 2 4-4"/>',
  hist:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  support:'<path d="M4.5 12a7.5 7.5 0 0 1 15 0v4.5a2 2 0 0 1-2 2H16v-6h3.5M4.5 12v4.5a2 2 0 0 0 2 2H8v-6H4.5"/>'};
const ic=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

// the burger takes the place of the sound button, which stays hidden as the switch the menu and the profile press
const top=document.querySelector('header.top');$('snd').style.display='none';
const bb=document.createElement('button');bb.className='ib';bb.id='menuBtn';bb.setAttribute('aria-label','Menu');bb.setAttribute('aria-expanded','false');
bb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>';top.appendChild(bb);
const mn=document.createElement('div');mn.className='mnu';mn.setAttribute('role','menu');$('app').appendChild(mn);
const ds=document.createElement('section');ds.className='sheet dsheet';ds.setAttribute('aria-label','Rules');$('app').appendChild(ds);

function who(){const u=TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user;const name=u?(u.username?'@'+u.username:[u.first_name,u.last_name].filter(Boolean).join(' ')):m('player');
  return{name,ini:(u?(u.first_name||u.username||'P'):'P').slice(0,1).toUpperCase()}}
function paint(){const w=who(),row=(act,k,right)=>`<button class="row" data-a="${act}" role="menuitem">${ic(k)}<span>${m(k==='lang'?'lang':act)}</span>${right||''}</button>`,tg=on=>`<i class="tg ${on?'on':''}"></i>`;
  mn.innerHTML=`<div class="who"><span class="av">${w.ini}</span><b></b></div>
  <div class="grp">${row('sound','sound',tg(AU.on))}${row('vibro','vibro',tg(!window.ECO||ECO.vibro()))}${row('anim','anim',tg(!(window.isLite&&isLite())))}
   <div class="row" role="group" aria-label="Language">${ic('lang')}<span>${m('lang')}</span><span class="lg" style="flex:none"><button data-l="ru" aria-pressed="${lang==='ru'}">RU</button><button data-l="en" aria-pressed="${lang==='en'}">EN</button></span></div></div>
  <div class="grp">${row('rules','rules')}${row('fair','fair')}${row('hist','hist')}${row('support','support')}</div>`;
  mn.querySelector('.who b').textContent=w.name}
function openMenu(){paint();mn.classList.add('on');bb.setAttribute('aria-expanded','true');haptic('select')}
function closeMenu(){mn.classList.remove('on');bb.setAttribute('aria-expanded','false')}
bb.addEventListener('click',e=>{e.stopPropagation();closePops();mn.classList.contains('on')?closeMenu():openMenu()});
document.addEventListener('click',e=>{if(mn.classList.contains('on')&&!mn.contains(e.target))closeMenu()});
mn.addEventListener('click',e=>{e.stopPropagation();const l=e.target.closest('[data-l]');if(l){setLang(l.dataset.l);paint();haptic('select');return}
  const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
  if(a==='sound'){$('snd').click();setTimeout(paint,30)}
  else if(a==='vibro'){ECO.setVibro(!ECO.vibro());paint();haptic('select')}
  else if(a==='anim'){setLite(!isLite());paint();haptic('select')}
  else{closeMenu();
    if(a==='rules')openDocs();else if(a==='fair')openDocs('fair');
    else if(a==='hist'){window.UI&&UI.go('game');$('plBtn').click();const t=$('psTabs').querySelector('[data-v="mine"]');t&&t.click()}
    else if(a==='support')toast(m('soon'))}});

function openDocs(sec){const D=DOCS[lang]||DOCS.en;
  ds.innerHTML=`<div class="sh-h"><h2>${m('docs')}</h2><button data-d="close" aria-label="Close">×</button></div>
  <div class="dbody"><div class="toc" aria-label="${m('toc')}">${D.map(([id,t])=>`<button data-d="${id}">${t}</button>`).join('')}</div>
  ${D.map(([id,t,ps])=>`<section id="doc-${id}"><h3>${t}</h3>${ps.map(p=>`<p>${p}</p>`).join('')}</section>`).join('')}</div>`;
  ds.classList.add('on');$('scrim').classList.add('on');haptic('select');
  const body=ds.querySelector('.dbody');body.scrollTop=0;if(sec)requestAnimationFrame(()=>{const s=$('doc-'+sec);s&&s.scrollIntoView({block:'start'})})}
function closeDocs(){ds.classList.remove('on');if(!document.querySelector('.sheet.on'))$('scrim').classList.remove('on')}
ds.addEventListener('click',e=>{const b=e.target.closest('[data-d]');if(!b)return;if(b.dataset.d==='close')closeDocs();else{const s=$('doc-'+b.dataset.d);s&&s.scrollIntoView({block:'start',behavior:'smooth'})}});
$('scrim').addEventListener('click',closeDocs);
window.MENU={open:openMenu,close:closeMenu,docs:openDocs};
})();
