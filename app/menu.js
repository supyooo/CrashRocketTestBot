/* Burger menu (top right): player, sound / vibration / animations, language, and links to the rules, fairness,
   bet history and support. The rules open in their own sheet. Loaded last; uses the game's globals. */
(()=>{
const M={
  ru:{menu:'Меню',player:'Игрок',sound:'Звук',vibro:'Вибрация',anim:'Анимации',lang:'Язык',rules:'Правила игры',fair:'Честность раундов',hist:'История ставок',support:'Поддержка',soon:'Поддержка появится к запуску',
    docs:'Правила игры',toc:'Разделы',
    intro:'Boomy — краш-игра прямо в Telegram. Пилот садится на ракету, ракета взлетает, а множитель растёт с каждой секундой. Задача простая: забрать ставку до взрыва. Чем дольше ждёшь, тем больше выигрыш и тем выше риск. Исход каждого раунда зафиксирован заранее, и его можно проверить.',
    slides:[['Сделай ставку','Выбери сумму и нажми «Ставка»: до старта есть 5 секунд'],['Следи за полётом','Ракета набирает высоту, множитель растёт с каждой секундой'],['Забери до взрыва','Нажми «Забрать» и получи ставку × множитель']],
    mkBet:'Ставка',mkCash:'Забрать'},
  en:{menu:'Menu',player:'Player',sound:'Sound',vibro:'Vibration',anim:'Animations',lang:'Language',rules:'Game rules',fair:'Provably fair',hist:'Bet history',support:'Support',soon:'Support arrives with the launch',
    docs:'Game rules',toc:'Sections',
    intro:'Boomy is a crash game right inside Telegram. The pilot rides a rocket, the rocket takes off and the multiplier climbs every second. The goal is simple: cash out before it blows up. The longer you wait, the bigger the win and the higher the risk. Every round is fixed in advance, and you can check it.',
    slides:[['Place a bet','Pick an amount and tap "Bet": you have 5 seconds before the start'],['Watch it fly','The rocket climbs and the multiplier grows every second'],['Cash out in time','Tap "Cash out" and get your bet × the multiplier']],
    mkBet:'Bet',mkCash:'Cash out'}};
const m=k=>(M[lang]||M.en)[k];

// the rules: [id, title, paragraphs]; numbers match the server config
const DOCS={
 ru:[
  ['how','Как играть',['1. Как сделать ставку? Выбери сумму кнопками − и + или быстрыми суммами и нажми «Ставка». Ставки принимаются 5 секунд перед стартом.','2. Одной ставкой можно не ограничиваться: нажми «+» справа от суммы и играй в одном раунде двумя ставками сразу.','3. Ракета взлетает, множитель растёт от 1.00x. Нажми «Забрать» в любой момент полёта: выигрыш равен ставке, умноженной на множитель в момент нажатия.','4. Если ракета взорвалась раньше, чем ты забрал ставку, ставка сгорает.','5. В какой момент будет взрыв, не знает никто, включая нас: точка краша каждого раунда зафиксирована заранее (см. «Проверка честности»).']],
  ['round','Раунд',['Перед стартом 5 секунд на ставки. Ставку можно сделать и во время полёта: она уйдёт на следующий раунд (кнопка «След. ставка»).','После взрыва 5 секунд пауза, затем открывается приём ставок на новый раунд.','Можно сделать две ставки в одном раунде: нажми «+» справа от суммы, откроется вторая панель со своей суммой, автовыводом и автоставкой. Каждую ставку забираешь отдельно.','Ставка от 0,1 до 1 000 TON. Максимальный выигрыш с одной ставки 10 000 TON: на этой сумме ставка забирается автоматически.']],
  ['auto','Автовывод и автоставка',['Автовывод: задай множитель в меню «Авто», и ставка заберётся сама, когда ракета до него долетит.','Автоставка: та же сумма ставится каждый раунд, пока ты её не выключишь или пока хватает баланса.','На компьютере пробел делает ставку и забирает выигрыш.']],
  ['stats','Ставки и статистика',['Кнопка с игроками над ракетой открывает панель ставок. Во вкладке «Раунд» в реальном времени видны ставки и выигрыши всех игроков текущего раунда.','Вкладка «Мои ставки» хранит историю твоих ставок и выводов.','Полоса множителей над ракетой — история раундов. Её можно листать, а кнопка с часами справа открывает последние 50 раундов.','В профиле собрана твоя статистика: сколько раундов сыграно, лучший множитель, оборот и итог.']],
  ['fair','Проверка честности',['1. Откройте историю коэффициентов (панель над ракетой) и нажмите на любой завершённый множитель, например 1.30x.','2. Откроется окно раунда: точное время, количество игроков и криптографические данные «Хэш раунда» и «Соль».','3. Результат каждого раунда заранее зафиксирован в цепочке хэшей SHA-256. Конец цепочки публикуется до начала игры, поэтому подменить исход раунда задним числом невозможно.','4. Прямо в окне раунда встроена автоматическая проверка: зелёные галочки подтверждают, что коэффициент совпадает с формулой, а хэш ведёт к опубликованному коммитменту (указано число шагов).','5. Для самостоятельной проверки скопируйте «Хэш раунда» и «Соль» иконкой копирования. Множитель = HMAC-SHA256 от хэша раунда с ключом-солью: первые 13 hex-символов дают число h, множитель = (100 − 3) / (1 − h / 2^52) / 100, округлённый вниз до сотых, но не меньше 1.00x.']],
  ['demo','Демо-режим',['В демо играешь на DEMO вместо TON в тех же живых раундах. Демо-баланс пополняется в один клик.','Демо-ставки не дают монет и не идут в статистику.']],
  ['coins','Монеты и скины',['Монеты начисляются за ставки в TON (50 монет за каждый поставленный TON), за задания дня и недели и за вход подряд.','За монеты в Ангаре покупаются скины: персонажи, ракеты, хвосты, парашюты, фоны и эмоции. Собранная коллекция даёт +5% к монетам.','Монеты нельзя вывести или обменять на TON.']],
  ['ton','Пополнение и вывод',['Сейчас игра работает в тестовой сети TON: настоящие деньги не используются.','Пополнение от 0,1 TON. Вывод от 0,5 TON, не больше 100 TON в сутки.']],
  ['tech','Сбои и связь',['Оператор не несёт ответственности за потерю ставки из-за проблем с интернет-соединением. Рекомендуется играть со стабильным подключением.','В случае сбоя программного обеспечения ставки раунда аннулируются, а средства возвращаются игрокам.']],
  ['rtp','RTP',['RTP (Return to Player) — доля поставленных средств, которая в среднем возвращается игрокам.','RTP проявляется только на большой дистанции: в короткой серии раундов результат может быть намного выше или ниже. RTP не обещает выигрыш конкретному игроку.','RTP Boomy — 97%. Преимущество игры 3% заложено прямо в формулу множителя (см. «Проверка честности»).']],
  ['aml','Антифрод и AML',['Возраст. Платформа доступна только лицам старше 18 лет.','Кошельки. Пополняйте с некастодиальных кошельков (например, Tonkeeper). Платформа не несёт ответственности за средства, отправленные со счетов криптобирж (Binance, Bybit и др.) без обязательного комментария (кода пополнения).','Мультиаккаунтинг. Запрещено создавать несколько аккаунтов одним пользователем ради бонусов, фрибетов, уникальных скинов или мест в турнирных таблицах.','Верификация (KYC). Администрация вправе запросить базовую верификацию личности при выводе крупных сумм или подозрении в мошенничестве.','Санкции. За фермы аккаунтов, сторонних ботов для ставок или эксплуатацию уязвимостей игры все связанные аккаунты блокируются без права восстановления.','Заморозка средств. При попытках отмывания средств, кардинга или поступлении неправомерной криптовалюты администрация вправе заморозить баланс пользователя.']],  ['play','Ответственная игра',['Играй только на те деньги, которые готов потерять. Выигрыш в прошлых раундах не влияет на следующие.','Если игра перестала быть развлечением, сделай перерыв.']]],
 en:[
  ['how','How to play',['1. How do I bet? Pick an amount with − and + or the quick amounts and tap "Bet". Bets are open for 5 seconds before the start.','2. One bet is not the limit: tap + next to the amount and play two bets in the same round.','3. The rocket takes off and the multiplier climbs from 1.00x. Tap "Cash out" at any moment of the flight: you win your bet times the multiplier at that moment.','4. If the rocket blows up before you cash out, the bet is lost.','5. Nobody knows when it will blow up, including us: the crash point of every round is fixed in advance (see "Fairness check").']],
  ['round','The round',['Bets are open for 5 seconds before the start. You can also bet during a flight: it goes to the next round (the "Next bet" button).','After the crash there is a 5 second pause, then bets open for the new round.','You can place two bets in one round: tap + next to the amount to open a second panel with its own amount, auto cash-out and auto bet. Each bet is cashed out on its own.','A bet is 0.1 to 1,000 TON. The largest payout of one bet is 10,000 TON: the bet is cashed out automatically at that amount.']],
  ['auto','Auto cash-out and auto bet',['Auto cash-out: set a multiplier in the "Auto" menu and the bet is cashed out as soon as the rocket reaches it.','Auto bet: the same amount is placed every round until you switch it off or the balance runs short.','On a computer, Space places a bet and cashes out.']],
  ['stats','Bets and stats',['The players button above the rocket opens the bets panel. Its "Round" tab shows the bets and wins of everyone in the current round, live.','The "My bets" tab keeps the history of your bets and cash-outs.','The strip of multipliers above the rocket is the round history. It scrolls, and the clock button on its right opens the last 50 rounds.','Your profile collects your stats: rounds played, best multiplier, turnover and result.']],
  ['fair','Fairness check',['1. Open the multiplier history (the panel above the rocket) and tap any completed multiplier, for example 1.30x.','2. The round window opens: the exact time, the number of players and the cryptographic data "Round hash" and "Salt".','3. The result of every round is fixed in advance in a SHA-256 hash chain. The end of the chain is published before play starts, so no round can be changed afterwards.','4. The round window checks itself: green ticks confirm that the multiplier matches the formula and that the hash leads to the published commitment (the number of steps is shown).','5. To check it yourself, copy "Round hash" and "Salt" with the copy icon. Multiplier = HMAC-SHA256 of the round hash keyed with the salt: its first 13 hex characters give a number h, and the multiplier is (100 − 3) / (1 − h / 2^52) / 100, rounded down to hundredths, at least 1.00x.']],
  ['demo','Demo mode',['In demo you play with DEMO instead of TON in the same live rounds. The demo balance refills in one tap.','Demo bets earn no coins and do not count in the stats.']],
  ['coins','Coins and skins',['Coins come from TON bets (50 coins per TON bet), daily and weekly quests and login streaks.','Spend them in the Hangar on skins: riders, rockets, trails, parachutes, backdrops and emotes. A completed collection gives +5% coins.','Coins cannot be withdrawn or exchanged for TON.']],
  ['ton','Deposits and withdrawals',['The game currently runs on the TON testnet: no real money is used.','Deposits from 0.1 TON. Withdrawals from 0.5 TON, up to 100 TON a day.']],
  ['tech','Connection and malfunctions',['The operator is not responsible for a lost bet caused by internet connection problems. Play with a stable connection.','If the software malfunctions, the round bets are cancelled and the funds are returned to the players.']],
  ['rtp','RTP',['RTP (Return to Player) is the share of all bets that goes back to the players on average.','RTP shows only over a long run: over a short series of rounds the result can be much higher or lower. RTP promises no win to any single player.','The RTP of Boomy is 97%. The 3% house edge is built right into the multiplier formula (see "Fairness check").']],
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
.dsheet p{margin:0;font-size:14px;line-height:1.55;color:#cfd2ec}
/* how to play: swipeable slides drawn with the game's own art, dots under them, a short intro */
.dslides{flex:none;display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;overscroll-behavior-x:contain;margin:0 -16px;padding:2px 16px}
.dslides::-webkit-scrollbar{display:none}
.dslide{flex:0 0 84%;scroll-snap-align:center;border-radius:16px;overflow:hidden;background:var(--panel);border:1px solid var(--line)}
.dslide .art{position:relative;height:150px;background:#0c0820;overflow:hidden;container-type:inline-size}   /* the mock-ups size by the slide (cqw) */
.dslide canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.dslide .cap{padding:10px 12px 12px}
.dslide .cap b{display:block;font:800 13.5px/1.3 'Unbounded',sans-serif}
.dslide .cap span{display:block;margin-top:4px;font-size:13px;line-height:1.4;color:var(--muted)}
.ddots{display:flex;justify-content:center;gap:6px;padding:4px 0 2px}
.ddots button{width:7px;height:7px;padding:0;border:0;border-radius:99px;background:#3a3266;transition:width .2s,background .2s;cursor:pointer}
.ddots button[aria-current="true"]{width:20px;background:var(--violet)}
.dintro{margin:2px 2px 6px;font-size:13.5px;line-height:1.55;color:#cfd2ec}
/* the bet panel and the cash-out button of the slides, drawn small after the real ones */
.mk{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:min(8px,2.6cqw);align-items:stretch;padding:min(9px,3cqw);border-radius:14px;background:rgba(22,26,47,.92);border:1px solid var(--line)}
.mk-l{display:flex;flex-direction:column;gap:min(6px,2cqw);width:min(112px,38cqw)}
.mk-amt{display:flex;align-items:center;justify-content:space-between;height:min(34px,11.5cqw);padding:0 min(8px,2.6cqw);border-radius:10px;background:var(--panel-2);font:800 min(14px,4.7cqw) 'Unbounded',sans-serif}
.mk-amt i{font-style:normal;color:var(--muted);font-family:'Golos Text',sans-serif;font-size:min(17px,5.7cqw)}
.mk-q{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.mk-q span{height:min(22px,7.4cqw);border-radius:7px;display:grid;place-items:center;background:var(--panel-2);font-size:min(11px,3.7cqw);font-weight:700;color:var(--muted)}
.mk-btn{position:relative;width:min(110px,37cqw);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:var(--gold);color:#1a1204;
  box-shadow:0 4px 0 #b8901a;font:800 min(13px,4.4cqw) 'Unbounded',sans-serif;text-transform:uppercase}
.mk-btn small{font:700 min(10.5px,3.6cqw) 'Golos Text',sans-serif;text-transform:none;opacity:.8}
.mk-btn.cash{position:absolute;right:min(12px,4cqw);bottom:14px;width:min(118px,40cqw);height:min(52px,17.5cqw);background:var(--green);color:#04150d;box-shadow:0 4px 0 #0f9a50,0 0 18px rgba(43,255,136,.45)}
.mk-btn u{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:2px solid rgba(255,255,255,.9);animation:mkTap 1.6s ease-out infinite}
@keyframes mkTap{0%{transform:scale(.4);opacity:0}15%{opacity:1}70%,100%{transform:scale(2.2);opacity:0}}
@media (prefers-reduced-motion:reduce){.mk-btn u{animation:none;opacity:.6}}`;
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
  stats:'<path d="M4 20.5h16M6.5 17v-5M11 17V7M15.5 17v-7.5M20 17V4.5"/>',
  rtp:'<path d="M18.5 5.5l-13 13"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
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

/* How to play: three slides over the rules, drawn with the player's own build (backdrop, rocket, rider, parachute):
   the bet panel, the flight with a growing multiplier, the bail-out with the win. They swipe; the dots follow. */
function howTo(){const SL=m('slides'),amt=fmtTon(1),win=fmtTon(2.37),cap=i=>`<div class="cap"><b>${SL[i][0]}</b><span>${SL[i][1]}</span></div>`;
  return `<div class="dslides" aria-roledescription="carousel">
    <div class="dslide"><div class="art"><canvas></canvas><div class="mk"><div class="mk-l"><div class="mk-amt"><i>−</i>${amt}<i>+</i></div>
      <div class="mk-q"><span>1</span><span>5</span><span>10</span><span>25</span></div></div><div class="mk-btn">${m('mkBet')}<small>${amt}${CUR()}</small><u></u></div></div></div>${cap(0)}</div>
    <div class="dslide"><div class="art"><canvas></canvas></div>${cap(1)}</div>
    <div class="dslide"><div class="art"><canvas></canvas><div class="mk-btn cash">${m('mkCash')}<small>${win}${CUR()}</small><u></u></div></div>${cap(2)}</div></div>
  <div class="ddots">${SL.map((_,i)=>`<button data-sl="${i}" aria-label="${i+1}" aria-current="${!i}"></button>`).join('')}</div>
  <p class="dintro">${m('intro')}</p>`}
const bgs={};   // one backdrop per size, made by the backdrop's own maker
function bgOf(w,h){const id=BGS[SEL.bg]?SEL.bg:'synth',key=id+w+'x'+h;
  return bgs[key]||(bgs[key]=(()=>{const b=BGS[id].make();b.resize(w,h);return b})())}
function drawSlide(cv,i,t){const w=cv.clientWidth,h=cv.clientHeight,d=Math.min(2,window.devicePixelRatio||1);if(!w||!h)return;
  if(cv.width!==Math.round(w*d)||cv.height!==Math.round(h*d)){cv.width=Math.round(w*d);cv.height=Math.round(h*d)}
  const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  bgOf(w,h).draw(c,{w,h,sc:Math.min(w/360,h/200),dt:1/60,t,alt:0,dAlt:0,sp:.8,I:i===1?.5:.25,phase:'fly',m:2,moonM:2,lvl:0,rx:w*.55,ry:h*.5,tx:w*.5,ty:h*.55,gy:h*.92});
  const ch=CHARS[SEL.char],big=(txt,x,y,col,glow)=>{c.save();c.font=`800 ${Math.round(h*.2)}px Unbounded,sans-serif`;c.textAlign='center';c.textBaseline='middle';
    c.shadowColor=glow;c.shadowBlur=14;c.fillStyle=col;c.fillText(txt,x,y);c.restore()};
  if(i===0){c.fillStyle='rgba(12,7,35,.45)';c.fillRect(0,0,w,h);return}                                 // under the bet panel
  if(i===1){const R=ROCKETS[SEL.rocket],s=1.5*Math.min(w/390,h/210),ang=-.62,x=w*.6,y=h*.66+Math.sin(t*2)*3;   // the flight
    c.save();c.translate(x,y);c.rotate(ang);c.scale(s,s);drawFlame(c,R.trail,1,t,R.tail);R.draw(c);
    c.save();c.translate(R.seat[0],R.seat[1]);c.rotate(-ang*.85);ch.draw(c,.7,t);c.restore();c.restore();
    const q=(t%5)/5;big(x2(Math.exp(q*1.7))+'x',w*.3,h*.24,'#fff','rgba(43,255,136,.8)');return}
  const s=h/165,cg=ch.chute;                                                                             // the bail-out
  c.save();c.translate(w*.3,h*.2+Math.sin(t*1.5)*3);c.rotate(Math.sin(t*1.2)*.08);c.scale(s,s);drawCanopy(c,SEL.chute);
  c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=.8;c.beginPath();
  if(cg){c.moveTo(-26,0);c.lineTo(cg.l[0],cg.l[1]-cg.y);c.moveTo(26,0);c.lineTo(cg.r[0],cg.r[1]-cg.y);c.stroke();c.translate(0,-cg.y);ch.draw(c,1,t,'chute')}
  else{c.moveTo(-26,0);c.lineTo(-5,30);c.moveTo(26,0);c.lineTo(5,30);c.stroke();c.translate(0,62);c.scale(.8,.8);ch.draw(c,1,t)}
  c.restore();
  big('2.37x',w*.72,h*.24,'#2bff88','rgba(43,255,136,.7)');
  c.save();c.font=`800 ${Math.round(h*.09)}px Unbounded,sans-serif`;c.textAlign='center';c.fillStyle='#ffd23f';c.shadowColor='rgba(0,0,0,.8)';c.shadowBlur=6;
  c.fillText('+'+fmtTon(2.37)+CUR(),w*.3,h*.95);c.restore()}
// slides animate while they are on screen (once, still, in smooth mode)
let slideRaf=0;const seen=new Set();
const slideIO=new IntersectionObserver(es=>es.forEach(e=>e.isIntersecting?seen.add(e.target):seen.delete(e.target)));
function startSlides(){cancelAnimationFrame(slideRaf);slideIO.disconnect();seen.clear();
  const cvs=[...ds.querySelectorAll('.dslide canvas')];cvs.forEach(cv=>slideIO.observe(cv));
  const frame=ts=>{if(!ds.classList.contains('on')||!cvs[0].isConnected)return;
    cvs.forEach((cv,i)=>{if(seen.has(cv))drawSlide(cv,i,ts/1000)});slideRaf=requestAnimationFrame(frame)};
  if(window.isLite&&isLite())requestAnimationFrame(()=>cvs.forEach((cv,i)=>drawSlide(cv,i,1.2)));else slideRaf=requestAnimationFrame(frame);
  const sl=ds.querySelector('.dslides'),dots=[...ds.querySelectorAll('.ddots button')];
  sl.addEventListener('scroll',()=>{const n=Math.round(sl.scrollLeft/(sl.firstElementChild.offsetWidth+10));dots.forEach((d,i)=>d.setAttribute('aria-current',String(i===n)))},{passive:true})}

// the rules as an accordion under the slides: one section open at a time (the asked one, or "how to play")
function openDocs(sec){const D=DOCS[lang]||DOCS.en,open=sec||'how';
  ds.innerHTML=`<div class="sh-h"><h2>${m('docs')}</h2><button data-d="close" aria-label="Close">×</button></div>
  <div class="dbody">${howTo()}${D.map(([id,t,ps])=>`<details id="doc-${id}"${id===open?' open':''}><summary><span class="di">${ic(id)}</span><span>${t}</span><span class="chev">${ic('chev')}</span></summary>
    <div class="dtext">${ps.map(p=>`<p>${p}</p>`).join('')}</div></details>`).join('')}</div>`;
  drawnAt=performance.now();ds.classList.add('on');$('scrim').classList.add('on');haptic('select');
  const body=ds.querySelector('.dbody');body.scrollTop=0;startSlides();if(sec)requestAnimationFrame(()=>toSec(sec))}
// a section opened by a tap scrolls into view; the one opened by the sheet itself (the toggle event comes a moment
// after the sheet is drawn) does not, so "how to play" opens with its slides on screen
let drawnAt=0;
ds.addEventListener('toggle',e=>{const d=e.target;if(d.tagName!=='DETAILS'||!d.open)return;if(performance.now()-drawnAt<400)return;
  ds.querySelectorAll('details[open]').forEach(x=>{if(x!==d)x.open=false});haptic('select');requestAnimationFrame(()=>toSec(d.id.slice(4),true))},true);
// scroll the sheet only (scrollIntoView would also shift the whole app frame)
function toSec(id,smooth){const body=ds.querySelector('.dbody'),s=$('doc-'+id);if(body&&s)body.scrollTo({top:s.offsetTop-body.offsetTop-8,behavior:smooth?'smooth':'auto'})}
function closeDocs(){ds.classList.remove('on');if(!document.querySelector('.sheet.on'))$('scrim').classList.remove('on')}
ds.addEventListener('click',e=>{const dot=e.target.closest('[data-sl]');
  if(dot){const sl=ds.querySelector('.dslides'),s=sl.children[+dot.dataset.sl];sl.scrollTo({left:s.offsetLeft-sl.offsetLeft-16,behavior:'smooth'});haptic('select');return}
  const b=e.target.closest('[data-d]');if(!b)return;if(b.dataset.d==='close')closeDocs();else toSec(b.dataset.d,true)});
$('scrim').addEventListener('click',closeDocs);
$('fairBtn').addEventListener('click',e=>{e.stopPropagation();openDocs('fair')});
window.MENU={open:openMenu,close:closeMenu,docs:openDocs};
})();
