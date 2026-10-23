/* Boomy scene, second generation (prototype): the loading screen's picture in motion.
   Layers, back to front, each moved by the camera with its own parallax: sky, nebula, stars, planets, the striped sun,
   mountains, clouds, the neon floor with the launch pad; then the smoke trail, the rocket with its flame and the bear,
   and the effects (explosion, parachute, sparkles). Everything static is painted once per size into offscreen
   canvases; a frame only copies and transforms them, so it stays light on phones.
   Motion is smooth by design: wobble and shake come from sums of sines, never from per-frame random jitter.
   API: const s=Scene2.create(canvas); s.resize(w,h,dpr); s.wait(); s.launch(); s.cashout(); s.crash(); s.frame(dt,t,m). */
(()=>{
const TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t);
const easeOut=t=>1-Math.pow(1-t,3),easeBack=t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
const wob=(t,s)=>Math.sin(t*1.7+s)*.5+Math.sin(t*2.9+s*1.3)*.3+Math.sin(t*4.3+s*2.1)*.2;      // smooth noise in -1..1
function rng(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rnd=(a,b)=>a+Math.random()*(b-a);
function canvas(w,h){const c=document.createElement('canvas');c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(h));return c}

/* ---------------- sprites painted once ---------------- */
// soft round glow, white: tinted by drawing it with a colour through 'source-atop' once per colour
function glowSprite(col,n=128){const c=canvas(n,n),g=c.getContext('2d'),r=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);
  r.addColorStop(0,col);r.addColorStop(.35,col.replace(/[\d.]+\)$/,'.45)'));r.addColorStop(1,col.replace(/[\d.]+\)$/,'0)'));g.fillStyle=r;g.fillRect(0,0,n,n);return c}
// a cloud puff: a few overlapping balls lit from the top right, shaded at the bottom
function puffSprite(cols,seed,n=160){const c=canvas(n,n),g=c.getContext('2d'),R=rng(seed),[lt,mid,dk]=cols;
  const balls=[[.5,.56,.3]];for(let i=0;i<5;i++)balls.push([.5+(R()-.5)*.42,.52+(R()-.5)*.3,.16+R()*.12]);
  for(const [x,y,r] of balls){const X=x*n,Y=y*n,Rr=r*n,gr=g.createRadialGradient(X+Rr*.35,Y-Rr*.45,Rr*.1,X,Y,Rr);
    gr.addColorStop(0,lt);gr.addColorStop(.55,mid);gr.addColorStop(1,dk);g.fillStyle=gr;g.beginPath();g.arc(X,Y,Rr,0,TAU);g.fill()}
  // feather the edge so puffs melt into each other
  g.globalCompositeOperation='destination-in';const f=g.createRadialGradient(n/2,n/2,n*.2,n/2,n/2,n*.5);f.addColorStop(0,'#000');f.addColorStop(.75,'rgba(0,0,0,.85)');f.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=f;g.fillRect(0,0,n,n);return c}
// four-point sparkle
function sparkSprite(n=64){const c=canvas(n,n),g=c.getContext('2d'),h=n/2;g.translate(h,h);
  const gl=g.createRadialGradient(0,0,0,0,0,h*.55);gl.addColorStop(0,'rgba(255,255,255,.9)');gl.addColorStop(1,'rgba(255,220,255,0)');g.fillStyle=gl;g.beginPath();g.arc(0,0,h*.55,0,TAU);g.fill();
  g.fillStyle='#fff';for(let i=0;i<2;i++){g.rotate(i*Math.PI/2);g.beginPath();g.moveTo(-h,0);g.quadraticCurveTo(0,-h*.07,h,0);g.quadraticCurveTo(0,h*.07,-h,0);g.fill()}return c}

/* ---------------- the rocket, nose along +x (units; the seat is on top, near the nose band) ---------------- */
const RK={tail:-66,seat:[8,-15.5],len:142},BS=1.2;   // BS: the bear is drawn 1.2x the rocket units (its head wider than the rocket, as on the poster)
function rocketPath(g){g.beginPath();g.moveTo(-54,-12.5);g.lineTo(-47,-15.6);g.lineTo(22,-16);g.bezierCurveTo(27,-16,29,-15.8,31,-15.2);
  g.bezierCurveTo(52,-12.5,66,-6,77,0);g.bezierCurveTo(66,6,52,12.5,31,15.2);g.bezierCurveTo(29,15.8,27,16,22,16);g.lineTo(-47,15.6);g.lineTo(-54,12.5);g.closePath()}
function chrome(g,y0,y1,stops){const gr=g.createLinearGradient(0,y0,0,y1);stops.forEach(([o,c])=>gr.addColorStop(o,c));return gr}
function drawRocket(g){
  const OUT='#06251a';g.lineJoin='round';g.lineCap='round';
  // back fin (behind the body): a broad swept fin, rounded at the tip
  const fin=(s)=>{g.beginPath();g.moveTo(-18,15*s);g.bezierCurveTo(-30,18*s,-46,26*s,-56,33*s);g.bezierCurveTo(-60,35.5*s,-65,35*s,-66,31*s);
    g.bezierCurveTo(-66.5,26*s,-62,18*s,-56,13*s);g.closePath()};
  fin(-1);g.fillStyle=chrome(g,-36,-14,[[0,'#1fbf78'],[.45,'#0d7349'],[1,'#063823']]);g.fill();g.strokeStyle=OUT;g.lineWidth=1.2;g.stroke();
  // nozzle: dark gunmetal, a lit lip
  g.beginPath();g.moveTo(-53,-10);g.bezierCurveTo(-57,-10,-60,-10.6,-63.5,-11.4);g.quadraticCurveTo(-65.5,0,-63.5,11.4);g.bezierCurveTo(-60,10.6,-57,10,-53,10);g.closePath();
  g.fillStyle=chrome(g,-11.4,11.4,[[0,'#1c1d2c'],[.25,'#8f93ad'],[.45,'#41435a'],[.85,'#15161f'],[1,'#ff6fb5']]);g.fill();g.strokeStyle=OUT;g.lineWidth=1.1;g.stroke();
  // body and nose: chrome green, dark rim on top, a bright band, a pink-orange rim light on the underside (the sun)
  rocketPath(g);g.fillStyle=chrome(g,-16,16,[[0,'#06331f'],[.07,'#1a9c5e'],[.2,'#b8ffe0'],[.3,'#4fe79a'],[.52,'#14a35f'],[.76,'#0a6a3f'],[.9,'#063d25'],[.96,'#c0447a'],[1,'#ff8a6a']]);g.fill();
  // the nose cone a touch brighter, darkening to the tip
  g.save();rocketPath(g);g.clip();g.fillStyle='rgba(180,255,220,.08)';g.fillRect(31,-16,46,32);
  const tip=g.createLinearGradient(31,0,77,0);tip.addColorStop(0,'rgba(0,0,0,0)');tip.addColorStop(1,'rgba(0,30,18,.35)');g.fillStyle=tip;g.fillRect(31,-16,46,32);
  // bands: behind the nose and near the tail
  for(const [x,w] of [[24,7],[-47,6]]){g.fillStyle=chrome(g,-16,16,[[0,'#04140d'],[.2,'#3c6e5c'],[.32,'#a9d8c4'],[.5,'#1c3f33'],[.9,'#071a12'],[1,'#7a2a55']]);g.fillRect(x,-17,w,34)}
  // specular streak along the top
  const sp=g.createLinearGradient(-44,0,70,0);sp.addColorStop(0,'rgba(255,255,255,0)');sp.addColorStop(.25,'rgba(255,255,255,.75)');sp.addColorStop(.8,'rgba(255,255,255,.55)');sp.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=sp;g.beginPath();g.moveTo(-42,-11.2);g.bezierCurveTo(0,-12.6,40,-11.6,66,-5);g.bezierCurveTo(40,-9.4,0,-10.2,-42,-9.8);g.closePath();g.fill();
  g.restore();
  rocketPath(g);g.strokeStyle=OUT;g.lineWidth=1.3;g.stroke();
  // the neon zig-zag along the body (the chart line of the game), with its glow
  g.save();g.shadowColor='#2bff88';g.shadowBlur=7;g.strokeStyle='#c8ffe4';g.lineWidth=1.7;g.beginPath();
  [[-40,5],[-29,1],[-22,6.5],[-10,-1],[0,4.5],[10,-2.5],[19,1.5]].forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();g.restore();
  // front fin (over the body), with a lit leading edge, and the side fin pointing at us
  fin(1);g.fillStyle=chrome(g,12,36,[[0,'#45f2a6'],[.4,'#15985d'],[1,'#063a24']]);g.fill();g.strokeStyle=OUT;g.lineWidth=1.2;g.stroke();
  g.strokeStyle='rgba(200,255,230,.75)';g.lineWidth=1;g.beginPath();g.moveTo(-20,16.5);g.bezierCurveTo(-31,19.5,-46,27,-55,33.5);g.stroke();
  g.beginPath();g.moveTo(-46,-2);g.bezierCurveTo(-52,-1,-60,1,-63,3);g.bezierCurveTo(-60,6,-52,6.5,-44,5);g.closePath();
  g.fillStyle=chrome(g,-2,6,[[0,'#2bd185'],[1,'#07462c']]);g.fill();g.strokeStyle=OUT;g.lineWidth=1.1;g.stroke();
}

/* ---------------- the bear: chunky soft parts, round joints, one outline colour; poses blend ---------------- */
const B={fur:'#8f5a2a',furD:'#5a3314',furL:'#d0924f',muz:'#f4cd98',muzD:'#cf955c',ol:'#23100a',jk:'#1f7a4c',jkD:'#0f4429',jkL:'#4cc788',
  collar:'#f3dcb0',collarD:'#c9a873',pants:'#143f2d',pantsL:'#2a6a4c',boot:'#1f1b33',bootL:'#4a4468'};
const HANDS={F:[25,-52],B:[-14,-52]};            // where the parachute straps meet the paws
// joints: [elbow/knee x,y, paw/foot x,y]; lean (rad) and head tilt. The raised fist goes up beside the head, never over the face.
const POSES={
  grip:  {aF:[17,-11,25,-5],aB:[-6,-9,3,-3],lF:[14,0,12,12],lB:[10,-1,7,10],lean:0,tilt:0},
  cheer: {aF:[25,-24,29,-42],aB:[-6,-9,3,-3],lF:[14,0,12,12],lB:[10,-1,7,10],lean:.04,tilt:.05},
  scared:{aF:[15,-8,24,-3],aB:[-3,-6,8,-2],lF:[13,1,11,13],lB:[9,0,6,11],lean:-.16,tilt:-.12},
  hang:  {aF:[28,-31,HANDS.F[0],HANDS.F[1]],aB:[-20,-33,HANDS.B[0],HANDS.B[1]],lF:[7,12,8,24],lB:[-1,12,-2,24],lean:0,tilt:0},
  fall:  {aF:[20,-24,28,-32],aB:[-12,-22,-18,-30],lF:[12,8,20,14],lB:[-4,8,-12,16],lean:0,tilt:0}};
function makeBear(){
  const P=JSON.parse(JSON.stringify(POSES.grip)),face={grin:0,scare:0,win:0};let glint=-1;
  function blend(T,k){for(const key of ['aF','aB','lF','lB'])for(let i=0;i<4;i++)P[key][i]+=(T[key][i]-P[key][i])*k;P.lean+=(T.lean-P.lean)*k;P.tilt+=(T.tilt-P.tilt)*k}
  // a limb: outline stroke under a colour stroke, so every joint is round and nothing gapes
  function limb(g,a,b,c,w,col,light){g.lineCap='round';g.lineJoin='round';g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.lineTo(c[0],c[1]);
    g.strokeStyle=B.ol;g.lineWidth=w+3.2;g.stroke();g.strokeStyle=col;g.lineWidth=w;g.stroke();
    if(light){g.strokeStyle=light;g.lineWidth=w*.32;g.beginPath();g.moveTo(a[0]-w*.18,a[1]-w*.18);g.lineTo(b[0]-w*.18,b[1]-w*.18);g.lineTo(c[0]-w*.18,c[1]-w*.18);g.stroke()}}
  function paw(g,x,y,r){const gr=g.createRadialGradient(x-r*.35,y-r*.4,r*.15,x,y,r);gr.addColorStop(0,B.furL);gr.addColorStop(1,B.fur);
    g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill();g.strokeStyle=B.ol;g.lineWidth=1.6;g.stroke()}
  function boot(g,x,y,a){g.save();g.translate(x,y);g.rotate(a);g.scale(1.25,1.25);g.beginPath();g.moveTo(-3.6,-3.4);g.bezierCurveTo(-4,2.4,-2.2,3.6,1.6,3.6);g.lineTo(6.6,3.6);
    g.bezierCurveTo(9,3.6,9.2,.2,6.6,-.6);g.bezierCurveTo(4,-1.4,2.6,-3,2.4,-4.6);g.closePath();g.fillStyle=B.boot;g.fill();g.strokeStyle=B.ol;g.lineWidth=1.3;g.stroke();
    g.fillStyle=B.bootL;g.beginPath();g.moveTo(-3.4,2.2);g.lineTo(7.6,2.2);g.quadraticCurveTo(8.4,3.4,6.6,3.6);g.lineTo(-2,3.6);g.closePath();g.fill();g.restore()}
  const hipF=[4,-2],hipB=[-1,-2],shF=[9,-19],shB=[-4,-19];
  const api={
    /** state: 'grip'|'cheer'|'scared'|'hang'|'fall'; mood: 'calm'|'hype'|'scared'|'win' */
    update(dt,t,state,mood){const T=JSON.parse(JSON.stringify(POSES[state]||POSES.grip)),k=1-Math.exp(-dt*10);
      if(state==='cheer'){const p=Math.sin(t*9);T.aF[3]+=p*2.6;T.aF[2]+=p*.6;T.aF[1]+=p*1.4}
      if(state==='hang'){const s=Math.sin(t*2.4);T.lF[2]+=s*2.2;T.lB[2]-=s*2.2;T.lF[0]+=s;T.lB[0]-=s}
      if(state==='fall')for(const key of ['aF','aB','lF','lB'])for(let i=0;i<4;i++)T[key][i]+=Math.sin(t*(13+i*2)+key.charCodeAt(1)+i)*3.4;
      blend(T,k);
      const fk=1-Math.exp(-dt*8);face.grin+=((mood==='hype'||mood==='win'?1:0)-face.grin)*fk;face.scare+=((mood==='scared'?1:0)-face.scare)*fk;face.win+=((mood==='win'?1:0)-face.win)*fk;
      if(glint<0&&Math.random()<dt*.35)glint=0;if(glint>=0){glint+=dt*1.6;if(glint>1)glint=-1}},
    /** behind the rocket: the far leg */
    back(g){g.save();g.rotate(P.lean);limb(g,hipB,P.lB.slice(0,2),P.lB.slice(2),8.2,'#0e3123');boot(g,P.lB[2],P.lB[3],.15);g.restore()},
    /** in front of the rocket: far arm, body, near leg, head, near arm */
    front(g,t){g.save();g.rotate(P.lean);
      limb(g,shB,P.aB.slice(0,2),P.aB.slice(2),7,B.jkD);paw(g,P.aB[2],P.aB[3],4.2);
      // bomber jacket: a padded body, a darker ribbed hem, the fur collar
      const body=()=>{g.beginPath();g.moveTo(-11,1);g.bezierCurveTo(-13.5,-9,-12.5,-18,-8,-23);g.quadraticCurveTo(1,-28,11,-23);g.bezierCurveTo(14.5,-17,14.5,-7,12.5,1);g.quadraticCurveTo(.5,5.5,-11,1);g.closePath()};
      body();const jg=g.createLinearGradient(-8,-26,12,4);jg.addColorStop(0,B.jkL);jg.addColorStop(.5,B.jk);jg.addColorStop(1,B.jkD);g.fillStyle=jg;g.fill();
      g.save();body();g.clip();g.fillStyle=B.jkD;g.fillRect(-16,-2.5,32,8);g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=.7;g.beginPath();for(let x=-12;x<14;x+=2.2){g.moveTo(x,-2.5);g.lineTo(x,5)}g.stroke();
      g.fillStyle='rgba(255,255,255,.08)';g.beginPath();g.ellipse(-5,-14,5,7,.3,0,TAU);g.fill();g.restore();
      body();g.strokeStyle=B.ol;g.lineWidth=1.7;g.stroke();
      g.strokeStyle='rgba(6,34,20,.75)';g.lineWidth=1.1;g.beginPath();g.moveTo(5.5,-21);g.quadraticCurveTo(7,-10,5.5,-1);g.stroke();
      g.fillStyle='#ffd23f';g.beginPath();g.arc(-5,-12,1.8,0,TAU);g.fill();g.strokeStyle=B.ol;g.lineWidth=.8;g.stroke();
      limb(g,hipF,P.lF.slice(0,2),P.lF.slice(2),8.6,B.pants,B.pantsL);boot(g,P.lF[2],P.lF[3],.1);
      g.beginPath();g.moveTo(-9,-21.5);g.quadraticCurveTo(1,-16,12,-21.5);g.quadraticCurveTo(13,-26.5,1,-27.5);g.quadraticCurveTo(-10,-26.5,-9,-21.5);g.closePath();
      const cg=g.createLinearGradient(0,-28,0,-17);cg.addColorStop(0,B.collar);cg.addColorStop(1,B.collarD);g.fillStyle=cg;g.fill();g.strokeStyle=B.ol;g.lineWidth=1.4;g.stroke();
      api.head(g,t);
      limb(g,shF,P.aF.slice(0,2),P.aF.slice(2),7.4,B.jk,'rgba(255,255,255,.16)');paw(g,P.aF[2],P.aF[3],4.6);
      g.restore()},
    head(g,t){g.save();g.translate(5,-40+Math.sin(t*9)*.35);g.rotate(P.tilt);g.scale(1.14,1.14);
      for(const [x,y] of [[-9.5,-10],[9.5,-11.5]]){g.fillStyle=B.fur;g.beginPath();g.arc(x,y,5.2,0,TAU);g.fill();g.strokeStyle=B.ol;g.lineWidth=1.5;g.stroke();
        g.fillStyle='#e0a274';g.beginPath();g.arc(x+.4,y+.4,2.6,0,TAU);g.fill()}
      const hg=g.createRadialGradient(4,-6,2,0,0,15);hg.addColorStop(0,B.furL);hg.addColorStop(.55,B.fur);hg.addColorStop(1,B.furD);
      g.fillStyle=hg;g.beginPath();g.arc(0,0,12.8,0,TAU);g.fill();g.strokeStyle=B.ol;g.lineWidth=1.6;g.stroke();
      const mg=g.createLinearGradient(0,0,0,11);mg.addColorStop(0,B.muz);mg.addColorStop(1,B.muzD);g.fillStyle=mg;g.beginPath();g.ellipse(6,5.6,7.6,5.9,-.08,0,TAU);g.fill();g.strokeStyle=B.ol;g.lineWidth=1.15;g.stroke();
      g.fillStyle='#2a140c';g.beginPath();g.ellipse(11.4,2.6,3.2,2.4,-.1,0,TAU);g.fill();g.fillStyle='rgba(255,255,255,.65)';g.beginPath();g.ellipse(12.2,1.7,1,.6,-.3,0,TAU);g.fill();
      const gr=face.grin,sc=face.scare;
      if(sc>.5){g.fillStyle='#4d0f1c';g.beginPath();g.ellipse(7,8.6,2.1+sc*.4,2.6+sc*.6+Math.sin(t*30)*.3,0,0,TAU);g.fill()}
      else if(gr<.25){g.strokeStyle=B.ol;g.lineWidth=1.3;g.beginPath();g.moveTo(3.4,7.2);g.quadraticCurveTo(7,10,10.6,7);g.stroke()}
      else{const d=2.4+gr*2.6+face.win*1.2;g.beginPath();g.moveTo(2.6,7);g.quadraticCurveTo(7,8,11.4,6.6);g.bezierCurveTo(11,7.5+d,3,8+d,2.6,7);g.closePath();
        g.fillStyle='#4d0f1c';g.fill();g.save();g.clip();g.fillStyle='#fff';g.fillRect(2,5.8,10,2.2);g.fillStyle='#ff7a93';g.beginPath();g.ellipse(7.2,8+d,3.4,2.2,0,0,TAU);g.fill();g.restore();
        g.strokeStyle=B.ol;g.lineWidth=1.2;g.stroke()}
      if(gr>.3||sc>.3){g.strokeStyle=B.ol;g.lineWidth=1.3;const lift=sc>.3?-2.2:-1.2*gr,knit=sc>.3?.8:0;
        g.beginPath();g.moveTo(-3.5,-7.6+lift);g.quadraticCurveTo(-1,-8.8+lift+knit,1.5,-8+lift);g.moveTo(5.5,-8.2+lift);g.quadraticCurveTo(8.5,-9.4+lift+knit,11.5,-8.4+lift);g.stroke()}
      const lens=(x,y,rx,ry)=>{g.beginPath();g.ellipse(x,y,rx,ry,-.05,0,TAU)};
      g.strokeStyle=B.ol;g.lineWidth=1.4;g.beginPath();g.moveTo(-9,-3.6);g.lineTo(-3,-3.4);g.moveTo(3,-3.6);g.lineTo(4.4,-3.8);g.stroke();
      for(const [x,y,rx,ry] of [[-.6,-3,4.4,3.5],[8.6,-3.3,5.2,3.9]]){const lg=g.createLinearGradient(x-rx,y-ry,x+rx,y+ry);lg.addColorStop(0,'#253660');lg.addColorStop(.5,'#0b1022');lg.addColorStop(1,'#05070f');
        lens(x,y,rx,ry);g.fillStyle=lg;g.fill();g.strokeStyle='#2bff88';g.lineWidth=1;g.stroke();
        g.save();lens(x,y,rx,ry);g.clip();g.fillStyle='rgba(120,255,190,.35)';g.beginPath();g.moveTo(x-rx,y+ry*.2);g.lineTo(x+rx*.2,y-ry);g.lineTo(x+rx*.6,y-ry);g.lineTo(x-rx*.6,y+ry);g.fill();
        if(glint>=0){const gx=lerp(x-rx*1.6,x+rx*1.6,glint);g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.moveTo(gx-1,y+ry);g.lineTo(gx+1.2,y-ry);g.lineTo(gx+2.6,y-ry);g.lineTo(gx+.4,y+ry);g.fill()}
        g.restore()}
      if(sc>.5){const k=(t*1.3)%1;g.globalAlpha=1-k;g.fillStyle='#9fe0ff';g.beginPath();g.moveTo(-11,-6+k*8);g.quadraticCurveTo(-13.4,-1+k*8,-11,0+k*8);g.quadraticCurveTo(-8.6,-1+k*8,-11,-6+k*8);g.fill();g.globalAlpha=1}
      if(face.win>.4){g.globalAlpha=face.win;for(let i=0;i<3;i++){const q=(t*1.3+i/3)%1,x=[-15,17,1][i],y=[-14,-16,-23][i]-q*6,s=(1-Math.abs(q*2-1))*3.4;
        g.fillStyle=['#ffd23f','#2bff88','#29e6ff'][i];g.beginPath();g.moveTo(x,y-s);g.quadraticCurveTo(x,y,x+s,y);g.quadraticCurveTo(x,y,x,y+s);g.quadraticCurveTo(x,y,x-s,y);g.quadraticCurveTo(x,y,x,y-s);g.fill()}g.globalAlpha=1}
      g.restore()}};
  return api}

/* ---------------- parachute: a striped dome (gores from the crown to a scalloped hem), its lines end in the paws ---------------- */
function drawCanopy(g,open,t){const o=easeBack(clamp(open,0,1));if(o<=.01)return;const R=44*o,Hh=30*o,cx=5,cy=-96,n=7,w=2*R/n;
  const cols=['#ff3ea5','#ffd23f','#29e6ff','#ff3ea5','#ffd23f','#29e6ff','#ff3ea5'];
  g.strokeStyle='rgba(255,255,255,.7)';g.lineWidth=.9;g.beginPath();            // lines behind the dome
  for(const [x,h] of [[-R,HANDS.B],[-R+w*2,HANDS.B],[R-w*2,HANDS.F],[R,HANDS.F]]){g.moveTo(cx+x,cy);g.lineTo(h[0],h[1])}g.stroke();
  g.save();g.translate(cx,cy);
  const gore=(xa,xb)=>{g.beginPath();g.moveTo(0,-Hh);g.quadraticCurveTo(xa,-Hh,xa,0);g.quadraticCurveTo((xa+xb)/2,5*o,xb,0);g.quadraticCurveTo(xb,-Hh,0,-Hh);g.closePath()};
  for(let i=0;i<n;i++){const xa=-R+i*w,xb=xa+w;gore(xa,xb);const gr=g.createLinearGradient(0,-Hh,0,5*o);
    gr.addColorStop(0,cols[i]);gr.addColorStop(.7,cols[i]);gr.addColorStop(1,'rgba(60,14,80,1)');g.fillStyle=gr;g.fill();g.strokeStyle='rgba(30,10,40,.45)';g.lineWidth=.8;g.stroke()}
  // the outline: the outer seams and the scalloped hem
  g.strokeStyle='#1e0c2c';g.lineWidth=1.4;g.beginPath();g.moveTo(-R,0);g.quadraticCurveTo(-R,-Hh,0,-Hh);g.quadraticCurveTo(R,-Hh,R,0);
  for(let i=n-1;i>=0;i--){const xa=-R+i*w;g.quadraticCurveTo(xa+w/2,5*o,xa,0)}g.stroke();
  const hl=g.createRadialGradient(-R*.3,-Hh*.65,0,-R*.3,-Hh*.65,R*.55);hl.addColorStop(0,'rgba(255,255,255,.45)');hl.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=hl;g.beginPath();g.moveTo(-R,0);g.quadraticCurveTo(-R,-Hh,0,-Hh);g.quadraticCurveTo(R,-Hh,R,0);g.closePath();g.fill();
  g.restore()}

/* ---------------- the scene ---------------- */
function create(cv){
  const ctx=cv.getContext('2d');
  let W=1,H=1,DPR=1,k=1,yH=1;                    // stage size, its scale (1 = a 390 px wide phone), the horizon at rest
  const L={};                                    // painted layers
  const glow={},puff={};let spark=null;
  const st={phase:'wait',t:0,m:1,alt:0,camX:0,dAlt:0,dCamX:0,sp:0,shake:0,stall:0,launchT:0,crashT:0,drop:0,rider:true,ridePose:'grip',
    rk:{x:0,y:0,ang:-1,vis:true},smoke:[],fire:[],sparks:[],debris:[],rings:[],bursts:[],jumper:null,tumble:null,shoot:[],flash:0};
  const bear=makeBear(),jbear=makeBear();
  let rocketCv=null,rocketRed=null;

  function paintStatic(){
    const R=rng(7);
    // nebula: soft colour clouds, a little taller than the stage, repeated as we climb
    const nh=Math.round(H*1.6);L.neb=canvas(W*DPR,nh*DPR);{const g=L.neb.getContext('2d');g.scale(DPR,DPR);g.globalCompositeOperation='lighter';
      const cols=['rgba(140,60,220,','rgba(220,60,170,','rgba(70,80,220,','rgba(255,90,150,'];
      for(let i=0;i<16;i++){const x=R()*W,y=R()*nh,r=(.25+R()*.45)*W,c=cols[i%4],gr=g.createRadialGradient(x,y,0,x,y,r);
        gr.addColorStop(0,c+(.13+R()*.1)+')');gr.addColorStop(1,c+'0)');g.fillStyle=gr;for(const dy of [-nh,0,nh]){g.beginPath();g.arc(x,y+dy,r,0,TAU);g.fill()}}}
    // stars, three depths
    L.stars=[];for(let l=0;l<3;l++){const n=[120,60,22][l];for(let i=0;i<n;i++)L.stars.push({l,x:R()*W,y:R()*nh,s:[.7,1.1,1.6][l]*(.7+R()*.6),ph:R()*TAU,f:.6+R()*2.2})}
    L.sparkles=[];for(let i=0;i<11;i++)L.sparkles.push({x:R()*W,y:R()*nh,s:(7+R()*9)*k,ph:R()*TAU});
    // planets
    L.pBig=planet(W*.27,['#3a1d6e','#1a0c3a','#0b0620'],'rgba(190,130,255,',.75,-.6,3);
    L.pSmall=planet(W*.075,['#4a1a52','#22092e','#0c0418'],'rgba(255,95,168,',1.1,2.4,9);
    // the sun with its glow; stripes are cut live
    const sr=Math.min(W*.36,H*.29);L.sunR=sr;L.sunBase=canvas(sr*2*DPR,sr*2*DPR);{const g=L.sunBase.getContext('2d');g.scale(DPR,DPR);
      const gr=g.createLinearGradient(0,0,0,sr*2);gr.addColorStop(0,'#ffe68a');gr.addColorStop(.38,'#ffb347');gr.addColorStop(.66,'#ff6a5c');gr.addColorStop(1,'#ff2f8f');
      g.fillStyle=gr;g.beginPath();g.arc(sr,sr,sr,0,TAU);g.fill()}
    L.sunCv=canvas(sr*2*DPR,sr*2*DPR);
    L.sunGlow=canvas(sr*4*DPR,sr*4*DPR);{const g=L.sunGlow.getContext('2d');g.scale(DPR,DPR);const gr=g.createRadialGradient(sr*2,sr*2,sr*.8,sr*2,sr*2,sr*2);
      gr.addColorStop(0,'rgba(255,120,120,.55)');gr.addColorStop(.4,'rgba(255,62,165,.18)');gr.addColorStop(1,'rgba(255,62,165,0)');g.fillStyle=gr;g.fillRect(0,0,sr*4,sr*4)}
    // mountains: two ridges with a lit crest
    const mw=W*1.6,mh=H*.2;L.mtn=canvas(mw*DPR,mh*DPR);{const g=L.mtn.getContext('2d');g.scale(DPR,DPR);
      const ridge=(base,amp,seed,fill,rim)=>{const pts=[];for(let x=0;x<=mw;x+=mw/40){const n=Math.abs(Math.sin(x*.011+seed))*.6+Math.abs(Math.sin(x*.027+seed*2))*.3+Math.sin(x*.07+seed)*.1;pts.push([x,mh-base-n*amp])}
        g.beginPath();g.moveTo(0,mh);pts.forEach(([x,y],i)=>{if(!i)g.lineTo(x,y);else{const [px,py]=pts[i-1];g.quadraticCurveTo(px,py,(px+x)/2,(py+y)/2)}});g.lineTo(mw,mh);g.closePath();
        const gr=g.createLinearGradient(0,mh-base-amp,0,mh);gr.addColorStop(0,fill[0]);gr.addColorStop(1,fill[1]);g.fillStyle=gr;g.fill();
        g.save();g.shadowColor=rim;g.shadowBlur=8;g.strokeStyle=rim;g.lineWidth=1.4;g.beginPath();pts.forEach(([x,y],i)=>{if(!i)g.moveTo(x,y);else{const [px,py]=pts[i-1];g.quadraticCurveTo(px,py,(px+x)/2,(py+y)/2)}});g.globalAlpha=.55;g.stroke();g.restore()};
      ridge(mh*.18,mh*.75,1.3,['#4a1f6e','#2a0f45'],'#ff6fc8');ridge(0,mh*.5,4.1,['#2a0f40','#140726'],'#ff4fa8')}
    // clouds: big billows at the horizon, lit from the sun
    L.clouds=[cloud(W*.66,H*.34,11,.85),cloud(W*.66,H*.36,23,.15),cloud(W*.9,H*.13,31,.5)];
    // rocket sprite at the scale it is drawn
    const s=k*DPR*1.6;rocketCv=canvas(170*s,96*s);{const g=rocketCv.getContext('2d');g.scale(s,s);g.translate(84,48);drawRocket(g)}
    rocketCv.s=s;paintOverlays();rocketRed=canvas(rocketCv.width,rocketCv.height);{const g=rocketRed.getContext('2d');g.drawImage(rocketCv,0,0);g.globalCompositeOperation='source-atop';g.fillStyle='rgba(255,40,80,.5)';g.fillRect(0,0,rocketRed.width,rocketRed.height)}
  }
  function paintOverlays(){
    L.vig=canvas(W*DPR,H*DPR);{const g=L.vig.getContext('2d');g.scale(DPR,DPR);const vg=g.createRadialGradient(W/2,H*.48,Math.min(W,H)*.35,W/2,H*.5,Math.max(W,H)*.75);
      vg.addColorStop(0,'rgba(5,2,15,0)');vg.addColorStop(1,'rgba(5,2,15,.55)');g.fillStyle=vg;g.fillRect(0,0,W,H)}
    L.hzl=canvas(W*DPR,24*DPR);{const g=L.hzl.getContext('2d');g.scale(DPR,DPR);const hl=g.createLinearGradient(0,0,W,0);hl.addColorStop(0,'rgba(140,30,140,.6)');hl.addColorStop(.5,'#ffc29a');hl.addColorStop(1,'rgba(140,30,140,.6)');
      g.shadowColor='rgba(255,90,150,.9)';g.shadowBlur=12;g.fillStyle=hl;g.fillRect(0,11,W,2)}
    const pw=130*k,ph=44*k;L.pad=canvas(pw*DPR,ph*DPR);{const g=L.pad.getContext('2d'),s=k;g.scale(DPR,DPR);g.translate(pw/2,ph/2);
      g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(4*s,6*s,60*s,12*s,0,0,TAU);g.fill();
      const pg=g.createLinearGradient(0,-10*s,0,10*s);pg.addColorStop(0,'#3a2d63');pg.addColorStop(1,'#140c26');g.fillStyle=pg;g.beginPath();g.ellipse(0,0,54*s,11*s,0,0,TAU);g.fill();
      g.save();g.shadowColor='#ff3ea5';g.shadowBlur=10*s;g.strokeStyle='#ff5bbd';g.lineWidth=1.6*s;g.beginPath();g.ellipse(0,0,54*s,11*s,0,0,TAU);g.stroke();g.restore();
      g.fillStyle='#24183f';g.beginPath();g.ellipse(0,-3*s,40*s,7*s,0,0,TAU);g.fill();
      g.fillStyle='#120a22';g.beginPath();g.ellipse(0,-3*s,16*s,4*s,0,0,TAU);g.fill();g.strokeStyle='#7a4fb0';g.lineWidth=1.4*s;g.stroke()}
    L.pad.w=pw;L.pad.h=ph}
  function planet(r,cols,rim,lx,ly,seed){const n=r*2.6,c=canvas(n*DPR,n*DPR),g=c.getContext('2d');g.scale(DPR,DPR);g.translate(n/2,n/2);
    const at=g.createRadialGradient(0,0,r*.9,0,0,r*1.3);at.addColorStop(0,rim+'.28)');at.addColorStop(1,rim+'0)');g.fillStyle=at;g.beginPath();g.arc(0,0,r*1.3,0,TAU);g.fill();
    const gr=g.createRadialGradient(Math.cos(ly)*r*.5*lx,Math.sin(ly)*r*.5*lx,r*.1,0,0,r);gr.addColorStop(0,cols[0]);gr.addColorStop(.6,cols[1]);gr.addColorStop(1,cols[2]);
    g.fillStyle=gr;g.beginPath();g.arc(0,0,r,0,TAU);g.fill();
    g.save();g.clip();const R=rng(seed);g.globalAlpha=.18;for(let i=0;i<7;i++){g.fillStyle=i%2?'#7c4bd0':'#120626';g.beginPath();g.ellipse(0,(R()-.5)*r*1.8,r*1.3,r*(.05+R()*.08),.25,0,TAU);g.fill()}g.restore();
    g.save();g.shadowColor=rim+'1)';g.shadowBlur=10;g.strokeStyle=rim+'.9)';g.lineWidth=Math.max(1.2,r*.04);g.beginPath();g.arc(0,0,r,ly-1.1,ly+1.1);g.stroke();g.restore();
    return c}
  function cloud(w,h,seed,lightX){const c=canvas(w*DPR,h*DPR),g=c.getContext('2d'),R=rng(seed);g.scale(DPR,DPR);lightX=lightX===undefined?.5:lightX;
    const balls=[];for(let i=0;i<34;i++){const x=w*(.1+R()*.8),top=h*(.18+Math.pow(Math.abs(x/w-.5)*2,1.6)*.55),r=h*(.16+R()*.2);balls.push([x,top+r*.8+R()*h*.2,r])}
    balls.sort((a,b)=>a[1]-b[1]);
    for(const [x,y,r] of balls){const gr=g.createRadialGradient(x+r*.22,y-r*.35,r*.05,x,y,r);gr.addColorStop(0,'#b77ad8');gr.addColorStop(.5,'#8448b8');gr.addColorStop(.82,'#4a2280');gr.addColorStop(1,'rgba(52,20,90,0)');
      g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,TAU);g.fill()}
    g.globalCompositeOperation='source-atop';
    const lt=g.createRadialGradient(w*lightX,h*.15,0,w*lightX,h*.15,w*.75);lt.addColorStop(0,'rgba(255,140,200,.42)');lt.addColorStop(1,'rgba(255,140,200,0)');g.fillStyle=lt;g.fillRect(0,0,w,h);
    const sh=g.createLinearGradient(0,0,0,h);sh.addColorStop(0,'rgba(20,6,40,0)');sh.addColorStop(.55,'rgba(20,6,40,.12)');sh.addColorStop(1,'rgba(20,6,40,.6)');g.fillStyle=sh;g.fillRect(0,0,w,h);
    g.globalCompositeOperation='destination-in';const f=g.createLinearGradient(0,0,0,h);f.addColorStop(0,'#000');f.addColorStop(.8,'#000');f.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=f;g.fillRect(0,0,w,h);return c}

  /* ---------- geometry helpers ---------- */
  const padPos=()=>({x:W*.3,y:yH+(H-yH)*.42+st.alt});                 // the pad stands on the floor, which sinks as we climb
  const home=()=>{const p=padPos();return{x:p.x+Math.cos(-1)*68*k,y:p.y+Math.sin(-1)*68*k-5*k}};   // the rocket's centre when its nozzle rests on the pad
  function nozzle(){const r=st.rk,s=k*1.0;return{x:r.x+Math.cos(r.ang)*RK.tail*s,y:r.y+Math.sin(r.ang)*RK.tail*s}}
  function seat(){const r=st.rk,s=k,[sx,sy]=RK.seat;return{x:r.x+(Math.cos(r.ang)*sx-Math.sin(r.ang)*sy)*s,y:r.y+(Math.sin(r.ang)*sx+Math.cos(r.ang)*sy)*s}}

  /* ---------- API ---------- */
  const api={
    resize(w,h,dpr){W=w;H=h;DPR=Math.min(2,dpr||1);k=Math.min(W/390,H/520)*1.0;yH=H*.78;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
      glow.pink=glowSprite('rgba(255,90,190,1)');glow.orange=glowSprite('rgba(255,170,60,1)');glow.white=glowSprite('rgba(255,250,235,1)');glow.green=glowSprite('rgba(80,255,170,1)');
      puff.pink=[puffSprite(['#ffc4f2','#c060e0','#4a1a72'],3),puffSprite(['#f4b4ff','#a74fd6','#3d1666'],8)];
      puff.dark=[puffSprite(['#8a7396','#43305a','#1c1228'],5),puffSprite(['#7a6688','#3a2a4e','#170f22'],12)];
      puff.dust=[puffSprite(['#ffe0f6','#d79be8','#6d3a8c'],15)];puff.fire=[puffSprite(['#fffbe0','#ffb23a','#ff2e6a'],21),puffSprite(['#fff4c4','#ff9a2e','#e8235f'],27)];
      spark=sparkSprite();paintStatic();if(st.phase==='wait')api.placeOnPad()},
    placeOnPad(){const h=home();st.rk.x=h.x;st.rk.y=h.y;st.rk.ang=-1},
    wait(){st.phase='wait';st.t=0;st.rider=true;st.rk.vis=true;st.stall=0;st.drop=1;st.jumper=null;st.tumble=null;st.ridePose='grip'},
    launch(){st.phase='fly';st.t=0;st.launchT=0;for(let i=0;i<26;i++)addPuff('dust',padPos().x+rnd(-30,30)*k,padPos().y-4*k,rnd(-140,140),rnd(-50,0),rnd(10,20)*k,rnd(1.2,2),22)},
    cashout(){if(!st.rider||st.phase!=='fly')return;st.rider=false;const p=seat();st.jumper={x:p.x,y:p.y,vx:-80*k,vy:-330*k,rot:st.rk.ang*.4,vr:-6,t:0,open:0};
      for(let i=0;i<26;i++){const a=rnd(0,TAU),v=rnd(80,260)*k;st.sparks.push({x:p.x,y:p.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.5,.9),max:.9,col:['#ffd23f','#2bff88','#29e6ff','#ff3ea5'][i%4],w:2})}
      st.rings.push({x:p.x,y:p.y,t:0,d:.55,r0:6,r1:70,col:'255,210,63'})},
    crash(){if(st.phase!=='fly')return;st.phase='stall';st.stall=.38},
    state:st,
    frame(dt,t,m){dt=Math.min(dt,.05);st.m=m;update(dt,t);draw(t)}};

  function addPuff(kind,x,y,vx,vy,r,life,gr){st.smoke.push({kind,x,y,vx,vy,r,r0:r,gr:gr*k,life,max:life,rot:rnd(0,TAU),spin:rnd(-.5,.5),i:Math.floor(Math.random()*puff[kind].length)})}
  function explode(){const r=st.rk,x=r.x,y=r.y;st.phase='crash';st.t=0;r.vis=false;st.shake=1;st.flash=1;
    for(let i=0;i<7;i++)st.fire.push({x:x+rnd(-14,14)*k,y:y+rnd(-12,12)*k,r:rnd(50,90)*k,t:-i*.035,d:rnd(.45,.7),col:i%3?'orange':'pink'});
    for(let i=0;i<14;i++){const a=rnd(0,TAU),v=rnd(40,150)*k;addPuff('fire',x+Math.cos(a)*8*k,y+Math.sin(a)*8*k,Math.cos(a)*v,Math.sin(a)*v-30*k,rnd(12,20)*k,rnd(.45,.75),70)}
    for(let i=0;i<18;i++){const a=rnd(0,TAU),v=rnd(30,110)*k;const p={kind:'dark',x:x+Math.cos(a)*12*k,y:y+Math.sin(a)*12*k,vx:Math.cos(a)*v,vy:Math.sin(a)*v-50*k,r:rnd(10,18)*k,gr:34*k,life:rnd(1.6,2.6),max:2.6,rot:rnd(0,TAU),spin:rnd(-.4,.4),i:i%2,delay:rnd(.12,.3)};st.smoke.push(p)}
    for(let i=0;i<46;i++){const a=rnd(0,TAU),v=rnd(120,480)*k;st.sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.4,1),max:1,col:['#fff3b0','#ffd23f','#ff7a1a','#ff3ea5'][i%4],w:rnd(1.4,2.6),g:380*k})}
    for(let i=0;i<12;i++){const a=rnd(0,TAU),v=rnd(120,340)*k;st.debris.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-140*k,rot:rnd(0,TAU),vr:rnd(-12,12),s:rnd(4,8)*k,life:rnd(1.2,2),col:i%3?'#19a866':'#0b5236'})}
    st.rings.push({x,y,t:0,d:.55,r0:12,r1:150*k,col:'255,225,150',w:3},{x,y,t:-.06,d:.75,r0:12,r1:210*k,col:'255,62,165',w:2});
    if(st.rider){st.rider=false;const s=seat();st.tumble={x:s.x,y:s.y,vx:rnd(-170,-70)*k,vy:-300*k,rot:0,vr:rnd(-9,-5)}}}

  /* ---------- simulation ---------- */
  function update(dt,t){st.t+=dt;const r=st.rk;
    // camera altitude: climbs with log(m) in flight; holds after the crash, then glides home for the next round
    let altT=st.alt;if(st.phase==='fly'||st.phase==='stall')altT=Math.log(st.m)*H*.95;else if(st.phase==='wait')altT=0;else if(st.phase==='crash'&&st.t>1.4)altT=0;
    const ka=st.phase==='crash'?1-Math.exp(-dt*1.6):st.phase==='wait'?1-Math.exp(-dt*2.5):1-Math.exp(-dt*3);
    const prev=st.alt;st.alt+=(altT-st.alt)*ka;st.dAlt=st.alt-prev;const pcx=st.camX;st.camX=st.alt*.45;st.dCamX=st.camX-pcx;
    st.sp=st.phase==='fly'?1+Math.log(st.m)*.9:st.phase==='stall'?.4:0;
    const pad=padPos(),hm=home();
    if(st.phase==='wait'){
      if(st.drop>0){st.drop=Math.max(0,st.drop-dt*1.3);if(st.drop===0)for(let i=0;i<12;i++)addPuff('dust',pad.x+rnd(-26,26)*k,pad.y-2*k,rnd(-90,90),rnd(-30,0),rnd(8,14)*k,rnd(.8,1.3),16)}
      const e=1-easeBack(1-st.drop);r.x=hm.x;r.y=hm.y-e*H*.9;r.ang=-1+Math.sin(st.drop*3)*.05*st.drop;
      // the last two seconds of the countdown: the engine warms up, a smooth rumble
      const warm=clamp((st.t-2)/2,0,1);if(warm>0){r.x+=wob(t*22,1)*1.2*warm*k;r.y+=wob(t*25,2)*1.2*warm*k;if(Math.random()<warm*dt*30){const n=nozzle();addPuff('dust',n.x+rnd(-6,6)*k,pad.y-3*k,rnd(-70,70),rnd(-25,0),rnd(5,9)*k,rnd(.7,1.1),14)}}
    }else if(st.phase==='fly'){
      const p=easeOut(clamp(st.t/2.2,0,1)),I=clamp(Math.log(st.m)/Math.log(10),0,1.3);
      const tx=lerp(hm.x,W*.56,p)+wob(t*.9,3)*6*k,ty=lerp(hm.y,H*.46,p)+wob(t*1.1,5)*6*k;
      r.x=st.t<.05?hm.x:tx;r.y=st.t<.05?hm.y:ty;r.ang=lerp(-1,-.76,p)+wob(t*2.2,7)*(.025+I*.04);
      // exhaust: pink billows trailing back
      const n=nozzle(),dir={x:Math.cos(r.ang),y:Math.sin(r.ang)},rate=(34+I*30)*dt;
      for(let i=0;i<Math.floor(rate)+(Math.random()<rate%1?1:0);i++){const v=rnd(90,170)*k;addPuff('pink',n.x-dir.x*10*k+rnd(-3,3)*k,n.y-dir.y*10*k+rnd(-3,3)*k,-dir.x*v+rnd(-24,24)*k,-dir.y*v+rnd(-24,24)*k,rnd(9,14)*k,rnd(1.4,2.2),26+I*14)}
    }else if(st.phase==='stall'){st.stall-=dt;const a=1-st.stall/.38;r.x+=wob(t*30,1)*2.4*k*a;r.y+=wob(t*33,4)*2.4*k*a+dt*30*k;r.ang+=wob(t*20,2)*.01;if(st.stall<=0)explode()}
    // shooting stars now and then
    if(Math.random()<dt*.35)st.shoot.push({x:rnd(W*.3,W*1.1),y:rnd(-H*.1,H*.4),v:rnd(500,800)*k,t:0,d:rnd(.5,.8)});
    for(let i=st.shoot.length-1;i>=0;i--){const s=st.shoot[i];s.t+=dt;s.x-=s.v*dt*.8;s.y+=s.v*dt*.5;if(s.t>s.d)st.shoot.splice(i,1)}
    // particles ride with the world: when the camera climbs, they slide down and left
    const cdy=st.dAlt,cdx=-st.dCamX;
    for(let i=st.smoke.length-1;i>=0;i--){const p=st.smoke[i];if(p.delay>0){p.delay-=dt;p.x+=cdx;p.y+=cdy;continue}p.life-=dt;if(p.life<=0){st.smoke.splice(i,1);continue}
      const d=1-Math.min(1,dt*1.6);p.vx*=d;p.vy*=d;p.vy-=6*k*dt;p.x+=p.vx*dt+cdx;p.y+=p.vy*dt+cdy;p.r+=p.gr*dt;p.rot+=p.spin*dt}
    for(let i=st.sparks.length-1;i>=0;i--){const p=st.sparks[i];p.life-=dt;if(p.life<=0){st.sparks.splice(i,1);continue}p.vx*=1-dt*1.8;p.vy*=1-dt*1.8;p.vy+=(p.g||0)*dt;p.x+=p.vx*dt+cdx;p.y+=p.vy*dt+cdy}
    for(let i=st.debris.length-1;i>=0;i--){const p=st.debris[i];p.life-=dt;if(p.life<=0){st.debris.splice(i,1);continue}p.vy+=520*k*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.rot+=p.vr*dt}
    for(let i=st.fire.length-1;i>=0;i--){const f=st.fire[i];f.t+=dt;if(f.t>f.d)st.fire.splice(i,1)}
    for(let i=st.rings.length-1;i>=0;i--){const q=st.rings[i];q.t+=dt;if(q.t>q.d)st.rings.splice(i,1)}
    st.shake=Math.max(0,st.shake-dt*1.2);st.flash=Math.max(0,st.flash-dt*3.5);
    // the bear: pose and mood follow the round
    const mood=st.phase==='stall'?'scared':st.phase==='wait'?'calm':st.m>1.3?'hype':'calm';
    const pose=st.phase==='stall'?'scared':st.phase==='fly'?(st.m>1.6?'cheer':'grip'):'grip';
    bear.update(dt,t,pose,mood);
    const j=st.jumper;if(j){j.t+=dt;if(j.t<.45){j.vy+=900*k*dt;j.rot+=j.vr*dt}else{j.open=Math.min(1,j.open+dt/.4);j.rot*=1-Math.min(1,dt*6);j.vy+=(70*k-j.vy)*dt*2.4;j.vx*=1-dt*1.4}
      j.x+=j.vx*dt+cdx*.6;j.y+=j.vy*dt+cdy*.6;jbear.update(dt,t,j.open>0?'hang':'cheer','win');if(j.y>H+160*k)st.jumper=null}
    const tb=st.tumble;if(tb){tb.vy+=700*k*dt;tb.x+=tb.vx*dt;tb.y+=tb.vy*dt;tb.rot+=tb.vr*dt;jbear.update(dt,t,'fall','scared');if(tb.y>H+120*k)st.tumble=null}
  }

  /* ---------- drawing ---------- */
  function draw(t){const g=ctx;g.setTransform(DPR,0,0,DPR,0,0);
    const sh=st.shake*st.shake;g.save();if(sh>0)g.translate(Math.sin(t*47)*9*sh*k,Math.cos(t*53)*7*sh*k);
    const f=clamp(st.alt/(H*2.2),0,1);
    // sky: dusk at the ground, deep space higher up
    const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,mix('#0b0522','#04020c',f));sky.addColorStop(.5,mix('#1a0b3e','#0a0520',f));sky.addColorStop(.78,mix('#3e1258','#120830',f));sky.addColorStop(1,mix('#5a1762','#160a36',f));
    g.fillStyle=sky;g.fillRect(-20,-20,W+40,H+40);
    // nebula (wraps vertically)
    const nh=L.neb.height/DPR,ny=((st.alt*.12)%nh+nh)%nh,nx=-((st.camX*.08)%W);g.globalAlpha=.9;for(const dy of [-nh,0])for(const dx of [0,W])g.drawImage(L.neb,nx+dx-(dx?0:0),ny+dy-nh*.2,W,nh);g.globalAlpha=1;
    // stars
    for(const s of L.stars){const par=[.05,.11,.2][s.l],y=((s.y+st.alt*par)%nh+nh)%nh-nh*.2,x=((s.x-st.camX*par)%W+W)%W;if(y<-4||y>H)continue;
      const a=.45+.55*(.5+.5*Math.sin(t*s.f+s.ph));g.globalAlpha=a;g.fillStyle=s.l===2?'#fff':s.l?'#e9ddff':'#b9a8e6';
      if(st.sp>2.2&&s.l>0){const len=(st.sp-2)*3*s.l;g.fillRect(x,y-len,s.s,len+s.s)}else g.fillRect(x,y,s.s,s.s)}
    g.globalAlpha=1;
    for(const s of L.sparkles){const y=((s.y+st.alt*.16)%nh+nh)%nh-nh*.2,x=((s.x-st.camX*.16)%W+W)%W;if(y<-20||y>H)continue;const q=.5+.5*Math.sin(t*1.6+s.ph),sz=s.s*(.5+q*.7);
      g.globalAlpha=.4+q*.6;g.drawImage(spark,x-sz/2,y-sz/2,sz,sz)}g.globalAlpha=1;
    for(const s of st.shoot){const a=1-s.t/s.d,lg=g.createLinearGradient(s.x,s.y,s.x+60*k,s.y-38*k);lg.addColorStop(0,`rgba(255,240,255,${a})`);lg.addColorStop(1,'rgba(255,240,255,0)');
      g.strokeStyle=lg;g.lineWidth=1.4;g.beginPath();g.moveTo(s.x,s.y);g.lineTo(s.x+60*k,s.y-38*k);g.stroke()}
    // planets
    {const b=L.pBig,bw=b.width/DPR;g.drawImage(b,W*.02-bw/2-st.camX*.2,H*.03-bw/2+st.alt*.22,bw,bw);
     const s=L.pSmall,sw=s.width/DPR;g.drawImage(s,W*.86-sw/2-st.camX*.26,H*.16-sw/2+st.alt*.3,sw,sw)}
    // sun: glow, then the disc with stripes that slide down
    const sr=L.sunR,scx=W*.5-st.camX*.35,scy=yH-sr*.98+st.alt*.6;
    const sunA=1-sm(clamp((st.alt-H*.25)/(H*.55),0,1));
    if(scy-sr<H&&sunA>0){g.globalAlpha=sunA;g.globalCompositeOperation='lighter';g.drawImage(L.sunGlow,scx-sr*2,scy-sr*2,sr*4,sr*4);g.globalCompositeOperation='source-over';
      const sg=L.sunCv.getContext('2d');sg.setTransform(1,0,0,1,0,0);sg.clearRect(0,0,L.sunCv.width,L.sunCv.height);sg.drawImage(L.sunBase,0,0);sg.globalCompositeOperation='destination-out';
      const D=DPR,ph=(t*.22)%1;for(let i=0;i<9;i++){const q=(i+ph)/9;const y=sr*(.86+q*1.14),hgt=sr*(.01+q*.075);sg.fillRect(0,y*D,sr*2*D,hgt*D)}sg.globalCompositeOperation='source-over';
      g.drawImage(L.sunCv,scx-sr,scy-sr,sr*2,sr*2);g.globalAlpha=1}
    // mountains and clouds sit on the horizon
    const hz=yH+st.alt,mz=yH+st.alt*.6,cz=yH+st.alt*.78;
    if(mz-H*.25<H){const mw=L.mtn.width/DPR,mh=L.mtn.height/DPR,mx=-((st.camX*.6)%(mw-W))-W*.1;g.drawImage(L.mtn,mx,mz-mh+2,mw,mh);
      // a haze under the ridges: the sun and the mountains sink into it as we climb
      const hzG=g.createLinearGradient(0,mz,0,mz+H*.35);hzG.addColorStop(0,'#2a0f45');hzG.addColorStop(.35,'rgba(42,15,69,.75)');hzG.addColorStop(1,'rgba(42,15,69,0)');g.fillStyle=hzG;g.fillRect(-10,mz,W+20,H*.35)}
    if(cz-H*.4<H){const cl=L.clouds;const br=t*.6;{const hz=cz;
      drawCloud(g,cl[2],W*.05-st.camX*.8,hz-cl[2].height/DPR*.62,1);
      drawCloud(g,cl[0],-W*.26-st.camX*.85+Math.sin(br)*4*k,hz-cl[0].height/DPR*.9,1+Math.sin(br*.8)*.015);
      drawCloud(g,cl[1],W*.6-st.camX*.85+Math.sin(br+1)*4*k,hz-cl[1].height/DPR*.92,1+Math.sin(br*.7+1)*.015)}}
    // the floor
    if(hz<H)floor(g,hz,t);
    // launch pad
    const pd=padPos();if(pd.y-40*k<H)padDraw(g,pd,t);
    // smoke behind the rocket
    for(const p of st.smoke){if(p.delay>0)continue;const a=clamp(p.life/p.max,0,1),spr=puff[p.kind][p.i%puff[p.kind].length],sz=p.r*2;g.globalAlpha=p.kind==='dark'?Math.min(1,a*1.6)*.9:p.kind==='fire'?a:a*a*.8;
      g.save();g.translate(p.x,p.y);g.rotate(p.rot);g.drawImage(spr,-sz/2,-sz/2,sz,sz);g.restore()}g.globalAlpha=1;
    // the rocket, its flame, and the bear astride it
    const r=st.rk;if(r.vis){g.save();g.translate(r.x,r.y);g.rotate(r.ang);
      const firing=st.phase==='fly'||(st.phase==='wait'&&st.t>2.6),stall=st.phase==='stall';
      if(firing||stall)flame(g,t,stall?(Math.sin(t*40)>0?.35:.05):st.phase==='fly'?1+Math.min(.6,Math.log(st.m)*.3):.35);
      if(st.rider){g.save();g.translate(RK.seat[0]*k,RK.seat[1]*k);g.rotate(-r.ang*.8);g.scale(k*BS,k*BS);bear.back(g);g.restore()}
      const s=rocketCv.s;g.drawImage(stall&&Math.sin(t*50)>0?rocketRed:rocketCv,-84*k,-48*k,rocketCv.width/s*k,rocketCv.height/s*k);
      if(st.rider){g.save();g.translate(RK.seat[0]*k,RK.seat[1]*k);g.rotate(-r.ang*.8);g.scale(k*BS,k*BS);bear.front(g,t);g.restore()}
      g.restore()}
    // the bear under the parachute, or tumbling after the explosion
    const j=st.jumper;if(j){g.save();g.translate(j.x,j.y);g.rotate(j.rot+Math.sin(t*2.2)*.12*j.open);g.scale(k*BS,k*BS);drawCanopy(g,j.open,t);jbear.back(g);jbear.front(g,t);g.restore()}
    const tb=st.tumble;if(tb){g.save();g.translate(tb.x,tb.y);g.rotate(tb.rot);g.scale(k*BS,k*BS);jbear.back(g);jbear.front(g,t);g.restore()}
    // explosion: fire, debris, sparks, rings
    g.globalCompositeOperation='lighter';
    for(const fb of st.fire){if(fb.t<0)continue;const q=fb.t/fb.d,R=fb.r*(.35+easeOut(q)*.9),a=(1-q)*(1-q);g.globalAlpha=a;g.drawImage(glow[fb.col],fb.x-R,fb.y-R,R*2,R*2);
      g.globalAlpha=a*.8;g.drawImage(glow.white,fb.x-R*.45,fb.y-R*.45,R*.9,R*.9)}
    g.globalAlpha=1;
    for(const p of st.sparks){const a=clamp(p.life/p.max,0,1);g.strokeStyle=p.col;g.globalAlpha=a;g.lineWidth=p.w;g.lineCap='round';g.beginPath();g.moveTo(p.x,p.y);g.lineTo(p.x-p.vx*.03,p.y-p.vy*.03);g.stroke()}
    g.globalAlpha=1;g.globalCompositeOperation='source-over';
    for(const d of st.debris){g.save();g.translate(d.x,d.y);g.rotate(d.rot);g.globalAlpha=clamp(d.life,0,1);g.fillStyle=d.col;g.beginPath();g.moveTo(-d.s,-d.s*.4);g.quadraticCurveTo(0,-d.s*.8,d.s,-d.s*.3);g.lineTo(d.s*.6,d.s*.5);g.quadraticCurveTo(-d.s*.2,d.s*.7,-d.s,-d.s*.4);g.fill();g.restore()}
    g.globalAlpha=1;
    for(const q of st.rings){if(q.t<0)continue;const p=q.t/q.d;g.strokeStyle=`rgba(${q.col},${(1-p)*(1-p)*.7})`;g.lineWidth=(1-p)*(q.w||4)*k+.5;g.beginPath();g.arc(q.x,q.y,lerp(q.r0,q.r1,easeOut(p)),0,TAU);g.stroke()}
    g.restore();
    if(st.flash>0){g.fillStyle=`rgba(255,225,245,${st.flash*.55})`;g.fillRect(0,0,W,H)}
    // a soft vignette keeps the eye in the middle
    g.drawImage(L.vig,0,0,W,H)}

  function drawCloud(g,c,x,y,s){const w=c.width/DPR*s,h=c.height/DPR*s;g.drawImage(c,x,y+(c.height/DPR-h),w,h)}
  function floor(g,hz,t){const fh=H-hz;
    const bg=g.createLinearGradient(0,hz,0,H);bg.addColorStop(0,'#3d1160');bg.addColorStop(.35,'#1d0a36');bg.addColorStop(1,'#0d0525');g.fillStyle=bg;g.fillRect(0,hz,W,fh);
    // the sun's reflection
    const cx=W*.5-st.camX*.35;const rf=g.createRadialGradient(cx,hz,0,cx,hz,fh*1.2);rf.addColorStop(0,'rgba(255,110,90,.55)');rf.addColorStop(.5,'rgba(255,62,120,.15)');rf.addColorStop(1,'rgba(255,62,120,0)');
    g.save();g.translate(cx,hz);g.scale(.32,1);g.translate(-cx,-hz);g.fillStyle=rf;g.fillRect(cx-fh*1.3,hz,fh*2.6,fh);g.restore();
    // grid: rows roll towards us (each gap ~1.3x the one before, like the loading screen), columns fan out from the
    // vanishing point on the horizon; every line is stroked twice, a wide glow and a thin core
    const vx=W*.5-st.camX*.35,rows=[],ph=(t*st.sp*.55)%1,C=Math.max(fh,H*.12)*.32;
    for(let n=0;n<16;n++){const u=(n+1-ph)*.07;if(u>=.95)break;const y=hz+C*u/(1-u);if(y>H)break;rows.push(y)}
    const gap=W*.2,off=((-st.camX*.9)%gap+gap)%gap,depth=Math.max(fh,H*.12);
    g.save();g.beginPath();g.rect(0,hz,W,fh);g.clip();
    for(const [lw,col] of [[5,'rgba(255,70,205,.16)'],[1.3,'rgba(255,115,225,.85)']]){g.lineWidth=lw;g.strokeStyle=col;g.beginPath();
      for(const y of rows){g.moveTo(0,y);g.lineTo(W,y)}
      for(let i=-12;i<=12;i++){const xb=vx+i*gap+off;g.moveTo(vx,hz);g.lineTo(vx+(xb-vx)*(fh/depth),hz+fh)}   // through (xb, hz+depth)
      g.stroke()}
    // a haze over the far rows
    const hzG=g.createLinearGradient(0,hz,0,hz+fh*.45);hzG.addColorStop(0,'rgba(150,32,128,.75)');hzG.addColorStop(1,'rgba(70,16,100,0)');g.fillStyle=hzG;g.fillRect(0,hz,W,fh*.45);
    g.restore();
    // horizon line
    g.drawImage(L.hzl,0,hz-12,W,24)}
  function padDraw(g,p,t){const s=k;g.drawImage(L.pad,p.x-L.pad.w/2,p.y-L.pad.h/2,L.pad.w,L.pad.h);g.save();g.translate(p.x,p.y);
    const warm=st.phase==='wait'?clamp((st.t-2)/2,0,1):0;g.globalCompositeOperation='lighter';
    if(warm>0){g.globalAlpha=warm*.9;g.drawImage(glow.pink,-26*s,-12*s,52*s,18*s)}g.globalAlpha=1;
    for(let i=0;i<10;i++){const a=i/10*TAU+t*1.6,x=Math.cos(a)*48*s,y=Math.sin(a)*9.6*s;if(Math.sin(a)<-.2)continue;const on=(i+Math.floor(t*6))%3===0;
      g.globalCompositeOperation=on?'lighter':'source-over';g.fillStyle=on?'#29e6ff':'#4b2a6e';g.beginPath();g.arc(x,y,(on?2.1:1.5)*s,0,TAU);g.fill();if(on)g.drawImage(glow.green,x-7*s,y-7*s,14*s,14*s)}
    g.globalCompositeOperation='source-over';g.restore()}
  function flame(g,t,power){const s=k,len=(40+wob(t*9,1)*7+wob(t*23,2)*4)*power*s,w=(9.5+wob(t*17,3)*1.2)*s,x0=RK.tail*s;
    g.globalCompositeOperation='lighter';
    g.globalAlpha=.75*Math.min(1,power);g.drawImage(glow.pink,x0-len*.9,-w*3,len*1.8,w*6);g.drawImage(glow.orange,x0-w*2.2,-w*2.2,w*4.4,w*4.4);
    const fg=g.createLinearGradient(x0,0,x0-len,0);fg.addColorStop(0,'rgba(255,255,245,1)');fg.addColorStop(.18,'rgba(255,240,170,.95)');fg.addColorStop(.5,'rgba(255,110,200,.75)');fg.addColorStop(1,'rgba(255,62,165,0)');
    g.globalAlpha=Math.min(1,power*1.2);g.fillStyle=fg;g.beginPath();g.moveTo(x0+2*s,-w);g.bezierCurveTo(x0-len*.35,-w*1.15,x0-len*.75,-w*.4,x0-len,0);g.bezierCurveTo(x0-len*.75,w*.4,x0-len*.35,w*1.15,x0+2*s,w);g.closePath();g.fill();
    const cg=g.createLinearGradient(x0,0,x0-len*.5,0);cg.addColorStop(0,'rgba(255,255,255,1)');cg.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=cg;g.beginPath();g.ellipse(x0-len*.18,0,len*.25,w*.45,0,0,TAU);g.fill();
    g.globalAlpha=1;g.globalCompositeOperation='source-over'}
  return api}

function mix(a,b,f){const p=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16)),A=p(a),Bc=p(b);return'#'+A.map((v,i)=>Math.round(v+(Bc[i]-v)*f).toString(16).padStart(2,'0')).join('')}
window.Scene2={create,_debug:{drawRocket,makeBear,drawCanopy,RK,BS}};   // _debug: close-ups of the parts while we tune them
})();
