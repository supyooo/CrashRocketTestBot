/* Crash Rocket screens: Hangar, Tournaments and Profile, plus the demo coin economy.
   Until the backend exists, coins, owned skins, stats and quest progress live on this device (localStorage).
   Loaded after the main game script, so it can use S, SC, SEL, T, lang, fmtTon, toast, haptic, AU. */
(()=>{
const $=id=>document.getElementById(id);
const app=$('app');

/* ---------------- texts ---------------- */
const TX={
 ru:{hangar:'Ангар',tour:'Турниры',profile:'Профиль',coins:'монет',build:'Твоя сборка',beasts:'Крипто-звери',retro:'Ретро-космос',bonus:'Собери всех: +5% монет',bonusOn:'Бонус +5% монет активен',
  cats:{char:'Персонаж',rocket:'Ракета',trail:'Хвост',chute:'Парашют',bg:'Фон',emote:'Эмоция'},
  rar:{c:'Обычный',r:'Редкий',e:'Эпический',l:'Легендарный',t:'Тест'},
  sel:'Выбрано',wear:'Надеть',soon:'Скоро',newSkin:'Новый скин',deal:'Витрина дня',dealIn:'до обновления',
  buy:n=>`Купить за ${n}`,short:n=>`Не хватает ${n} монет`,bought:'Куплено и надето',equipped:'Надето',
  balance:n=>`Баланс ${n} монет`,after:n=>`После покупки ${n}`,preview:'Так будет выглядеть твоя сборка',
  how:'Больше монет: задания и турниры во вкладке',howBtn:'Турниры',inSet:'Коллекция',
  segWeek:'Турнир',segDay:'Топ дня',segQ:'Задания',weekT:'Лунная гонка',weekLeft:'Турнир недели · осталось',weekRule:'Очки — сумма пяти твоих лучших множителей за неделю',
  weekFund:'Фонд: 250 000 монет + Золотой парашют',dayLeft:'Топ дня · до конца',dayT:'Самый высокий пойманный множитель',dayRule:'Считается только забранная ставка от 0,5 TON. Тройка лидеров получает монеты.',
  you:'Ты',login:'Награда за вход',streak:n=>`Серия ${n} дн.`,claimDay:(n,d)=>`Забрать ${n} монет за день ${d}`,claimedDay:'Награда за сегодня получена',
  dQuests:'Задания дня',refresh:'Обновятся через',claim:'Забрать',got:'Получено',weekly:'Задание недели',
  q1:'Сыграй 10 раундов',q2:'Забери на 3x и выше',q3:'Поставь 3 раунда подряд',q4:'Пригласи друга',
  wq:'Забери на 10x три раза',wqR:'награда: Ретро-шаттл',wqRcoins:'награда: 1 500 монет',chest:'Сундук',today:'сегодня',done:'получено',
  lvl:n=>`Пилот · ${n} ур.`,bal:'Баланс',top:'Пополнить',wd:'Вывести',earn:'Как заработать',
  sRounds:'Раундов сыграно',sBest:'Лучший множитель',sTurn:'Оборот',sNet:'Итог',
  coll:'Коллекция скинов',refH:'Приглашай друзей',refP:'1% с оборота каждого друга и 1 000 монет, когда он сыграет первый раунд.',
  copy:'Копировать',share:'Поделиться',copied:'Ссылка скопирована',invited:'Приглашено',earned:'Заработано',
  hist:'Последние ставки',noHist:'Здесь появятся твои ставки',sound:'Звук',vibro:'Вибрация',langL:'Язык',langV:'Русский',
  fair:'Честность раундов',fairV:'Проверить',support:'Поддержка',soonBack:'Появится вместе с бэкендом',
  shareText:'Лечу на ракете в Crash Rocket, залетай!',pilot:'Пилот',plusCoins:n=>`+${n} монет`},
 en:{hangar:'Hangar',tour:'Tournaments',profile:'Profile',coins:'coins',build:'Your build',beasts:'Crypto Beasts',retro:'Retro Space',bonus:'Complete it: +5% coins',bonusOn:'+5% coins bonus active',
  cats:{char:'Rider',rocket:'Rocket',trail:'Trail',chute:'Parachute',bg:'Backdrop',emote:'Emote'},
  rar:{c:'Common',r:'Rare',e:'Epic',l:'Legendary',t:'Test'},
  sel:'Equipped',wear:'Equip',soon:'Soon',newSkin:'New skin',deal:'Deal of the day',dealIn:'refreshes in',
  buy:n=>`Buy for ${n}`,short:n=>`${n} coins short`,bought:'Bought and equipped',equipped:'Equipped',
  balance:n=>`Balance ${n} coins`,after:n=>`After purchase ${n}`,preview:'This is how your build will look',
  how:'More coins: quests and tournaments in the tab',howBtn:'Tournaments',inSet:'Collection',
  segWeek:'Tournament',segDay:'Top today',segQ:'Quests',weekT:'Moon Race',weekLeft:'Weekly tournament · ends in',weekRule:'Score is the sum of your five best multipliers this week',
  weekFund:'Prize: 250,000 coins + Golden parachute',dayLeft:'Top today · ends in',dayT:'Highest multiplier cashed out',dayRule:'Only cash-outs from 0.5 TON count. The top three get coins.',
  you:'You',login:'Daily login',streak:n=>`${n}-day streak`,claimDay:(n,d)=>`Claim ${n} coins for day ${d}`,claimedDay:'Today\'s reward claimed',
  dQuests:'Daily quests',refresh:'Refresh in',claim:'Claim',got:'Claimed',weekly:'Weekly quest',
  q1:'Play 10 rounds',q2:'Cash out at 3x or more',q3:'Bet 3 rounds in a row',q4:'Invite a friend',
  wq:'Cash out at 10x three times',wqR:'reward: Retro Shuttle',wqRcoins:'reward: 1,500 coins',chest:'Chest',today:'today',done:'claimed',
  lvl:n=>`Pilot · lvl ${n}`,bal:'Balance',top:'Top up',wd:'Withdraw',earn:'How to earn',
  sRounds:'Rounds played',sBest:'Best multiplier',sTurn:'Turnover',sNet:'Net',
  coll:'Skin collection',refH:'Invite friends',refP:'1% of each friend\'s turnover and 1,000 coins when they play their first round.',
  copy:'Copy',share:'Share',copied:'Link copied',invited:'Invited',earned:'Earned',
  hist:'Recent bets',noHist:'Your bets will show up here',sound:'Sound',vibro:'Vibration',langL:'Language',langV:'English',
  fair:'Provably fair',fairV:'Verify',support:'Support',soonBack:'Arrives with the backend',
  shareText:'I\'m riding a rocket in Crash Rocket, jump in!',pilot:'Pilot',plusCoins:n=>`+${n} coins`}
};
const tx=k=>TX[lang][k];
const num=n=>Math.round(n).toLocaleString(lang==='ru'?'ru-RU':'en-US');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------------- catalog ---------------- */
const RAR={c:'#8f93b8',r:'#29e6ff',e:'#b06bff',l:'#ffd23f',t:'#ff3ea5'};
const CAT=[
 {k:'char',src:CHARS,items:[['bear','c',0],['bull','c',0],['whale','r',2500],['trump','t',0],['musk','t',0],['sahur','t',0]],soon:[]},
 {k:'rocket',src:ROCKETS,items:[['candle','c',0],['retro','r',1800],['short','e',6000]],soon:['r','e','l']},
 {k:'trail',src:TRAILS,items:[['rainbow','c',0],['fire','c',0],['dollar','r',1200],['pixel','e',4000]],soon:['e','l']},
 {k:'chute',src:CHUTES,items:[['rainbow','c',0],['bag','e',7500],['gold','l',15000]],soon:['r','e','l']},
 {k:'bg',src:BGS,items:[['synth','c',0],['exch','c',0],['moon','r',3000]],soon:['r','e','l']},
 {k:'emote',src:EMOTES,items:[['cheer','c',0],['fireworks','r',1500],['money','e',5000]],soon:['r','e','l']}
];
const DESC={
 bear:{ru:'Медвежий рынок в костюме. Флегматично верит, что всё упадёт, но на ракету сел.',en:'The bear market in a suit. Expects a crash, rides anyway.'},
 bull:{ru:'Бычий рынок с золотой цепью. Пыхтит паром, когда множитель растёт.',en:'The bull market with a gold chain. Snorts steam as the multiplier climbs.'},
 whale:{ru:'Крипто-кит. Бьёт фонтаном от восторга на высоких множителях.',en:'The crypto whale. Spouts with joy at high multipliers.'},
 trump:{ru:'Тестовый мем-персонаж. Уберём перед запуском.',en:'Test meme rider. Removed before launch.'},
 musk:{ru:'Тестовый мем-персонаж. Уберём перед запуском.',en:'Test meme rider. Removed before launch.'},
 sahur:{ru:'Тестовый мем-персонаж. Уберём перед запуском.',en:'Test meme rider. Removed before launch.'},
 candle:{ru:'Зелёная свеча лонга. Радужный хвост в комплекте.',en:'The long green candle. Rainbow flame included.'},
 retro:{ru:'Хромированная классика пятидесятых. Летит на живом огне и разлетается серебряными обломками.',en:'Chrome fifties classic. Flies on real fire and bursts into silver debris.'},
 short:{ru:'Красная свеча шорта для тех, кто ставит против толпы. График на борту идёт вниз.',en:'The red short candle for contrarians. The chart on its side goes down.'},
 rainbow:{ru:'Классика: радужный выхлоп.',en:'The classic rainbow exhaust.'},
 fire:{ru:'Живое пламя с дымом.',en:'Real flames with smoke.'},
 dollar:{ru:'Ракета сорит деньгами на лету.',en:'The rocket sheds dollars as it flies.'},
 pixel:{ru:'Ретро-пиксели из восьмибитных автоматов.',en:'Retro pixels straight out of an 8-bit arcade.'},
 bag:{ru:'Зелёный купол с долларом. Прыгаешь с деньгами, как и положено.',en:'A green canopy with a dollar sign. Bail out with the money.'},
 gold:{ru:'Золотой купол для тех, кто забирает по-крупному.',en:'A golden canopy for big cash-outs.'},
 synth:{ru:'Закат, неоновый город и сетка до горизонта. С высотными зонами.',en:'Sunset, neon city and a grid to the horizon. With altitude zones.'},
 exch:{ru:'Ракета сама рисует график раунда поверх биржевого стакана.',en:'The rocket draws the round chart over the order book.'},
 moon:{ru:'Земля уходит вниз, а Луна растёт вместе с множителем.',en:'Earth falls away and the Moon grows with the multiplier.'},
 cheer:{ru:'Твой герой ликует, повиснув на парашюте.',en:'Your rider cheers while hanging from the parachute.'},
 fireworks:{ru:'Салют в небе при каждом кэшауте.',en:'Fireworks in the sky on every cash-out.'},
 money:{ru:'С неба сыплются монеты, когда забираешь выигрыш.',en:'Coins rain down when you cash out.'}
};
const nameOf=(k,id)=>{const c=CAT.find(x=>x.k===k);return c&&c.src[id]?c.src[id][lang]:id};
const COLLS=[
 {id:'beasts',items:[['char','bear'],['char','bull'],['char','whale']]},
 {id:'retro',items:[['rocket','retro'],['trail','fire'],['chute','gold'],['bg','moon']]}
];

/* ---------------- storage ---------------- */
const today=()=>{const d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate()};
const weekId=()=>Math.floor((Date.now()/864e5+3)/7);
function fresh(){const own={};CAT.forEach(c=>own[c.k]=c.items.filter(i=>i[2]===0).map(i=>i[0]));
  return{v:1,coins:2000,bal:25,own,st:{rounds:0,best:0,turn:0,net:0,xp:0,hist:[]},week:{id:weekId(),tops:[],x10:0,claimed:false},
    day:{date:today(),best:0,rounds:0,x3:0,run:0,runMax:0,claimed:[]},login:{last:'',streak:0,claimed:''},set:{vibro:true}}}
let D;try{D=JSON.parse(localStorage.getItem('cr.eco')||'null')}catch(e){}
if(!D||D.v!==1)D=fresh();
CAT.forEach(c=>{D.own[c.k]=D.own[c.k]||[];c.items.forEach(i=>{if(i[2]===0&&!D.own[c.k].includes(i[0]))D.own[c.k].push(i[0])})});
function rollover(){const t=today();if(D.day.date!==t)D.day={date:t,best:0,rounds:0,x3:0,run:0,runMax:0,claimed:[]};
  if(D.week.id!==weekId())D.week={id:weekId(),tops:[],x10:0,claimed:false}}
rollover();
// login streak
(()=>{const t=today();if(D.login.last!==t){const y=new Date(Date.now()-864e5),ys=y.getFullYear()+'-'+(y.getMonth()+1)+'-'+y.getDate();D.login.streak=D.login.last===ys?D.login.streak+1:1;D.login.last=t}})();
function save(){D.bal=S.bal;try{localStorage.setItem('cr.eco',JSON.stringify(D))}catch(e){}}
S.bal=typeof D.bal==='number'?D.bal:25;
for(const k of['trail','chute','emote','char','rocket','bg'])if(!D.own[k].includes(SEL[k]))SEL[k]=D.own[k][0];

const owns=(k,id)=>D.own[k].includes(id);
const collDone=cl=>cl.items.every(([k,id])=>owns(k,id));
const coinMult=()=>1+COLLS.filter(collDone).length*.05;
function addCoins(n,why){n=Math.round(n);if(!n)return;D.coins+=n;save();renderCoins(true);if(why)toast(tx('plusCoins')(num(n)))}
function renderCoins(bump){const e=$('coins');if(e)e.textContent=num(D.coins);if(bump){const b=$('coinBtn');if(b){b.classList.add('bump');setTimeout(()=>b.classList.remove('bump'),140)}}}

/* ---------------- hooks from the game ---------------- */
let roundBet=false;
window.ECO={
  vibro:()=>D.set.vibro,
  hist:()=>D.st.hist,
  bet(a){rollover();D.st.turn+=a;D.st.net-=a;save();addCoins(a*50*coinMult())},
  cash(m,win,amt){rollover();D.st.net+=win;D.st.best=Math.max(D.st.best,m);D.st.xp+=20;
    if(amt>=.5)D.day.best=Math.max(D.day.best,m);if(m>=3)D.day.x3++;if(m>=10)D.week.x10++;
    D.week.tops.push(m);D.week.tops.sort((a,b)=>b-a);D.week.tops.length=Math.min(D.week.tops.length,5);save();refresh()},
  roundEnd(bet,crash){rollover();if(bet){D.st.rounds++;D.day.rounds++;D.st.xp+=10;D.day.run=roundBet?D.day.run+1:1;D.day.runMax=Math.max(D.day.runMax,D.day.run);
      const d=new Date(),time=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
      D.st.hist.unshift({time,amt:bet.amt,x:bet.out||crash,win:bet.out?bet.amt*bet.out:0});D.st.hist.length=Math.min(D.st.hist.length,20)}
    else D.day.run=0;
    roundBet=!!bet;save();refresh()}
};

/* ---------------- drawing ---------------- */
const BGC={};
function bgFor(id,w,h,key){const k=key+id+w+'x'+h;if(!BGC[k]){BGC[k]=BGS[id].make();BGC[k].resize(w,h)}return BGC[k]}
function prep(cv){const r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
  if(cv.width!==w*d||cv.height!==h*d){cv.width=w*d;cv.height=h*d}const c=cv.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);return{c,w,h}}
function coinIcon(c,x,y,r){c.fillStyle='#ffd23f';c.beginPath();c.arc(x,y,r,0,6.283);c.fill();c.fillStyle='#0098ea';c.beginPath();c.arc(x,y,r*.72,0,6.283);c.fill();
  c.fillStyle='#fff';c.beginPath();c.moveTo(x-r*.38,y-r*.25);c.lineTo(x+r*.38,y-r*.25);c.lineTo(x,y+r*.38);c.closePath();c.fill()}
function emoteFx(c,id,w,h,t){if(id==='fireworks'){c.save();c.globalCompositeOperation='lighter';[[.22,.3,'#ff3ea5',0],[.78,.24,'#29e6ff',.4],[.55,.5,'#ffd23f',.8]].forEach(([x,y,col,o])=>{const q=((t*.6+o)%1),R=10+q*38*Math.min(w,h)/200;
    c.globalAlpha=1-q;for(let i=0;i<16;i++){const a=i/16*6.283;c.fillStyle=col;c.beginPath();c.arc(w*x+Math.cos(a)*R,h*y+Math.sin(a)*R,2,0,6.283);c.fill()}});c.restore()}
  else if(id==='money'){for(let i=0;i<10;i++){const x=((i*53)%100)/100*w,y=((t*60+i*37)%(h+30))-15;c.save();c.translate(x,y);c.scale(.4+.6*Math.abs(Math.sin(t*4+i)),1);coinIcon(c,0,0,7);c.restore()}}}
// a whole build: backdrop, trail, rocket with rider, a parachute on the side, emote hint
function drawBuild(cv,L,t,key){const{c,w,h}=prep(cv);const k=Math.min(w/360,h/200);
  bgFor(L.bg,w,h,key).draw(c,{w,h,sc:k,dt:1/60,t,alt:0,dAlt:0,sp:.8,I:.3,phase:'fly',m:2,moonM:2,lvl:0,rx:w*.55,ry:h*.5,tx:w*.5,ty:h*.55,gy:h*.92});
  const s=1.15*Math.min(w/390,h/210),ang=-.62,x=w*.58,y=h*.52+Math.sin(t*2)*3,R=ROCKETS[L.rocket];
  drawTrailPreview(c,L.trail,x+Math.cos(ang)*R.tail*s,y+Math.sin(ang)*R.tail*s,ang,s,34,t);
  c.save();c.translate(x,y);c.rotate(ang);c.scale(s,s);drawFlame(c,R.trail,1,t,R.tail);R.draw(c);c.save();c.translate(R.seat[0],R.seat[1]);c.rotate(-ang*.85);CHARS[L.char].draw(c,.6,t);c.restore();c.restore();
  c.save();c.translate(w*.16,h*.26+Math.sin(t*1.5)*4);c.rotate(Math.sin(t*1.2)*.1);c.scale(s*.62,s*.62);drawCanopy(c,L.chute);c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=.8;c.beginPath();c.moveTo(-26,0);c.lineTo(-5,30);c.moveTo(26,0);c.lineTo(5,30);c.stroke();
  c.translate(0,62);c.scale(.8,.8);CHARS[L.char].draw(c,1,t);c.restore();
  if(L.emote!=='cheer')emoteFx(c,L.emote,w,h,t)}
function drawThumb(cv,k,id){const{c,w,h}=prep(cv),s=Math.min(w/90,h/92);
  if(k==='char'){c.save();c.translate(w/2-3,h*.93);c.scale(1.45*s,1.45*s);CHARS[id].draw(c,.55,1.1);c.restore()}
  else if(k==='rocket'){c.save();c.translate(w/2+4,h/2);c.rotate(-.62);c.scale(.62*s,.62*s);drawFlame(c,ROCKETS[id].trail,.9,1,ROCKETS[id].tail);ROCKETS[id].draw(c);c.restore()}
  else if(k==='trail'){drawTrailPreview(c,id,w*.76,h*.3,-.6,.62*s,30,1);c.save();c.translate(w*.86,h*.2);c.rotate(-.6);c.scale(.34*s,.34*s);ROCKETS.candle.draw(c);c.restore()}
  else if(k==='chute'){c.save();c.translate(w/2,h*.55);c.scale(1.3*s,1.3*s);drawCanopy(c,id);c.restore()}
  else if(k==='bg'){bgFor(id,w,h,'th').draw(c,{w,h,sc:w/360,dt:0,t:1,alt:0,dAlt:0,sp:1,I:.3,phase:'fly',m:4,moonM:6,lvl:0,rx:w*.5,ry:h*.5,tx:w*.5,ty:h*.55,gy:h*.8})}
  else if(k==='emote'){if(id==='cheer'){c.save();c.translate(w/2-3,h*.95);c.scale(1.35*s,1.35*s);CHARS.bear.draw(c,1,1.35);c.restore()}else emoteFx(c,id,w,h,id==='money'?.7:.35)}}

/* ---------------- screens ---------------- */
const scr={};
['hangar','tour','profile'].forEach(id=>{const e=document.createElement('section');e.className='screen';e.id='sc-'+id;e.hidden=true;e.setAttribute('aria-label',id);app.insertBefore(e,$('fx'));scr[id]=e});
const isheet=document.createElement('section');isheet.className='sheet isheet';isheet.setAttribute('aria-label','Skin');app.appendChild(isheet);
let tab='game',cat='char',seg='week',sheetItem=null;
const COIN='<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ffd23f"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#b8901a" stroke-width="1.8"/><path d="M12 7.2l3.4 5.2h-2.2V17h-2.4v-4.6H8.6z" fill="#b8901a"/></svg>';
const coinPill=()=>`<div class="coinp" data-act="noop">${COIN}<span>${num(D.coins)}</span></div>`;

// hangar
function dealPick(){const pool=[];CAT.forEach(c=>c.items.forEach(i=>{if(i[2]>0&&!owns(c.k,i[0]))pool.push([c.k,i[0],i[1],i[2]])}));if(!pool.length)return null;
  const n=pool[(new Date().getDate()+new Date().getMonth()*31)%pool.length];return{k:n[0],id:n[1],r:n[2],price:n[3],now:Math.round(n[3]*.7/10)*10}}
const priceOf=(k,id)=>{const c=CAT.find(x=>x.k===k),it=c.items.find(i=>i[0]===id),d=dealPick();return d&&d.k===k&&d.id===id?d.now:it[2]};
function untilMidnight(){const n=new Date(),m=new Date(n);m.setHours(24,0,0,0);const s=Math.max(0,(m-n)/1000|0);return[s/3600|0,(s/60|0)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':')}
function renderHangar(){const bc=COLLS[0],bn=bc.items.filter(([k,id])=>owns(k,id)).length,d=dealPick(),C=CAT.find(c=>c.k===cat);
  const items=C.items.map(([id,r])=>{const own=owns(cat,id),sel=SEL[cat]===id,p=priceOf(cat,id);return`<button class="item ${sel?'sel':own?'own':'buy'}" data-act="item" data-k="${cat}" data-id="${id}" style="border-color:${sel?'':RAR[r]+'66'}">
    <div class="pv" style="background:${RAR[r]}1a"><canvas data-th="${cat}:${id}"></canvas><span class="rl" style="color:${RAR[r]}">${tx('rar')[r]}</span></div><b>${esc(nameOf(cat,id))}</b>
    <span class="st">${sel?tx('sel'):own?tx('wear'):COIN+num(p)}</span></button>`}).join('')+C.soon.map(r=>`<div class="item soon"><div class="pv" style="background:${RAR[r]}14"><span class="q" style="color:${RAR[r]}">?</span><span class="rl" style="color:${RAR[r]}">${tx('rar')[r]}</span></div><b>${tx('newSkin')}</b><span class="st">${tx('soon')}</span></div>`).join('');
  scr.hangar.innerHTML=`<div class="sc-h"><h1>${tx('hangar')}</h1>${coinPill()}</div>
   <div class="hero"><canvas id="heroCv"></canvas><div class="cap"><div style="flex:1;min-width:0"><span class="lbl">${tx('build')}</span><b>${esc([nameOf('char',SEL.char),nameOf('rocket',SEL.rocket),nameOf('trail',SEL.trail),nameOf('chute',SEL.chute)].join(' · '))}</b></div>
    <div class="coll"><b>${tx('beasts')} ${bn}/${bc.items.length}</b><div class="bar5"><i style="width:${bn/bc.items.length*100}%"></i></div><span>${collDone(bc)?tx('bonusOn'):tx('bonus')}</span></div></div></div>
   <div class="cats">${CAT.map(c=>`<button data-act="cat" data-k="${c.k}" aria-pressed="${c.k===cat}">${tx('cats')[c.k]}</button>`).join('')}</div>
   ${d?`<button class="deal" data-act="item" data-k="${d.k}" data-id="${d.id}"><canvas data-th="${d.k}:${d.id}"></canvas><div class="t"><small>${tx('deal')} · <span id="dealT">${untilMidnight()}</span></small><b>${esc(nameOf(d.k,d.id))}</b><span><s>${num(d.price)}</s> <b style="color:var(--gold);display:inline">${num(d.now)}</b> ${tx('coins')}</span></div><span class="pct">−30%</span></button>`:''}
   <div class="grid3">${items}</div>`;
  paintThumbs(scr.hangar)}
function paintThumbs(root){root.querySelectorAll('canvas[data-th]').forEach(cv=>{const[k,id]=cv.dataset.th.split(':');drawThumb(cv,k,id)})}
function openItem(k,id){sheetItem={k,id};renderItem();isheet.classList.add('on');$('scrim').classList.add('on');haptic('select');syncBack()}
function closeItem(){sheetItem=null;isheet.classList.remove('on');if(!$('psheet').classList.contains('on'))$('scrim').classList.remove('on');syncBack()}
function renderItem(){if(!sheetItem)return;const{k,id}=sheetItem,C=CAT.find(c=>c.k===k),it=C.items.find(i=>i[0]===id),r=it[1],own=owns(k,id),sel=SEL[k]===id,p=priceOf(k,id),d=dealPick(),isDeal=d&&d.k===k&&d.id===id;
  const cl=COLLS.find(c=>c.items.some(([a,b])=>a===k&&b===id)),cn=cl?cl.items.filter(([a,b])=>owns(a,b)).length:0;
  const btn=own?`<button class="btn ${sel?'ghost':'gold'}" data-act="equip" ${sel?'disabled':''}>${sel?tx('sel'):tx('wear')}</button>`
    :D.coins>=p?`<button class="btn gold" data-act="buy">${COIN} ${tx('buy')(num(p))}</button>`:`<button class="btn gold" disabled>${tx('short')(num(p-D.coins))}</button>`;
  isheet.innerHTML=`<div class="sh-h"><div class="chips" style="flex:1"><span style="background:${RAR[r]}24;color:${RAR[r]}">${tx('rar')[r]}</span>${isDeal&&!own?`<span style="background:rgba(255,62,165,.16);color:var(--pink)">${tx('deal')} −30%</span>`:''}</div><button data-act="close" aria-label="Close">×</button></div>
   <div class="body"><div class="big" style="border-color:${RAR[r]}66"><canvas id="itemCv"></canvas><span>${tx('preview')}</span></div>
    <h3>${esc(nameOf(k,id))}</h3><p>${esc(DESC[id]?DESC[id][lang]:'')}</p>
    ${cl?`<div class="box" style="padding:10px 12px;display:flex;flex-direction:column;gap:6px"><span style="font-size:12px;color:var(--muted)">${tx('inSet')} «${tx(cl.id)}» · ${tx('bonus')}</span><div style="display:flex;align-items:center;gap:8px"><div class="bar5"><i style="width:${cn/cl.items.length*100}%"></i></div><b style="font-size:12px">${cn}/${cl.items.length}</b></div></div>`:''}
    ${own?'':`<div class="how">${tx('how')} <button data-act="gotour">${tx('howBtn')}</button></div><div class="after"><span>${tx('balance')(num(D.coins))}</span><span>${D.coins>=p?tx('after')(num(D.coins-p)):''}</span></div>`}
    ${btn}</div>`}
function equip(k,id){SEL[k]=id;try{localStorage.setItem('cr.sel',JSON.stringify(SEL))}catch(e){}if(k==='bg')SC.setBg(id)}
function buy(){const{k,id}=sheetItem,p=priceOf(k,id);if(D.coins<p||owns(k,id))return;D.coins-=p;D.own[k].push(id);save();renderCoins(true);equip(k,id);AU.cash&&AU.cash();haptic('success');toast(tx('bought'));renderItem();renderHangar()}

// tournaments
const hueOf=s=>{let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))%360;return`hsl(${h} 55% 42%)`};
function board(){const week=seg==='week';
  const src=week?[['ton_tiger',312.4],['whale_99',288],['moon_boy',251.7],['degen_anna',198.2,'10 000'],['crypto_king',176.9,'8 000'],['sol_sister',160.3,'6 000'],['hodl_masha',151,'5 000']]
    :[['alpha_lena',84.2],['pepe_lord',61.05],['ivan_kick',48.77],['gm_frens',33.1],['dima_pump',29.64],['rekt_again',25],['long_x100',22.41]];
  const my=week?D.week.tops.reduce((a,b)=>a+b,0):D.day.best,fmt=v=>week?v.toFixed(1).replace('.',lang==='ru'?',':'.'):v.toFixed(2).replace('.',lang==='ru'?',':'.')+'x';
  const place=my>=src[src.length-1][1]?src.filter(r=>r[1]>my).length+1:(my>0?Math.max(8,Math.round((week?160:90)-my*(week?.6:1.5))):'—');
  const M=['#ffd23f','#cfd6e6','#ff9a5c'],MS=['rgba(255,210,63,.3)','rgba(207,214,230,.22)','rgba(255,154,92,.25)'];
  const pod=[1,0,2].map(i=>{const r=src[i];return`<div><span class="ava" style="width:${i?44:52}px;height:${i?44:52}px;background:${hueOf(r[0])};border-color:${M[i]}">${r[0][0].toUpperCase()}</span><b class="n">@${r[0]}</b><div class="ped" style="height:${[74,56,44][i]}px;border-color:${M[i]};background:linear-gradient(180deg,${MS[i]},rgba(22,26,47,.6))"><b style="color:${M[i]}">${i+1}</b><span>${fmt(r[1])}</span></div></div>`}).join('');
  const rows=src.slice(3).map((r,k)=>`<div class="lbr"><span class="pn">${k+4}</span><span class="a" style="background:${hueOf(r[0])}">${r[0][0].toUpperCase()}</span><span class="nm">@${r[0]}</span><b>${fmt(r[1])}</b><span class="pz">${r[2]||''}</span></div>`).join('');
  const me=`<div class="lbr me"><span class="pn" style="color:var(--gold)">${typeof place==='number'?'#'+place:place}</span><span class="a" style="background:linear-gradient(135deg,#ffd23f,#ff3ea5);color:#1a1204">${lang==='ru'?'Я':'Y'}</span><span class="nm">${tx('you')}</span><b>${my?fmt(my):'—'}</b><span class="pz"></span></div>`;
  const head=week?`<div class="tour"><canvas id="tourCv"></canvas><div class="in"><span class="lbl" style="color:var(--gold)">${tx('weekLeft')} ${daysLeft()}</span><b>${tx('weekT')}</b><span>${tx('weekRule')}</span><span class="f">${tx('weekFund')}</span></div></div>`
    :`<div class="dayc"><span class="lbl" style="color:var(--green)">${tx('dayLeft')} ${untilMidnight()}</span><b>${tx('dayT')}</b><span>${tx('dayRule')}</span></div>`;
  return head+`<div class="podium">${pod}</div><div class="lb">${rows}${me}</div>`}
function daysLeft(){const n=new Date(),dow=(n.getDay()+6)%7,left=(7-dow)*864e5-(n-new Date(n.getFullYear(),n.getMonth(),n.getDate()));const d=left/864e5|0,h=(left/36e5|0)%24;return lang==='ru'?`${d} д ${h} ч`:`${d}d ${h}h`}
const DAYR=[100,150,200,300,400,600,1500];
const QUESTS=()=>[['q1',Math.min(D.day.rounds,10),10,150],['q2',Math.min(D.day.x3,3),3,200],['q3',Math.min(D.day.runMax,3),3,100],['q4',0,1,1000]];
function quests(){const di=(D.login.streak-1)%7,claimed=D.login.claimed===today();
  const days=DAYR.map((r,i)=>{const cls=i<di||(i===di&&claimed)?'done':i===di?'now':'';return`<div class="${cls}"><span>${lang==='ru'?'Д':'D'}${i+1}</span><b>${i===6?tx('chest'):r}</b><span>${cls==='done'?tx('done'):cls==='now'?tx('today'):''}</span></div>`}).join('');
  const qs=QUESTS().map(([id,a,b,rw])=>{const got=D.day.claimed.includes(id),ok=a>=b;return`<div class="box quest ${ok?'ok':''} ${got?'got':''}"><span class="qt">${tx(id)}</span>${got?`<span class="rw" style="color:var(--muted)">${tx('got')}</span>`:ok?`<button class="btn green" data-act="claimq" data-id="${id}">${tx('claim')} ${num(rw)}</button>`:`<span class="rw">+${num(rw)}</span>`}
    <div class="qp"><div class="bar5"><i style="width:${a/b*100}%"></i></div><span>${a} / ${b}</span></div></div>`}).join('');
  const wOk=D.week.x10>=3,hasRetro=owns('rocket','retro');
  return`<div class="sec"><b>${tx('login')}</b><span>${tx('streak')(D.login.streak)}</span></div><div class="days">${days}</div>
   ${claimed?`<div class="empty">${tx('claimedDay')}</div>`:`<button class="btn gold" data-act="claimday">${tx('claimDay')(num(DAYR[di]),di+1)}</button>`}
   <div class="sec"><b>${tx('dQuests')}</b><span>${tx('refresh')} ${untilMidnight().slice(0,5)}</span></div>${qs}
   <div class="wq"><canvas data-th="rocket:retro"></canvas><div style="flex:1"><small>${tx('weekly')}</small><b>${tx('wq')}</b><span>${Math.min(D.week.x10,3)} / 3 · ${hasRetro?tx('wqRcoins'):tx('wqR')}</span></div>${wOk&&!D.week.claimed?`<button class="btn green" data-act="claimw" style="height:36px">${tx('claim')}</button>`:''}</div>`}
function renderTour(){const n=QUESTS().filter(([id,a,b])=>a>=b&&!D.day.claimed.includes(id)).length+(D.login.claimed===today()?0:1);
  scr.tour.innerHTML=`<div class="sc-h"><h1>${tx('tour')}</h1>${coinPill()}</div>
   <div class="segs2">${[['week',tx('segWeek')],['day',tx('segDay')],['quests',tx('segQ')]].map(([id,l])=>`<button data-act="seg" data-k="${id}" aria-pressed="${seg===id}">${l}${id==='quests'&&n?`<i>${n}</i>`:''}</button>`).join('')}</div>
   ${seg==='quests'?quests():board()}`;
  paintThumbs(scr.tour);const tc=$('tourCv');if(tc){const{c,w,h}=prep(tc);bgFor('moon',w,h,'tour').draw(c,{w,h,sc:w/360,dt:0,t:1,alt:0,dAlt:0,sp:0,I:0,phase:'fly',m:12,moonM:12,lvl:0,rx:0,ry:0,tx:0,ty:0,gy:h*2})}}

// profile
const user=()=>{const u=TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user;return u||null};
function level(){const xp=D.st.xp;let L=1;while(xp>=100*L*(L+1)/2)L++;const lo=100*(L-1)*L/2,hi=100*L*(L+1)/2;return{L,cur:xp-lo,need:hi-lo}}
const refLink=()=>`https://t.me/CrashRocketTestBot?startapp=ref_${(user()&&user().id)||'demo'}`;
function renderProfile(){const u=user(),name=u?(u.username?'@'+u.username:[u.first_name,u.last_name].filter(Boolean).join(' ')):tx('pilot'),ini=(u?(u.first_name||u.username||'P'):'P').slice(0,1).toUpperCase(),lv=level();
  const total=CAT.reduce((a,c)=>a+c.items.filter(i=>i[1]!=='t').length,0),mine=CAT.reduce((a,c)=>a+c.items.filter(i=>i[1]!=='t'&&owns(c.k,i[0])).length,0);
  const dec=v=>v.toFixed(2).replace('.',lang==='ru'?',':'.');
  const hist=D.st.hist.slice(0,6).map(h=>`<div class="hrow"><span>${h.time}</span><span>${fmtTon(h.amt)} TON</span><span style="color:${h.win?'var(--cyan)':'var(--muted)'};font-weight:700">${dec(h.x)}x</span><b style="color:${h.win?'var(--green)':'var(--red)'}">${h.win?'+'+fmtTon(h.win-h.amt):'−'+fmtTon(h.amt)}</b></div>`).join('');
  scr.profile.innerHTML=`<div class="mehead"><span class="pic">${u&&u.photo_url?`<img src="${esc(u.photo_url)}" alt="">`:ini}</span><div class="who"><b>${esc(name)}</b><div class="lvl"><span>${tx('lvl')(lv.L)}</span><div class="bar5"><i style="width:${lv.cur/lv.need*100}%"></i></div><span>${num(lv.cur)} / ${num(lv.need)}</span></div></div></div>
   <div class="wallet"><span class="lbl">${tx('bal')}</span><div class="sum"><svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#0098ea"/><path d="M7.2 7.5h9.6c.7 0 1.1.8.8 1.4L12.6 17c-.3.5-.9.5-1.2 0L6.4 8.9c-.3-.6.1-1.4.8-1.4zm4.1 1.3H8.3l3 5.4V8.8zm1.4 0v5.4l3-5.4h-3z" fill="#fff"/></svg><b>${fmtTon(S.bal)}</b><span>TON</span></div>
    <div class="row2"><button class="btn green" data-act="deposit">${tx('top')}</button><button class="btn ghost" data-act="withdraw">${tx('wd')}</button></div>
    <div class="cn">${COIN}<b>${num(D.coins)} ${tx('coins')}</b><span style="flex:1"></span><button class="link" data-act="gotourq">${tx('earn')}</button></div></div>
   <div class="stats"><div class="box"><span>${tx('sRounds')}</span><b>${num(D.st.rounds)}</b></div><div class="box"><span>${tx('sBest')}</span><b style="color:var(--gold)">${D.st.best?dec(D.st.best)+'x':'—'}</b></div>
    <div class="box"><span>${tx('sTurn')}</span><b>${fmtTon(D.st.turn)} TON</b></div><div class="box"><span>${tx('sNet')}</span><b style="color:${D.st.net>=0?'var(--green)':'var(--red)'}">${D.st.net>=0?'+':'−'}${fmtTon(Math.abs(D.st.net))} TON</b></div></div>
   <button class="box colb" data-act="gohangar"><canvas data-th="char:${SEL.char}"></canvas><div class="t"><div><b>${tx('coll')}</b><span style="color:var(--muted);font-size:12.5px">${mine} / ${total}</span></div><div class="bar5"><i style="width:${mine/total*100}%"></i></div></div><span style="font-size:20px;color:var(--muted)">›</span></button>
   <div class="box ref"><h2>${tx('refH')}</h2><p>${tx('refP')}</p><div class="url" id="refUrl">${esc(refLink().replace('https://',''))}</div>
    <div class="row2"><button class="btn ghost" data-act="copy" style="border-color:var(--green);color:var(--green)">${tx('copy')}</button><button class="btn green" data-act="share">${tx('share')}</button></div>
    <div class="foot"><span>${tx('invited')} <b style="color:var(--text)">0</b></span><span>${tx('earned')} <b style="color:var(--green)">0,00 TON</b></span></div></div>
   <div class="sec"><b>${tx('hist')}</b></div><div class="hist2">${hist||`<div class="empty">${tx('noHist')}</div>`}</div>
   <div class="box sets"><button data-act="sound"><span>${tx('sound')}</span><i class="tgl ${AU.on?'on':''}"></i></button><button data-act="vibro"><span>${tx('vibro')}</span><i class="tgl ${D.set.vibro?'on':''}"></i></button>
    <button data-act="lang"><span>${tx('langL')}</span><em>${tx('langV')} ›</em></button><button data-act="soon"><span>${tx('fair')}</span><em>${tx('fairV')} ›</em></button><button data-act="soon"><span>${tx('support')}</span><em>›</em></button></div>`;
  paintThumbs(scr.profile)}

/* ---------------- navigation ---------------- */
function render(){if(tab==='hangar')renderHangar();else if(tab==='tour')renderTour();else if(tab==='profile')renderProfile();renderItem()}
function refresh(){renderCoins();if(tab!=='game')render()}
function go(t){tab=t;window.SCREEN_OPEN=t!=='game';for(const k in scr)scr[k].hidden=k!==t;
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-current',b.dataset.tab===t?'page':'false'));
  if(t!=='game'){render();scr[t].scrollTop=0}closePops&&closePops();syncBack();haptic('select')}
function syncBack(){if(!TG||!TG.BackButton)return;if(sheetItem||tab!=='game')TG.BackButton.show();else TG.BackButton.hide()}
if(TG&&TG.BackButton)TG.BackButton.onClick(()=>{if(sheetItem)closeItem();else go('game')});
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>go(b.dataset.tab));
$('coinBtn').onclick=()=>go('hangar');

function act(e){const b=e.target.closest('[data-act]');if(!b)return;const a=b.dataset.act;
  if(a==='cat'){cat=b.dataset.k;renderHangar();haptic('select')}
  else if(a==='item')openItem(b.dataset.k,b.dataset.id);
  else if(a==='close')closeItem();
  else if(a==='equip'){equip(sheetItem.k,sheetItem.id);haptic('success');toast(tx('equipped'));renderItem();renderHangar()}
  else if(a==='buy')buy();
  else if(a==='gotour'||a==='gotourq'){closeItem();seg='quests';go('tour')}
  else if(a==='gohangar')go('hangar');
  else if(a==='seg'){seg=b.dataset.k;renderTour();haptic('select')}
  else if(a==='claimday'){const di=(D.login.streak-1)%7;D.login.claimed=today();addCoins(DAYR[di],true);haptic('success');renderTour()}
  else if(a==='claimq'){const q=QUESTS().find(q=>q[0]===b.dataset.id);if(q&&q[1]>=q[2]&&!D.day.claimed.includes(q[0])){D.day.claimed.push(q[0]);addCoins(q[3],true);haptic('success');renderTour()}}
  else if(a==='claimw'){D.week.claimed=true;if(owns('rocket','retro'))addCoins(1500,true);else{D.own.rocket.push('retro');save();toast(nameOf('rocket','retro'))}haptic('success');renderTour()}
  else if(a==='copy'){const l=refLink();const ok=()=>toast(tx('copied'));navigator.clipboard?navigator.clipboard.writeText(l).then(ok,()=>{}):0}
  else if(a==='share'){const u='https://t.me/share/url?url='+encodeURIComponent(refLink())+'&text='+encodeURIComponent(tx('shareText'));if(TG&&TG.openTelegramLink)TG.openTelegramLink(u);else window.open(u,'_blank')}
  else if(a==='sound'){$('snd').click();setTimeout(renderProfile,30)}
  else if(a==='vibro'){D.set.vibro=!D.set.vibro;save();renderProfile();haptic('select')}
  else if(a==='lang'){window.setLang(lang==='ru'?'en':'ru');render()}
  else if(a==='deposit'||a==='withdraw'){if(window.NET&&NET.ton)NET.openTon(a);else toast(tx('soonBack'))}
  else if(a==='soon')toast(tx('soonBack'))}
Object.values(scr).forEach(s=>s.addEventListener('click',act));isheet.addEventListener('click',act);
$('scrim').addEventListener('click',()=>{if(sheetItem)closeItem()});

/* live previews while the hangar or the item sheet is visible */
(function loop(ts){const t=ts/1000;
  if(tab==='hangar'&&!scr.hangar.hidden){const h=$('heroCv');if(h)drawBuild(h,SEL,t,'hero');const dt=$('dealT');if(dt&&(ts|0)%500<20)dt.textContent=untilMidnight()}
  if(sheetItem){const cv=$('itemCv');if(cv)drawBuild(cv,Object.assign({},SEL,{[sheetItem.k]:sheetItem.id}),t,'item')}
  requestAnimationFrame(loop)})(performance.now());

window.UI={go,refresh,renderCoins};
renderCoins();save();
})();
