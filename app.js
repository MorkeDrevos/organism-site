// ====== CONFIG ======
const API = "https://organism-backend.onrender.com"; // change if your backend URL differs

// ====== Canvas setup (fullscreen womb) ======
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ====== Teasing layout: center slightly offset so glow spills offscreen ======
function drawOrganism() {
  const W = canvas.width, H = canvas.height;
  const t = performance.now() / 1000;

  // clear with very soft vignette
  ctx.clearRect(0, 0, W, H);

  // off-center to tease
  const cx = W * 0.42;
  const cy = H * 0.44;

  // size relative to viewport
  const base = Math.min(W, H) * 0.24;
  const pulse = base + Math.sin(t * 1.3) * (base * 0.08);

  // nucleus glow
  const g = ctx.createRadialGradient(cx, cy, base * 0.08, cx, cy, pulse);
  g.addColorStop(0, "rgba(120,255,235,0.95)");
  g.addColorStop(0.4, "rgba(90,220,230,0.35)");
  g.addColorStop(1, "rgba(10,25,40,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
  ctx.fill();

  // concentric “womb” rings drifting
  ctx.lineWidth = 1.2;
  for (let i = 1; i <= 5; i++) {
    ctx.strokeStyle = `rgba(180,220,255,${0.06 + 0.04*Math.sin(t*0.5 + i)})`;
    ctx.beginPath();
    ctx.arc(cx, cy, base * (0.6 + i*0.35) + Math.sin(t*0.6 + i)*4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // drifting specks
  for (let i=0;i<14;i++){
    const ang = t*0.25 + i*0.45;
    const r = base * (1.2 + (i%5)*0.25);
    const px = cx + Math.cos(ang) * r;
    const py = cy + Math.sin(ang*1.1) * r;
    ctx.fillStyle = "rgba(190,235,255,0.22)";
    ctx.beginPath(); ctx.arc(px, py, 2.2 + (i%3)*0.6, 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

// ====== DOM refs ======
const priceLabel   = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar      = document.getElementById("flowBar");
const flowLabel    = document.getElementById("flowLabel");
const healthBar    = document.getElementById("healthBar");
const healthPct    = document.getElementById("healthPct");
const mutBar       = document.getElementById("mutBar");
const mutPct       = document.getElementById("mutPct");
const decayRate    = document.getElementById("decayRate");
const stageNum     = document.getElementById("stageNum");
const statusSpan   = document.getElementById("status");
const tradesBody   = document.getElementById("trades-body");

// ====== Small sim state to animate vitals ======
let health = 0.75;           // 0..1
let mutation = 0.04;         // 0..1
const DECAY_PER_TICK = 0.001; // ~0.1% per tick
decayRate.textContent = "1% / 10m"; // label
stageNum.textContent = "1";

function setHealth(h){
  health = Math.max(0, Math.min(1, h));
  healthBar.style.width = (health*100).toFixed(0) + "%";
  healthPct.textContent = (health*100).toFixed(0) + "%";
}
function setMutation(m){
  mutation = Math.max(0, Math.min(1, m));
  mutBar.style.width = (mutation*100).toFixed(0) + "%";
  mutPct.textContent = (mutation*100).toFixed(0) + "%";
}
setHealth(health);
setMutation(mutation);

// ====== Helpers ======
const fmtUSD = n => `$${Number(n).toLocaleString(undefined, {minimumFractionDigits:4, maximumFractionDigits:6})}`;
const fmtMoney = n => `$${Number(n).toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
function nowHHMMSS(){
  const d = new Date();
  const p2 = v => String(v).padStart(2,'0');
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}

// ====== Data polling ======
async function fetchHealth(){
  try {
    const r = await fetch(`${API}/health`, { cache: "no-store" });
    const j = await r.json();
    const price = j.price ?? 0;
    priceLabel.textContent = fmtUSD(price);
    updatedLabel.textContent = nowHHMMSS();

    // nudge health a bit by price change magnitude (toy model)
    const target = Math.max(0, Math.min(1, 0.2 + Math.log10(1 + price * 8000) / 2.6));
    setHealth(health * 0.92 + target * 0.08);

    statusSpan.textContent = "Alive";
    statusSpan.className = "ok";
  } catch (e) {
    statusSpan.textContent = "Offline";
    statusSpan.className = "";
  }
}

let lastTradesTs = 0;
async function fetchTrades(){
  try{
    const r = await fetch(`${API}/trades`, { cache: "no-store" });
    const arr = await r.json();

    // Expected each item: { time: "<ISO or ms>", type: "feed"|"starve", valueUsd: number, priceUsd: number }
    tradesBody.innerHTML = "";

    let buys=0, sells=0;

    arr.forEach(it=>{
      const t = typeof it.time === "number" ? new Date(it.time) : new Date(it.time);
      const hh = String(t.getHours()).padStart(2,"0");
      const mm = String(t.getMinutes()).padStart(2,"0");
      const ss = String(t.getSeconds()).padStart(2,"0");
      const hhmmss = `${hh}:${mm}:${ss}`;

      const type = (it.type || "").toLowerCase() === "buy" || (it.type||"") === "feed" ? "feed" :
                   (it.type || "").toLowerCase() === "sell" ? "starve" : (it.type||"").toLowerCase();

      if (type === "feed") buys += Number(it.valueUsd||0);
      if (type === "starve") sells += Number(it.valueUsd||0);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${hhmmss}</td>
        <td class="${type==='feed'?'type-feed':'type-starve'}">${type === "feed" ? "Feed" : "Starve"}</td>
        <td>${fmtMoney(it.valueUsd || 0)}</td>
        <td>${fmtUSD(it.priceUsd || 0)}</td>
      `;
      tradesBody.appendChild(tr);
    });

    // Net flow bar (left = starving, right = feeding)
    const net = buys - sells; // USD over window
    const scale = Math.max(-1, Math.min(1, net / 50)); // clamp ±$50 window
    const pct = (50 + scale * 50); // 0..100
    flowBar.style.width = `${pct}%`;
    flowBar.style.marginLeft = `${Math.min(pct,0)}%`;
    flowLabel.textContent = scale > 0.05 ? "Feeding" : scale < -0.05 ? "Starving" : "Neutral";

    // health tiny nudge by net
    setHealth(health + scale * 0.004);

  }catch(e){
    // swallow; table stays as-is
  }
}

// Decay – gentle heartbeat
function tick(){
  setHealth(health - DECAY_PER_TICK);
  setMutation(mutation * 0.995 + 0.0008 * Math.random());
}

// Wire buttons (placeholders)
document.getElementById("feedBtn").addEventListener("click", () => {
  setHealth(Math.min(1, health + 0.04));
});

// Schedulers
setInterval(tick, 1000);
setInterval(fetchHealth, 6000);
setInterval(fetchTrades, 6000);

// Boot
fetchHealth();
fetchTrades();
