/* Round details: tap a multiplier in the history strip. Online, the app checks the round itself, in the browser:
   1) the crash point follows from the revealed round hash and the public salt (HMAC-SHA256 formula),
   2) hashing the round hash n times gives the commitment published before the rounds (so it was not changed later).
   Also: Space bets / cashes out on a computer. Loaded after net.js; uses the game's globals. */
(()=>{
const R={
  ru:{title:'Раунд',demo:'Демо-раунд: проверка честности доступна в онлайн-режиме.',time:'Время',players:'Игроков',hash:'Хэш раунда',salt:'Соль',
    checking:'Проверяем…',formulaOk:'Коэффициент совпадает с формулой',formulaBad:'Коэффициент НЕ совпадает с формулой',
    chainOk:n=>`Хэш ведёт к опубликованному коммитменту (${n} шагов)`,chainBad:'Хэш НЕ ведёт к коммитменту',chainLong:'Цепочка длинная: проверена связь с предыдущим раундом',
    old:'Раунд слишком старый, подробностей нет',how:'Результат каждого раунда заранее зашифрован в цепочке хэшей. Конец цепочки опубликован до начала игры, поэтому подменить раунд задним числом нельзя.',copied:'Скопировано'},
  en:{title:'Round',demo:'Demo round: fairness checks work in online mode.',time:'Time',players:'Players',hash:'Round hash',salt:'Salt',
    checking:'Checking…',formulaOk:'Multiplier matches the formula',formulaBad:'Multiplier does NOT match the formula',
    chainOk:n=>`Hash leads to the published commitment (${n} steps)`,chainBad:'Hash does NOT lead to the commitment',chainLong:'Long chain: link to the previous round checked',
    old:'Round is too old, no details',how:'Every round result is fixed in advance in a hash chain. Its end was published before play started, so no round can be changed afterwards.',copied:'Copied'}};
const r=k=>(R[lang]||R.en)[k];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const enc=s=>new TextEncoder().encode(s);
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',enc(s)));
const E52=2n**52n;
async function crashOf(hash,salt,edgeBps){
  const key=await crypto.subtle.importKey('raw',enc(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const h=BigInt('0x'+hex(await crypto.subtle.sign('HMAC',key,enc(hash))).slice(0,13));
  const x=(BigInt(10000-edgeBps)*E52)/(100n*(E52-h));return Number(x<100n?100n:x)/100}

const sh=document.createElement('section');sh.className='sheet rsheet';sh.setAttribute('aria-label','Round');$('app').appendChild(sh);
let token=0;
function close(){sh.classList.remove('on');token++;if(!document.querySelector('.sheet.on'))$('scrim').classList.remove('on')}
$('scrim').addEventListener('click',close);
sh.addEventListener('click',e=>{const b=e.target.closest('[data-c]');if(!b)return;
  if(b.dataset.c==='close')close();
  else{navigator.clipboard&&navigator.clipboard.writeText(b.dataset.c).then(()=>toast(r('copied')),()=>{})}});

function paint(no,x,body){const cls=x<2?'lo':x<10?'mid':'hi';
  sh.innerHTML=`<div class="sh-h"><h2>${r('title')}${no?' #'+no:''}</h2><button data-c="close" aria-label="Close">×</button></div>
  <div class="tbody"><div class="rbig chip ${cls}">${x2(x)}x</div>${body}</div>`}
const row=(k,v,copy)=>`<div class="tcopy box"${copy?` data-c="${esc(copy)}"`:''}><span>${k}</span><b>${esc(v)}</b>${copy?'<i>⧉</i>':''}</div>`;
const short=h=>h.slice(0,8)+'…'+h.slice(-6);

async function open(i){
  const x=S.hist[i];if(x===undefined)return;const my=++token;
  sh.classList.add('on');$('scrim').classList.add('on');haptic('select');
  const meta=window.NET_ON&&window.NET&&NET.hist[i];
  if(!meta){paint(0,x,`<div class="tnote">${r('demo')}</div>`);return}
  paint(meta.no,x,`<div class="tnote">${r('checking')}</div>`);
  try{
    const [fair,rounds]=await Promise.all([fetch(NET.base+'/api/fair').then(q=>q.json()),fetch(NET.base+'/api/rounds?limit=100').then(q=>q.json())]);
    if(my!==token)return;
    const k=rounds.findIndex(z=>z.no===meta.no),rd=rounds[k];
    if(!rd){paint(meta.no,x,`<div class="tnote">${r('old')}</div>`);return}
    const d=new Date(rd.startedAt),time=d.toLocaleTimeString(lang==='ru'?'ru-RU':'en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    const info=row(r('time'),time)+row(r('players'),String(rd.players))+row(r('hash'),short(rd.hash),rd.hash)+row(r('salt'),short(fair.salt),fair.salt);
    const status=lines=>paint(meta.no,x,info+lines.map(([ok,t])=>`<div class="rchk ${ok?'ok':'bad'}">${ok?'✓':'✗'} ${t}</div>`).join('')+`<div class="tnote">${r('how')}</div>`);
    const fx=await crashOf(rd.hash,fair.salt,fair.edgeBps);const lines=[[Math.abs(fx-rd.crash)<.001,r(Math.abs(fx-rd.crash)<.001?'formulaOk':'formulaBad')]];
    status([...lines,[true,r('checking')]]);
    if(rd.no<=50000){let h=rd.hash;for(let n=0;n<rd.no;n++){h=await sha(h);if(my!==token)return}
      lines.push([h===fair.commitment,h===fair.commitment?r('chainOk')(rd.no):r('chainBad')])}
    else{const prev=rounds[k+1];if(prev&&prev.no===rd.no-1){const ok=(await sha(rd.hash))===prev.hash;lines.push([ok,ok?r('chainLong'):r('chainBad')])}}
    if(my===token)status(lines);
  }catch(e){if(my===token)paint(meta.no,x,`<div class="tnote">${esc(e.message)}</div>`)}
}
$('hist').addEventListener('click',e=>{const c=e.target.closest('.chip');if(!c)return;open([...$('hist').children].indexOf(c))});

// Space: the main button (bet, cancel, cash out). Cash-out goes through touch-down for the instant response.
document.addEventListener('keydown',e=>{
  if(e.code!=='Space'||e.repeat||/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName)||window.SCREEN_OPEN||document.querySelector('.sheet.on'))return;
  e.preventDefault();const m=$('main');
  if(window.NET_ON&&S.phase==='fly'&&S.bet&&!S.bet.out)m.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));else m.click()});
})();
