/******** CONFIG ********/
const TOKEN_MINT = "YOUR_CA_HERE";

/******** DOM ********/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha:true });
const priceLabel = document.getElementById("priceLabel");
const updatedEl  = document.getElementById("updatedLabel");
const feedBtn    = document.getElementById("feedBtn");
const tradeBtn   = document.getElementById("tradeBtn");

/******** Helpers ********/
const clamp = (v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const lerp  = (a,b,t)=>a+(b-a)*t;
const TAU = Math.PI*2;
const rnd = (a=1,b=0)=>Math.random()*(b-a)+a;
const nowHHMMSS = ()=>{
  const d=new Date(); const p=n=>String(n).padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/******** Visual State ********/
let W=0,H=0,t=0, heart=0;
let HEALTH=.58;      // 0..1 – core size + glow strength
let MUT=.10;         // 0..1 – echo ring/chromatic intensity
let FLOW=.55;        // 0..1 – set point the health tends to
let PRICE=.01;

const MOTES_MAX=42;
let motes=[];
let feedBursts=[];   // short-lived pulses when Feed is clicked

/******** Resize ********/
function resize(){ canvas.width=W=innerWidth; canvas.height=H=innerHeight; }
addEventListener("resize", resize); resize();

/******** Seed field (background stars) ********/
function ensureMotes(){
  while(motes.length<MOTES_MAX){
    motes.push({
      x: rnd(W), y: rnd(H),
      dx: (Math.random()-.5)*.25,
      dy: (Math.random()-.5)*.25,
      r: rnd(1.2, .6),
      tw: rnd(.008, .003),
      ph: rnd(TAU)
    });
  }
}

/******** Feed burst ********/
function spawnFeedBurst(cx,cy){
  for(let i=0;i<18;i++){
    feedBursts.push({
      x:cx, y:cy, r: rnd(2.5,1.2), a:1,
      dx:Math.cos((i/18)*TAU)*rnd(1.8,.6),
      dy:Math.sin((i/18)*TAU)*rnd(1.8,.6)
    });
  }
}

/******** Draw ********/
function draw(){
  t+=0.016; heart=(heart+0.008)%1;
  ensureMotes();

  const cx=W*.5, cy=H*.62;

  /* ---- Womb fog & vignette ---- */
  const fog = ctx.createRadialGradient(cx,cy, 20, cx,cy, Math.max(W,H)*1.2);
  fog.addColorStop(0, "rgba(30,44,70,.16)");
  fog.addColorStop(1, "rgba(5,6,10,1)");
  ctx.fillStyle=fog; ctx.fillRect(0,0,W,H);

  // subtle caustic ripples (two large moving bands blended)
  ctx.globalCompositeOperation="lighter";
  rippleBand(cx,cy, 1.2,  .06,  .25, 0.9);
  rippleBand(cx,cy, 1.65, .045, .18, 0.6);
  ctx.globalCompositeOperation="source-over";

  /* ---- Concentric rings (bioluminescent) ---- */
  ctx.save();
  for(let i=1;i<=12;i++){
    const frac=i/12;
    const base = (Math.min(W,H)*.58)*frac;
    const wobble = Math.sin(t*.7+i*.9)*0.9 + Math.sin(t*1.7+i)*0.4;
    ctx.strokeStyle = `rgba(160,240,255,${.035 + MUT*0.03*(1-frac)})`;
    ctx.lineWidth = 1 + wobble*.15;
    ctx.beginPath();
    ctx.arc(cx, cy, base, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  /* ---- Core glow (heartbeat) ---- */
  const R = 52 + Math.sin(heart*TAU)*3 + HEALTH*12;
  const halo = ctx.createRadialGradient(cx,cy,R*.25, cx,cy,R*2.1);
  halo.addColorStop(0, "rgba(255,255,255,.95)");
  halo.addColorStop(1, getCSS('--halo'));
  ctx.fillStyle=halo;
  ctx.beginPath(); ctx.arc(cx,cy,R*2.1,0,TAU); ctx.fill();

  ctx.fillStyle="rgba(255,255,255,.98)";
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fill();

  /* ---- Chromatic echo (split aqua/magenta) ---- */
  const echo = R*1.35 + Math.sin(t*1.4)*6 + MUT*30;
  ctx.lineWidth=2;
  // magenta layer (slightly offset phase)
  ctx.strokeStyle=getCSS('--echoMag');
  ctx.beginPath(); ctx.arc(cx,cy,echo,0,TAU); ctx.stroke();
  // cyan layer
  ctx.strokeStyle=getCSS('--echoCya');
  ctx.beginPath(); ctx.arc(cx,cy,echo+2,0,TAU); ctx.stroke();

  /* ---- Tether (sine sway, thicker root) ---- */
  if (HEALTH>.28){
    const sway = Math.sin(t*.9)*18;
    const c1x=cx-90,  c1y=cy-10+sway*.5;
    const c2x=cx-210, c2y=cy-40+Math.cos(t*.7)*16;
    const endx=cx-310, endy=cy-70;

    ctx.strokeStyle=`rgba( ${hex2rgb(getCSS('--aqua')).join(',')}, .45)`;
    ctx.lineCap="round";
    // tapered stroke: draw multiple strokes decreasing width & alpha
    for(let i=0;i<5;i++){
      const w = 10-i*1.6;
      ctx.lineWidth=Math.max(1,w);
      ctx.globalAlpha = 0.35 - i*0.05;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.bezierCurveTo(c1x,c1y, c2x,c2y, endx,endy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Motes (twinkle drift) ---- */
  ctx.fillStyle="rgba(220,235,255,.2)";
  for(const m of motes){
    m.x+=m.dx+Math.sin(t*.07+m.y*.0015)*.06;
    m.y+=m.dy+Math.cos(t*.06+m.x*.0012)*.06;
    if(m.x<0||m.x>W) m.dx*=-1;
    if(m.y<0||m.y>H) m.dy*=-1;
    const tw = (Math.sin(t*m.tw+m.ph)+1)*.5; // 0..1
    ctx.globalAlpha = .15 + tw*.35;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r*(.8+tw*.9),0,TAU); ctx.fill();
  }
  ctx.globalAlpha=1;

  /* ---- Feed bursts ---- */
  for(let i=feedBursts.length-1;i>=0;i--){
    const p=feedBursts[i];
    p.x+=p.dx; p.y+=p.dy; p.a*=0.94; p.r*=1.02;
    if(p.a<0.03){ feedBursts.splice(i,1); continue; }
    ctx.fillStyle=`rgba(255,255,255,${p.a*.7})`;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill();
  }

  requestAnimationFrame(draw);
}

/* cheap ripple band shader-ish */
function rippleBand(cx,cy, scale, freq, amp, alpha){
  const g = ctx.createRadialGradient(cx,cy, 10, cx,cy, Math.max(W,H)*scale);
  const ph = t*0.7;
  for(let i=0;i<=6;i++){
    const p=i/6;
    const wave = Math.sin(ph + p*TAU*freq)*amp;
    const a = Math.max(0, alpha*(.15 + .85*p) - Math.abs(wave)*0.3);
    g.addColorStop(p, `rgba(160,200,255,${a})`);
  }
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);
}

/******** Sim ********/
function simVitals(){
  const tgt = 0.55 + (FLOW-0.5)*0.25;
  HEALTH = clamp( lerp(HEALTH, tgt, 0.03) + (Math.random()-.5)*0.006 );
  MUT    = clamp( MUT + (Math.random()-.5)*0.004, 0, 0.5 );
}
function simPrice(){
  const drift=(Math.random()-.5)*0.02;
  PRICE=Math.max(0.01, PRICE+drift);
  if(priceLabel) priceLabel.textContent = PRICE.toFixed(2);
}

/******** Buttons ********/
if(feedBtn){
  feedBtn.addEventListener("click",(e)=>{
    e.preventDefault();
    FLOW = clamp(FLOW + .06);
    HEALTH = clamp(HEALTH + .02);
    spawnFeedBurst(W*.5, H*.62);
  });
}
if(tradeBtn){
  tradeBtn.href = `https://jup.ag/swap/SOL-${TOKEN_MINT}`;
}

/******** Clock ********/
function tickClock(){ if(updatedEl) updatedEl.textContent = nowHHMMSS(); }

/******** Boot ********/
function boot(){
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(simVitals, 4000);
  setInterval(simPrice, 6000);
  requestAnimationFrame(draw);
}
boot();

/******** Utilities ********/
function getCSS(name){ return getComputedStyle(document.body).getPropertyValue(name).trim() }
function hex2rgb(hex){
  // accepts #rrggbb
  const m = (hex||"").match(/#?([0-9a-f]{6})/i);
  if(!m) return [255,255,255];
  const n = parseInt(m[1],16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}
