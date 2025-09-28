
/***** CONFIG *****/
const API = "https://organism-backend.onrender.com"; // your backend base
const JUP_SWAP = "https://jup.ag/swap";               // set to your token link when ready

// DOM refs
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const statusWord   = document.getElementById("status");
const heartbeat    = document.getElementById("heartbeat");
const priceLabel   = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar      = document.getElementById("flowBar");
const flowNeedle   = document.getElementById("flowNeedle");
const flowLabel    = document.getElementById("flowLabel");

const healthBar = document.getElementById("healthBar");
const mutBar    = document.getElementById("mutBar");
const healthNum = document.getElementById("healthNum");
const mutNum    = document.getElementById("mutNum");
const decayRate = document.getElementById("decayRate");
const stageNum  = document.getElementById("stageNum");
const stageBadge= document.getElementById("stageBadge");

const tradesBody = document.getElementById("trades-body");
const feedBtn    = document.getElementById("feedBtn");
const sfxBtn     = document.getElementById("sfxBtn");
const tradeBtn   = document.getElementById("tradeBtn");

tradeBtn.href = JUP_SWAP;

/***** STATE *****/
let health = 0.66;     // 0..1 simulated start
let mutation = 0.06;   // 0..1
let stage = 1;
let decay = 0.01;      // 1% / 10m display
let sfx = false;

let lastPrice = 0;
let lastTs = 0;

let flowWindow = [];  // last 5 minutes of +value (buys) / -value (sells)

/***** UTIL *****/
const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));
const fmtUSD = (n)=> n == null ? "$—" : `$${Number(n).toFixed(4)}`;
const fmtMoney2 = (n)=> n == null ? "$—" : `$${Number(n).toFixed(2)}`;
const pad2 = (n)=> String(n).padStart(2,"0");
const fmtTime = (ts)=>{
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/***** CANVAS SIZING *****/
function resizeCanvas(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/***** ORGANISM DRAW (mysterious womb, always visible) *****/
function drawOrganism(){
  const W = canvas.width, H = canvas.height;
  const t = performance.now()/1000;

  ctx.clearRect(0,0,W,H);

  // position: slightly below center so it peeks around panels
  const cx = W*0.52;
  const cy = H*0.70;

  // big womb gradient (elliptical)
  const baseR = Math.min(W,H)*0.58;
  const grad = ctx.createRadialGradient(cx, cy, baseR*0.05, cx, cy, baseR*1.1);
  grad.addColorStop(0,   `rgba(120,210,230,0.20)`);
  grad.addColorStop(0.5, `rgba(72,130,200,0.10)`);
  grad.addColorStop(1,   `rgba(10,20,35,0.0)`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, baseR, 0, Math.PI*2); ctx.fill();

  // nucleus pulse (tied to health)
  const pulse = 0.12 + 0.2*Math.sin(t*2.2);
  const r = baseR*(0.10 + 0.18*health + pulse*0.05);
  ctx.fillStyle = `rgba(160,255,235,0.24)`;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();

  // concentric rings drifting
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(140,200,255,0.10)";
  for(let i=0;i<5;i++){
    const rr = baseR*(0.30 + 0.12*i + 0.02*Math.sin(t*0.8 + i));
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI*2); ctx.stroke();
  }

  // drifting specs
  for(let i=0;i<14;i++){
    const a = t*0.07 + i*0.6;
    const rr = baseR*(0.25 + 0.65*(i/14));
    const x = cx + Math.cos(a)*rr;
    const y = cy + Math.sin(a*1.2)*rr*0.6;
    ctx.fillStyle = "rgba(200,255,255,0.18)";
    ctx.beginPath(); ctx.arc(x,y, 1.6 + 1.2*Math.sin(t*2+i), 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/***** HEALTH/MUTATION UI *****/
function setHealth(v){
  health = clamp(v,0,1);
  healthBar.style.width = `${Math.round(health*100)}%`;
  healthNum.textContent = `${Math.round(health*100)}%`;
}
function setMutation(v){
  mutation = clamp(v,0,1);
  mutBar.style.width = `${Math.round(mutation*100)}%`;
  mutNum.textContent = `${Math.round(mutation*100)}%`;
}
function setStage(n){
  stage = n;
  stageNum.textContent = String(n);
  stageBadge.textContent = n===1 ? "Stage 1 · The Cell" : `Stage ${n}`;
}
function setFlow(v){
  // v is -1..+1, map to bar width & label
  const W = flowBar.clientWidth;
  const x = (v*0.45 + 0.5)*W; // keep needle inside
  flowNeedle.style.left = `${Math.round(x)}px`;
  flowLabel.textContent = v>0.08 ? "Feeding" : v<-0.08 ? "Starving" : "Neutral";
}

/***** POLLERS (backend) *****/
const POLL_HEALTH_MS = 6_000;
const POLL_TRADES_MS = 6_000;

async function pollHealth(){
  try{
    const resp = await fetch(`${API}/health`, { cache:"no-store" });
    const j = await resp.json();
    lastPrice = Number(j.price)||0;
    lastTs = j.timestamp || Date.now();

    priceLabel.textContent   = fmtUSD(lastPrice);
    updatedLabel.textContent = fmtTime(lastTs);

    // nudge health toward price bands (demo)
    const target = clamp(lastPrice*10,0,1); // simple demo mapping
    const delta = (target - health)*0.12;
    setHealth(health + delta);

    // small creep of mutation
    setMutation(mutation + 0.002);
  }catch(e){
    console.error("health fetch error:", e);
  }
}

async function pollTrades(){
  try{
    const resp = await fetch(`${API}/trades`, { cache:"no-store" });
    const arr = await resp.json();

    // Accept either normalized or Jupiter-like objects
    const norm = arr.map(row => {
      if (row.time && row.type){            // normalized already
        return row;
      } else {
        // Jupiter-ish
        const side = (row.side || "").toLowerCase()==="buy" ? "feed" : "starve";
        const priceUsd = Number(row.price || 0);
        const valueUsd = Number(row.valueUsd || (priceUsd * Number(row.amount||0)));
        return { time: row.ts || row.time || Date.now(), type: side, valueUsd, priceUsd };
      }
    });

    // render latest 8
    renderTrades(norm.slice(0,8));

    // update net flow window (5m)
    const now = Date.now();
    for (const t of norm) {
      const signed = t.type==="feed" ? +Number(t.valueUsd||0) : -Number(t.valueUsd||0);
      flowWindow.push({ ts: now, v: signed });
    }
    // purge >5m
    const cutoff = now - 5*60*1000;
    flowWindow = flowWindow.filter(x => x.ts >= cutoff);
    const sum = flowWindow.reduce((a,b)=>a+b.v,0);
    const net = clamp(sum/100, -1, +1); // scale to -1..1 for needle
    setFlow(net);
    // nudge health a hair in net direction
    setHealth(health + net*0.02);
  }catch(e){
    console.error("trades fetch error:", e);
  }
}

function renderTrades(list){
  tradesBody.innerHTML = "";
  for(const r of list){
    const tr = document.createElement("tr");
    const cls = r.type==="feed" ? "type-feed" : "type-starve";
    tr.innerHTML = `
      <td>${fmtTime(r.time)}</td>
      <td class="${cls}">${r.type === "feed" ? "Feed" : "Starve"}</td>
      <td>${fmtMoney2(r.valueUsd)}</td>
      <td>${fmtUSD(r.priceUsd ?? r.price)}</td>
    `;
    tradesBody.appendChild(tr);
  }
}

/***** DECAY *****/
function tickDecay(){
  setHealth(health - 0.006);     // slow drift down
  if (health>0.85) setMutation(mutation + 0.004); // high health accelerates mutation
}

/***** INTERACTIONS *****/
feedBtn.addEventListener("click", (ev)=>{
  ev.preventDefault();
  setHealth(health + 0.05); // micro-boost
});
sfxBtn.addEventListener("click", ()=>{
  sfx = !sfx;
  sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
});

/***** SCHEDULES *****/
setInterval(tickDecay, 10_000);
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);

// initial
pollHealth();
pollTrades();

const pulse = 0.1 * Math.sin(t * 2) + 1; 
ctx.beginPath();
ctx.arc(Cx, Cy, baseR * pulse, 0, 2 * Math.PI);
ctx.fillStyle = `hsla(${hue}, 80%, 55%, 0.25)`;
ctx.fill();

for (let i = 0; i < 20; i++) {
  const a = t * 0.2 + i;
  const r = 200 + 50 * Math.sin(t * 0.3 + i);
  const x = Cx + Math.cos(a) * r;
  const y = Cy + Math.sin(a) * r;

  ctx.beginPath();
  ctx.arc(x, y, 2, 0, 2 * Math.PI);
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fill();
}
const grad = ctx.createRadialGradient(Cx, Cy, 0, Cx, Cy, 300);
grad.addColorStop(0, "rgba(0,255,200,0.15)");
grad.addColorStop(1, "rgba(0,0,0,0)");
ctx.fillStyle = grad;
ctx.fillRect(0, 0, W, H);
