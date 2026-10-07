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
  ['fair','Проверка честности',['1. Откройте историю коэффициентов (панель над ракетой) и нажмите на любой завершённый множитель, например 1.30x.','2. Откроется окно раунда: точное время, количество игроков и криптографические данные «Хэш раунда» и «Соль».','3. Результат каждого раунда заранее зафиксирован в цепочке хэшей SHA-256. Конец цепочки публикуется до начала игры, поэтому подменить исход раунда задним числом невозможно.','4. Прямо в окне раунда встроена автоматическая проверка: зелёные галочки подтверждают, что коэффициент совпадает с формулой, а хэш ведёт к опубликованному коммитменту (указано число шагов).','5. Для самостоятельной проверки скопируйте «Хэш раунда» и «Соль» иконкой копирования. Множитель = HMAC-SHA256 от хэша раунда с ключом-солью: первые 13 hex-символов дают число h, множитель = (100 − 3) / (1 − h / 2^52) / 100, округлённый вниз до сотых, но не меньше 1.00x.']],
  ['demo','Демо-режим',['В демо играешь на DEMO вместо TON в тех же живых раундах. Демо-баланс пополняется в один клик.','Демо-ставки не дают монет и не идут в статистику.']],
  ['coins','Монеты и скины',['Монеты начисляются за ставки в TON (50 монет за каждый поставленный TON), за задания дня и недели и за вход подряд.','За монеты в Ангаре покупаются скины: персонажи, ракеты, хвосты, парашюты, фоны и эмоции. Собранная коллекция даёт +5% к монетам.','Монеты нельзя вывести или обменять на TON.']],
  ['ton','Пополнение и вывод',['Сейчас игра работает в тестовой сети TON: настоящие деньги не используются.','Пополнение от 0,1 TON. Вывод от 0,5 TON, не больше 100 TON в сутки.']],
  ['tech','Сбои и связь',['Оператор не несёт ответственности за потерю ставки из-за проблем с интернет-соединением. Рекомендуется играть со стабильным подключением.','В случае сбоя программного обеспечения ставки раунда аннулируются, а средства возвращаются игрокам.']],
  ['aml','Антифрод и AML',['Возраст. Платформа доступна только лицам старше 18 лет.','Кошельки. Пополняйте с некастодиальных кошельков (например, Tonkeeper). Платформа не несёт ответственности за средства, отправленные со счетов криптобирж (Binance, Bybit и др.) без обязательного комментария (кода пополнения).','Мультиаккаунтинг. Запрещено создавать несколько аккаунтов одним пользователем ради бонусов, фрибетов, уникальных скинов или мест в турнирных таблицах.','Верификация (KYC). Администрация вправе запросить базовую верификацию личности при выводе крупных сумм или подозрении в мошенничестве.','Санкции. За фермы аккаунтов, сторонних ботов для ставок или эксплуатацию уязвимостей игры все связанные аккаунты блокируются без права восстановления.','Заморозка средств. При попытках отмывания средств, кардинга или поступлении неправомерной криптовалюты администрация вправе заморозить баланс пользователя.']],  ['play','Ответственная игра',['Играй только на те деньги, которые готов потерять. Выигрыш в прошлых раундах не влияет на следующие.','Если игра перестала быть развлечением, сделай перерыв.']]],
 en:[
  ['how','How to play',['The rocket takes off and the multiplier climbs from 1.00x. The longer it flies, the higher the multiplier.','Cash out before it blows up: you win your bet times the multiplier at that moment. If the rocket blows up first, the bet is lost.','Nobody knows when it will blow up, including us: the crash point of every round is fixed in advance (see "Provably fair").']],
  ['round','The round',['Bets are open for 5 seconds before the start. You can also bet during a flight: it goes to the next round (the "Next bet" button).','After the crash there is a 5 second pause, then bets open for the new round.','A bet is 0.1 to 1,000 TON. The largest payout of one bet is 10,000 TON: the bet is cashed out automatically at that amount.']],
  ['auto','Auto cash-out and auto bet',['Auto cash-out: set a multiplier in the "Auto" menu and the bet is cashed out as soon as the rocket reaches it.','Auto bet: the same amount is placed every round until you switch it off or the balance runs short.','On a computer, Space places a bet and cashes out.']],
  ['fair','Fairness check',['1. Open the multiplier history (the panel above the rocket) and tap any completed multiplier, for example 1.30x.','2. The round window opens: the exact time, the number of players and the cryptographic data "Round hash" and "Salt".','3. The result of every round is fixed in advance in a SHA-256 hash chain. The end of the chain is published before play starts, so no round can be changed afterwards.','4. The round window checks itself: green ticks confirm that the multiplier matches the formula and that the hash leads to the published commitment (the number of steps is shown).','5. To check it yourself, copy "Round hash" and "Salt" with the copy icon. Multiplier = HMAC-SHA256 of the round hash keyed with the salt: its first 13 hex characters give a number h, and the multiplier is (100 − 3) / (1 − h / 2^52) / 100, rounded down to hundredths, at least 1.00x.']],
  ['demo','Demo mode',['In demo you play with DEMO instead of TON in the same live rounds. The demo balance refills in one tap.','Demo bets earn no coins and do not count in the stats.']],
  ['coins','Coins and skins',['Coins come from TON bets (50 coins per TON bet), daily and weekly quests and login streaks.','Spend them in the Hangar on skins: riders, rockets, trails, parachutes, backdrops and emotes. A completed collection gives +5% coins.','Coins cannot be withdrawn or exchanged for TON.']],
  ['ton','Deposits and withdrawals',['The game currently runs on the TON testnet: no real money is used.','Deposits from 0.1 TON. Withdrawals from 0.5 TON, up to 100 TON a day.']],
  ['tech','Connection and malfunctions',['The operator is not responsible for a lost bet caused by internet connection problems. Play with a stable connection.','If the software malfunctions, the round bets are cancelled and the funds are returned to the players.']],
  ['aml','Anti-fraud and AML',['Age. The platform is available only to people over 18.','Wallets. Deposit from non-custodial wallets (e.g. Tonkeeper). The platform is not responsible for funds sent from exchange accounts (Binance, Bybit, etc.) without the required comment (deposit code).','Multi-accounting. Creating several accounts by one user to claim bonuses, free bets, unique skins or leaderboard places is prohibited.','Verification (KYC). The administration may request basic identity verification for large withdrawals or when fraud is suspected.','Sanctions. Account farms, third-party betting bots or exploiting game vulnerabilities lead to a permanent ban of all linked accounts.','Fund freezing. The administration may freeze a balance in cases of attempted money laundering, carding or deposits of illicit cryptocurrency.']],  ['play','Play responsibly',['Only play with money you can afford to lose. Past rounds do not affect the next ones.','If the game stops being fun, take a break.']]]};

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
.dsheet .dbody{overflow:auto;padding:4px 16px 20px;display:flex;flex-direction:column;gap:8px}
.dsheet details{border-radius:14px;background:var(--panel);border:1px solid var(--line)}
.dsheet details[open]{border-color:#4a4290}
.dsheet summary{display:flex;align-items:center;gap:12px;padding:12px 14px;cursor:pointer;list-style:none;font:800 14px 'Unbounded',sans-serif}
.dsheet summary::-webkit-details-marker{display:none}
.dsheet summary .di{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:none;background:rgba(43,255,136,.12);color:var(--green)}
.dsheet summary .di svg{width:19px;height:19px}
.dsheet summary span{flex:1;min-width:0}
.dsheet summary .chev{width:18px;height:18px;flex:none;color:var(--muted);transition:transform .2s}
.dsheet details[open] .chev{transform:rotate(180deg)}
.dsheet .dtext{display:flex;flex-direction:column;gap:8px;padding:0 14px 14px 60px}
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
  support:'<path d="M4.5 12a7.5 7.5 0 0 1 15 0v4.5a2 2 0 0 1-2 2H16v-6h3.5M4.5 12v4.5a2 2 0 0 0 2 2H8v-6H4.5"/>',
  // rule sections
  how:'<path d="M12 2.5c3 2.2 4.5 5.6 4.5 9.5l-1.8 4.5H9.3L7.5 12c0-3.9 1.5-7.3 4.5-9.5z"/><circle cx="12" cy="10" r="1.8"/><path d="M12 18.5v3"/>',
  round:'<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 1.5M9.5 2.5h5"/>',
  auto:'<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5"/>',
  demo:'<rect x="3" y="7" width="18" height="11" rx="4"/><path d="M8 10.5v4M6 12.5h4"/><circle cx="15.5" cy="11.5" r=".8"/><circle cx="17.5" cy="13.5" r=".8"/>',
  coins:'<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>',
  ton:'<path d="M3.5 7.5h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-15z"/><path d="M3.5 7.5 15 4l1 3.5M16.5 13.5h1"/>',
  tech:'<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.3a9.5 9.5 0 0 1 13 0M8.5 15.5a5 5 0 0 1 7 0"/><circle cx="12" cy="18.8" r="1"/>',
  aml:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/>',
  play:'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  chev:'<path d="M6 9l6 6 6-6"/>'};
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

// the rules as an accordion: one section open at a time (the asked one, or "how to play")
function openDocs(sec){const D=DOCS[lang]||DOCS.en,open=sec||'how';
  ds.innerHTML=`<div class="sh-h"><h2>${m('docs')}</h2><button data-d="close" aria-label="Close">×</button></div>
  <div class="dbody">${D.map(([id,t,ps])=>`<details id="doc-${id}"${id===open?' open':''}><summary><span class="di">${ic(id)}</span><span>${t}</span><span class="chev">${ic('chev')}</span></summary>
    <div class="dtext">${ps.map(p=>`<p>${p}</p>`).join('')}</div></details>`).join('')}</div>`;
  ds.classList.add('on');$('scrim').classList.add('on');haptic('select');
  const body=ds.querySelector('.dbody');body.scrollTop=0;if(sec)requestAnimationFrame(()=>toSec(sec))}
ds.addEventListener('toggle',e=>{const d=e.target;if(d.tagName!=='DETAILS'||!d.open)return;
  ds.querySelectorAll('details[open]').forEach(x=>{if(x!==d)x.open=false});haptic('select');requestAnimationFrame(()=>toSec(d.id.slice(4),true))},true);
// scroll the sheet only (scrollIntoView would also shift the whole app frame)
function toSec(id,smooth){const body=ds.querySelector('.dbody'),s=$('doc-'+id);if(body&&s)body.scrollTo({top:s.offsetTop-body.offsetTop-8,behavior:smooth?'smooth':'auto'})}
function closeDocs(){ds.classList.remove('on');if(!document.querySelector('.sheet.on'))$('scrim').classList.remove('on')}
ds.addEventListener('click',e=>{const b=e.target.closest('[data-d]');if(!b)return;if(b.dataset.d==='close')closeDocs();else toSec(b.dataset.d,true)});
$('scrim').addEventListener('click',closeDocs);
$('fairBtn').addEventListener('click',e=>{e.stopPropagation();openDocs('fair')});
window.MENU={open:openMenu,close:closeMenu,docs:openDocs};
})();
