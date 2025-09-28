/******** CONFIG ********/
const API_BASE = "";          // ← set later if you wire a backend ('' keeps the sim)
const TOKEN_MINT = "YOUR_CA_HERE"; // ← put your CA here (used when you wire real APIs)

/******** DOM ********/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const stageNum     = document.getElementById("stageNum");
const stageChip    = document.getElementById("stageChip");
const priceLabel   = document.getElementById("priceLabel");
const priceFoot    = document.getElementById("priceFoot");
const updatedLabel = document.getElementById("updatedLabel");
const clockEl      = document.getElementById("clock");
const flowBar      = document.getElementById("flowBar");

const healthBar    = document.getElementById("healthBar");
const mutBar       = document.getElementById("mutBar");
const healthPct    = document.getElementById("healthPct");
const mutPct       = document.getElementById("mutPct");

const feedBtn      = document.getElementById("feedBtn");
const tradeBtn     = document.getElementById("tradeBtn");
const logList      = document.getElementById("logList");

const traitBars = {
  biolume: { bar: document.getElementById("trait-biolume-bar"), pct: document.getElementById("trait-biolume-pct"), v: 0 },
  rings:   { bar: document.getElementById("trait-rings-bar"),   pct: document.getElementById("trait-rings-pct"),   v: 0 },
  sparks:  { bar: document.getElementById("trait-sparks-bar"),  pct: document.getElementById("trait-sparks-pct"),  v: 0 },
};

/******** Helpers ********/
const clamp = (v, a=0, b=1) => Math.min(b, Math.max(a, v));
const nowHHMMSS = () => {
  const d=new Date(); const p=(n)=>String(n).padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const fmtUSD = (n) => `$${Number(n).toFixed(2)}`;

/******** State ********/
let W=0,H=0,t=0;
let HEALTH = 0.52;
let MUT    = 0.08;
let STAGE  = 1;
let FLOW   = 0.5;   // 0..1 left↔right
let PRICE  = 0.01;

// for canvas motes & ripple
let motes = [];
const RINGS = 8;

/******** Canvas Setup ********/
function resize(){
  canvas.width = W = window.innerWidth;
  canvas.height = H = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

/******** Creature Render ********/
function drawOrganism(){
  t += 0.016;

  // backdrop gradient & vignette
  const bg = ctx.createRadialGradient(W*0.5, H*0.65, 40, W*0.5, H*0.3, Math.max(W,H));
  bg.addColorStop(0, "rgba(20,26,44, .25)");
  bg.addColorStop(1, "rgba(5,6,11, 1)");
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,W,H);

  // soft haze
  ctx.save();
  const haze = ctx.createRadialGradient(W*0.5, H*0.65, 10, W*0.5, H*0.5, Math.max(W,H)*0.9);
  haze.addColorStop(0, "rgba(160,240,255,.20)");
  haze.addColorStop(1, "rgba(160,240,255,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = haze;
  ctx.beginPath(); ctx.arc(W*0.5,H*0.62, Math.max(W,H)*0.9, 0, Math.PI*2); ctx.fill();
  ctx.restore();

  // concentric echo rings
  ctx.save();
  ctx.strokeStyle = "rgba(120,200,255,.12)";
  for(let i=1;i<=RINGS;i++){
    const rr = (Math.min(W,H)*0.55)*(i/RINGS);
    ctx.lineWidth = 1 + Math.sin(t*0.7 + i)*0.5;
    ctx.beginPath(); ctx.arc(W*0.5,H*0.62, rr, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // nucleus
  const nucR = 42 + Math.sin(t*1.5)*3 + HEALTH*8;
  const cx = W*0.5, cy = H*0.62;
  const glow = ctx.createRadialGradient(cx,cy, nucR*0.2, cx,cy, nucR*1.6);
  glow.addColorStop(0, "rgba(205,235,255,.85)");
  glow.addColorStop(1, "rgba(100,180,255,.05)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx,cy,nucR*1.6,0,Math.PI*2); ctx.fill();

  ctx.fillStyle = "rgba(215,245,255,.95)";
  ctx.beginPath(); ctx.arc(cx,cy,nucR,0,Math.PI*2); ctx.fill();

  // umbilical tether
  ctx.save();
  ctx.strokeStyle = "rgba(180,220,255,.45)";
  ctx.lineWidth = 6; ctx.lineCap = "round";
  const ax = cx, ay = cy;
  const bx = cx - 260, by = cy - 60;
  const c1x = cx - 90, c1y = cy - 20 + Math.sin(t*0.8)*16;
  const c2x = cx - 180, c2y = cy - 40 + Math.cos(t*0.6)*14;
  ctx.beginPath();
  ctx.moveTo(ax,ay); ctx.bezierCurveTo(c1x,c1y, c2x,c2y, bx,by); ctx.stroke();
  ctx.restore();

  // motes
  if (!motes.length){
    for(let i=0;i<28;i++){
      motes.push({
        x: Math.random()*W, y: Math.random()*H,
        dx: (Math.random()-.5)*0.4, dy: (Math.random()-.5)*0.4,
        r: 1+Math.random()*1.8
      });
    }
  }
  ctx.fillStyle = "rgba(200,220,255,.25)";
  for(const m of motes){
    m.x += m.dx + Math.sin(t*0.05+m.y*0.001)*0.08;
    m.y += m.dy + Math.cos(t*0.04+m.x*0.001)*0.08;
    if (m.x<0||m.x>W) m.dx*=-1;
    if (m.y<0||m.y>H) m.dy*=-1;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/******** UI setters ********/
function setStage(n){
  STAGE = n;
  stageNum.textContent = String(n);
  stageChip.textContent = String(n);
}
function setHealth(p){ // 0..1
  HEALTH = clamp(p);
  const pct = Math.round(HEALTH*100);
  healthPct.textContent = pct + "%";
  healthBar.style.width = pct + "%";
}
function setMutation(p){
  MUT = clamp(p);
  const pct = Math.round(MUT*100);
  mutPct.textContent = pct + "%";
  mutBar.style.width = pct + "%";
  // traits grow with mutation over time
  traitBars.biolume.v = clamp(traitBars.biolume.v + MUT*0.01);
  traitBars.rings.v   = clamp(traitBars.rings.v   + MUT*0.012);
  traitBars.sparks.v  = clamp(traitBars.sparks.v  + MUT*0.009);
  renderTraits();
}
function setFlow(p){ // 0..1
  FLOW = clamp(p);
  flowBar.style.width = (FLOW*100) + "%";
}
function setPrice(n){
  PRICE = n;
  priceLabel.textContent = n.toFixed(2);
  priceFoot.textContent = n.toFixed(2);
}
function tickClock(){
  updatedLabel.textContent = nowHHMMSS();
  clockEl.textContent = nowHHMMSS();
}

/******** Traits render ********/
function renderTraits(){
  for (const k of Object.keys(traitBars)){
    const { bar, pct, v } = traitBars[k];
    const P = Math.round(v*100);
    bar.style.width = P + "%";
    pct.textContent = P + "%";
  }
}

/******** Evolution Log ********/
const MAX_LOG = 16; // keeps it light; we’ll only *show* latest 8 by CSS height
function pushLog(type, valueUsd){
  const li = document.createElement("li");
  const badge = document.createElement("span");
  badge.className = "badge " + (type==="Feed" ? "feed" : "starve");
  badge.textContent = type;

  const val = document.createElement("span");
  val.className="val";
  val.textContent = fmtUSD(valueUsd);

  const tt = document.createElement("span");
  tt.className="t";
  tt.textContent = nowHHMMSS();

  li.appendChild(badge);
  li.appendChild(val);
  li.appendChild(tt);

  logList.insertBefore(li, logList.firstChild);
  while (logList.children.length > MAX_LOG) logList.removeChild(logList.lastChild);
}

/******** Sim / Pollers ********/
/* If you want real endpoints later, set API_BASE and replace these with fetchers:

   async function pollHealth() {
     const r = await fetch(`${API_BASE}/health?mint=${TOKEN_MINT}`);
     const j = await r.json(); setPrice(j.price); tickClock(); setHealth(j.health ?? HEALTH);
   }
   async function pollEvents() {
     const r = await fetch(`${API_BASE}/trades?mint=${TOKEN_MINT}&limit=5`);
     const items = await r.json();
     items.forEach(x => pushLog(x.type, x.valueUsd));
   }
*/

function simTick(){
  // drift flow needle and health slowly to feel "alive"
  const tgt = 0.55 + (FLOW-0.5)*0.2;
  const nextH = HEALTH + (tgt-HEALTH)*0.04 + (Math.random()-.5)*0.01;
  setHealth(clamp(nextH));

  // mutation wanders gently
  const nextM = MUT + (Math.random()-.5)*0.01;
  setMutation(clamp(nextM,0,0.35));
}
function simTrades(){
  // ~every 12s, a small feed/starve
  const isFeed = Math.random() > 0.5;
  const usd = 5 + Math.random()*40;
  pushLog(isFeed ? "Feed" : "Starve", usd);

  // tiny nudge needle + health
  const delta = (usd/1000) * (isFeed ? +1 : -1);
  setFlow(clamp(FLOW + delta*2));
  setHealth(clamp(HEALTH + delta*0.3));
}

/******** Wire buttons ********/
feedBtn.addEventListener("click", (ev)=>{
  ev.preventDefault();
  pushLog("Feed", 12 + Math.random()*28);
  setFlow(clamp(FLOW + 0.06));
  setHealth(clamp(HEALTH + 0.02));
});

/******** Boot ********/
function boot(){
  setStage(1);
  setHealth(HEALTH);
  setMutation(MUT);
  setFlow(0.5);
  setPrice(0.01);
  tickClock();
  renderTraits();

  // link your swap if you want a prefilled CA
  tradeBtn.href = `https://jup.ag/swap/SOL-${TOKEN_MINT}`;

  setInterval(tickClock, 1_000);
  setInterval(simTick, 4_000);
  setInterval(simTrades, 12_000);
}
boot();
