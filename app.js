/* ===== CONFIG ===== */
const API = "https://organism-backend.onrender.com"; // <- change if needed
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;

/* ===== DOM ===== */
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const statusWord = document.getElementById("status");
const heartbeat = document.getElementById("heartbeat");
const feedBtn = document.getElementById("feedBtn");
const tradeBtn = document.getElementById("tradeBtn");
const sfxBtn = document.getElementById("sfxBtn");

const healthBar = document.getElementById("healthBar");
const mutBar = document.getElementById("mutBar");
const healthPct = document.getElementById("healthPct");
const mutPct = document.getElementById("mutPct");
const stageNum = document.getElementById("stageNum");
const stageBadge = document.getElementById("stageBadge");
const decayRate = document.getElementById("decayRate");
const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar = document.getElementById("flowBar");
const flowLabel = document.getElementById("flowLabel");
const tradesBody = document.getElementById("trades-body");

/* ===== State ===== */
let health = 0.55;        // 0..1
let mutation = 0.06;      // 0..1
let stage = 1;
let sfx = false;

let lastPrice = 0;
let lastTs = 0;
let net = 0;              // -1..+1 recent net flow window
const flows = [];         // last N trades window
const FLOW_WINDOW = 20;

/* ===== Canvas sizing ===== */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * devicePixelRatio);
  canvas.height = Math.floor(rect.height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ===== Creature render (tease below panels) ===== */
let t0 = performance.now();
function drawOrganism() {
  const now = performance.now();
  const t = (now - t0) / 1000;

  const W = canvas.width / devicePixelRatio;
  const H = canvas.height / devicePixelRatio;
  ctx.clearRect(0,0,W,H);

  // Center slightly off so the lower globe peeks out
  const cx = W * 0.5;
  const cy = H * 0.72;
  const base = Math.min(W, H) * 0.36;

  // soft chamber glow
  const grad = ctx.createRadialGradient(cx, cy, base*0.1, cx, cy, base*1.3);
  grad.addColorStop(0, `rgba(145, 240, 215, ${0.20 + 0.08*Math.sin(t*1.2)})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, base*1.35, 0, Math.PI*2); ctx.fill();

  // nucleus
  const hue = 170 + 25*Math.sin(t*0.8);
  ctx.fillStyle = `hsla(${hue}, 70%, ${54 + 10*Math.sin(t*2)}%, .85)`;
  ctx.beginPath(); ctx.arc(cx, cy, base*(0.30 + 0.05*Math.sin(t*1.5)), 0, Math.PI*2); ctx.fill();

  // drift rings
  ctx.lineWidth = 1.2;
  for (let i=1;i<=5;i++){
    const r = base * (0.42 + i*0.12 + 0.02*Math.sin(t + i));
    ctx.strokeStyle = `rgba(130,180,210, ${0.08 - i*0.008})`;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  }

  // specks
  for (let i=0;i<18;i++){
    const rr = base*(0.18 + 0.68*Math.random());
    const a = t*0.12 + i*0.35;
    const x = cx + Math.cos(a+i)*rr;
    const y = cy + Math.sin(a+i)*rr*0.8;
    const d = 1.2 + (i%5===0 ? 2.5 : 0.8);
    ctx.fillStyle = `rgba(180, 220, 250, ${0.18 + 0.2*Math.random()})`;
    ctx.beginPath(); ctx.arc(x, y, d, 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/* ===== Helpers ===== */
const fmtUSD = n => typeof n === "number" ? `$${n.toFixed(4)}` : "$—";
const fmtUSDSmall = n => typeof n === "number" ? `$${n.toFixed(2)}` : "$—";
const fmtTime = ts => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  const ss = String(d.getSeconds()).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
};
function setHealth(v){ health = Math.max(0, Math.min(1, v)); healthBar.style.width = `${Math.round(health*100)}%`; healthPct.textContent = `${Math.round(health*100)}%`; }
function setMutation(v){ mutation = Math.max(0, Math.min(1, v)); mutBar.style.width = `${Math.round(mutation*100)}%`; mutPct.textContent = `${Math.round(mutation*100)}%`; }
function setStage(n){ stage = n; stageNum.textContent = String(n); stageBadge.textContent = n===1 ? "Stage 1 · The Cell" : `Stage ${n}`; }
function setFlow(v){
  // v should be -1..+1
  const mid = 50 + Math.round(v*50);
  flowBar.style.width = `${Math.max(6, Math.min(100, mid))}%`;
  flowLabel.textContent = v>0.04 ? "Feeding" : v<-0.04 ? "Starving" : "Neutral";
}

/* ===== Poll: /health ===== */
async function pollHealth(){
  try{
    const r = await fetch(`${API}/health`, { cache:"no-store" });
    const j = await r.json();
    const price = Number(j.price) || 0;
    lastPrice = price;
    lastTs = j.timestamp || Date.now();
    priceLabel.textContent = fmtUSDSmall(price);
    updatedLabel.textContent = fmtTime(lastTs);

    // gently push health with price vibration (demo)
    const target = 0.45 + Math.tanh(price*20)/10; // playful mapping
    setHealth(health*0.9 + target*0.1);
  }catch(e){
    updatedLabel.textContent = "—:—:—";
  }
}

/* ===== Normalize trades =====
 Accepts:
  A) our shape: [{ time, type, valueUsd, priceUsd }, ...]
  B) Jupiter-ish: [{ side:"BUY"/"SELL", price, amount, ts }, ...]
*/
function normalizeTrades(arr){
  return arr.map(x=>{
    if (x.time && x.type) return x;
    const type = (x.side || "").toLowerCase()==="buy" ? "feed" : "starve";
    const valueUsd = (x.price ?? 0) * (x.amount ?? 0);
    const priceUsd = x.price ?? 0;
    const time = x.ts ?? Date.now();
    return { time, type, valueUsd, priceUsd };
  });
}

/* ===== Poll: /trades ===== */
async function pollTrades(){
  try{
    const r = await fetch(`${API}/trades`, { cache:"no-store" });
    const j = await r.json();
    const list = Array.isArray(j) ? j : (j.trades || []);
    const trades = normalizeTrades(list)
      .sort((a,b)=>b.time-a.time)
      .slice(0,12);

    // Render
    tradesBody.innerHTML = "";
    let buys=0, sells=0;
    for (const tr of trades){
      const row = document.createElement("div");
      row.className = "trade";
      const t = fmtTime(tr.time);
      const typeTxt = tr.type === "feed" ? "Feed" : "Starve";
      const valueTxt = fmtUSDSmall(tr.valueUsd ?? 0);
      const priceTxt = fmtUSD(tr.priceUsd ?? 0);

      row.innerHTML = `
        <div class="c-time">${t}</div>
        <div class="c-type type ${tr.type}">${typeTxt}</div>
        <div class="c-value">${valueTxt}</div>
        <div class="c-price">${priceTxt}</div>
      `;
      tradesBody.appendChild(row);

      // Net flow window
      if (tr.type === "feed") buys += tr.valueUsd ?? 0;
      if (tr.type === "starve") sells += tr.valueUsd ?? 0;
    }
    const sum = buys + sells;
    const dir = sum>0 ? (buys - sells) / sum : 0;
    flows.push(dir);
    if (flows.length > FLOW_WINDOW) flows.shift();
    const avg = flows.reduce((a,b)=>a+b,0) / flows.length;
    setFlow(avg);

    // small nudge to health based on flow
    setHealth(health + avg*0.02);
  }catch(e){
    // ignore
  }
}

/* ===== Decay driver ===== */
function tickDecay(){
  setHealth(health - 0.01);           // 1% tick
  setMutation(mutation + 0.004*health); // slow creep
  if (health < 0.02 && stage>0){ /* could drop stage later */ }
}

/* ===== Interactions ===== */
sfxBtn.addEventListener("click", ()=> {
  sfx = !sfx;
  sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
});
feedBtn.addEventListener("click", (e)=>{
  e.preventDefault();
  setHealth(health + 0.06);
});

/* ===== Schedules ===== */
setInterval(tickDecay, 10_000);
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);

/* initial */
pollHealth();
pollTrades();

/* Optional: set your token’s Jupiter swap URL here */
tradeBtn.href = "#";
