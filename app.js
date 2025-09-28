/* === Config === */
const API = "https://organism-backend.onrender.com"; // change if your backend URL differs
const TOKEN_MINT = (typeof window !== "undefined" && window.__TOKEN_MINT) || ""; // optional, backend may not need it

/* === DOM === */
const canvas   = document.getElementById("org-canvas");
const ctx      = canvas.getContext("2d", { alpha: true });
const statusEl = document.getElementById("status");
const heartbeatEl = document.getElementById("heartbeat");
const stageBadge  = document.getElementById("stage-badge");

const priceLabel   = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");

const flowNeedle = document.getElementById("flowNeedle");
const flowText   = document.getElementById("flowText");

const healthBar = document.getElementById("healthBar");
const mutBar    = document.getElementById("mutBar");
const healthPct = document.getElementById("healthPct");
const mutPct    = document.getElementById("mutPct");
const decayRate = document.getElementById("decayRate");
const stageNum  = document.getElementById("stageNum");

const tradesBody = document.getElementById("trades-body");
const sfxBtn  = document.getElementById("sfxBtn");
const feedBtn = document.getElementById("feedBtn");

/* === State === */
let HEALTH = 0.55;
let MUT = 0.04;
let STAGE = 1;
let lastPrice = 0;
let NET = 0; // -1..+1 (needle)

let AC = null, humNode = null, pulseNode = null, sfxOn = false;

/* === Sizing === */
function resizeCanvas(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

/* === Time === */
let t0 = performance.now();

/* === Womb drawing === */
function drawWomb(){
  const now = performance.now();
  const t = (now - t0) / 1000;
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0,0,W,H);

  // Radial fluid shading (dark top, lighter center)
  const gy = ctx.createLinearGradient(0, 0, 0, H);
  gy.addColorStop(0.0, "rgba(255,120,150,0.05)");
  gy.addColorStop(0.4, "rgba(255,140,165,0.03)");
  gy.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = gy;
  ctx.fillRect(0,0,W,H);

  // Center the organism above the panels (slightly right to reveal vignette)
  const cx = W*0.52, cy = H*0.46;

  // Concentric soft rings (heartbeat ripples)
  const baseHue = 345; // womb pinks
  for(let i=0;i<8;i++){
    const r = 70 + i*36 + Math.sin(t*0.8 + i)*3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    const a = 0.06 - i*0.005;
    ctx.strokeStyle = `hsla(${baseHue},60%,40%,${Math.max(a,0)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Pulsing nucleus
  const pulse = 1 + Math.sin(t*2.2)*0.05 + HEALTH*0.05;
  const R = 56 * pulse;

  // core glow
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, R*2.2);
  g.addColorStop(0.00, "rgba(255,210,198,0.95)"); // warm peach core
  g.addColorStop(0.35, "rgba(255,168,180,0.35)");
  g.addColorStop(1.00, "rgba(255,120,150,0.05)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, R*2.2, 0, Math.PI*2);
  ctx.fill();

  // inner cell
  ctx.beginPath();
  ctx.fillStyle = "rgba(255,210,198,0.35)";
  ctx.shadowColor = "rgba(255,168,180,0.55)";
  ctx.shadowBlur = 40;
  ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // drifting motes
  ctx.fillStyle = "rgba(255,220,230,0.25)";
  for(let i=0;i<22;i++){
    const ang = i * 0.28 + t * (0.04 + (i%5)*0.005);
    const rr = 120 + (i%7)*46 + Math.sin(t*0.6+i)*6;
    const x = cx + Math.cos(ang)*rr;
    const y = cy + Math.sin(ang)*rr*0.72;
    const s = 1.1 + (i%3)*0.6;
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI*2);
    ctx.fill();
  }

  // subtle vignette to sell depth
  const vign = ctx.createRadialGradient(cx, cy, Math.max(W,H)*0.35, cx, cy, Math.max(W,H)*0.95);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vign;
  ctx.fillRect(0,0,W,H);
}

/* === UI helpers === */
const pad2 = n => String(n|0).padStart(2,"0");
const fmtUSD = n => `$${(n||0).toFixed(4)}`;

/* === Audio (optional) === */
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  // low hum
  humNode = AC.createOscillator();
  const humGain = AC.createGain();
  humGain.gain.value = 0.02;
  humNode.frequency.value = 62; // deep hum
  humNode.connect(humGain).connect(AC.destination);
  humNode.start();
  // heartbeat/pulse (very faint)
  pulseNode = AC.createOscillator();
  const pg = AC.createGain();
  pg.gain.value = 0.0;
  pulseNode.frequency.value = 1.5; // LFO
  pulseNode.connect(pg.gain);
  pg.connect(AC.destination);
  pulseNode.start();
}
sfxBtn.addEventListener("click", () => {
  sfxOn = !sfxOn;
  if (sfxOn){
    initAudio();
    sfxBtn.textContent = "🔊 SFX On";
  }else{
    sfxBtn.textContent = "🔇 SFX Off";
    try { AC && AC.close(); } catch {}
    AC = humNode = pulseNode = null;
  }
});

/* manual nudge */
feedBtn.addEventListener("click", (e) => {
  e.preventDefault();
  setHealth(Math.min(1, HEALTH + 0.06));
  setMutation(Math.min(1, MUT + 0.01));
});

/* === Vitals setters === */
function setHealth(v){
  HEALTH = Math.max(0, Math.min(1, v));
  healthBar.style.width = `${HEALTH*100}%`;
  healthPct.textContent = `${Math.round(HEALTH*100)}%`;
}
function setMutation(v){
  MUT = Math.max(0, Math.min(1, v));
  mutBar.style.width = `${MUT*100}%`;
  mutPct.textContent = `${Math.round(MUT*100)}%`;
}
function setStage(n){
  STAGE = n|0;
  stageNum.textContent = String(STAGE);
  document.getElementById("stage-badge").textContent = `Stage ${STAGE} · The Cell`;
}

/* === Flow needle === */
function setFlow(net){ // net ∈ [-1..+1]
  NET = Math.max(-1, Math.min(1, net));
  const left = 50 + NET*45; // center is 50%
  flowNeedle.style.left = `${left}%`;
  flowText.textContent = NET > 0.05 ? "Feeding" : NET < -0.05 ? "Starving" : "Neutral";
}

/* === Backend polling === */
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;

async function pollHealth(){
  try{
    const q = TOKEN_MINT ? `?mint=${encodeURIComponent(TOKEN_MINT)}` : "";
    const r = await fetch(`${API}/health${q}`);
    const j = await r.json();
    lastPrice = +j.price || 0;
    priceLabel.textContent = fmtUSD(lastPrice);
    const d = new Date(+j.timestamp || Date.now());
    updatedLabel.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

    // gently nudge health by price movement (very light)
    const target = Math.max(0.1, Math.min(0.9, 0.5 + (Math.log10((lastPrice||1e-8)*1e8)-1)/10));
    setHealth(HEALTH + (target - HEALTH) * 0.04);
  }catch(err){
    console.error("health fetch error:", err);
  }
}

async function pollTrades(){
  try{
    const q = TOKEN_MINT ? `?mint=${encodeURIComponent(TOKEN_MINT)}` : "";
    const r = await fetch(`${API}/trades${q}`);
    const data = await r.json();

    // Accept either our normalized shape or a Jupiter-like array and map it
    const rows = Array.isArray(data) ? data : (Array.isArray(data.trades) ? data.trades : []);
    tradesBody.innerHTML = "";

    let buys=0, sells=0;

    rows.slice(0, 12).forEach(it => {
      // normalized fields
      const time    = it.time ? new Date(it.time) : new Date(it.ts||Date.now());
      const sideRaw = (it.type || it.side || "").toString().toLowerCase();
      const type = sideRaw === "buy" ? "feed" : sideRaw === "sell" ? "starve" : "feed";
      const valueUsd = typeof it.valueUsd === "number" ? it.valueUsd
                     : (typeof it.amount === "number" && typeof it.price === "number" ? it.amount * it.price : 0);
      const price = typeof it.priceUsd === "number" ? it.priceUsd
                   : (typeof it.price === "number" ? it.price : 0);

      if (type === "feed") buys += valueUsd; else sells += valueUsd;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="left">${pad2(time.getHours())}:${pad2(time.getMinutes())}:${pad2(time.getSeconds())}</td>
        <td class="left ${type==='feed'?'type-feed':'type-starve'}">${type === "feed" ? "Feed" : "Starve"}</td>
        <td class="left">$${(valueUsd||0).toFixed(2)}</td>
        <td class="left">${fmtUSD(price||0)}</td>
      `;
      tradesBody.appendChild(tr);
    });

    // update flow needle from net $ over window
    const net = (buys - sells) / Math.max(1, (buys + sells));
    setFlow(net);
  }catch(err){
    console.error("trades fetch error:", err);
  }
}

/* === Decay / heartbeat tick === */
function tick(){
  // slow natural decay
  setHealth(HEALTH - 0.0008);
}

/* === Main loop === */
function loop(){
  drawWomb();
  requestAnimationFrame(loop);
}

/* === Boot === */
decayRate.textContent = "1% / 10m";
setHealth(HEALTH); setMutation(MUT); setStage(1);

pollHealth(); pollTrades();
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);
setInterval(tick, 10000);

loop();
