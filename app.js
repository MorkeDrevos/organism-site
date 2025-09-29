/******** CONFIG (set your token CA once) ********/
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
const nowHHMMSS = ()=>{
  const d=new Date(); const p=n=>String(n).padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/******** Visual State (creature only) ********/
let W=0,H=0,t=0;
let HEALTH=.55;     // influences core size + glow
let MUT=.08;        // unlocks echo/tether intensity
let FLOW=.55;       // nudges health slowly
let PRICE=.01;

let motes=[];       // floating particles
let heart=0;        // heartbeat phase (0..1)

/******** Resize ********/
function resize(){ canvas.width=W=innerWidth; canvas.height=H=innerHeight; }
addEventListener("resize", resize); resize();

/******** Creature Draw ********/
function draw(){
  t+=0.016; heart=(heart+0.008)%1;

  // background haze + vignette
  const bg = ctx.createRadialGradient(W*.5,H*.62, 40, W*.5,H*.35, Math.max(W,H));
  bg.addColorStop(0, "rgba(25,35,60,.14)");
  bg.addColorStop(1, "rgba(5,6,10,1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,W,H);

  const cx=W*.5, cy=H*.62;

  // concentric rings, slight wobble, bioluminescent edge
  ctx.save();
  ctx.strokeStyle = `rgba(110,242,222,${.06 + MUT*0.06})`;
  for(let i=1;i<=12;i++){
    const base = (Math.min(W,H)*.56)*(i/12);
    const wobble = Math.sin(t*.6+i*.9)*0.8;
    ctx.lineWidth = 1 + wobble;
    ctx.beginPath();
    ctx.arc(cx, cy, base, 0, Math.PI*2);
    ctx.stroke();
  }
  ctx.restore();

  // nucleus core (breathing with heartbeat)
  const R = 46 + Math.sin(heart*2*Math.PI)*3 + HEALTH*10;
  const glow = ctx.createRadialGradient(cx,cy,R*.2, cx,cy,R*1.8);
  glow.addColorStop(0, "rgba(255,255,255,.95)");
  glow.addColorStop(1, "rgba(110,242,222,.10)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx,cy,R*1.8,0,Math.PI*2); ctx.fill();

  // inner core
  ctx.fillStyle="rgba(240,255,255,.98)";
  ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();

  // magenta echo ring (subtle, more visible with mutation)
  const echoR = R*1.25 + Math.sin(t*1.9)*6 + MUT*28;
  ctx.strokeStyle="rgba(255,102,204,.35)";
  ctx.lineWidth=2;
  ctx.beginPath(); ctx.arc(cx,cy,echoR,0,Math.PI*2); ctx.stroke();

  // tether cord (appears stronger as health rises)
  if (HEALTH>.35){
    ctx.strokeStyle="rgba(110,242,222,.45)";
    ctx.lineWidth=6; ctx.lineCap="round";
    ctx.beginPath();
    const c1x=cx-90,  c1y=cy-15+Math.sin(t*.8)*18;
    const c2x=cx-180, c2y=cy-35+Math.cos(t*.6)*16;
    ctx.moveTo(cx,cy); ctx.bezierCurveTo(c1x,c1y,c2x,c2y, cx-260, cy-60); ctx.stroke();
  }

  // motes (amniotic drift)
  const target = 36;
  if(motes.length<target){
    for(let i=motes.length;i<target;i++){
      motes.push({x:Math.random()*W,y:Math.random()*H,dx:(Math.random()-.5)*.35,dy:(Math.random()-.5)*.35,r:1+Math.random()*1.7});
    }
  }
  ctx.fillStyle="rgba(220,235,255,.22)";
  for(const m of motes){
    m.x+=m.dx+Math.sin(t*.05+m.y*.001)*.07;
    m.y+=m.dy+Math.cos(t*.05+m.x*.001)*.07;
    if(m.x<0||m.x>W) m.dx*=-1;
    if(m.y<0||m.y>H) m.dy*=-1;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

/******** Tiny Sim for visuals (no UI boxes) ********/
function simVitals(){
  // flow seeks a target health, adds a living feel
  const tgt = 0.55 + (FLOW-0.5)*0.25;
  HEALTH = clamp( HEALTH + (tgt-HEALTH)*0.03 + (Math.random()-.5)*0.008 );
  MUT    = clamp( MUT + (Math.random()-.5)*0.006, 0, 0.45 );
}
function simPrice(){
  const drift=(Math.random()-.5)*0.02;
  PRICE=Math.max(0.01, PRICE+drift);
  priceLabel.textContent = PRICE.toFixed(2);
}

/******** Buttons (kept so you can “feed” while we iterate visuals) ********/
feedBtn.addEventListener("click",(e)=>{
  e.preventDefault();
  FLOW = clamp(FLOW + .06);
  HEALTH = clamp(HEALTH + .02);
});
tradeBtn.href = `https://jup.ag/swap/SOL-${TOKEN_MINT}`;

/******** Clock ********/
function tickClock(){ updatedEl.textContent = nowHHMMSS(); }

/******** Boot ********/
function boot(){
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(simVitals, 4000);
  setInterval(simPrice, 6000);
}
boot();
