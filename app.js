/***** CONFIG *****/
const API = "https://organism-backend.onrender.com"; // ← your backend base URL
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;

/***** Canvas (fullscreen womb) *****/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

/***** Teasing organism (brighter, visible behind panels) *****/
function drawOrganism() {
  const W = canvas.width, H = canvas.height;
  const t = performance.now() / 1000;

  ctx.clearRect(0, 0, W, H);

  // place slightly left/center so it peeks behind both panels
  const cx = W * 0.36;
  const cy = H * 0.46;

  const base = Math.min(W, H) * 0.30;
  const pulse = base + Math.sin(t * 1.25) * (base * 0.10);

  // core glow
  let g = ctx.createRadialGradient(cx, cy, base * 0.08, cx, cy, pulse);
  g.addColorStop(0.0, "rgba(130,255,240,0.98)");
  g.addColorStop(0.35,"rgba(110,230,240,0.45)");
  g.addColorStop(1.0, "rgba(10,22,35,0.00)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, Math.PI*2); ctx.fill();

  // inner definition
  g = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.42);
  g.addColorStop(0, "rgba(160,255,245,0.25)");
  g.addColorStop(1, "rgba(40,70,95,0.00)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, base * 0.55, 0, Math.PI*2); ctx.fill();

  // womb rings
  ctx.lineWidth = 1.2;
  for (let i = 1; i <= 6; i++) {
    const r = base * (0.6 + i*0.36) + Math.sin(t*0.5 + i)*5;
    ctx.strokeStyle = `rgba(185,225,255,${0.08 + 0.05*Math.sin(t*0.35 + i)})`;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.stroke();
  }

  // floating motes
  for (let i=0;i<16;i++){
    const ang = t*0.22 + i*0.47;
    const r = base * (1.15 + (i%5)*0.26);
    const px = cx + Math.cos(ang) * r;
    const py = cy + Math.sin(ang*1.07) * r;
    const a = 0.22 + 0.08*Math.sin(t*0.9 + i);
    ctx.fillStyle = `rgba(200,240,255,${a})`;
    ctx.beginPath(); ctx.arc(px, py, 2.2 + (i%3)*0.7, 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/***** DOM refs *****/
const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowLabel = document.getElementById("flowLabel");
const flowBar = document.getElementById("flowBar");
const healthBar = document.getElementById("healthBar");
const healthNum = document.getElementById("healthNum");
const mutBar = document.getElementById("mutBar");
const mutNum = document.getElementById("mutNum");
const stageNum = document.getElementById("stageNum");
const tradesBody = document.getElementById("trades-body");

/***** Helpers *****/
const fmtUSD = n => n == null ? "$—" : `$${Number(n).toFixed(4)}`.replace(/(\.\d*[1-9])0+$/,'$1');
const fmtUSD2 = n => n == null ? "$—" : `$${Number(n).toFixed(2)}`;
const pad2 = n => String(n).padStart(2,"0");
const timeHHMMSS = ts => {
  const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/***** State (simple) *****/
let lastHealth = 0.66;   // 0..1
let lastMut = 0.06;      // 0..1
let windowFlow = 0.5;    // 0..1 where 0.5 neutral, < starving, > feeding
const FLOW_SMOOTH = 0.15;

/***** Poll health (price) *****/
async function pollHealth(){
  try{
    const r = await fetch(`${API}/health`, { cache:"no-store" });
    const j = await r.json();

    // Expect { price: number, timestamp: ms }
    if (typeof j.price === "number") {
      priceLabel.textContent = fmtUSD(j.price);
    } else {
      priceLabel.textContent = "$—";
    }
    updatedLabel.textContent = timeHHMMSS(j.timestamp ?? Date.now());

    // nudge health slightly by price momentum (demo)
    if (typeof j.price === "number") {
      const target = Math.max(0, Math.min(1, 0.2 + Math.log10(1 + j.price*200))));
      lastHealth = lastHealth*(1-FLOW_SMOOTH) + target*FLOW_SMOOTH;
    }
    updateVitals();

  }catch(e){
    // leave previous values
  }
}

/***** Poll trades *****/
let recent = []; // keep last ~5 minutes
const WINDOW_MS = 5*60*1000;

async function pollTrades(){
  try{
    const r = await fetch(`${API}/trades`, { cache:"no-store" });
    const data = await r.json();

    // Accept either our normalized shape OR a lean shape:
    // [{ time, type: 'feed'|'starve', valueUsd, priceUsd }]
    // OR Jupiter-ish: { side:'BUY'|'SELL', price:number, amount:number, ts:number }
    let list = Array.isArray(data) ? data : data?.items || data?.trades || [];

    const parsed = list.map(x => {
      const type = (x.type ?? x.side ?? "").toString().toLowerCase() === "buy" ? "feed"
                 : (x.type ?? x.side ?? "").toString().toLowerCase() === "sell" ? "starve"
                 : (x.type ?? "").toString().toLowerCase();
      const priceUsd = x.priceUsd ?? x.price ?? null;
      const valueUsd = x.valueUsd ?? (priceUsd && x.amount ? priceUsd * x.amount : null);
      const time = x.time ?? x.ts ?? Date.now();
      return { time, type, valueUsd, priceUsd };
    }).filter(x => x.type === "feed" || x.type === "starve");

    // merge & clamp to 5m window
    const now = Date.now();
    recent = [...parsed, ...recent].sort((a,b)=>b.time-a.time)
              .filter(x => now - x.time <= WINDOW_MS).slice(0,50);

    // compute flow: buys add, sells subtract
    const sum = recent.reduce((acc,x)=> acc + ((x.type==="feed"?1:-1) * (x.valueUsd || 0)), 0);
    // map flow to 0..1 bar around 0.5
    const range = 50; // $ range that fills the bar
    const net = Math.max(0, Math.min(1, 0.5 + (sum / range) * 0.5));
    windowFlow = windowFlow*(1-FLOW_SMOOTH) + net*FLOW_SMOOTH;
    flowBar.style.width = `${windowFlow*100}%`;
    flowLabel.textContent = windowFlow>0.53 ? "Feeding" : windowFlow<0.47 ? "Starving" : "Neutral";

    // nudge health by trades
    const delta = (net - 0.5) * 0.12;
    lastHealth = Math.max(0, Math.min(1, lastHealth + delta));
    lastMut = Math.max(0, Math.min(1, lastMut + Math.abs(delta)*0.1));

    updateVitals();
    renderTrades();

  }catch(e){
    // quiet fallback
  }
}

/***** Renderers *****/
function updateVitals(){
  healthBar.style.width = `${Math.round(lastHealth*100)}%`;
  healthNum.textContent = `${Math.round(lastHealth*100)}%`;
  mutBar.style.width = `${Math.round(lastMut*100)}%`;
  mutNum.textContent = `${Math.round(lastMut*100)}%`;
}

function renderTrades(){
  tradesBody.innerHTML = "";
  // newest first; show up to 10
  recent.slice(0,10).forEach(row=>{
    const tr = document.createElement("tr");
    const typeClass = row.type==="feed" ? "type-feed" : "type-starve";
    tr.innerHTML = `
      <td class="left">${timeHHMMSS(row.time)}</td>
      <td class="left ${typeClass}">${row.type[0].toUpperCase()+row.type.slice(1)}</td>
      <td class="left">${row.valueUsd!=null ? fmtUSD2(row.valueUsd) : "—"}</td>
      <td class="left">${row.priceUsd!=null ? fmtUSD(row.priceUsd) : "—"}</td>
    `;
    tradesBody.appendChild(tr);
  });
}

/***** Interactions (demo) *****/
document.getElementById("sfxBtn").addEventListener("click", e=>{
  e.preventDefault();
  const on = e.currentTarget.textContent.includes("Off");
  e.currentTarget.textContent = on ? "🔊 SFX On" : "🔇 SFX Off";
});
document.getElementById("feedBtn").addEventListener("click", e=>{
  e.preventDefault();
  lastHealth = Math.min(1, lastHealth + 0.04);
  updateVitals();
});

/***** Schedulers *****/
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);

// initial
pollHealth();
pollTrades();
