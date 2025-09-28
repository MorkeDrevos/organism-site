/* ===== CONFIG ===== */
const API = "https://organism-backend.onrender.com"; // your backend base
const TOKEN_SWAP_URL = "#"; // set to your Jupiter swap link when ready

/* ===== canvas (womb) ===== */
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });
let W = 0, H = 0, t0 = performance.now();

function resizeCanvas(){
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function drawOrganism(now){
  const t = (now - t0) / 1000;
  ctx.clearRect(0,0,W,H);

  // center slightly above mid-screen
  const cx = W*0.52;
  const cy = H*0.38;

  // soft “amniotic” backdrop
  for(let r=0;r<6;r++){
    ctx.beginPath();
    const R = Math.min(W,H)* (0.18 + r*0.08);
    ctx.arc(cx, cy, R + Math.sin(t*0.7+r)*2, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(42,61,79,${0.15 - r*0.02})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // pulsing nucleus
  const hue = 164; // teal-green
  const base = 64 + 28*Math.sin(t*1.6);
  const grad = ctx.createRadialGradient(cx,cy,0,cx,cy,base+80);
  grad.addColorStop(0, `hsla(${hue},70%,65%,.95)`);
  grad.addColorStop(0.45, `hsla(${hue},48%,42%,.65)`);
  grad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, base+90, 0, Math.PI*2); ctx.fill();

  // membrane glow
  ctx.beginPath(); ctx.arc(cx, cy, base+54, 0, Math.PI*2);
  ctx.strokeStyle = `hsla(${hue},60%,70%,.35)`; ctx.lineWidth = 8; ctx.stroke();

  // drifting motes
  for(let i=0;i<14;i++){
    const a = t*0.12 + i*1.3;
    const r = 90 + i*14 + 10*Math.sin(t*0.7+i);
    const x = cx + Math.cos(a)*r;
    const y = cy + Math.sin(a*1.2)*r*0.55;
    ctx.beginPath(); ctx.arc(x, y, 2 + (i%3===0?1.6:0), 0, Math.PI*2);
    ctx.fillStyle = "rgba(200,240,230,.25)"; ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/* ===== DOM refs ===== */
const statusWord = document.getElementById("status");
const heartbeat = document.getElementById("heartbeat");
const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");

const healthBar = document.getElementById("health-bar");
const mutBar = document.getElementById("mut-bar");
const healthPct = document.getElementById("healthPct");
const mutPct = document.getElementById("mutPct");
const stageNum = document.getElementById("stageNum");
const stageBadge = document.getElementById("stageBadge");
const decayRate = document.getElementById("decayRate");

const flowNeedle = document.getElementById("flowNeedle");
const flowLabel = document.getElementById("flowLabel");

const tradesBody = document.getElementById("trades-body");
const feedBtn = document.getElementById("feedBtn");
const sfxBtn = document.getElementById("sfxBtn");
const tradeBtn = document.getElementById("tradeBtn");

/* ===== utils ===== */
const fmtUSD = n => `$${Number(n).toFixed(4)}`;
const pad2 = n => String(n).padStart(2,"0");
const fmtTime = ts => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

/* ===== state ===== */
let health = 0.53, mutation = 0.06, net = 0;
let lastPrice = 0, lastTs = 0;

/* ===== data polling ===== */
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;
const DECAY_MS = 10000;

// /health
async function pollHealth(){
  try{
    const r = await fetch(`${API}/health`);
    const j = await r.json();
    lastPrice = j.price ?? 0;
    lastTs = j.timestamp ?? Date.now();
    priceLabel.textContent = fmtUSD(lastPrice);
    updatedLabel.textContent = fmtTime(lastTs);

    // nudge health slightly by price motion
    const priceToHealth = Math.max(0, Math.min(1, lastPrice * 10));
    setHealth(health*0.92 + priceToHealth*0.08);
  }catch(e){
    console.error("health fetch", e);
  }
}

// /trades
async function pollTrades(){
  try{
    const r = await fetch(`${API}/trades`);
    const arr = await r.json();

    // supports either normalized [{time,type,valueUsd,priceUsd}] or Jupiter-ish shape
    const rows = Array.isArray(arr) ? arr.map(x => {
      if (x.valueUsd !== undefined) return x;
      // jupiter-ish fallback (example mapping)
      return {
        time: (x.ts ?? x.time ?? Date.now()),
        type: (x.side ?? x.type ?? "feed").toString().toLowerCase()==="buy" ? "feed" : "starve",
        valueUsd: x.valueUsd ?? ((x.price ?? 0) * (x.amount ?? 0)),
        priceUsd: x.price ?? x.usdPrice ?? 0
      }
    }) : [];

    // fill table (Time, Type, Value, Price) — type is colored text (no dots)
    tradesBody.innerHTML = "";
    let buys=0, sells=0;
    rows.slice(0,8).forEach(it=>{
      const tr = document.createElement("tr");
      const cls = it.type==="feed" ? "type-feed" : "type-starve";
      tr.innerHTML = `
        <td class="left">${fmtTime(it.time)}</td>
        <td class="left ${cls}">${it.type.charAt(0).toUpperCase()+it.type.slice(1)}</td>
        <td class="left">${fmtUSD(it.valueUsd)}</td>
        <td class="left">${fmtUSD(it.priceUsd)}</td>
      `;
      tradesBody.appendChild(tr);
      if(it.type==="feed") buys += it.valueUsd; else sells += it.valueUsd;
    });

    // drive net flow needle
    const range = buys + sells || 1;
    net = Math.max(0, Math.min(1, (buys - sells) / range * 0.5 + 0.5)); // 0..1
    const pct = Math.round(net*100);
    flowNeedle.style.width = `${pct}%`;
    flowLabel.textContent = pct>52 ? "Feeding" : pct<48 ? "Starving" : "Neutral";

    // gentle health nudge
    setHealth( health*0.9 + (net)*0.1 );
  }catch(e){
    console.error("trades fetch", e);
  }
}

/* ===== health & stage ===== */
function setHealth(h){
  health = Math.max(0, Math.min(1, h));
  healthBar.style.width = `${Math.round(health*100)}%`;
  healthPct.textContent = `${Math.round(health*100)}%`;
  // stage gates (placeholder)
  const s = health>0.66 ? 2 : 1;
  if (Number(stageNum.textContent) !== s){
    stageNum.textContent = s;
    stageBadge.textContent = s===1 ? "Stage 1 · The Cell" : "Stage 2 · ????";
  }
}

/* decay */
function tickDecay(){
  setHealth(health - 0.01); // 1% / tick
}

/* ===== SFX (very subtle) ===== */
let AC, noiseNode, noiseGain;
function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  // brown noise
  const bufferSize = 2 * AC.sampleRate;
  const noiseBuffer = AC.createBuffer(1, bufferSize, AC.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let lastOut = 0.0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    data[i] *= 0.6;
  }
  noiseNode = AC.createBufferSource();
  noiseNode.buffer = noiseBuffer;
  noiseNode.loop = true;

  noiseGain = AC.createGain();
  noiseGain.gain.value = 0.08; // raise if you want it louder

  const lp = AC.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 500;

  noiseNode.connect(lp).connect(noiseGain).connect(AC.destination);
  noiseNode.start();
}

/* UI events */
let sfx=false;
sfxBtn.addEventListener("click", async () => {
  sfx = !sfx;
  sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
  if (sfx){
    if (!AC) initAudio();
    else await AC.resume();
  }else{
    if (AC && AC.state !== "suspended") await AC.suspend();
  }
});

feedBtn.addEventListener("click", (e)=>{
  e.preventDefault();
  setHealth(health + 0.04); // micro nudge
});

/* set swap link if you have it */
if (TOKEN_SWAP_URL && TOKEN_SWAP_URL !== "#") tradeBtn.href = TOKEN_SWAP_URL;

/* ===== Schedules ===== */
setInterval(tickDecay, 10_000);
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);

// boot
pollHealth();
pollTrades();
