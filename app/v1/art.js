/* Crash Rocket game art: characters, rockets, backdrops. Shared by the app and the brand kit. */
const rnd=(a,b)=>a+Math.random()*(b-a),lerp=(a,b,t)=>a+(b-a)*t,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const easeBack=t=>{const c=1.70158;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}

/* =====================================================================
   Characters — drawn upright, origin at the seat, ~52 units tall
   mood 0..1 (calm → ecstatic), t = time
   ===================================================================== */
function suit(c,col,mood,t,tieCol,lapel){
  c.fillStyle=col;rr(c,-11,-24,22,25,7);c.fill();
  if(lapel){c.fillStyle='#f4f4f8';c.beginPath();c.moveTo(-5,-24);c.lineTo(0,-13);c.lineTo(5,-24);c.fill()}
  c.save();c.translate(0,-21.5);c.rotate(.25+mood*1.05+Math.sin(t*26)*.14*(.3+mood));
  c.fillStyle=tieCol;c.beginPath();c.moveTo(-1.8,0);c.lineTo(1.8,0);c.lineTo(2.9,9);c.lineTo(0,12.5);c.lineTo(-2.9,9);c.closePath();c.fill();c.restore();
}
function arms(c,col,paw,mood,t){
  c.lineCap='round';c.lineWidth=6;c.strokeStyle=col;
  c.beginPath();c.moveTo(8,-18);c.lineTo(15,-7);c.stroke();c.fillStyle=paw;c.beginPath();c.arc(15,-6,3.6,0,6.283);c.fill();
  const up=clamp((mood-.45)/.4,0,1),wave=Math.sin(t*14)*.35*up;
  const ex=lerp(-13,-17,up),ey=lerp(-6,-38,up)+wave*6;
  c.strokeStyle=col;c.beginPath();c.moveTo(-8,-18);c.lineTo(ex,ey);c.stroke();c.fillStyle=paw;c.beginPath();c.arc(ex,ey-1,3.6,0,6.283);c.fill();
}
function mouth(c,x,y,mood){
  if(mood<.3){c.strokeStyle='#1b1010';c.lineWidth=1.3;c.beginPath();c.arc(x,y-1,2.8,.25,2.9);c.stroke();return}
  c.fillStyle='#3a0d12';c.beginPath();c.ellipse(x,y,2.4+mood*1.8,1.1+mood*2.6,0,0,6.283);c.fill();
  c.fillStyle='#ff7a9a';c.beginPath();c.ellipse(x,y+mood*1.4,1.6+mood,1+mood*.8,0,0,Math.PI);c.fill();
}
function shades(c,x,y,rim){c.fillStyle='#0b1a14';c.strokeStyle=rim;c.lineWidth=1.3;rr(c,x-10,y,8.5,5.5,2);c.fill();c.stroke();rr(c,x+1.5,y,8.5,5.5,2);c.fill();c.stroke();
  c.beginPath();c.moveTo(x-1.5,y+2);c.lineTo(x+1.5,y+2);c.stroke();c.fillStyle='rgba(255,255,255,.55)';c.fillRect(x-8,y+1,2.4,1.2);c.fillRect(x+3.5,y+1,2.4,1.2)}
function drawBear(c,mood,t){
  suit(c,'#1c2447',mood,t,'#e8364f',true);arms(c,'#1c2447','#8a5a33',mood,t);
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  const ew=Math.sin(t*22)*mood*.25;
  [[-9,-45,-ew],[9,-45,ew]].forEach(([x,y,r])=>{c.save();c.translate(x,y);c.rotate(r);c.fillStyle='#8a5a33';c.beginPath();c.arc(0,0,5.2,0,6.283);c.fill();c.fillStyle='#c9925f';c.beginPath();c.arc(0,0,2.6,0,6.283);c.fill();c.restore()});
  c.fillStyle='#8a5a33';c.beginPath();c.arc(0,-35,12.5,0,6.283);c.fill();
  c.fillStyle='#e0b27f';c.beginPath();c.ellipse(2,-30,7.2,5.6,0,0,6.283);c.fill();
  c.fillStyle='#1b1010';c.beginPath();c.ellipse(3,-33,2.7,1.9,0,0,6.283);c.fill();
  mouth(c,3,-28.6,mood);shades(c,0,-41.5,'#2bff88');c.restore();
}
function drawBull(c,mood,t){
  suit(c,'#15151f',mood,t,'#2bff88',true);
  c.strokeStyle='#ffd23f';c.lineWidth=1.6;c.setLineDash([2,1.5]);c.beginPath();c.arc(0,-24,7,.3,Math.PI-.3);c.stroke();c.setLineDash([]);
  arms(c,'#15151f','#5b3a29',mood,t);
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  c.strokeStyle='#f1e6c8';c.lineCap='round';c.lineWidth=4.2;
  c.beginPath();c.moveTo(-8,-43);c.quadraticCurveTo(-19,-44,-18,-56);c.stroke();c.beginPath();c.moveTo(8,-43);c.quadraticCurveTo(19,-44,18,-56);c.stroke();
  c.fillStyle='#5b3a29';[[-13,-38,-.5],[13,-38,.5]].forEach(([x,y,r])=>{c.beginPath();c.ellipse(x,y,5,2.6,r,0,6.283);c.fill()});
  c.beginPath();c.ellipse(0,-35,12,12.5,0,0,6.283);c.fill();
  c.fillStyle='#fff';c.beginPath();c.ellipse(-4.5,-38,2.8,2.4,0,0,6.283);c.ellipse(4.5,-38,2.8,2.4,0,0,6.283);c.fill();
  c.fillStyle='#1b1010';c.beginPath();c.arc(-3.8,-37.6,1.3,0,6.283);c.arc(5.2,-37.6,1.3,0,6.283);c.fill();
  c.strokeStyle='#1b1010';c.lineWidth=1.8;c.beginPath();c.moveTo(-8,-43);c.lineTo(-2,-40.5);c.moveTo(8,-43);c.lineTo(2,-40.5);c.stroke();
  c.fillStyle='#d49b75';c.beginPath();c.ellipse(1,-28.5,8.5,6,0,0,6.283);c.fill();
  c.fillStyle='#3a1f14';c.beginPath();c.ellipse(-2.5,-29.5,1.5,1.1,0,0,6.283);c.ellipse(4.5,-29.5,1.5,1.1,0,0,6.283);c.fill();
  c.strokeStyle='#ffd23f';c.lineWidth=1.6;c.beginPath();c.arc(1,-25.5,3,0,Math.PI);c.stroke();
  if(mood>.35){c.fillStyle='rgba(255,255,255,.7)';for(let i=0;i<2;i++){const k=((t*2.4)+i*.5)%1;c.globalAlpha=(1-k)*.8;c.beginPath();c.arc(-8-k*9,-28+k*3,1.5+k*3,0,6.283);c.fill()}c.globalAlpha=1}
  c.restore();
}
function drawWhale(c,mood,t){
  const hb=Math.sin(t*9)*mood*1.2;c.save();c.translate(0,hb);
  c.fillStyle='#2f6fe0';c.save();c.translate(-13,-8);c.rotate(-.5+Math.sin(t*10)*.15*(.3+mood));c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-9,-4,-14,-14);c.quadraticCurveTo(-8,-12,-5,-9);c.quadraticCurveTo(-5,-16,-2,-20);c.quadraticCurveTo(2,-10,3,-3);c.closePath();c.fill();c.restore();
  const g=c.createLinearGradient(0,-40,0,0);g.addColorStop(0,'#4f94ff');g.addColorStop(1,'#2458c9');c.fillStyle=g;
  c.beginPath();c.moveTo(-15,0);c.bezierCurveTo(-19,-22,-10,-40,4,-40);c.bezierCurveTo(16,-40,19,-24,17,-8);c.quadraticCurveTo(16,0,8,0);c.closePath();c.fill();
  c.fillStyle='#cfe3ff';c.beginPath();c.moveTo(-4,0);c.bezierCurveTo(-4,-10,4,-18,16,-18);c.quadraticCurveTo(17,-6,8,0);c.closePath();c.fill();
  c.strokeStyle='rgba(36,88,201,.45)';c.lineWidth=.9;for(let i=0;i<3;i++){c.beginPath();c.moveTo(0+i*3,-2);c.quadraticCurveTo(6+i*2,-9,15,-12+i*2);c.stroke()}
  c.fillStyle='#e8364f';c.beginPath();c.moveTo(3,-19);c.lineTo(-1,-22);c.lineTo(-1,-16);c.closePath();c.moveTo(3,-19);c.lineTo(7,-22);c.lineTo(7,-16);c.closePath();c.fill();c.beginPath();c.arc(3,-19,1.4,0,6.283);c.fill();
  c.save();c.translate(13,-10);c.rotate(.6+Math.sin(t*12)*.2*mood);c.fillStyle='#2458c9';c.beginPath();c.ellipse(0,0,6,3,0,0,6.283);c.fill();c.restore();
  c.fillStyle='#0b1a14';c.strokeStyle='#29e6ff';c.lineWidth=1.3;rr(c,-2,-33,18,6,3);c.fill();c.stroke();c.fillStyle='rgba(255,255,255,.55)';c.fillRect(1,-32,3,1.4);
  if(mood<.3){c.strokeStyle='#123a86';c.lineWidth=1.4;c.beginPath();c.moveTo(4,-24);c.quadraticCurveTo(10,-21,16,-24);c.stroke()}
  else{c.fillStyle='#10245a';c.beginPath();c.moveTo(4,-24.5);c.quadraticCurveTo(10,-19+mood*-1-mood*3,16.5,-24.5);c.quadraticCurveTo(10,-23,4,-24.5);c.fill()}
  if(mood>.3){c.strokeStyle='#8fd8ff';c.lineWidth=1.6;c.lineCap='round';const h=6+mood*10+Math.sin(t*18)*2;
    for(const s of[-1,0,1]){c.beginPath();c.moveTo(3,-40);c.quadraticCurveTo(3+s*3,-40-h,3+s*(5+mood*4),-40-h*.6);c.stroke()}
    c.fillStyle='#8fd8ff';for(let i=0;i<3;i++){const k=(t*1.8+i/3)%1;c.globalAlpha=1-k;c.beginPath();c.arc(3+(i-1)*(6+k*6),-40-h*.6+k*10,1.5,0,6.283);c.fill()}c.globalAlpha=1}
  c.restore();
}
const CHARS={
  bear:{ru:'Медведь',en:'Bear',draw:drawBear,drop:'shades'},
  bull:{ru:'Бык',en:'Bull',draw:drawBull,drop:'horn'},
  whale:{ru:'Кит',en:'Whale',draw:drawWhale,drop:'shades'}
};

/* =====================================================================
   Rockets — local +x is the nose. Rider seat + nozzle x.
   ===================================================================== */
function drawCandle(c){
  c.fillStyle='#7b3cff';c.beginPath();c.moveTo(-46,-12);c.lineTo(-63,-28);c.lineTo(-30,-12);c.fill();c.beginPath();c.moveTo(-46,12);c.lineTo(-63,28);c.lineTo(-30,12);c.fill();
  c.fillStyle='#2a2f45';c.fillRect(-57,-8,8,16);
  const g=c.createLinearGradient(0,-12,0,12);g.addColorStop(0,'#7dffbe');g.addColorStop(.5,'#16c865');g.addColorStop(1,'#06793a');c.fillStyle=g;rr(c,-50,-12,92,24,6);c.fill();
  c.strokeStyle='rgba(200,255,225,.55)';c.lineWidth=1;c.stroke();
  c.fillStyle='#1eea78';c.beginPath();c.moveTo(41,-12);c.quadraticCurveTo(58,-6,66,0);c.quadraticCurveTo(58,6,41,12);c.fill();
  c.strokeStyle='#b9ffd9';c.lineWidth=1.6;c.beginPath();c.moveTo(66,0);c.lineTo(78,0);c.stroke();
  c.fillStyle='rgba(255,255,255,.35)';rr(c,-44,-8.5,78,3,1.5);c.fill();
  c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=1.6;c.beginPath();c.moveTo(-36,6);c.lineTo(-24,1);c.lineTo(-16,4);c.lineTo(-2,-3);c.lineTo(8,0);c.lineTo(22,-6);c.stroke();
}
function retroBody(c){c.beginPath();c.moveTo(-50,-14);c.lineTo(28,-14);c.quadraticCurveTo(62,-11,72,0);c.quadraticCurveTo(62,11,28,14);c.lineTo(-50,14);c.quadraticCurveTo(-55,0,-50,-14);c.closePath()}
function drawRetro(c){
  c.fillStyle='#ff3b5c';c.strokeStyle='#ff9ac4';c.lineWidth=1;
  c.beginPath();c.moveTo(-38,-13);c.lineTo(-62,-34);c.lineTo(-54,-13);c.closePath();c.fill();c.stroke();
  c.beginPath();c.moveTo(-38,13);c.lineTo(-62,34);c.lineTo(-54,13);c.closePath();c.fill();c.stroke();
  c.fillStyle='#2a2f45';c.fillRect(-59,-9,9,18);c.fillStyle='#3d4460';c.fillRect(-61,-10,3,20);
  const g=c.createLinearGradient(0,-14,0,14);g.addColorStop(0,'#ffffff');g.addColorStop(.45,'#d2d8e8');g.addColorStop(1,'#6f7896');c.fillStyle=g;retroBody(c);c.fill();
  c.save();retroBody(c);c.clip();c.fillStyle='#ff3b5c';c.fillRect(38,-20,40,40);c.fillStyle='#ff3ea5';c.fillRect(-32,-20,5,40);c.fillRect(-24,-20,2,40);
  c.fillStyle='rgba(255,255,255,.55)';c.fillRect(-48,-10,84,2.4);c.restore();
  c.strokeStyle='#ff3ea5';c.lineWidth=1.3;retroBody(c);c.stroke();
  [[2,0,6.5],[18,0,5]].forEach(([x,y,r])=>{const pg=c.createRadialGradient(x-2,y-2,1,x,y,r);pg.addColorStop(0,'#c8fbff');pg.addColorStop(1,'#1aa6c9');c.fillStyle=pg;c.beginPath();c.arc(x,y,r,0,6.283);c.fill();c.strokeStyle='#2a2f45';c.lineWidth=2;c.stroke()});
}
const ROCKETS={
  candle:{ru:'Зелёная свеча',en:'Green Candle',draw:drawCandle,seat:[-12,-11],tail:-58,trail:'rainbow'},
  retro:{ru:'Ретро-шаттл',en:'Retro Shuttle',draw:drawRetro,seat:[-16,-13],tail:-61,trail:'fire'}
};
function drawFlame(c,kind,power,t,x){
  if(power<=0)return;const L=(22+power*26)*(1+Math.sin(t*50)*.08+Math.random()*.12),W=7+power*3;
  c.save();c.globalCompositeOperation='lighter';
  const g=c.createLinearGradient(x,0,x-L,0);
  if(kind==='fire'){g.addColorStop(0,'#fffbe6');g.addColorStop(.25,'#ffd23f');g.addColorStop(.6,'#ff6a1a');g.addColorStop(1,'rgba(255,40,40,0)')}
  else{g.addColorStop(0,'#fffbe6');g.addColorStop(.3,'#ffd23f');g.addColorStop(.7,'#ff3ea5');g.addColorStop(1,'rgba(41,230,255,0)')}
  c.fillStyle=g;c.beginPath();c.moveTo(x,-W);c.quadraticCurveTo(x-L*.4,-W*1.1,x-L,0);c.quadraticCurveTo(x-L*.4,W*1.1,x,W);c.closePath();c.fill();
  c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.ellipse(x-4,0,6,W*.45,0,0,6.283);c.fill();c.restore();
}

/* =====================================================================
   Backgrounds (each is a factory so thumbnails get their own instance)
   E = {w,h,sc,dt,t,alt,dAlt,sp,I,phase,m,rx,ry,tx,ty,gy,crashT}
   ===================================================================== */
function candleFeed(){let v=.45,dump=0;return{
  next(){const o=v;let c=o+(dump>0?rnd(-.16,-.04):rnd(-.05,.075));if(dump>0)dump--;if(c>.92)c-=.1;if(c<.06)c=.06+Math.random()*.05;v=c;return{o,c,hi:Math.max(o,c)+rnd(.005,.04),lo:Math.min(o,c)-rnd(.005,.04)}},
  crash(){dump=4}}}
function drawCandles(c,arr,off,top,bot,alpha,step){c.globalAlpha=alpha;arr.forEach((k,i)=>{const x=i*step-off,Y=v=>bot-v*(bot-top),up=k.c>=k.o;c.strokeStyle=c.fillStyle=up?'#2bff88':'#ff3e7a';
  c.lineWidth=1;c.beginPath();c.moveTo(x+step/4,Y(k.hi));c.lineTo(x+step/4,Y(k.lo));c.stroke();const y1=Y(Math.max(k.o,k.c)),y2=Y(Math.min(k.o,k.c));c.fillRect(x,y1,step/2,Math.max(2,y2-y1))});c.globalAlpha=1}

function makeSynth(){
  let w,h,stars=[],city=[],candles=[],feed=candleFeed(),cOff=0,gOff=0;
  return{smoke:'#5d3f86',
    resize(W,H){w=W;h=H;stars=Array.from({length:80},()=>({x:rnd(0,w),y:rnd(0,h),r:rnd(.3,1.4),t:rnd(0,6)}));
      city=[];let x=-6;while(x<w+30){const bw=rnd(12,34);city.push({x,w:bw,h:rnd(.04,.2)*h,win:Array.from({length:6},()=>Math.random()<.4)});x+=bw+rnd(1,4)}
      candles=[];for(let i=0;i<Math.ceil(w/14)+3;i++)candles.push(feed.next())},
    crash(){feed.crash()},
    draw(c,E){const{t,dt,sp,gy}=E;
      const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#090320');g.addColorStop(.55,'#260a4d');g.addColorStop(1,'#5b1269');c.fillStyle=g;c.fillRect(-20,-20,w+40,h+40);
      c.fillStyle='#fff';for(const s of stars){s.y+=sp*14*dt*s.r;if(s.y>h)s.y-=h;c.globalAlpha=.35+.35*Math.sin(t*2+s.t);c.fillRect(s.x,s.y,s.r,s.r)}c.globalAlpha=1;
      cOff+=dt*(E.phase==='fly'?40*sp:10);while(cOff>=14){cOff-=14;candles.shift();candles.push(feed.next())}
      drawCandles(c,candles,cOff,h*.1,gy-h*.06,.42,14);
      if(gy<h+10){
        const sr=w*.26,sx=w*.5,sy=gy-h*.01;c.save();c.beginPath();for(let i=0;i<9;i++){const y0=sy-sr+i*sr/7.2,hh=sr/7.2-i*1.4;c.rect(sx-sr,y0,sr*2,Math.max(1,hh))}c.clip();
        const sg=c.createLinearGradient(0,sy-sr,0,sy);sg.addColorStop(0,'#ffd23f');sg.addColorStop(1,'#ff3ea5');c.fillStyle=sg;c.beginPath();c.arc(sx,sy,sr,Math.PI,0);c.fill();c.restore();
        city.forEach(b=>{c.fillStyle='#16072e';c.fillRect(b.x,gy-b.h,b.w,b.h);c.fillStyle='rgba(41,230,255,.5)';b.win.forEach((on,i)=>{if(on)c.fillRect(b.x+3+(i%2)*(b.w/2),gy-b.h+5+Math.floor(i/2)*9,2,3)})});
        const fg=c.createLinearGradient(0,gy,0,h);fg.addColorStop(0,'#2a0a4a');fg.addColorStop(1,'#0c0320');c.fillStyle=fg;c.fillRect(0,gy,w,h-gy+40);
        gOff=(gOff+dt*(E.phase==='fly'?1.2*sp:.25))%1;c.strokeStyle='#ff3ea5';
        for(let k=0;k<12;k++){const z=(k+gOff)/12,y=gy+(h-gy+60)*z*z;c.globalAlpha=.15+.75*z;c.lineWidth=1+z*1.5;c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
        c.globalAlpha=.55;c.lineWidth=1.2;for(let i=-10;i<=10;i++){c.beginPath();c.moveTo(w/2+i*w*.045,gy);c.lineTo(w/2+i*w*.42,h+60);c.stroke()}c.globalAlpha=1;
        c.fillStyle='rgba(255,62,165,.7)';c.fillRect(0,gy-1,w,2);}
    }};
}

function makeMoon(){
  let w,h,layers=[],neb=null,craters=[],sats=[];
  return{smoke:'#4a5570',
    resize(W,H){w=W;h=H;
      layers=[[.2,.5,110],[.5,.9,50],[1,1.4,20]].map(([s,r,n])=>({s,r,st:Array.from({length:n},()=>({x:rnd(0,w),y:rnd(0,h),t:rnd(0,6)}))}));
      craters=Array.from({length:9},()=>({a:rnd(0,6.283),d:rnd(0,.75),r:rnd(.07,.2)}));
      neb=document.createElement('canvas');const d=Math.min(2,window.devicePixelRatio||1);neb.width=Math.max(1,Math.round(w*d));neb.height=Math.max(1,Math.round(h*d));const n=neb.getContext('2d');n.scale(d,d);
      const bg=n.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#03020c');bg.addColorStop(1,'#0b0a2a');n.fillStyle=bg;n.fillRect(0,0,w,h);
      [[w*.1,h*.3,w*.8,'rgba(138,92,255,.28)'],[w*.95,h*.7,w*.9,'rgba(255,62,165,.18)'],[w*.6,h*.05,w*.6,'rgba(41,230,255,.12)']].forEach(([x,y,r,col])=>{const g=n.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');n.fillStyle=g;n.fillRect(0,0,w,h)})},
    crash(){},
    draw(c,E){const{t,dt,sp,gy,m}=E;const fly=E.phase==='fly';
      c.drawImage(neb,0,0,w,h);
      for(const L of layers){c.fillStyle='#e6ecff';for(const s of L.st){s.y+=(fly?80*sp:5)*L.s*dt;s.x-=(fly?30*sp:0)*L.s*dt;if(s.y>h){s.y=0;s.x=rnd(0,w*1.2)}if(s.x<0)s.x+=w;
        c.globalAlpha=(.4+.6*Math.abs(Math.sin(t*.8+s.t)))*(L.s<.3?.6:1);if(fly&&L.s===1&&sp>1.5){c.save();c.translate(s.x,s.y);c.rotate(.4);c.fillRect(0,0,L.r,L.r*(1+sp*4));c.restore()}else c.fillRect(s.x,s.y,L.r,L.r)}}c.globalAlpha=1;
      // the moon grows as the multiplier climbs
      const k=Math.pow(clamp(Math.log(Math.max(1,E.moonM))/Math.log(40),0,1),.75),R=lerp(16,w*.62,k),mx=lerp(w*.78,w*.7,k),my=lerp(h*.2,h*.08+R*.4,k);
      const gl=c.createRadialGradient(mx,my,R*.8,mx,my,R*1.6);gl.addColorStop(0,'rgba(255,240,210,.25)');gl.addColorStop(1,'rgba(255,240,210,0)');c.fillStyle=gl;c.beginPath();c.arc(mx,my,R*1.6,0,6.283);c.fill();
      const mg=c.createRadialGradient(mx-R*.35,my-R*.35,R*.1,mx,my,R);mg.addColorStop(0,'#fbf6e8');mg.addColorStop(.7,'#d9d2bd');mg.addColorStop(1,'#a59d88');c.fillStyle=mg;c.beginPath();c.arc(mx,my,R,0,6.283);c.fill();
      c.save();c.beginPath();c.arc(mx,my,R,0,6.283);c.clip();c.fillStyle='rgba(120,110,95,.35)';craters.forEach(q=>{c.beginPath();c.arc(mx+Math.cos(q.a)*q.d*R,my+Math.sin(q.a)*q.d*R,q.r*R,0,6.283);c.fill()});
      const sh=c.createLinearGradient(mx-R,my,mx+R,my);sh.addColorStop(0,'rgba(10,8,40,0)');sh.addColorStop(.7,'rgba(10,8,40,.1)');sh.addColorStop(1,'rgba(10,8,40,.55)');c.fillStyle=sh;c.fillRect(mx-R,my-R,R*2,R*2);c.restore();
      if(fly&&E.I>.35&&Math.random()<.01*sp)sats.push({x:w+20,y:rnd(h*.2,h*.7),v:rnd(80,160)*sp});
      for(let i=sats.length-1;i>=0;i--){const s=sats[i];s.x-=s.v*dt;s.y+=s.v*.35*dt;if(s.x<-40){sats.splice(i,1);continue}
        c.save();c.translate(s.x,s.y);c.rotate(.3);c.fillStyle='#8a92b8';c.fillRect(-3,-3,6,6);c.fillStyle='#29e6ff';c.fillRect(-13,-1.5,8,3);c.fillRect(5,-1.5,8,3);c.fillStyle=Math.sin(t*10)>0?'#ff3b6b':'#401020';c.fillRect(-1,-5,2,2);c.restore()}
      if(gy<h+60){const Re=w*1.6,cy=gy+Re-h*.02;
        const eg=c.createRadialGradient(w*.35,cy-Re,Re*.05,w*.5,cy,Re);eg.addColorStop(0,'#1f5fd1');eg.addColorStop(.35,'#123a8a');eg.addColorStop(1,'#050a22');c.fillStyle=eg;c.beginPath();c.arc(w/2,cy,Re,0,6.283);c.fill();
        c.save();c.shadowColor='#29e6ff';c.shadowBlur=22;c.strokeStyle='rgba(120,220,255,.9)';c.lineWidth=2;c.beginPath();c.arc(w/2,cy,Re,Math.PI*1.15,Math.PI*1.85);c.stroke();c.restore();
        c.fillStyle='rgba(255,210,63,.9)';for(let i=0;i<14;i++){const x=w*.12+i*w*.055;if(Math.sin(i*7.3)>0)c.fillRect(x,gy+6+Math.sin(i)*2,1.6,1.6)}}
    }};
}

function makeExch(){
  let w,h,cols=[],trail=[],feed=candleFeed(),candles=[],cOff=0,tape=0,hot=false;
  const TICK=['BTC ▲ 2.41%','TON ▲ 6.18%','ETH ▼ 0.82%','SOL ▲ 4.02%','DOGE ▲ 12.5%','NOT ▼ 3.30%','PEPE ▲ 21.7%','XRP ▲ 1.14%'];
  const tapeStr=TICK.join('     ')+'     ';
  return{smoke:'#2d4a3c',
    resize(W,H){w=W;h=H;cols=[];const n=Math.floor(w/70);for(let i=0;i<n;i++)cols.push({x:i*70+10,off:rnd(0,20),rows:Array.from({length:40},()=>({p:rnd(0.5,99).toFixed(2),q:rnd(1,999).toFixed(0),up:Math.random()<.55}))});
      candles=[];for(let i=0;i<Math.ceil(w/22)+3;i++)candles.push(feed.next())},
    crash(){feed.crash();hot=true},
    reset(){trail=[];hot=false},
    draw(c,E){const{t,dt,sp,gy}=E;const fly=E.phase==='fly';
      c.fillStyle='#040b08';c.fillRect(-20,-20,w+40,h+40);
      c.strokeStyle='rgba(43,255,136,.06)';c.lineWidth=1;const go=(t*sp*20)%32;
      for(let y=-32+go;y<h;y+=32){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}for(let x=0;x<w;x+=32){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
      c.font='500 9px JetBrains Mono,monospace';c.textBaseline='top';
      cols.forEach(col=>{col.off+=dt*(fly?50*sp:6);const rowH=13;const st=Math.floor(col.off/rowH);for(let r=0;r<Math.ceil(h/rowH)+1;r++){const row=col.rows[(r-st+4000)%col.rows.length];const y=r*rowH+(col.off%rowH)-rowH;
        c.fillStyle=row.up?'rgba(43,255,136,.16)':'rgba(255,62,122,.16)';c.fillText(row.p,col.x,y);c.fillStyle='rgba(200,220,210,.08)';c.fillText(row.q,col.x+34,y)}});
      cOff+=dt*(fly?30*sp:8);while(cOff>=22){cOff-=22;candles.shift();candles.push(feed.next())}
      drawCandles(c,candles,cOff,h*.14,gy-h*.04,.35,22);
      // the rocket draws the chart behind itself
      if(fly){trail.forEach(p=>p[1]+=E.dAlt);trail.push([E.tx,E.ty]);if(trail.length>400)trail.shift()}else if(E.phase==='crash'){trail.forEach(p=>p[1]+=E.dAlt)}
      if(trail.length>1){const col=hot?'#ff3e7a':'#2bff88';c.save();c.beginPath();trail.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));
        c.lineTo(trail[trail.length-1][0],h+10);c.lineTo(trail[0][0],h+10);c.closePath();const ag=c.createLinearGradient(0,E.ry,0,h);ag.addColorStop(0,hot?'rgba(255,62,122,.25)':'rgba(43,255,136,.22)');ag.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=ag;c.fill();
        c.beginPath();trail.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=col;c.lineWidth=2.5;c.shadowColor=col;c.shadowBlur=10;c.stroke();c.restore()}
      if(gy<h+30){c.fillStyle='#07130e';c.fillRect(0,gy,w,h-gy+40);c.fillStyle='rgba(43,255,136,.5)';c.fillRect(0,gy,w,1.5);
        for(let i=0;i<4;i++){const mx=w*.08+i*w*.24,mw=w*.18,mh=mw*.6;c.fillStyle='#0c1f17';rr(c,mx,gy+10,mw,mh,3);c.fill();c.strokeStyle='rgba(43,255,136,.35)';c.lineWidth=1;c.stroke();
          c.strokeStyle=i%2?'rgba(255,62,122,.8)':'rgba(43,255,136,.8)';c.beginPath();for(let j=0;j<=8;j++){const xx=mx+4+j*(mw-8)/8,yy=gy+10+mh*.7-(Math.sin(j*1.3+i+t*.8)*.25+j*.05*(i%2?-1:1)+.3)*mh*.5;j?c.lineTo(xx,yy):c.moveTo(xx,yy)}c.stroke()}}
      // ticker tape
      tape+=dt*(fly?60+30*sp:30);c.fillStyle='rgba(4,11,8,.85)';c.fillRect(0,h-22,w,22);c.fillStyle='rgba(43,255,136,.25)';c.fillRect(0,h-22,w,1);
      c.font='700 10.5px JetBrains Mono,monospace';c.textBaseline='middle';const tw=c.measureText(tapeStr).width;let x=-(tape%tw);
      while(x<w){let xx=x;TICK.forEach(s=>{c.fillStyle=s.includes('▲')?'#2bff88':'#ff3e7a';c.fillText(s,xx,h-11);xx+=c.measureText(s+'     ').width});x+=tw}
    }};
}
const BGS={synth:{ru:'Синтвейв-закат',en:'Synthwave Sunset',make:makeSynth},moon:{ru:'Курс на Луну',en:'To the Moon',make:makeMoon},exch:{ru:'Биржа',en:'Exchange',make:makeExch}};
