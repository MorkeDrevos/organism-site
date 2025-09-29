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
const getCSS = (name)=>getComputedStyle(document.body).getPropertyValue(name).trim();
const hex2rgb=(hex)=>{ const m=(hex||"").match(/#?([0-9a-f]{6})/i); if(!m) return [255,255,255]; const n=parseInt(m[1],16); return [(n>>16)&255,(n>>8)&255,n&255]; };

/******** Visual State ********/
let W=0,H=0,t=0, heart=0;
let HEALTH=.58;
let MUT=.10;
let FLOW=.55;
let PRICE=.01;

const MOTES_MAX=34;        // slightly fewer & dimmer for realism
let motes=[];
let feedBursts=[];

/******** Resize ********/
function resize(){ canvas.width=W=innerWidth; canvas.height=H=innerHeight; }
addEventListener("resize", resize); resize();

/******** Stars / motes ********/
function ensureMotes(){
  while(motes.length<MOTES_MAX){
    motes.push({
      x: rnd(W), y: rnd(H),
      dx: (Math.random()-.5)*.18,
      dy: (Math.random()-.5)*.18,
      r: rnd(1.1, .6),
      tw: rnd(.006, .002),
      ph: rnd(TAU)
    });
  }
}

/******** Feed burst ********/
function spawnFeedBurst(cx,cy){
  for(let i=0;i<14;i++){
    feedBursts.push({
      x:cx, y:cy, r: rnd(2.2,1.1), a:1,
      dx:Math.cos((i/14)*TAU)*rnd(1.4,.5),
      dy:Math.sin((i/14)*TAU)*rnd(1.4,.5)
    });
  }
}

/******** Ripple band (warm caustics) ********/
function rippleBand(cx,cy, scale, freq, amp, alpha){
  const g = ctx.createRadialGradient(cx,cy, 10, cx,cy, Math.max(W,H)*scale);
  const ph = t*0.6;
  for(let i=0;i<=6;i++){
    const p=i/6;
    const wave = Math.sin(ph + p*TAU*freq)*amp;
    const a = Math.max(0, alpha*(.12 + .88*p) - Math.abs(wave)*0.28);
    // warm amber band
    g.addColorStop(p, `rgba(255, 190, 150, ${a})`);
  }
  ctx.fillStyle=g;
  ctx.fillRect(0,0,W,H);
}

/******** Draw ********/
function draw(){
  t+=0.016; heart=(heart+0.0065)%1; // slightly slower heartbeat
  ensureMotes();

  const cx=W*.5, cy=H*.62;

  /* ---- Womb fog (warm) ---- */
  // darker vignette, soft inner glow
  const fog = ctx.createRadialGradient(cx,cy, 10, cx,cy, Math.max(W,H)*1.2);
  fog.addColorStop(0, "rgba(70,32,34,.18)");
  fog.addColorStop(1, "rgba(12,6,7,1)");
  ctx.fillStyle=fog; ctx.fillRect(0,0,W,H);

  ctx.globalCompositeOperation="lighter";
  rippleBand(cx,cy, 1.18, .055, .22, 0.7);
  rippleBand(cx,cy, 1.62, .042, .16, 0.55);
  ctx.globalCompositeOperation="source-over";

  /* ---- Concentric echoable rings ---- */
  ctx.save();
  for(let i=1;i<=11;i++){
    const frac=i/11;
    const base = (Math.min(W,H)*.58)*frac;
    const wobble = Math.sin(t*.6+i*.9)*0.8 + Math.sin(t*1.3+i)*0.35;
    ctx.strokeStyle = `rgba(255,200,170,${.028 + MUT*0.028*(1-frac)})`;
    ctx.lineWidth = 1 + wobble*.12;
    ctx.beginPath();
    ctx.arc(cx, cy, base, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();

  /* ---- Core glow (warm heart) ---- */
  const R = 50 + Math.sin(heart*TAU)*2.6 + HEALTH*12;
  const halo = ctx.createRadialGradient(cx,cy,R*.25, cx,cy,R*2.0);
  halo.addColorStop(0, "rgba(255,245,240,.92)");
  halo.addColorStop(1, getCSS('--halo'));
  ctx.fillStyle=halo;
  ctx.beginPath(); ctx.arc(cx,cy,R*2.0,0,TAU); ctx.fill();

  ctx.fillStyle="rgba(255,249,246,.97)";
  ctx.beginPath(); ctx.arc(cx,cy,R,0,TAU); ctx.fill();

  /* ---- Chromatic echo: pink + amber split ---- */
  const echo = R*1.32 + Math.sin(t*1.2)*5 + MUT*26;
  ctx.lineWidth=2;
  ctx.strokeStyle=getCSS('--echoMag'); // pink
  ctx.beginPath(); ctx.arc(cx,cy,echo,0,TAU); ctx.stroke();
  ctx.strokeStyle=getCSS('--echoCya'); // amber
  ctx.beginPath(); ctx.arc(cx,cy,echo+1.5,0,TAU); ctx.stroke();

  /* ---- Tether (warmer tint, thicker root, slower sway) ---- */
  if (HEALTH>.26){
    const sway = Math.sin(t*.7)*14;
    const c1x=cx-86,  c1y=cy-8+sway*.5;
    const c2x=cx-206, c2y=cy-36+Math.cos(t*.55)*14;
    const endx=cx-310, endy=cy-64;

    const [r,g,b]=hex2rgb("#ffcc88"); // warm amber
    ctx.lineCap="round";
    for(let i=0;i<5;i++){
      const w = 11-i*1.7;
      ctx.lineWidth=Math.max(1,w);
      ctx.strokeStyle=`rgba(${r},${g},${b},${0.34 - i*0.055})`;
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.bezierCurveTo(c1x,c1y, c2x,c2y, endx,endy);
      ctx.stroke();
    }
  }

  /* ---- Motes (dim, reddish twinkle) ---- */
  for(const m of motes){
    m.x+=m.dx+Math.sin(t*.06+m.y*.0012)*.05;
    m.y+=m.dy+Math.cos(t*.05+m.x*.001)*.05;
    if(m.x<0||m.x>W) m.dx*=-1;
    if(m.y<0||m.y>H) m.dy*=-1;
    const tw = (Math.sin(t*m.tw+m.ph)+1)*.5;
    ctx.globalAlpha = .10 + tw*.28;
    ctx.fillStyle=`rgba(255,200,180,${.3+tw*.2})`;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r*(.8+tw*.9),0,TAU); ctx.fill();
  }
  ctx.globalAlpha=1;

  /* ---- Feed bursts (warm sparks) ---- */
  for(let i=feedBursts.length-1;i>=0;i--){
    const p=feedBursts[i];
    p.x+=p.dx; p.y+=p.dy; p.a*=0.94; p.r*=1.02;
    if(p.a<0.03){ feedBursts.splice(i,1); continue; }
    ctx.fillStyle=`rgba(255,210,180,${p.a*.75})`;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU); ctx.fill();
  }

  requestAnimationFrame(draw);
}

/******** Sim ********/
function simVitals(){
  const tgt = 0.55 + (FLOW-0.5)*0.22;
  HEALTH = clamp( lerp(HEALTH, tgt, 0.028) + (Math.random()-.5)*0.005 );
  MUT    = clamp( MUT + (Math.random()-.5)*0.0035, 0, 0.5 );
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
if(tradeBtn){ tradeBtn.href = `https://jup.ag/swap/SOL-${TOKEN_MINT}`; }

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
