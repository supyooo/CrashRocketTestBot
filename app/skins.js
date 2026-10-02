/* Skins from the concept sheet other than the riders: rockets, trails, parachutes, backdrops and emotes.
   Loaded right after art.js. Adds entries to its registries and widens the drawing functions the game calls
   (drawFlame, trailParticle, drawTrailPreview, drawCanopy). Everything is drawn in code, no images. */
(()=>{
const now=()=>performance.now()/1000;
const EMOJI='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
function lg(c,x0,y0,x1,y1,stops){const g=c.createLinearGradient(x0,y0,x1,y1);stops.forEach((s,i)=>g.addColorStop(i/(stops.length-1),s));return g}
function poly(c,pts){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath()}
// a jet nozzle pointing back (-x) from (x,y)
function nozzle(c,x,y,h,len){c.fillStyle=lg(c,0,y-h/2,0,y+h/2,['#aab2c6','#4a5166','#22263a']);poly(c,[[x,y-h*.4],[x-len,y-h*.55],[x-len,y+h*.55],[x,y+h*.4]]);c.fill();
  c.fillStyle='#14161f';c.fillRect(x-len-1.5,y-h*.55,2,h*1.1)}
function bill(c,w,h){c.fillStyle='#9fd99a';c.fillRect(-w/2,-h/2,w,h);c.strokeStyle='#2f7a3a';c.lineWidth=Math.max(.6,h*.08);c.strokeRect(-w/2+h*.15,-h/2+h*.15,w-h*.3,h*.7);
  c.fillStyle='#2f7a3a';c.beginPath();c.ellipse(0,0,h*.26,h*.3,0,0,6.283);c.fill()}
window.drawBill=bill;

/* =====================================================================
   Rockets
   ===================================================================== */
function drawPlane(c){const f=Math.sin(now()*6)*1.2;
  c.fillStyle='#7cc4ec';poly(c,[[-38,3],[72,0],[-26,21+f]]);c.fill();                     // far wing
  c.fillStyle='#4aa3dd';poly(c,[[-38,3],[72,0],[-14,10]]);c.fill();                       // keel fold
  c.fillStyle=lg(c,0,-16,0,4,['#ffffff','#dff1fc']);poly(c,[[-52,-16+f*.5],[72,0],[-38,3]]);c.fill();
  c.strokeStyle='rgba(40,120,180,.55)';c.lineWidth=1;c.beginPath();c.moveTo(-38,3);c.lineTo(72,0);c.stroke();
  c.strokeStyle='rgba(255,255,255,.9)';c.beginPath();c.moveTo(-50,-15.5+f*.5);c.lineTo(70,-.5);c.stroke()}
function drawLedger(c){const t=now();
  c.fillStyle='#c9cfdc';c.fillRect(-64,-6,14,12);c.fillStyle='#7d8598';c.fillRect(-61,-3.5,5,2.5);c.fillRect(-61,1,5,2.5);   // USB plug
  c.fillStyle=lg(c,0,-12,0,12,['#4a5060','#1c1f28','#0d0f15']);rr(c,-52,-12,110,24,5);c.fill();
  c.fillStyle='#05070c';rr(c,6,-7,44,14,2);c.fill();                                         // screen
  c.fillStyle='#e9f4ff';c.font='700 6.5px JetBrains Mono,monospace';c.textAlign='left';c.textBaseline='middle';c.fillText('TON +∞',10,.5);
  if(Math.sin(t*6)>0)c.fillRect(41,-3,2.5,6);
  c.fillStyle='#2a2e3a';c.beginPath();c.arc(54,-12,2.4,Math.PI,0);c.fill();                // button
  // steel swivel cover over the back half, pivot at the round end
  c.fillStyle=lg(c,0,-14,0,14,['#ffffff','#c3c9d6','#7d8598']);c.beginPath();c.moveTo(-2,-14);c.lineTo(-38,-14);c.arc(-38,0,14,-Math.PI/2,Math.PI/2,true);c.lineTo(-2,14);c.closePath();c.fill();
  c.strokeStyle='rgba(60,66,82,.6)';c.lineWidth=1;c.stroke();
  c.fillStyle='#9aa1b2';c.beginPath();c.arc(-38,0,6,0,6.283);c.fill();c.fillStyle='#e9edf3';c.beginPath();c.arc(-38,0,3,0,6.283);c.fill();
  c.fillStyle='rgba(255,255,255,.65)';c.fillRect(-34,-11.5,28,2);
  c.fillStyle=Math.sin(t*3)>0?'#2bff88':'#0c5a32';c.beginPath();c.arc(2,8,1.4,0,6.283);c.fill()}
function drawCart(c){
  nozzle(c,-44,0,12,14);
  c.strokeStyle='#8b93a8';c.lineWidth=2.4;c.lineCap='round';c.beginPath();c.moveTo(-40,8);c.lineTo(54,8);c.moveTo(-30,8);c.lineTo(-30,17);c.moveTo(46,8);c.lineTo(46,17);c.stroke();
  [-30,46].forEach(x=>{c.fillStyle='#1d2030';c.beginPath();c.arc(x,20,4.5,0,6.283);c.fill();c.fillStyle='#8b93a8';c.beginPath();c.arc(x,20,1.6,0,6.283);c.fill()});
  // groceries poking out of the front: a baguette and a money sack
  c.save();c.translate(50,-22);c.rotate(.45);c.fillStyle='#e0a35a';rr(c,-3.5,-14,7,26,3.5);c.fill();c.strokeStyle='#b97a34';c.lineWidth=1;
  for(let i=0;i<3;i++){c.beginPath();c.moveTo(-2,-8+i*7);c.lineTo(3,-10+i*7);c.stroke()}c.restore();
  c.fillStyle='#b9894a';c.beginPath();c.arc(30,-20,8,0,6.283);c.fill();c.fillStyle='#8a5f2c';c.fillRect(27,-30,6,4);
  c.fillStyle='#ffd23f';c.font='900 9px Unbounded,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('$',30,-19);
  // wire basket
  const B=[[-46,-20],[62,-20],[52,6],[-36,6]];c.fillStyle='rgba(180,195,225,.18)';poly(c,B);c.fill();
  c.strokeStyle='#c7cfe0';c.lineWidth=1;c.beginPath();
  for(let i=0;i<=12;i++){const u=i/12;c.moveTo(-46+u*108,-20);c.lineTo(-36+u*88,6)}
  for(let j=1;j<4;j++){const v=j/4,y=-20+v*26;c.moveTo(-46+v*10,y);c.lineTo(62-v*10,y)}c.stroke();
  c.strokeStyle='#e7ecf6';c.lineWidth=2.2;poly(c,B);c.stroke();
  c.lineWidth=2;c.beginPath();c.moveTo(-46,-20);c.lineTo(-56,-29);c.stroke();
  c.strokeStyle='#ff3b5c';c.lineWidth=4.5;c.beginPath();c.moveTo(-55,-28);c.lineTo(-60,-32);c.stroke();c.lineCap='butt'}
function drawBath(c){const t=now();
  nozzle(c,-50,2,12,12);
  for(let i=0;i<9;i++){const x=-40+i*11,a=Math.sin(i*2.1)*.5+Math.sin(t*4+i)*.08;c.save();c.translate(x,-14);c.rotate(a);
    c.fillStyle=i%2?'#8fd18a':'#a6e0a0';c.fillRect(-4.5,-13,9,16);c.strokeStyle='#2f7a3a';c.lineWidth=.8;c.strokeRect(-3,-11.5,6,13);c.fillStyle='#2f7a3a';c.beginPath();c.arc(0,-5,2,0,6.283);c.fill();c.restore()}
  c.fillStyle=lg(c,0,-12,0,16,['#ffffff','#e3e8f2','#aab4c8']);c.beginPath();c.moveTo(-54,-12);c.quadraticCurveTo(-54,16,-30,16);c.lineTo(40,16);c.quadraticCurveTo(64,16,64,-12);c.closePath();c.fill();
  c.strokeStyle='rgba(120,130,150,.6)';c.lineWidth=1;c.stroke();
  c.fillStyle='#ffffff';rr(c,-58,-16,126,6,3);c.fill();c.strokeStyle='#b8c2d6';c.stroke();
  [-34,46].forEach(x=>{c.fillStyle='#e0a300';c.beginPath();c.moveTo(x-5,14);c.quadraticCurveTo(x-7,22,x-2,23);c.lineTo(x+3,23);c.quadraticCurveTo(x+5,19,x+4,14);c.closePath();c.fill()});
  c.strokeStyle='#ffc21a';c.lineWidth=3;c.lineCap='round';c.beginPath();c.moveTo(60,-16);c.lineTo(60,-26);c.quadraticCurveTo(60,-31,66,-30);c.stroke();c.lineCap='butt';
  c.fillStyle='#ffc21a';c.beginPath();c.arc(56,-21,2.4,0,6.283);c.fill();
  c.fillStyle='rgba(255,255,255,.7)';c.fillRect(-46,-6,70,2)}
function drawCyber(c){
  nozzle(c,-58,0,12,8);
  const body=[[-58,8],[-58,-6],[2,-24],[72,-8],[72,6],[64,10]];
  c.fillStyle=lg(c,0,-24,0,10,['#f4f6f9','#c3c9d3','#7e8796']);poly(c,body);c.fill();c.strokeStyle='#5d6575';c.lineWidth=1;c.stroke();
  [-34,46].forEach(x=>{c.fillStyle='#0e1016';c.beginPath();c.arc(x,10,12.5,Math.PI,0);c.fill();
    c.fillStyle='#15171f';c.beginPath();c.arc(x,10,10,0,6.283);c.fill();c.fillStyle='#59606f';poly(c,[0,1,2,3,4,5].map(i=>[x+Math.cos(i*1.047)*5,10+Math.sin(i*1.047)*5]));c.fill()});
  c.fillStyle='#20242f';poly(c,[[-24,-12],[2,-21],[44,-14],[40,-11],[2,-17],[-20,-9]]);c.fill();
  c.strokeStyle='rgba(255,255,255,.35)';c.beginPath();c.moveTo(-14,-12);c.lineTo(2,-18);c.stroke();
  c.strokeStyle='rgba(60,66,82,.5)';c.beginPath();c.moveTo(-6,-16);c.lineTo(-6,8);c.moveTo(24,-17);c.lineTo(24,8);c.moveTo(-58,-1);c.lineTo(72,-1);c.stroke();
  c.save();c.shadowColor='#bfe9ff';c.shadowBlur=6;c.strokeStyle='#f2fbff';c.lineWidth=2;c.beginPath();c.moveTo(50,-12);c.lineTo(72,-7.5);c.stroke();c.restore();
  c.strokeStyle='#ff3b5c';c.lineWidth=2;c.beginPath();c.moveTo(-57,-5);c.lineTo(-57,3);c.stroke()}
function drawGoldbar(c){const t=now();
  c.fillStyle=lg(c,0,8,0,22,['#d9dee8','#7d8598','#3a3f4f']);rr(c,-28,8,58,13,6.5);c.fill();      // turbine under the bar
  c.fillStyle='#22263a';c.beginPath();c.ellipse(30,14.5,3.5,6.5,0,0,6.283);c.fill();
  c.strokeStyle='#cfd5e2';c.lineWidth=1;for(let i=0;i<4;i++){const a=t*30+i*1.57;c.beginPath();c.moveTo(30,14.5);c.lineTo(30+Math.cos(a)*2.5,14.5+Math.sin(a)*5.5);c.stroke()}
  nozzle(c,-28,14.5,10,8);nozzle(c,-44,-2,12,12);
  const B=[[-36,-14],[50,-14],[60,8],[-46,8]];
  c.fillStyle=lg(c,0,-14,0,8,['#fff3b0','#ffc21a','#b27a00']);poly(c,B);c.fill();
  c.fillStyle='rgba(255,250,210,.7)';poly(c,[[-36,-14],[50,-14],[48,-10],[-34,-10]]);c.fill();
  c.save();poly(c,B);c.clip();const sx=((t*70)%240)-90;c.fillStyle='rgba(255,255,255,.5)';poly(c,[[sx,-16],[sx+10,-16],[sx-2,10],[sx-12,10]]);c.fill();c.restore();
  c.strokeStyle='#8a5c00';c.lineWidth=1;poly(c,B);c.stroke();
  c.fillStyle='rgba(120,74,0,.8)';c.font='800 7px Unbounded,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('999.9',22,-3);c.font='700 4.4px Unbounded,sans-serif';c.fillText('FINE GOLD',22,3.5)}
function drawGelik(c){
  nozzle(c,-46,-2,14,14);
  c.fillStyle='#050608';[-26,38].forEach(x=>{c.beginPath();c.arc(x,8,14,Math.PI,0);c.fill()});
  c.fillStyle=lg(c,0,-8,0,14,['#555a66','#15161b','#050608']);rr(c,-46,-8,104,20,3);c.fill();
  c.fillStyle=lg(c,0,-38,0,-8,['#3d414c','#0d0e12']);poly(c,[[-41,-8],[-40,-38],[22,-38],[27,-8]]);c.fill();
  c.fillStyle='#283444';rr(c,-36,-34,24,21,1.5);c.fill();rr(c,-8,-34,24,21,1.5);c.fill();poly(c,[[19,-34],[22,-34],[25,-13],[19,-13]]);c.fill();
  c.fillStyle='rgba(255,255,255,.16)';poly(c,[[-30,-34],[-24,-34],[-34,-13],[-36,-13],[-36,-20]]);c.fill();poly(c,[[0,-34],[6,-34],[-4,-13],[-8,-13]]);c.fill();
  c.strokeStyle='#9aa3b4';c.lineWidth=1;c.beginPath();c.moveTo(-44,2);c.lineTo(56,2);c.moveTo(-39,-40);c.lineTo(21,-40);c.moveTo(-34,-40);c.lineTo(-34,-38);c.moveTo(16,-40);c.lineTo(16,-38);c.stroke();
  c.fillStyle='#9aa3b4';c.fillRect(-17,-5,5,1.6);c.fillRect(10,-5,5,1.6);
  [-26,38].forEach(x=>{c.fillStyle='#0d0e12';c.beginPath();c.arc(x,12,10.5,0,6.283);c.fill();c.fillStyle='#b8bfcc';c.beginPath();c.arc(x,12,6,0,6.283);c.fill();
    c.fillStyle='#4a505c';c.beginPath();c.arc(x,12,2,0,6.283);c.fill()});
  c.fillStyle='#0d0e12';c.beginPath();c.arc(-44,-20,9.5,0,6.283);c.fill();c.strokeStyle='#3a3f4c';c.lineWidth=2;c.beginPath();c.arc(-44,-20,5.5,0,6.283);c.stroke();
  c.save();c.shadowColor='#fff7cc';c.shadowBlur=8;c.fillStyle='#fffbe6';c.beginPath();c.arc(54,-2,4.2,0,6.283);c.fill();c.restore();
  c.strokeStyle='#5a606c';c.lineWidth=1;c.beginPath();c.arc(54,-2,4.6,0,6.283);c.stroke();
  c.fillStyle='#ff9f1c';c.fillRect(50,-9,6,2)}
Object.assign(ROCKETS,{
  plane:{ru:'Бумажный самолётик',en:'Paper Plane',draw:drawPlane,seat:[-10,-11],tail:-44,trail:'none',debris:['#ffffff','#dff1fc','#4aa3dd']},
  ledger:{ru:'Аппаратный кошелёк',en:'Hardware Wallet',draw:drawLedger,seat:[-16,-13],tail:-64,trail:'blue',debris:['#1c1f28','#c3c9d6','#4a5060']},
  cart:{ru:'Тележка из супермаркета',en:'Shopping Cart',draw:drawCart,seat:[-10,-17],tail:-58,trail:'fire',debris:['#c7cfe0','#ff3b5c','#e0a35a']},
  bath:{ru:'Ванна с купюрами',en:'Bathtub of Cash',draw:drawBath,seat:[-8,-18],tail:-62,trail:'fire',debris:['#ffffff','#8fd18a','#e0a300']},
  cyber:{ru:'Кибертрак',en:'Cybertruck',draw:drawCyber,seat:[-26,-15],tail:-66,trail:'blue',debris:['#c3c9d3','#7e8796','#20242f']},
  goldbar:{ru:'Золотой слиток',en:'Gold Bar',draw:drawGoldbar,seat:[-12,-15],tail:-56,trail:'fire',debris:['#ffc21a','#fff3b0','#b27a00']},
  gelik:{ru:'Чёрный Гелик',en:'Black G-Wagon',draw:drawGelik,seat:[-10,-39],tail:-60,trail:'blue',debris:['#15161b','#555a66','#b8bfcc']}
});
ROCKETS.candle.debris=['#16c865','#7b3cff','#7dffbe'];
Object.assign(ROCKETS.short,{ru:'Красная свеча',en:'Red Candle',debris:['#ff2d55','#2a2f45','#ff9aac']});
Object.assign(ROCKETS.retro,{ru:'Базовая ракета',en:'Basic Rocket',debris:['#d2d8e8','#ff3b5c','#6f7896']});

const flame0=drawFlame;
drawFlame=function(c,kind,power,t,x){
  if(power<=0)return;
  if(kind==='none'){c.save();c.strokeStyle='#ffffff';c.lineWidth=1.4;c.lineCap='round';           // a paper plane only leaves wind streaks
    for(let i=0;i<3;i++){const y=(i-1)*7,L=(14+power*24)*(.7+.3*Math.sin(t*9+i*2));c.globalAlpha=.2+.35*Math.min(1,power);c.beginPath();c.moveTo(x-2,y);c.quadraticCurveTo(x-L*.5,y+Math.sin(t*12+i)*3,x-L,y);c.stroke()}
    c.restore();return}
  if(kind==='blue'){const L=(24+power*30)*(1+Math.sin(t*50)*.08+Math.random()*.1),W=6+power*3;c.save();c.globalCompositeOperation='lighter';
    const g=c.createLinearGradient(x,0,x-L,0);g.addColorStop(0,'#ffffff');g.addColorStop(.25,'#9ff3ff');g.addColorStop(.6,'#2f8bff');g.addColorStop(1,'rgba(90,60,255,0)');
    c.fillStyle=g;c.beginPath();c.moveTo(x,-W);c.quadraticCurveTo(x-L*.4,-W*1.05,x-L,0);c.quadraticCurveTo(x-L*.4,W*1.05,x,W);c.closePath();c.fill();
    c.fillStyle='rgba(255,255,255,.7)';for(let i=1;i<4;i++){c.beginPath();c.ellipse(x-L*i*.2,0,3,W*.35*(1-i*.18),0,0,6.283);c.fill()}   // shock diamonds
    c.restore();return}
  flame0(c,kind,power,t,x)};

/* =====================================================================
   Trails: particle shapes shared by the game and the previews
   ===================================================================== */
const MX='01アイウエオカキクケコサシスセソタチツテトナニヌネ$₿Ξ';
function heartPath(c,s){c.beginPath();c.moveTo(0,9*s);c.bezierCurveTo(-13*s,1*s,-8*s,-11*s,0,-4*s);c.bezierCurveTo(8*s,-11*s,13*s,1*s,0,9*s);c.closePath()}
const CRACK=[[0,-4],[-2,0],[2,3],[-1,6],[0,20]];
window.PSHAPE={
  dot(c,p,r){c.beginPath();c.arc(p.x,p.y,r,0,6.283);c.fill()},
  sq(c,p,r){c.fillRect(p.x-r*.8,p.y-r*.8,r*1.6,r*1.6)},
  glyph(c,p,r){c.font=`900 ${Math.max(6,Math.round(r*2.2*(p.gs||1)))}px Unbounded,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.glyph,p.x,p.y)},
  mono(c,p,r){c.font=`700 ${Math.max(7,Math.round(r*2*(p.gs||1)))}px JetBrains Mono,monospace`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.glyph,p.x,p.y)},
  puff(c,p,r,a){c.globalAlpha=a*.45;c.beginPath();c.arc(p.x,p.y,p.s*(1+(1-a)*1.8),0,6.283);c.fill()},
  spark(c,p,r){c.strokeStyle=p.c;c.lineWidth=Math.max(1,r*.45);c.lineCap='round';c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*.035,p.y-p.vy*.035);c.stroke();c.lineCap='butt'},
  bubble(c,p,r,a){const x=p.x+Math.sin(p.life*9+p.s)*2;c.globalAlpha=a*.9;c.strokeStyle=p.c;c.lineWidth=1.2;c.beginPath();c.arc(x,p.y,r,0,6.283);c.stroke();
    c.fillStyle='rgba(255,255,255,.18)';c.fill();c.fillStyle='rgba(255,255,255,.85)';c.beginPath();c.arc(x-r*.35,p.y-r*.35,Math.max(.8,r*.22),0,6.283);c.fill()},
  candle(c,p,r){c.fillRect(p.x-.6,p.y-r*1.3,1.2,r*2.6);c.fillRect(p.x-r*.4,p.y-r*.75,r*.8,r*1.5)},
  heart(c,p,r,a){const s=r*.12,sep=(1-a)*r*.7;
    for(const sd of[-1,1]){c.save();c.translate(p.x+sd*sep,p.y);c.rotate(sd*(1-a)*.6);c.beginPath();c.moveTo(sd*20*s,-20*s);CRACK.forEach(([x,y])=>c.lineTo(x*s,y*s));c.lineTo(sd*20*s,20*s);c.closePath();c.clip();heartPath(c,s);c.fill();c.restore()}},
  coin(c,p,r){c.save();c.translate(p.x,p.y);c.scale(Math.abs(Math.cos(p.life*7+p.s))*.8+.2,1);c.fillStyle='#ffd23f';c.beginPath();c.arc(0,0,r,0,6.283);c.fill();
    c.fillStyle='#e09a00';c.beginPath();c.arc(0,0,r*.74,0,6.283);c.fill();c.fillStyle='#fff6d0';c.font=`900 ${Math.max(5,Math.round(r*1.2))}px Unbounded,sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('₿',0,r*.06);c.restore()},
  usdt(c,p,r){c.save();c.translate(p.x,p.y);c.scale(Math.abs(Math.cos(p.life*7+p.s))*.8+.2,1);c.fillStyle='#26a17b';c.beginPath();c.arc(0,0,r,0,6.283);c.fill();
    c.fillStyle='#ffffff';c.fillRect(-r*.55,-r*.55,r*1.1,r*.26);c.fillRect(-r*.14,-r*.5,r*.28,r*1.1);c.strokeStyle='#fff';c.lineWidth=Math.max(.6,r*.12);c.beginPath();c.ellipse(0,-r*.05,r*.5,r*.16,0,0,6.283);c.stroke();c.restore()}
};
Object.assign(TRAILS,{
  smoke:{ru:'Белый дым',en:'White Smoke'},sparks:{ru:'Искры',en:'Sparks'},bubbles:{ru:'Мыльные пузыри',en:'Soap Bubbles'},
  pnl:{ru:'−99% PNL',en:'−99% PNL'},candles:{ru:'Японские свечи',en:'Candlesticks'},hearts:{ru:'Разбитые сердца',en:'Broken Hearts'},
  matrix:{ru:'Матричный код',en:'Matrix Code'},cryptorain:{ru:'Дождь из крипты',en:'Crypto Rain'}
});
Object.assign(TRAILS.fire,{ru:'Турбо-выхлоп',en:'Turbo Exhaust'});
const tp0=trailParticle;
// prev: a still preview, where picks must not change from frame to frame
trailParticle=function(kind,i,t,prev){const R=prev?((i*7919)%13)/13:Math.random();
  switch(kind){
    case 'smoke':return{c:'#eceef6',shape:'puff',norm:1,noshrink:1};
    case 'sparks':return{c:['#fff6c8','#ffd23f','#ffb21a','#ffffff'][i%4],shape:'spark'};
    case 'bubbles':return{c:['#9ff3ff','#ffb3e6','#c9b8ff'][i%3],shape:'bubble',norm:1,noshrink:1,g:-140};
    case 'pnl':return R<.2?{c:'#ff3e5f',shape:'glyph',glyph:'-99%',gs:.42,norm:1,noshrink:1}:{c:i%2?'#ff3e5f':'#ff8a9c',shape:'glyph',glyph:'−',gs:1.3,norm:1};
    case 'candles':return{c:(prev?i%2:R<.5)?'#2bff88':'#ff3e7a',shape:'candle',norm:1,noshrink:1};
    case 'hearts':return{c:['#ff3e7a','#ff6fa5','#d81b4a'][i%3],shape:'heart',norm:1,noshrink:1};
    case 'matrix':return{c:R<.15?'#e6fff0':'#2bff88',shape:'mono',glyph:MX[prev?(i*7+((t*5)|0))%MX.length:(R*MX.length)|0],gs:.8};
    case 'cryptorain':return(prev?i%2:R<.5)?{c:'#ffd23f',shape:'coin',norm:1,noshrink:1,g:380}:{c:'#26a17b',shape:'usdt',norm:1,noshrink:1,g:380};
    case 'fire':return{c:['#fff2b0','#ffd23f','#ff9f1c','#ff5a1a','#ff2d55'][i%5],shape:'dot',smoke:true,big:1.25};
  }return tp0(kind,i,t)};
const DENSE={dot:1,spark:1,puff:1};
drawTrailPreview=function(c,kind,x,y,ang,s,len,t){const dx=Math.cos(ang),dy=Math.sin(ang);c.save();
  for(let i=0;i<len;i++){const p=trailParticle(kind,i,t+i*.02,true);if(!DENSE[p.shape]&&i%3)continue;
    const d=(18+i*5.4)*s,wob=Math.sin(i*.45+t*6)*i*.2*s,a=1-i/len,fall=p.g?Math.sign(p.g)*i*i*.012*s:0;
    const q={x:x-dx*d-dy*wob,y:y-dy*d+dx*wob+fall,vx:dx*260,vy:dy*260,s:Math.max(1,9.5-i*.17)*s,c:p.c,glyph:p.glyph,gs:p.gs,life:1-i/len+t};
    if(p.shape==='spark'){const a2=i*2.4+t*3,sp=(4+i*.6)*s;q.x+=Math.cos(a2)*sp;q.y+=Math.sin(a2)*sp;q.vx=Math.cos(a2)*200+dx*150;q.vy=Math.sin(a2)*200+dy*150}   // a spray, not a line
    const r=p.noshrink?q.s*.8:q.s*(p.big||1);c.globalAlpha=a*.9;c.fillStyle=p.c;c.globalCompositeOperation=p.norm?'source-over':'lighter';
    PSHAPE[p.shape](c,q,r,a)}
  c.restore()};

/* =====================================================================
   Parachutes (dome around (0,0), opening down, lines hang from (±26,0))
   ===================================================================== */
const canopy0=drawCanopy;
drawCanopy=function(c,id){const ch=CHUTES[id];if(ch&&ch.draw){c.save();ch.draw(c,now());c.restore()}else canopy0(c,id)};
function rimLine(c,col){c.strokeStyle=col;c.lineWidth=1.2;c.beginPath();c.arc(0,0,28,Math.PI,0);c.stroke()}
Object.assign(CHUTES.rainbow,{ru:'Стандартный',en:'Standard',cols:['#ff3b5c','#f6f3ff','#ff3b5c','#f6f3ff','#ff3b5c','#f6f3ff','#ff3b5c']});
Object.assign(CHUTES.gold,{ru:'Золотой парашют',en:'Golden Parachute',draw(c){canopy0(c,'gold');
  c.fillStyle='#7a4b00';c.font='900 10px Unbounded,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('CEO',0,-12);
  c.fillStyle='#1a0633';poly(c,[[-5,-3],[0,-5],[5,-3],[5,-7],[0,-5],[-5,-7]]);c.fill()}});   // and a bow tie
Object.assign(CHUTES,{
  tornbag:{ru:'Рваный пакет',en:'Torn Plastic Bag',draw(c,t){const f=i=>Math.sin(t*9+i*1.7)*1.6;
    c.strokeStyle='rgba(240,244,252,.85)';c.lineWidth=2;c.beginPath();c.ellipse(-20,5,5,4,0,0,Math.PI);c.moveTo(25,5);c.ellipse(20,5,5,4,0,0,Math.PI);c.stroke();   // handles
    c.fillStyle='rgba(246,248,253,.82)';c.strokeStyle='#ffffff';c.lineWidth=1;c.beginPath();c.moveTo(-27,2);
    c.bezierCurveTo(-31,-20,-14,-34,0,-32);c.bezierCurveTo(14,-34,31,-20,27,2);
    [[20,-3],[14,3],[8,-4],[2,2],[-5,-3],[-12,3],[-19,-2]].forEach(([x,y],i)=>c.lineTo(x,y+f(i)));c.closePath();c.fill();c.stroke();
    c.strokeStyle='rgba(41,120,230,.55)';c.lineWidth=2.2;c.beginPath();c.moveTo(-24,-14);c.quadraticCurveTo(0,-20,24,-14);c.stroke();
    c.strokeStyle='rgba(150,160,190,.45)';c.lineWidth=.8;c.beginPath();c.moveTo(-18,-22);c.lineTo(-10,-8);c.lineTo(-14,0);c.moveTo(6,-28);c.lineTo(2,-16);c.lineTo(8,-4);c.moveTo(18,-18);c.lineTo(14,-6);c.stroke();
    c.fillStyle='rgba(12,8,32,.8)';[[-12,-22,4,2.5],[10,-8,3,4],[16,-24,2.5,2]].forEach(([x,y,a,b])=>{c.beginPath();c.moveTo(x-a,y);c.lineTo(x-a*.3,y-b);c.lineTo(x+a*.6,y-b*.7);c.lineTo(x+a,y+b*.2);c.lineTo(x+a*.2,y+b);c.lineTo(x-a*.7,y+b*.6);c.closePath();c.fill()})}},
  trash:{ru:'Мешок для мусора',en:'Trash Bag',draw(c,t){const f=Math.sin(t*5)*1.2;
    c.fillStyle=lg(c,0,-36,0,4,['#4a4a56','#1a1a22','#060609']);c.beginPath();c.moveTo(-28,2);c.quadraticCurveTo(-34,-24,-5,-30);c.lineTo(0,-31);c.lineTo(5,-30);c.quadraticCurveTo(34,-24,28,2);
    for(let x=28;x>-28;x-=8)c.quadraticCurveTo(x-4,4+f,x-8,1);c.closePath();c.fill();
    c.fillStyle='#14141a';poly(c,[[-3,-30],[-9,-39],[-1,-34],[1,-34],[9,-39],[3,-30]]);c.fill();          // the knot
    c.strokeStyle='rgba(255,255,255,.22)';c.lineWidth=1.4;c.beginPath();c.moveTo(-18,-20);c.quadraticCurveTo(-14,-8,-16,0);c.moveTo(10,-24);c.quadraticCurveTo(14,-14,10,-4);c.stroke();
    c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=1;c.beginPath();c.moveTo(-14,-25);c.quadraticCurveTo(-8,-28,-2,-27);c.stroke()}},
  cane:{ru:'Зонт-трость',en:'Cane Umbrella',draw(c){
    c.strokeStyle='#c9cfdc';c.lineWidth=1.6;c.beginPath();c.moveTo(0,-30);c.lineTo(0,22);c.stroke();
    c.strokeStyle='#8a5a2b';c.lineWidth=3.2;c.lineCap='round';c.beginPath();c.moveTo(0,20);c.lineTo(0,26);c.arc(4,26,4,Math.PI,0,true);c.stroke();c.lineCap='butt';
    const X=[-30,-15,0,15,30];c.fillStyle=lg(c,0,-26,0,0,['#3a3a48','#121218']);c.beginPath();c.moveTo(-30,0);c.bezierCurveTo(-30,-22,-12,-27,0,-27);c.bezierCurveTo(12,-27,30,-22,30,0);
    for(let i=X.length-1;i>0;i--)c.quadraticCurveTo((X[i]+X[i-1])/2,-6,X[i-1],0);c.closePath();c.fill();
    c.strokeStyle='rgba(255,255,255,.18)';c.lineWidth=1;c.beginPath();X.forEach(x=>{c.moveTo(0,-27);c.quadraticCurveTo(x*.75,-20,x,0)});c.stroke();
    c.fillStyle='#c9cfdc';c.fillRect(-1,-33,2,6)}},
  cocktail:{ru:'Коктейльный зонтик',en:'Cocktail Umbrella',draw(c,t){
    c.strokeStyle='#e8c48a';c.lineWidth=1.6;c.beginPath();c.moveTo(0,-17);c.lineTo(0,12);c.stroke();
    const n=8,cols=['#ff5fa2','#ffd23f','#29e6ff','#7dffbe'];
    for(let i=0;i<n;i++){const a0=Math.PI+i*Math.PI/n,a1=a0+Math.PI/n;c.fillStyle=cols[i%4];c.beginPath();c.moveTo(0,-17);
      c.lineTo(Math.cos(a0)*31,Math.sin(a0)*7);c.lineTo(Math.cos(a1)*31,Math.sin(a1)*7);c.closePath();c.fill()}
    c.strokeStyle='rgba(120,40,80,.35)';c.lineWidth=.8;c.beginPath();for(let i=0;i<=n;i++){const a=Math.PI+i*Math.PI/n;c.moveTo(0,-17);c.lineTo(Math.cos(a)*31,Math.sin(a)*7)}c.stroke();
    c.fillStyle='#ffd23f';c.beginPath();c.arc(0,-18,2.4,0,6.283);c.fill();
    c.save();c.translate(0,7);c.rotate(Math.sin(t*2)*.2);c.fillStyle='#d81b4a';c.beginPath();c.arc(0,0,3.4,0,6.283);c.fill();c.fillStyle='rgba(255,255,255,.6)';c.beginPath();c.arc(-1,-1.2,1,0,6.283);c.fill();c.restore()}},   // a cherry on the pick
  flamingo:{ru:'Надувной фламинго',en:'Inflatable Flamingo',draw(c,t){c.rotate(Math.sin(t*1.6)*.05);
    c.fillStyle='#ff7eb6';c.beginPath();c.ellipse(0,-5,29,10,0,0,6.283);c.fill();c.fillStyle='#c94481';c.beginPath();c.ellipse(0,-6,14,4,0,0,6.283);c.fill();
    c.fillStyle='rgba(255,255,255,.45)';c.beginPath();c.ellipse(-14,-10,8,2,-.15,0,6.283);c.fill();
    c.strokeStyle='#ff7eb6';c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(18,-8);c.bezierCurveTo(30,-24,6,-30,14,-44);c.stroke();c.lineCap='butt';
    c.fillStyle='#ff7eb6';c.beginPath();c.arc(17,-45,6,0,6.283);c.fill();
    c.fillStyle='#ffffff';poly(c,[[21,-47],[29,-44],[22,-41]]);c.fill();c.fillStyle='#1a0633';poly(c,[[26,-45],[29,-44],[25,-41]]);c.fill();
    c.beginPath();c.arc(17,-47,1.3,0,6.283);c.fill();
    c.fillStyle='rgba(255,255,255,.55)';c.beginPath();c.ellipse(12,-36,1.5,4,-.3,0,6.283);c.fill()}},
  balloons:{ru:'Воздушные шары',en:'Balloons',draw(c,t){
    const B=[[-17,-30,'#ff3e7a'],[0,-40,'#ffd23f'],[17,-30,'#29e6ff'],[-24,-12,'#2bff88'],[24,-12,'#b06bff'],[0,-20,'#ff8a3d']];
    c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=.7;c.beginPath();B.forEach(([x,y],i)=>{const bx=x+Math.sin(t*1.8+i)*1.5;c.moveTo(bx,y+11);c.quadraticCurveTo(bx*.8,(y+11)/2,x<0?-26:x>0?26:(i%2?-26:26),0)});c.stroke();
    B.forEach(([x,y,col],i)=>{const bx=x+Math.sin(t*1.8+i)*1.5,by=y+Math.cos(t*1.5+i)*1;c.fillStyle=col;c.beginPath();c.ellipse(bx,by,9,11,0,0,6.283);c.fill();
      poly(c,[[bx-2,by+12],[bx+2,by+12],[bx,by+10]]);c.fill();c.fillStyle='rgba(255,255,255,.45)';c.beginPath();c.ellipse(bx-3,by-4,2,3.5,-.4,0,6.283);c.fill()})}},
  bill:{ru:'Сотка баксов',en:'$100 Bill',draw(c,t){const f=Math.sin(t*3)*2;
    c.fillStyle='#bfe4b4';c.beginPath();c.moveTo(-31,-6);c.quadraticCurveTo(0,-36+f,31,-6);c.lineTo(28,4);c.quadraticCurveTo(0,-22+f,-28,4);c.closePath();c.fill();
    c.strokeStyle='#2f7a3a';c.lineWidth=1.2;c.stroke();
    c.lineWidth=.7;c.beginPath();c.moveTo(-26,-5);c.quadraticCurveTo(0,-31+f,26,-5);c.moveTo(-24,1);c.quadraticCurveTo(0,-24+f,24,1);c.stroke();
    c.fillStyle='#e9f6e4';c.beginPath();c.ellipse(0,-17+f*.5,5.5,6,0,0,6.283);c.fill();c.strokeStyle='#2f7a3a';c.stroke();
    c.fillStyle='#2f7a3a';c.beginPath();c.arc(0,-18+f*.5,2,0,6.283);c.fill();c.fillRect(-2.5,-15.5+f*.5,5,3);
    c.font='900 6px Unbounded,sans-serif';c.textAlign='center';c.textBaseline='middle';c.save();c.translate(-19,-10);c.rotate(-.55);c.fillText('100',0,0);c.restore();c.save();c.translate(19,-10);c.rotate(.55);c.fillText('100',0,0);c.restore()}},
  btc:{ru:'Биткоин на стропах',en:'Bitcoin Chute',draw(c,t){const sx=.86+.14*Math.cos(t*1.3);c.save();c.translate(0,-17);c.scale(sx,.92);
    c.fillStyle='#b27a00';c.beginPath();c.arc(0,4,24,0,6.283);c.fill();
    const g=c.createRadialGradient(-8,-8,2,0,0,24);g.addColorStop(0,'#fff3b0');g.addColorStop(.6,'#ffc21a');g.addColorStop(1,'#d18f00');c.fillStyle=g;c.beginPath();c.arc(0,0,24,0,6.283);c.fill();
    c.strokeStyle='#a86d00';c.lineWidth=2;c.beginPath();c.arc(0,0,19,0,6.283);c.stroke();
    c.fillStyle='#ffffff';c.font='900 24px Unbounded,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('₿',0,1.5);c.restore();
    c.strokeStyle='rgba(255,255,255,.6)';c.lineWidth=.8;c.beginPath();c.moveTo(-26,0);c.lineTo(-20*sx,-12);c.moveTo(26,0);c.lineTo(20*sx,-12);c.stroke()}}
});

/* =====================================================================
   Backdrops (factories, like art.js)
   ===================================================================== */
function starLayers(w,h){return[[.2,.6,90],[.5,1,45],[1,1.5,18]].map(([s,r,n])=>({s,r,st:Array.from({length:n},()=>({x:rnd(0,w),y:rnd(0,h),t:rnd(0,6)}))}))}
function drawStars(c,L,E,w,h){const fly=E.phase==='fly',{t,dt,sp}=E;c.fillStyle='#e6ecff';
  for(const l of L){for(const s of l.st){s.y+=(fly?80*sp:4)*l.s*dt;if(s.y>h){s.y=0;s.x=rnd(0,w)}c.globalAlpha=(.4+.6*Math.abs(Math.sin(t*.8+s.t)))*(l.s<.3?.6:1);
    if(fly&&l.s===1&&sp>1.5)c.fillRect(s.x,s.y,l.r,l.r*(1+sp*3));else c.fillRect(s.x,s.y,l.r,l.r)}}c.globalAlpha=1}
function towers(w,minW,maxW,minH,maxH,h){const a=[];let x=-10;while(x<w+40){const bw=rnd(minW,maxW),bh=rnd(minH,maxH)*h,cols=Math.max(1,Math.floor((bw-5)/7)),rows=Math.max(1,Math.floor((bh-8)/9));
  a.push({x,w:bw,h:bh,cols,rows,lit:Array.from({length:cols*rows},()=>Math.random()<.33),neon:Math.random()<.22?['#ff3ea5','#29e6ff','#ffd23f'][(Math.random()*3)|0]:null,ant:Math.random()<.3});x+=bw+rnd(0,3)}return a}
function drawTowers(c,arr,base,body,win,winA,t){c.fillStyle=body;for(const b of arr)c.fillRect(b.x,base-b.h,b.w,b.h+80);
  c.fillStyle=win;c.globalAlpha=winA;c.beginPath();for(const b of arr){for(let i=0;i<b.lit.length;i++)if(b.lit[i])c.rect(b.x+4+(i%b.cols)*7,base-b.h+6+Math.floor(i/b.cols)*9,3,4)}c.fill();c.globalAlpha=1;
  for(const b of arr){if(b.neon){c.fillStyle=b.neon;c.globalAlpha=.85;c.fillRect(b.x,base-b.h,b.w,1.6);c.fillRect(b.x,base-b.h,1.4,b.h*.6);c.globalAlpha=1}
    if(b.ant){c.fillStyle='#3a3360';c.fillRect(b.x+b.w/2-.5,base-b.h-10,1,10);c.fillStyle=Math.sin(t*3+b.x)>0?'#ff3b6b':'#40101c';c.fillRect(b.x+b.w/2-1,base-b.h-12,2,2)}}}

function makeSpace(){let w,h,L=[];return{smoke:'#4a4f6e',
  resize(W,H){w=W;h=H;L=starLayers(w,h)},crash(){},
  draw(c,E){const{gy}=E;c.fillStyle=lg(c,0,0,0,h,['#03041a','#0b0f33','#1a1446']);c.fillRect(-20,-20,w+40,h+40);
    const ng=c.createRadialGradient(w*.25,h*.3,0,w*.25,h*.3,w*.7);ng.addColorStop(0,'rgba(41,230,255,.14)');ng.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=ng;c.fillRect(0,0,w,h);
    drawStars(c,L,E,w,h);
    const r=w*.07,px=w*.8,py=h*.2+E.alt*.12;c.save();c.translate(px,py);c.rotate(-.35);c.strokeStyle='rgba(255,208,160,.7)';c.lineWidth=r*.14;c.beginPath();c.ellipse(0,0,r*1.9,r*.42,0,Math.PI,0);c.stroke();
    const pg=c.createRadialGradient(-r*.35,-r*.4,r*.1,0,0,r);pg.addColorStop(0,'#ffcf8a');pg.addColorStop(.6,'#d1663a');pg.addColorStop(1,'#4a1a3a');c.fillStyle=pg;c.beginPath();c.arc(0,0,r,0,6.283);c.fill();
    c.beginPath();c.ellipse(0,0,r*1.9,r*.42,0,0,Math.PI);c.stroke();c.restore();
    if(gy<h+40){c.fillStyle=lg(c,0,gy,0,h,['#262a44','#0d0f1f']);c.fillRect(0,gy,w,h-gy+40);c.fillStyle='rgba(41,230,255,.55)';c.fillRect(0,gy-1,w,1.5);
      c.fillStyle='#14172b';for(let i=0;i<5;i++){const x=w*(.08+i*.22);c.fillRect(x,gy-18,6,18);c.fillRect(x-4,gy-22,14,4)}
      c.fillStyle=Math.sin(E.t*4)>0?'#29e6ff':'#0d3a4a';for(let i=0;i<12;i++)c.fillRect(w*.04+i*w*.08,gy+8,2,2)}}}}

function makeCity(){let w,h,far=[],near=[],stars=[];return{smoke:'#3c3a5c',
  resize(W,H){w=W;h=H;far=towers(w,14,30,.12,.34,h);near=towers(w,22,48,.1,.36,h);stars=Array.from({length:50},()=>({x:rnd(0,w),y:rnd(0,h*.6),r:rnd(.4,1.3),t:rnd(0,6)}))},crash(){},
  draw(c,E){const{t,gy}=E;c.fillStyle=lg(c,0,0,0,h,['#05071a','#161241','#3b1f5e']);c.fillRect(-20,-20,w+40,h+40);
    c.fillStyle='#fff';for(const s of stars){c.globalAlpha=.3+.4*Math.abs(Math.sin(t+s.t));c.fillRect(s.x,(s.y+E.alt*.08)%h,s.r,s.r)}c.globalAlpha=1;
    const mx=w*.2,my=h*.15+E.alt*.1,mr=13*E.sc+4;const gl=c.createRadialGradient(mx,my,mr*.5,mx,my,mr*3);gl.addColorStop(0,'rgba(255,240,200,.3)');gl.addColorStop(1,'rgba(255,240,200,0)');c.fillStyle=gl;c.fillRect(mx-mr*3,my-mr*3,mr*6,mr*6);
    c.fillStyle='#fff3d0';c.beginPath();c.arc(mx,my,mr,0,6.283);c.fill();c.fillStyle='rgba(180,160,120,.35)';c.beginPath();c.arc(mx-mr*.3,my-mr*.2,mr*.25,0,6.283);c.arc(mx+mr*.35,my+mr*.3,mr*.18,0,6.283);c.fill();
    const fb=gy-E.alt*.5;if(fb-h*.4<h){c.fillStyle='rgba(255,120,80,.12)';c.fillRect(0,fb-h*.12,w,h*.12);drawTowers(c,far,fb,'#151036','#ffcf7a',.35,t)}
    if(gy<h+h*.4){c.save();c.globalCompositeOperation='lighter';[.3,.74].forEach((x,i)=>{const a=-Math.PI/2+Math.sin(t*.5+i*2)*.45,L=h;c.fillStyle='rgba(200,220,255,.05)';
        c.beginPath();c.moveTo(w*x,gy);c.lineTo(w*x+Math.cos(a-.06)*L,gy+Math.sin(a-.06)*L);c.lineTo(w*x+Math.cos(a+.06)*L,gy+Math.sin(a+.06)*L);c.closePath();c.fill()});c.restore();
      drawTowers(c,near,gy,'#0a0820','#ffd76a',.8,t);
      if(gy<h+40){c.fillStyle='#07061a';c.fillRect(0,gy,w,h-gy+40);c.fillStyle='#1b1838';c.fillRect(0,gy+5,w,6);
        for(let i=0;i<10;i++){const dir=i%2?1:-1,x=(((t*55*dir+i*97)%(w+40))+w+40)%(w+40)-20;c.fillStyle=dir>0?'#fff4c8':'#ff3b5c';c.fillRect(x,gy+(dir>0?6:9),3,1.5)}}}}}}

function makeClouds(){let w,h,cl=[];return{smoke:'#c9d6ea',
  resize(W,H){w=W;h=H;cl=Array.from({length:14},(_,i)=>({x:rnd(-60,w),y:rnd(-h*.1,h*.9),s:rnd(.5,1.2),L:i<6?.4:i<11?.8:1.3,v:rnd(6,14)})).sort((a,b)=>a.L-b.L)},crash(){},
  draw(c,E){const{t,dt,sp,gy}=E,fly=E.phase==='fly',k=clamp((E.lvl||0)/Math.log(30),0,1);
    c.fillStyle=lg(c,0,0,0,h,[mixHex('#3d8ee6','#0b1e5a',k),mixHex('#bfe6ff','#4a6fc0',k)]);c.fillRect(-20,-20,w+40,h+40);
    const sx=w*.8,sy=h*.15;const sg=c.createRadialGradient(sx,sy,4,sx,sy,70*E.sc+20);sg.addColorStop(0,'rgba(255,250,220,.8)');sg.addColorStop(1,'rgba(255,250,220,0)');c.fillStyle=sg;c.fillRect(0,0,w,h*.5);
    c.fillStyle='#fffbe6';c.beginPath();c.arc(sx,sy,10+8*E.sc,0,6.283);c.fill();
    if(gy<h+40){c.fillStyle='#86cc72';c.beginPath();c.moveTo(-10,gy+4);c.quadraticCurveTo(w*.3,gy-h*.08,w*.6,gy);c.quadraticCurveTo(w*.85,gy-h*.05,w+10,gy+2);c.lineTo(w+10,h+40);c.lineTo(-10,h+40);c.fill();
      c.fillStyle=lg(c,0,gy,0,h,['#5cb85a','#2f7a33']);c.fillRect(0,gy+4,w,h-gy+40);
      for(let i=0;i<7;i++){const x=w*(.06+i*.15),y=gy+6+(i%2)*6;c.fillStyle='#6b4a2a';c.fillRect(x-1,y-6,2,7);c.fillStyle='#2f8a3a';c.beginPath();c.arc(x,y-9,5,0,6.283);c.fill()}}
    for(const q of cl){q.x+=q.v*q.L*dt;if(q.x>w+90)q.x=-130;q.y+=(fly?70*sp:1.5)*q.L*dt;if(q.y>h+60){q.y=rnd(-140,-50);q.x=rnd(-60,w)}
      c.globalAlpha=q.L<.5?.55:.95;puff(c,q.x,q.y+5*q.s,q.s,'#c8d8ee');puff(c,q.x,q.y,q.s,'#ffffff')}c.globalAlpha=1}}}

function makeGolf(){let w,h,cl=[],balls=[];return{smoke:'#d8e6d0',
  resize(W,H){w=W;h=H;cl=Array.from({length:6},()=>({x:rnd(-40,w),y:rnd(0,h*.6),s:rnd(.4,.8)}))},crash(){},reset(){balls=[]},
  draw(c,E){const{t,dt,sp,gy}=E,fly=E.phase==='fly';
    c.fillStyle=lg(c,0,0,0,h,['#5aaeef','#a9d8f5','#ffe3b0']);c.fillRect(-20,-20,w+40,h+40);
    const sx=w*.84,sy=h*.32+E.alt*.2;const sg=c.createRadialGradient(sx,sy,4,sx,sy,90);sg.addColorStop(0,'rgba(255,220,150,.75)');sg.addColorStop(1,'rgba(255,220,150,0)');c.fillStyle=sg;c.fillRect(sx-90,sy-90,180,180);
    c.fillStyle='#fff2c8';c.beginPath();c.arc(sx,sy,12,0,6.283);c.fill();
    for(const q of cl){q.x+=5*dt;if(q.x>w+80)q.x=-90;q.y+=(fly?50*sp:0)*dt;if(q.y>h+40){q.y=-40;q.x=rnd(-40,w)}c.globalAlpha=.9;puff(c,q.x,q.y,q.s,'#ffffff')}c.globalAlpha=1;
    const fb=gy-E.alt*.4;if(fb-h*.2<h){c.fillStyle='#8cc97a';c.beginPath();c.moveTo(-10,fb);c.quadraticCurveTo(w*.25,fb-h*.09,w*.5,fb-h*.02);c.quadraticCurveTo(w*.78,fb-h*.11,w+10,fb-h*.03);c.lineTo(w+10,fb+60);c.lineTo(-10,fb+60);c.fill();
      const cx=w*.7,cy=fb-h*.075;c.fillStyle='#f6f1e4';c.fillRect(cx-22,cy-12,44,12);c.fillStyle='#b8452f';poly(c,[[cx-26,cy-12],[cx,cy-22],[cx+26,cy-12]]);c.fill();
      c.fillStyle='#6a8aa8';for(let i=0;i<5;i++)c.fillRect(cx-18+i*8,cy-9,4,5);
      [w*.12,w*.2,w*.9].forEach((x,i)=>{const y=fb-h*.04;c.strokeStyle='#5a3e22';c.lineWidth=2;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+3,y-14,x+1,y-26);c.stroke();
        c.strokeStyle='#2f6b3a';c.lineWidth=2.4;c.lineCap='round';for(let j=0;j<5;j++){const a=-2.6+j*.55+Math.sin(t+i)*.06;c.beginPath();c.moveTo(x+1,y-26);c.quadraticCurveTo(x+1+Math.cos(a)*8,y-26+Math.sin(a)*8-3,x+1+Math.cos(a)*14,y-26+Math.sin(a)*14+3);c.stroke()}c.lineCap='butt'})}
    if(gy<h+40){c.fillStyle=lg(c,0,gy,0,h,['#5cbf4f','#3a8f36']);c.fillRect(0,gy,w,h-gy+40);
      c.fillStyle='rgba(255,255,255,.07)';for(let i=0;i<6;i++){const y=gy+i*i*3+2;c.fillRect(0,y,w,(i+1)*1.6)}
      c.fillStyle='#f3dfa4';c.beginPath();c.ellipse(w*.36,gy+24,w*.1,6,0,0,6.283);c.fill();
      const hx=w*.72,hy=gy+16;c.fillStyle='#7fdc6c';c.beginPath();c.ellipse(hx,hy,w*.15,9,0,0,6.283);c.fill();c.fillStyle='#1d2a12';c.beginPath();c.ellipse(hx,hy,3,1.5,0,0,6.283);c.fill();
      c.strokeStyle='#ffffff';c.lineWidth=1.2;c.beginPath();c.moveTo(hx,hy);c.lineTo(hx,hy-30);c.stroke();
      c.fillStyle='#ff3b5c';c.beginPath();c.moveTo(hx,hy-30);c.quadraticCurveTo(hx+7,hy-28+Math.sin(t*5)*2,hx+14,hy-26+Math.sin(t*5+1)*2);c.lineTo(hx,hy-21);c.fill();
      const kx=w*.13,ky=gy+12;c.fillStyle='#ffffff';rr(c,kx-12,ky-8,24,8,2);c.fill();c.fillStyle='#e8eef5';c.fillRect(kx-11,ky-19,22,2);c.fillStyle='#9aa3b4';c.fillRect(kx-10,ky-18,1.2,10);c.fillRect(kx+8,ky-18,1.2,10);
      c.fillStyle='#1d2030';c.beginPath();c.arc(kx-7,ky,3,0,6.283);c.arc(kx+7,ky,3,0,6.283);c.fill()}
    if(fly&&Math.random()<.012*sp)balls.push({x:-10,y:rnd(h*.2,h*.7),vx:rnd(320,520),vy:rnd(-160,-40)});
    for(let i=balls.length-1;i>=0;i--){const b=balls[i];b.vy+=200*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.x>w+20){balls.splice(i,1);continue}
      c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=1.5;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x-b.vx*.05,b.y-b.vy*.05);c.stroke();c.fillStyle='#fff';c.beginPath();c.arc(b.x,b.y,2.6,0,6.283);c.fill()}}}}

function xpFlag(c,x,y,s,t){const C=['#f35325','#81bc06','#05a6f0','#ffba08'],q=11*s,g=1.6*s;
  for(let i=0;i<4;i++){const ox=x+(i%2)*(q+g)-q,oy=y+Math.floor(i/2)*(q*.85+g)-q*.85,wv=xx=>Math.sin((xx-x)*.14/s+t*3.5)*2.2*s;
    c.fillStyle=C[i];c.beginPath();c.moveTo(ox,oy+wv(ox));c.lineTo(ox+q,oy+wv(ox+q));c.lineTo(ox+q,oy+q*.85+wv(ox+q));c.lineTo(ox,oy+q*.85+wv(ox));c.closePath();c.fill()}}
function makeXP(){let w,h,cl=[],fl=[];return{smoke:'#d6e6f8',
  resize(W,H){w=W;h=H;cl=Array.from({length:8},()=>({x:rnd(-60,w),y:rnd(0,h*.55),s:rnd(.7,1.4)}));fl=Array.from({length:3},()=>({x:rnd(30,w-30),y:rnd(30,h*.6),vx:rnd(30,50)*(Math.random()<.5?-1:1),vy:rnd(20,40)*(Math.random()<.5?-1:1)}))},crash(){},
  draw(c,E){const{t,dt,sp,gy}=E,fly=E.phase==='fly';
    c.fillStyle=lg(c,0,0,0,h,['#1f63d0','#5c9ae6','#a9d0f7']);c.fillRect(-20,-20,w+40,h+40);
    for(const q of cl){q.x+=6*dt;if(q.x>w+90)q.x=-120;q.y+=(fly?55*sp:0)*dt;if(q.y>h+50){q.y=rnd(-120,-50);q.x=rnd(-60,w)}c.globalAlpha=.92;puff(c,q.x,q.y+4*q.s,q.s,'#dce9f8');puff(c,q.x,q.y,q.s,'#ffffff')}c.globalAlpha=1;
    if(gy<h+60){c.fillStyle='#4fa832';c.beginPath();c.moveTo(-10,gy+18);c.quadraticCurveTo(w*.35,gy-h*.05,w*.7,gy+4);c.quadraticCurveTo(w*.9,gy+8,w+10,gy+2);c.lineTo(w+10,h+40);c.lineTo(-10,h+40);c.fill();
      c.fillStyle=lg(c,0,gy-h*.1,0,h,['#86d64a','#4fae2c','#2a7d1a']);c.beginPath();c.moveTo(-10,gy+26);c.quadraticCurveTo(w*.45,gy-h*.12,w+10,gy+40);c.lineTo(w+10,h+40);c.lineTo(-10,h+40);c.fill();
      c.strokeStyle='rgba(255,255,255,.12)';c.lineWidth=2;c.beginPath();c.moveTo(w*.1,gy+20);c.quadraticCurveTo(w*.45,gy-h*.08,w*.85,gy+28);c.stroke()}
    const fa=clamp(E.alt/(h*.35),0,1);if(fa>0){c.globalAlpha=fa;for(const f of fl){f.x+=f.vx*dt*(fly?1+sp*.3:1);f.y+=f.vy*dt*(fly?1+sp*.3:1);if(f.x<20||f.x>w-20)f.vx*=-1;if(f.y<20||f.y>h*.8)f.vy*=-1;
      f.x=clamp(f.x,20,w-20);f.y=clamp(f.y,20,h*.8);xpFlag(c,f.x,f.y,1+E.sc*.4,t+f.x*.01)}c.globalAlpha=1}}}}

function goldStack(c,x,y,n,s){for(let r=0;r<n;r++)for(let i=0;i<n-r;i++){const bx=x+(i-(n-r-1)/2)*16*s,by=y-r*7*s;
  c.fillStyle=lg(c,0,by-7*s,0,by,['#fff0a0','#ffc21a','#b27a00']);poly(c,[[bx-6*s,by-7*s],[bx+6*s,by-7*s],[bx+8*s,by],[bx-8*s,by]]);c.fill()}}
function makeVault(){let w,h,off=0,alarm=0;return{smoke:'#3a3f4c',
  resize(W,H){w=W;h=H},crash(){alarm=1.8},reset(){alarm=0},
  draw(c,E){const{t,dt,sp,gy}=E,fly=E.phase==='fly';
    c.fillStyle=lg(c,0,0,0,h,['#1d222c','#11141b']);c.fillRect(-20,-20,w+40,h+40);
    off=(off+dt*(fly?70*sp:3))%20;const oy=(off+E.alt*.3)%20;
    c.fillStyle='#232833';c.strokeStyle='#363d4b';c.lineWidth=1;c.beginPath();for(let y=-20+oy;y<h;y+=20)for(let x=2;x<w;x+=32)c.rect(x,y,29,17);c.fill();c.stroke();
    c.fillStyle='#b08a3a';c.beginPath();for(let y=-20+oy;y<h;y+=20)for(let x=2;x<w;x+=32)c.rect(x+13.5,y+7,2,3);c.fill();
    const R=Math.min(w,h)*.3,dx=w*.68,dy=h*.4+E.alt*.5;if(dy-R<h){
      const rg=c.createRadialGradient(dx-R*.3,dy-R*.3,R*.1,dx,dy,R*1.08);rg.addColorStop(0,'#dfe4ec');rg.addColorStop(.7,'#8a93a6');rg.addColorStop(1,'#3c4252');c.fillStyle=rg;c.beginPath();c.arc(dx,dy,R*1.08,0,6.283);c.fill();
      c.fillStyle='#6a7284';c.beginPath();c.arc(dx,dy,R*.86,0,6.283);c.fill();c.fillStyle=rg;c.beginPath();c.arc(dx,dy,R*.8,0,6.283);c.fill();
      c.fillStyle='#4a5162';for(let i=0;i<16;i++){const a=i/16*6.283;c.beginPath();c.arc(dx+Math.cos(a)*R*.97,dy+Math.sin(a)*R*.97,R*.035,0,6.283);c.fill()}
      c.strokeStyle='rgba(40,46,60,.5)';c.lineWidth=1;[.6,.45].forEach(k=>{c.beginPath();c.arc(dx,dy,R*k,0,6.283);c.stroke()});
      const sp_=t*.25+(alarm>0?t*3:0);c.strokeStyle='#c9cfdc';c.lineWidth=R*.05;c.lineCap='round';c.beginPath();for(let i=0;i<4;i++){const a=sp_+i*1.571;c.moveTo(dx,dy);c.lineTo(dx+Math.cos(a)*R*.42,dy+Math.sin(a)*R*.42)}c.stroke();c.lineCap='butt';
      c.fillStyle='#e8ecf3';for(let i=0;i<4;i++){const a=sp_+i*1.571;c.beginPath();c.arc(dx+Math.cos(a)*R*.42,dy+Math.sin(a)*R*.42,R*.05,0,6.283);c.fill()}
      c.fillStyle='#9aa1b2';c.beginPath();c.arc(dx,dy,R*.12,0,6.283);c.fill()}
    if(gy<h+40){c.fillStyle=lg(c,0,gy,0,h,['#262b36','#0d0f14']);c.fillRect(0,gy,w,h-gy+40);c.fillStyle='rgba(255,210,63,.35)';c.fillRect(0,gy,w,1.2);
      const s=E.sc*1.1+.3;goldStack(c,w*.14,gy+4,3,s);goldStack(c,w*.86,gy+4,4,s);goldStack(c,w*.5,gy+12,2,s*.8)}
    const ml=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.3,w/2,h/2,Math.max(w,h)*.75);ml.addColorStop(0,'rgba(0,0,0,0)');ml.addColorStop(1,'rgba(0,0,0,.45)');c.fillStyle=ml;c.fillRect(0,0,w,h);
    if(alarm>0){alarm-=dt;const a=(Math.sin(t*14)*.5+.5)*.22*Math.min(1,alarm);c.fillStyle=`rgba(255,30,50,${a})`;c.fillRect(0,0,w,h)}}}}

function makeDubai(){let w,h,stars=[],far=[],near=[],yachts=[],fw=[];return{smoke:'#4a3a6a',
  resize(W,H){w=W;h=H;stars=Array.from({length:60},()=>({x:rnd(0,w),y:rnd(0,h*.55),r:rnd(.4,1.3),t:rnd(0,6)}));far=towers(w,12,26,.14,.36,h);near=towers(w,18,36,.1,.26,h);
    near.forEach(b=>{if(!b.neon&&Math.random()<.4)b.neon=Math.random()<.5?'#ff3ea5':'#29e6ff'});yachts=Array.from({length:3},(_,i)=>({x:w*(.2+i*.3),s:rnd(.8,1.15),v:rnd(-10,10),ph:rnd(0,6)}))},
  crash(){},reset(){fw=[]},
  draw(c,E){const{t,dt,sp,gy}=E,fly=E.phase==='fly',sea=gy-14;
    c.fillStyle=lg(c,0,0,0,h,['#090726','#2a0f55','#7a2a6e','#ff7a4a']);c.fillRect(-20,-20,w+40,h+40);
    c.fillStyle='#fff';for(const s of stars){c.globalAlpha=.3+.4*Math.abs(Math.sin(t+s.t));c.fillRect(s.x,(s.y+E.alt*.06)%h,s.r,s.r)}c.globalAlpha=1;
    if(fly&&Math.random()<.025*sp)fw.push({x:rnd(w*.1,w*.9),y:rnd(h*.1,h*.5),t:0,col:['#ffd23f','#ff3ea5','#29e6ff','#2bff88'][(Math.random()*4)|0]});
    c.save();c.globalCompositeOperation='lighter';for(let i=fw.length-1;i>=0;i--){const f=fw[i];f.t+=dt;if(f.t>1.3){fw.splice(i,1);continue}const R=f.t*70,a=1-f.t/1.3;c.fillStyle=f.col;c.globalAlpha=a;
      for(let j=0;j<18;j++){const an=j/18*6.283;c.fillRect(f.x+Math.cos(an)*R,f.y+Math.sin(an)*R+f.t*f.t*30,2,2)}}c.restore();
    const fb=sea-E.alt*.45;if(fb-h*.6<h){drawTowers(c,far,fb,'#22164f','#ffcf7a',.3,t);
      const bx=w*.6,bH=h*.58;c.fillStyle='#2a1a5e';for(let i=0;i<6;i++){const ww=(13-i*2)*(E.sc+.4),y0=fb-bH*(i/6),y1=fb-bH*((i+1)/6);c.fillRect(bx-ww,y1,ww*2,y0-y1+1)}
      c.fillRect(bx-1,fb-bH-h*.08,2,h*.08);c.fillStyle='rgba(255,217,160,.65)';for(let y=fb-6;y>fb-bH;y-=6)c.fillRect(bx-.6,y,1.2,3);
      c.fillStyle=Math.sin(t*2.5)>0?'#ff3b6b':'#401020';c.beginPath();c.arc(bx,fb-bH-h*.08,1.8,0,6.283);c.fill()}
    if(sea<h+h*.3){drawTowers(c,near,sea,'#130b30','#ffcf7a',.7,t);
      const hx=w*.12,hH=h*.2;c.fillStyle='#1b1140';c.beginPath();c.moveTo(hx,sea);c.lineTo(hx,sea-hH);c.quadraticCurveTo(hx+hH*.55,sea-hH*.55,hx+hH*.45,sea);c.closePath();c.fill();
      c.strokeStyle='#29e6ff';c.lineWidth=1.3;c.stroke();
      if(sea<h+40){c.fillStyle=lg(c,0,sea,0,h,['#2a1258','#05041a']);c.fillRect(0,sea,w,h-sea+40);
        for(let i=0;i<34;i++){const x=(i*73)%w,y=sea+4+(i*13)%Math.max(8,h-sea);c.fillStyle=['#ff3ea5','#29e6ff','#ffcf7a'][i%3];c.globalAlpha=.25+.15*Math.sin(t*3+i);c.fillRect(x+Math.sin(t*2+i)*4,y,10+(i%3)*4,1.2)}c.globalAlpha=1;
        for(const y of yachts){y.x+=y.v*dt;if(y.x<-40)y.x=w+40;if(y.x>w+40)y.x=-40;const yy=sea+6+Math.sin(t*1.5+y.ph)*1.5,s=y.s*(E.sc*.55+.2);c.save();c.translate(y.x,yy);c.scale(s*(y.v<0?-1:1),s);
          c.fillStyle='#f4f6fb';c.beginPath();c.moveTo(-22,-4);c.lineTo(24,-4);c.lineTo(16,3);c.lineTo(-18,3);c.closePath();c.fill();c.fillRect(-12,-9,22,5);c.fillRect(-6,-13,12,4);
          c.fillStyle='#1d2a4a';c.fillRect(-10,-8,18,2);c.fillStyle='#ffd76a';c.fillRect(-16,-2,2,1.5);c.fillRect(-8,-2,2,1.5);c.fillRect(0,-2,2,1.5);c.fillRect(8,-2,2,1.5);c.restore()}}}}}}

function makeLunar(){let w,h,L=[],craters=[];return{smoke:'#6a6a78',
  resize(W,H){w=W;h=H;L=starLayers(w,h);craters=Array.from({length:7},(_,i)=>({x:rnd(0,w),d:rnd(8,40),r:rnd(10,26)}))},crash(){},
  draw(c,E){const{t,gy}=E;c.fillStyle=lg(c,0,0,0,h,['#020208','#070818','#0d0d22']);c.fillRect(-20,-20,w+40,h+40);
    drawStars(c,L,E,w,h);
    // Earth over the horizon, closer as the multiplier climbs
    const k=Math.pow(clamp(Math.log(Math.max(1,E.moonM))/Math.log(40),0,1),.75),R=lerp(w*.07,w*.5,k),ex=lerp(w*.78,w*.66,k),ey=lerp(h*.2,h*.1+R*.4,k);
    const gl=c.createRadialGradient(ex,ey,R*.9,ex,ey,R*1.35);gl.addColorStop(0,'rgba(90,170,255,.35)');gl.addColorStop(1,'rgba(90,170,255,0)');c.fillStyle=gl;c.beginPath();c.arc(ex,ey,R*1.35,0,6.283);c.fill();
    const eg=c.createRadialGradient(ex-R*.3,ey-R*.3,R*.1,ex,ey,R);eg.addColorStop(0,'#6cc0ff');eg.addColorStop(.7,'#1f62c8');eg.addColorStop(1,'#0b2a6a');c.fillStyle=eg;c.beginPath();c.arc(ex,ey,R,0,6.283);c.fill();
    c.save();c.beginPath();c.arc(ex,ey,R,0,6.283);c.clip();c.fillStyle='#3e9a4a';[[-.3,-.1,.35,.22],[.25,.2,.28,.35],[.1,-.45,.2,.12]].forEach(([a,b,rx,ry])=>{c.beginPath();c.ellipse(ex+a*R,ey+b*R,rx*R,ry*R,.5,0,6.283);c.fill()});
      c.strokeStyle='rgba(255,255,255,.55)';c.lineWidth=R*.06;for(let i=0;i<3;i++){c.beginPath();c.arc(ex+R*(i*.3-.3),ey+R*(.1*i-.2),R*.5,.3+t*.02,1.4+t*.02);c.stroke()}
      const sh=c.createLinearGradient(ex-R,ey,ex+R,ey);sh.addColorStop(0,'rgba(0,0,10,0)');sh.addColorStop(.65,'rgba(0,0,10,.1)');sh.addColorStop(1,'rgba(0,0,10,.65)');c.fillStyle=sh;c.fillRect(ex-R,ey-R,R*2,R*2);c.restore();
    if(gy<h+60){c.fillStyle=lg(c,0,gy,0,h,['#b4b4bd','#6c6c78','#3a3a45']);c.beginPath();c.moveTo(-10,h+40);for(let x=-10;x<=w+10;x+=16)c.lineTo(x,gy+Math.sin(x*.03)*3+Math.sin(x*.011)*5);c.lineTo(w+10,h+40);c.fill();
      for(const q of craters){const y=gy+q.d;c.fillStyle='rgba(60,60,72,.55)';c.beginPath();c.ellipse(q.x,y,q.r,q.r*.28,0,0,6.283);c.fill();c.strokeStyle='rgba(230,230,240,.35)';c.lineWidth=1.2;c.beginPath();c.ellipse(q.x,y+1,q.r,q.r*.28,0,0,Math.PI);c.stroke()}
      const fx=w*.84,fy=gy+2;c.strokeStyle='#d8dce6';c.lineWidth=1.4;c.beginPath();c.moveTo(fx,fy);c.lineTo(fx,fy-34);c.stroke();c.fillStyle='#2bff88';c.fillRect(fx,fy-34,18,11);
      c.fillStyle='#0b3d22';poly(c,[[fx+9,fy-32],[fx+12,fy-28.5],[fx+9,fy-25],[fx+6,fy-28.5]]);c.fill();
      const lx=w*.1,ly=gy+4;c.strokeStyle='#c9a24a';c.lineWidth=1.2;c.beginPath();c.moveTo(lx-10,ly);c.lineTo(lx-5,ly-8);c.moveTo(lx+10,ly);c.lineTo(lx+5,ly-8);c.stroke();
      c.fillStyle='#d9b45a';c.fillRect(lx-7,ly-14,14,7);c.fillStyle='#c9cfdc';poly(c,[[lx-5,ly-14],[lx+5,ly-14],[lx+3,ly-21],[lx-3,ly-21]]);c.fill()}}}}

BGS.moon.make=makeLunar;
Object.assign(BGS.moon,{ru:'Поверхность Луны',en:'Lunar Surface'});
Object.assign(BGS.synth,{ru:'Закат',en:'Sunset'});
Object.assign(BGS.exch,{ru:'Терминал трейдера',en:'Trader Terminal'});
Object.assign(BGS,{
  space:{ru:'Базовый космос',en:'Deep Space',make:makeSpace},city:{ru:'Ночной город',en:'Night City',make:makeCity},clouds:{ru:'Плывущие облака',en:'Drifting Clouds',make:makeClouds},
  golf:{ru:'Гольф-клуб',en:'Golf Club',make:makeGolf},xp:{ru:'Заставка Windows XP',en:'XP Wallpaper',make:makeXP},
  vault:{ru:'Сейф швейцарского банка',en:'Swiss Bank Vault',make:makeVault},dubai:{ru:'Дубайская ночь',en:'Dubai Night',make:makeDubai}
});

/* =====================================================================
   Emotes: a sticker over the rider on cash-out (win) or crash (lose), some with effects on the whole scene.
   fx(S,x,y) gets the game scene; it may add particles, shake, a cracked screen.
   ===================================================================== */
function crackSegs(x,y,R){const a=[];for(let i=0;i<9;i++){let an=i/9*6.283+rnd(-.2,.2),px=x,py=y;const s=[[px,py]];for(let j=0;j<5;j++){const L=rnd(.12,.24)*R;an+=rnd(-.4,.4);px+=Math.cos(an)*L;py+=Math.sin(an)*L;s.push([px,py])}a.push(s)}return a}
window.drawCrack=(c,cr)=>{const a=clamp(1-cr.t/1.8,0,1);if(a<=0)return;c.save();c.strokeStyle=`rgba(255,255,255,${a*.85})`;c.lineWidth=1.4;c.beginPath();
  for(const s of cr.segs)s.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.strokeStyle=`rgba(255,255,255,${a*.4})`;c.beginPath();c.arc(cr.x,cr.y,cr.r*.12,0,6.283);c.stroke();c.restore()};
Object.assign(EMOTES.cheer,{ru:'Помахать',en:'Wave',e:'👋',when:'both'});
Object.assign(EMOTES.fireworks,{ru:'Салют из монет',en:'Coin Fireworks',e:'🎆',when:'win',fx(S){
  [[.25,.25],[.75,.2],[.5,.36]].forEach(([fx,fy],b)=>{for(let i=0;i<22;i++){const a=i/22*6.283,v=rnd(130,220);
    S.parts.push({x:W*fx,y:H*fy,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:1.2+b*.15,max:1.4,s:rnd(3,4.5)*S.sc,c:'#ffd23f',g:160,drag:1.3,shape:i%3?'coin':'usdt',norm:1})}});
  if(typeof AU!=='undefined'){AU.tone(1400,.25,'triangle',.12,700);AU.noise(.3,4000,.15,'highpass')}}});
Object.assign(EMOTES.money,{ru:'Make it Rain',en:'Make it Rain',e:'👑',cap:'MAKE IT RAIN',when:'win',fx(S){
  for(let i=0;i<40;i++)S.confetti.push({bill:1,x:rnd(0,AW),y:OY-rnd(10,320),vx:rnd(-30,30),vy:rnd(40,120),rot:rnd(0,6),vr:rnd(-4,4),w:16,h:8,life:rnd(2.6,3.4)});
  for(let i=0;i<18;i++)S.confetti.push({coin:1,x:rnd(0,AW),y:OY-rnd(10,260),vx:rnd(-30,30),vy:rnd(60,180),rot:rnd(0,6),vr:rnd(-6,6),w:rnd(7,10),h:0,life:rnd(2.2,3)})}});
Object.assign(EMOTES,{
  like:{ru:'Лайк',en:'Like',e:'👍',when:'win'},
  shrug:{ru:'Пожать плечами',en:'Shrug',e:'🤷',when:'both'},
  cry:{ru:'Плач',en:'Cry',e:'😭',when:'lose'},
  whiskey:{ru:'Тёмный биттер',en:'On the Rocks',e:'🥃',when:'win'},
  facepalm:{ru:'Facepalm',en:'Facepalm',e:'🤦',when:'lose'},
  fine:{ru:'This is fine',en:'This is fine',e:'🔥',cap:'THIS IS FINE',when:'lose',fx(S,x,y){const k=S.sc;
    for(let i=0;i<34;i++)S.parts.push({x:x+rnd(-40,40)*k,y:y+rnd(-6,14)*k,vx:rnd(-20,20),vy:rnd(-170,-60),life:rnd(.8,1.7),max:1.7,s:rnd(3,7)*k,c:['#ffd23f','#ff9f1c','#ff5a1a'][i%3],shrink:1,drag:.6})}},
  rekt:{ru:'Rekt',en:'Rekt',e:'👊',cap:'REKT',when:'lose',fx(S,x,y){S.shake=Math.max(S.shake,1.6);S.crack={t:0,x,y,r:Math.max(W,H),segs:crackSegs(x,y,Math.max(W,H))};
    if(typeof flashVig==='function')flashVig('rgba(255,30,60,.9)');if(typeof AU!=='undefined')AU.noise(.5,300,.5,'lowpass')}}
});
const EMOTE_ORDER=['cheer','like','shrug','cry','whiskey','facepalm','fine','fireworks','rekt','money'];
// the sticker at (0,0) in scene units; q runs 0..1 over its life, t is time
function drawEmote(c,id,q,t){const E=EMOTES[id];if(!E||!E.e)return;
  const pin=Math.min(1,q/.12),out=q>.85?(1-q)/.15:1,s=easeBack(pin);if(s<=0)return;
  c.save();c.globalAlpha=clamp(out,0,1);c.scale(s,s);
  c.fillStyle='rgba(255,255,255,.96)';c.beginPath();c.arc(0,0,19,0,6.283);c.fill();poly(c,[[-5,16],[2,27],[6,15]]);c.fill();
  c.strokeStyle=id==='money'?'#ffd23f':id==='rekt'?'#ff3e5f':'rgba(26,6,51,.25)';c.lineWidth=2;c.beginPath();c.arc(0,0,19,0,6.283);c.stroke();
  c.save();const k=t*1;
  if(id==='cheer'){c.translate(2,8);c.rotate(Math.sin(k*12)*.35);c.translate(-2,-8)}
  else if(id==='like'){const b=1+.14*Math.abs(Math.sin(k*6));c.scale(b,b)}
  else if(id==='shrug')c.translate(0,-Math.abs(Math.sin(k*5))*2.5);
  else if(id==='whiskey')c.rotate(-.2+Math.sin(k*3)*.25);
  else if(id==='facepalm'&&q<.5)c.translate(Math.sin(k*40)*1.2,0);
  else if(id==='fine'){const b=1+.06*Math.sin(k*20);c.scale(b,b)}
  else if(id==='rekt'){const b=q<.12?2.4-q/.12*1.4:1;c.scale(b,b);c.rotate(.15)}
  else if(id==='money')c.translate(0,Math.sin(k*4)*2);
  c.font=`24px ${EMOJI}`;c.textAlign='center';c.textBaseline='middle';c.fillStyle='#000';c.fillText(E.e,0,1.5);c.restore();
  if(id==='cry'){c.fillStyle='#4ab8ff';for(let i=0;i<2;i++){const yy=((t*1.4+i*.5)%1)*16;[-7,7].forEach(x=>{c.beginPath();c.arc(x,4+yy,1.8,0,6.283);c.fill()})}}
  if(id==='money'){c.fillStyle='#ffd23f';for(let i=0;i<3;i++){const a=t*3+i*2.1;c.beginPath();c.arc(Math.cos(a)*24,Math.sin(a)*10-14,1.4,0,6.283);c.fill()}}
  if(E.cap){c.font='800 7px Unbounded,sans-serif';const tw=c.measureText(E.cap).width+10;c.fillStyle=id==='rekt'?'#ff3e5f':'#1a0633';rr(c,-tw/2,22,tw,12,6);c.fill();
    c.fillStyle=id==='rekt'?'#ffffff':'#ffd23f';c.textAlign='center';c.textBaseline='middle';c.fillText(E.cap,0,28.5)}
  c.restore()}
window.drawEmote=drawEmote;
// hangar previews: scene-wide effects over w×h plus the sticker at (x,y) scaled by s
const PCR={};
window.emotePreview=(c,id,w,h,t,x,y,s)=>{const q=(t%2.6)/2.6;
  if(id==='fireworks'){[[.22,.3,0],[.78,.24,.4],[.55,.55,.8]].forEach(([fx,fy,o])=>{const p=((t*.6+o)%1),R=8+p*34*Math.min(w,h)/200;c.globalAlpha=1-p;
    for(let i=0;i<10;i++){const a=i/10*6.283;PSHAPE[i%3?'coin':'usdt'](c,{x:w*fx+Math.cos(a)*R,y:h*fy+Math.sin(a)*R+p*p*10,life:t+i,s:i},Math.max(2.6,Math.min(w,h)/40))}});c.globalAlpha=1}
  else if(id==='money'){for(let i=0;i<9;i++){const bx=((i*53)%100)/100*w,by=((t*45+i*37)%(h+30))-15;c.save();c.translate(bx,by);c.rotate(Math.sin(t*2+i)*.8);c.scale(1,Math.abs(Math.cos(t*3+i))*.8+.2);bill(c,14,7);c.restore()}}
  else if(id==='rekt'){const key=w+'x'+h;if(!PCR[key])PCR[key]={t:.4,x:x,y:y,r:Math.max(w,h)*.8,segs:crackSegs(x,y,Math.max(w,h)*.8)};drawCrack(c,PCR[key])}
  else if(id==='fine'){c.save();c.globalCompositeOperation='lighter';for(let i=0;i<14;i++){const p=((t*.8+i*.13)%1),fx=((i*41)%100)/100*w;c.globalAlpha=(1-p)*.8;c.fillStyle=['#ffd23f','#ff9f1c','#ff5a1a'][i%3];
    c.beginPath();c.arc(fx,h-p*h*.45,(1-p)*5+1,0,6.283);c.fill()}c.restore()}
  c.save();c.translate(x,y);c.scale(s,s);drawEmote(c,id,q*.85+.08,t);c.restore()};
window.EMOTE_ORDER=EMOTE_ORDER;
})();
