/* ===== CONFIG ===== */
const API = "https://organism-backend.onrender.com"; // change if needed
const POLL_HEALTH_MS = 6000;
const POLL_TRADES_MS = 6000;

/* ===== DOM ===== */
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const statusWord = document.getElementById("status");
const heartbeat  = document.getElementById("heartbeat");
const feedBtn    = document.getElementById("feedBtn");
const tradeBtn   = document.getElementById("tradeBtn");
const sfxBtn     = document.getElementById("sfxBtn");

const healthBar  = document.getElementById("healthBar");
const mutBar     = document.getElementById("mutBar");
const healthPct  = document.getElementById("healthPct");
const mutPct     = document.getElementById("mutPct");
const stageNum   = document.getElementById("stageNum");
const stageBadge = document.getElementById("stageBadge");
const decayRate  = document.getElementById("decayRate");
const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowBar    = document.getElementById("flowBar");
const flowLabel  = document.getElementById("flowLabel");
const tradesBody = document.getElementById("trades-body");

/* ===== State ===== */
let health = 0.58;       // 0..1
let mutation = 0.06;     // 0..1
let stage = 1;
let sfxEnabled = false;

let lastPrice = 0;
let lastTs = 0;
let flows = [];
const FLOW_WINDOW = 20;

/* ===== Canvas sizing ===== */
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.floor(rect.width  * devicePixelRatio);
  canvas.height = Math.floor(rect.height * devicePixelRatio);
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener("resize", resizeCanvas);
resizeCanvas();

/* ===== Helpers ===== */
const clamp = (v,a,b)=> Math.max(a, Math.min(b,v));
const rand = (a,b)=> a + Math.random()*(b-a);
const lerp = (a,b,t)=> a+(b-a)*t;
const fmtUSD = n => typeof n === "number" ? `$${n.toFixed(4)}` : "$—";
const fmtUSDSmall  = n => typeof n === "number" ? `$${n.toFixed(2)}` : "$—";
const fmtTime = ts => {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  const ss = String(d.getSeconds()).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
};
function setHealth(v){ health = clamp(v,0,1); healthBar.style.width = `${Math.round(health*100)}%`; healthPct.textContent = `${Math.round(health*100)}%`; }
function setMutation(v){ mutation = clamp(v,0,1); mutBar.style.width = `${Math.round(mutation*100)}%`; mutPct.textContent = `${Math.round(mutation*100)}%`; }
function setStage(n){ stage = n; stageNum.textContent = String(n); stageBadge.textContent = n===1 ? "Stage 1 · The Cell" : `Stage ${n}`; }
function setFlow(v){
  const mid = 50 + Math.round(v*50);
  flowBar.style.width = `${Math.max(6, Math.min(100, mid))}%`;
  flowLabel.textContent = v>0.04 ? "Feeding" : v<-0.04 ? "Starving" : "Neutral";
}

/* ===== Creature render (womb-style) ===== */
const bubbles = Array.from({length: 32}, (_,i)=>({
  r: rand(1.2, 3.2) * (i%7===0?1.6:1),
  a: rand(0, Math.PI*2),
  d: rand(0.25, 0.95),   // radial fraction
  s: rand(0.2, 0.55),    // speed
  z: rand(0.1, 0.9)      // depth for parallax
}));
let t0 = performance.now();
function drawOrganism() {
  const now = performance.now();
  const t = (now - t0) / 1000;

  const W = canvas.width  / devicePixelRatio;
  const H = canvas.height / devicePixelRatio;
  ctx.clearRect(0,0,W,H);

  // Chamber center (lower so it peeks from below panels)
  const cx = W * 0.5;
  const cy = H * 0.72;
  const base = Math.min(W, H) * 0.38;

  /* 1) Deep amniotic glow */
  const ambient = ctx.createRadialGradient(cx, cy, base*0.05, cx, cy, base*1.4);
  ambient.addColorStop(0, `rgba(155, 235, 210, ${0.22 + 0.05*Math.sin(t*1.0)})`);
  ambient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ambient;
  ctx.beginPath(); ctx.arc(cx, cy, base*1.45, 0, Math.PI*2); ctx.fill();

  /* 2) Membrane */
  ctx.save();
  ctx.lineWidth = 14;
  ctx.strokeStyle = `rgba(180,220,235,${0.08 + 0.02*Math.sin(t*1.3)})`;
  ctx.shadowBlur = 20;
  ctx.shadowColor = "rgba(150,200,255,0.08)";
  ctx.beginPath(); ctx.arc(cx, cy, base*1.02 + 6*Math.sin(t*0.9), 0, Math.PI*2); ctx.stroke();
  ctx.restore();

  /* 3) Caustic bands */
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  for (let i=0;i<5;i++){
    const r = base * (0.35 + i*0.12 + 0.02*Math.sin(t + i));
    ctx.strokeStyle = `rgba(140,180,220,${0.06 - i*0.008})`;
    ctx.lineWidth = 2 + Math.sin(i + t*0.25)*1.2;
    ctx.beginPath(); ctx.arc(cx + 6*Math.sin(t*0.6+i), cy + 4*Math.cos(t*0.7+i), r, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  /* 4) Nucleus */
  const hue = 165 + 25*Math.sin(t*0.9);
  const nucR = base*(0.30 + 0.03*Math.sin(t*1.6) + 0.02*health);
  const nucleus = ctx.createRadialGradient(cx, cy, nucR*0.1, cx, cy, nucR);
  nucleus.addColorStop(0, `hsla(${hue}, 70%, ${60 + 8*Math.sin(t*2)}%, .95)`);
  nucleus.addColorStop(1, `hsla(${hue}, 40%, 22%, 0.05)`);
  ctx.fillStyle = nucleus;
  ctx.beginPath(); ctx.arc(cx, cy, nucR, 0, Math.PI*2); ctx.fill();

  /* 5) Umbilical pulse */
  ctx.save();
  const pulse = 4 + 2*Math.sin(t*2.4);
  ctx.lineWidth = pulse;
  const gradCord = ctx.createLinearGradient(W*0.22, H*0.15, cx, cy);
  gradCord.addColorStop(0, "rgba(220,160,255,.05)");
  gradCord.addColorStop(1, "rgba(140,220,200,.35)");
  ctx.strokeStyle = gradCord;
  ctx.shadowColor = "rgba(120,220,200,.25)";
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(W*0.22, H*0.15);
  ctx.bezierCurveTo(W*0.32, H*0.22, W*0.42, H*0.35, cx - nucR*0.6, cy - nucR*0.6);
  ctx.stroke();
  ctx.restore();

  /* 6) Bubbles */
  for (const b of bubbles){
    const ang = b.a + t*(0.2 + b.s*0.3);
    const rr  = base * lerp(0.2, 0.95, b.d);
    const x   = cx + Math.cos(ang + b.z*2)*rr*0.85;
    const y   = cy + Math.sin(ang + b.z*1.5)*rr*0.55 - t*8*b.s; // up drift
    const yy  = ((y - (cy-base)) % (base*2.2)) + (cy-base);
    ctx.fillStyle = `rgba(200,230,255, ${0.12 + 0.1*b.z})`;
    ctx.beginPath(); ctx.arc(x, yy, b.r*(1+0.2*Math.sin(t+b.z*6)), 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

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

    // gentle health target guided by price (playful mapping)
    const target = 0.45 + Math.tanh(price*20)/10;
    setHealth(health*0.9 + target*0.1);

    // update heartbeat speed if SFX on
    if (sfxEnabled) refreshHeartbeatRate();
  }catch(e){
    updatedLabel.textContent = "—:—:—";
  }
}

/* ===== Normalize trades ===== */
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
let lastPlayedTradeTime = 0;
async function pollTrades(){
  try{
    const r = await fetch(`${API}/trades`, { cache:"no-store" });
    const j = await r.json();
    const list = Array.isArray(j) ? j : (j.trades || []);
    const trades = normalizeTrades(list)
      .sort((a,b)=>b.time-a.time)
      .slice(0,12);

    tradesBody.innerHTML = "";
    let buys=0, sells=0;
    let newest = null;

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

      if (tr.type === "feed") buys += tr.valueUsd ?? 0;
      if (tr.type === "starve") sells += tr.valueUsd ?? 0;

      if (!newest || tr.time > newest.time) newest = tr;
    }

    // Net flow → UI + tiny health nudge
    const sum = buys + sells;
    const dir = sum>0 ? (buys - sells) / sum : 0; // -1..+1
    flows.push(dir);
    if (flows.length > FLOW_WINDOW) flows.shift();
    const avg = flows.reduce((a,b)=>a+b,0) / flows.length;
    setFlow(avg);
    setHealth(health + avg*0.02);

    // Play a cue for the newest trade (after user enabled SFX)
    if (sfxEnabled && newest && newest.time > lastPlayedTradeTime){
      if (newest.type === "feed") playBloop(0.08);
      else playCrackle(0.1);
      lastPlayedTradeTime = newest.time;
    }

  }catch(e){
    // ignore transient errors
  }
}

/* ===== Decay driver ===== */
function tickDecay(){
  setHealth(health - 0.01);            // 1% per tick
  setMutation(mutation + 0.003*health); // slow creep
}

/* ===== Interactions ===== */
feedBtn.addEventListener("click", (e)=>{
  e.preventDefault();
  setHealth(health + 0.06);
  if (sfxEnabled) playBloop(0.12); // tactile feedback
});

sfxBtn.addEventListener("click", async ()=>{
  if (!sfxEnabled) {
    await initAudio();     // creates audio context & starts ambience + heartbeat
    sfxEnabled = true;
    sfxBtn.textContent = "🔊 SFX On";
  } else {
    stopAudio();
    sfxEnabled = false;
    sfxBtn.textContent = "🔇 SFX Off";
  }
});

/* ===== Schedules ===== */
setInterval(tickDecay, 10_000);
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);

// initial
pollHealth();
pollTrades();

/* ===========================================================
   ==============  W O M B   S O U N D S  ====================
   Pure Web Audio — no external files
=========================================================== */
let AC, master, noiseSrc, noiseGain, noiseLP, hbTimer = null;

// Create a small looped noise buffer
function makeNoiseBuffer(ctx, seconds=1){
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(1, length, rate);
  const data = buf.getChannelData(0);
  for (let i=0;i<length;i++){
    // pink-ish noise feel (integrate white a little)
    const w = (Math.random()*2-1);
    data[i] = (data[i-1] || 0)*0.98 + w*0.02;
  }
  return buf;
}

async function initAudio(){
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain();
  master.gain.value = 0.8;
  master.connect(AC.destination);

  // Ambient fluid: looped noise -> lowpass -> gentle gain
  noiseSrc = AC.createBufferSource();
  noiseSrc.buffer = makeNoiseBuffer(AC, 2.0);
  noiseSrc.loop = true;

  noiseLP = AC.createBiquadFilter();
  noiseLP.type = "lowpass";
  noiseLP.frequency.value = 280;          // muffled
  noiseLP.Q.value = 0.6;

  noiseGain = AC.createGain();
  noiseGain.gain.value = 0.06;            // subtle bed

  noiseSrc.connect(noiseLP).connect(noiseGain).connect(master);
  noiseSrc.start();

  // Start heartbeat scheduler
  refreshHeartbeatRate();
}

// Stop everything
function stopAudio(){
  if (!AC) return;
  try { noiseSrc && noiseSrc.stop(); } catch {}
  try { hbTimer && clearInterval(hbTimer); } catch {}
  hbTimer = null;
  AC.close();
  AC = null;
}

// Heartbeat: two thumps “lub-dub” using short filtered noise + sine kick
function scheduleBeat(){
  if (!AC) return;
  const t = AC.currentTime;

  // helper: envelope for a one-shot
  const env = (gainNode, start, a=0.005, d=0.12, peak=0.9, sustain=0.0)=>{
    gainNode.gain.cancelScheduledValues(start);
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(peak, start + a);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), start + a + d);
  };

  // thump 1 (kick + body)
  {
    const g = AC.createGain(); g.gain.value = 0; g.connect(master);
    const osc = AC.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(50, t+0.08);
    osc.connect(g);
    env(g, t, 0.004, 0.1, 0.25);
    osc.start(t); osc.stop(t+0.15);
  }
  {
    const g = AC.createGain(); g.gain.value = 0; g.connect(master);
    const n = AC.createBufferSource(); n.buffer = makeNoiseBuffer(AC, 0.1); n.loop = false;
    const lp = AC.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value = 220;
    n.connect(lp).connect(g);
    env(g, t, 0.003, 0.09, 0.08);
    n.start(t); n.stop(t+0.12);
  }

  // thump 2 a moment later (dub)
  const dt = 0.23; // spacing between lub and dub
  {
    const g = AC.createGain(); g.gain.value = 0; g.connect(master);
    const osc = AC.createOscillator(); osc.type = "sine"; osc.frequency.setValueAtTime(95, t+dt);
    osc.frequency.exponentialRampToValueAtTime(55, t+dt+0.08);
    osc.connect(g);
    env(g, t+dt, 0.004, 0.1, 0.18);
    osc.start(t+dt); osc.stop(t+dt+0.15);
  }
  {
    const g = AC.createGain(); g.gain.value = 0; g.connect(master);
    const n = AC.createBufferSource(); n.buffer = makeNoiseBuffer(AC, 0.1); n.loop = false;
    const lp = AC.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value = 200;
    n.connect(lp).connect(g);
    env(g, t+dt, 0.003, 0.09, 0.06);
    n.start(t+dt); n.stop(t+dt+0.12);
  }
}

// Set heartbeat rate based on health (and re-schedule timer)
function refreshHeartbeatRate(){
  if (!AC) return;
  if (hbTimer) clearInterval(hbTimer);
  // BPM: 56 (weak) .. 88 (stronger) tied to health
  const bpm = 56 + Math.round(health * 32);
  const intervalMs = Math.max(400, Math.min(1500, (60_000 / bpm)));
  scheduleBeat(); // fire one immediately
  hbTimer = setInterval(scheduleBeat, intervalMs);
  heartbeat.textContent = `${Math.round(bpm)} bpm`;
}

/* One-shots for events */
function playBloop(vol=0.1){
  if (!AC) return;
  const t = AC.currentTime;
  const g = AC.createGain(); g.gain.value = 0; g.connect(master);
  const osc = AC.createOscillator(); osc.type = "sine";
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.exponentialRampToValueAtTime(840, t+0.08);
  const lp = AC.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value = 1600;
  osc.connect(lp).connect(g);
  // envelope
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.18);
  osc.start(t); osc.stop(t+0.22);
}

function playCrackle(vol=0.12){
  if (!AC) return;
  const t = AC.currentTime;
  const src = AC.createBufferSource();
  const buf = makeNoiseBuffer(AC, 0.2);
  src.buffer = buf; src.loop = false;
  const bp = AC.createBiquadFilter(); bp.type="bandpass"; bp.frequency.value = 420; bp.Q.value = 5;
  const g = AC.createGain(); g.gain.value = 0;
  src.connect(bp).connect(g).connect(master);
  // envelope
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t+0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t+0.25);
  src.start(t); src.stop(t+0.26);
}
