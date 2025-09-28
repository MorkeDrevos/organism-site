/***** CONFIG (plug your backend when ready) *****/
const API = ""; // e.g. "https://organism-backend.onrender.com"

/***** DOM *****/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const statusEl = document.getElementById("status");
const heartbeatEl = document.getElementById("heartbeat");
const priceLabel = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");

const healthBar = document.getElementById("healthBar");
const mutBar = document.getElementById("mutBar");
const healthPct = document.getElementById("healthPct");
const mutPct = document.getElementById("mutPct");
const stageNum = document.getElementById("stageNum");
const stageBadge = document.getElementById("stageBadge");

const flowBar = document.getElementById("flowBar");
const flowLabel = document.getElementById("flowLabel");

const tradesBody = document.getElementById("trades-body");

const sfxBtn = document.getElementById("sfxBtn");
const feedBtn = document.getElementById("feedBtn");

/***** State (game-ish) *****/
let W = 0, H = 0, CX = 0, CY = 0, t = 0;
let HEALTH = 0.54;         // 0..1
let MUTATION = 0.06;       // 0..1
let STAGE = 1;
let FLOW = 0;              // -1..+1
let FLOW_NEEDLE = 0;       // 0..100 (pct for bar width)

const motes = Array.from({length: 26}, () => ({
  r: 1 + Math.random()*2,
  x: Math.random(), // 0..1 (relative)
  y: Math.random(),
  v: (Math.random() * 0.3 + 0.1) * (Math.random() < .5 ? -1 : 1),
  j: Math.random()*Math.PI*2
}));

/***** Audio (optional) *****/
let AC = null, gain = null, noiseNode = null;
function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  const buf = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
  const data = buf.getChannelData(0);
  for (let i=0;i<data.length;i++){
    data[i] = (Math.random()*2-1) * 0.35; // pink-ish noise feel
  }
  const src = AC.createBufferSource();
  src.buffer = buf; src.loop = true;
  const biquad = AC.createBiquadFilter(); biquad.type = "lowpass"; biquad.frequency.value = 260;
  const lfo = AC.createOscillator(); lfo.type = "sine"; lfo.frequency.value = 0.07;
  const lfoGain = AC.createGain(); lfoGain.gain.value = 0.25;
  gain = AC.createGain(); gain.gain.value = 0.0;

  lfo.connect(lfoGain).connect(gain.gain);
  src.connect(biquad).connect(gain).connect(AC.destination);
  src.start(); lfo.start();
  noiseNode = src;
}

sfxBtn.addEventListener("click", () => {
  if (!AC) { initAudio(); sfxBtn.textContent = "🔊 SFX On"; gain.gain.linearRampToValueAtTime(0.08, AC.currentTime+1.2); }
  else if (gain.gain.value > 0) { gain.gain.linearRampToValueAtTime(0.0, AC.currentTime+0.6); sfxBtn.textContent = "🔇 SFX Off"; }
  else { gain.gain.linearRampToValueAtTime(0.08, AC.currentTime+1.0); sfxBtn.textContent = "🔊 SFX On"; }
});

/***** Resize *****/
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; CX=W/2; CY=H*0.55; }
window.addEventListener("resize", resize); resize();

/***** Helpers *****/
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const lerp  = (a,b,p)=> a + (b-a)*p;

/***** Drawing: womb look *****/
function drawWomb() {
  t += 0.01;
  ctx.clearRect(0,0,W,H);

  // Amniotic fluid gradient (deep → light → deep)
  const g = ctx.createRadialGradient(CX, CY-60, Math.min(W,H)*0.05,  CX, CY, Math.max(W,H)*0.8);
  g.addColorStop(0.00, "rgba(14,25,38,0.35)");
  g.addColorStop(0.35, "rgba(20,36,57,0.22)");
  g.addColorStop(0.70, "rgba(9,14,24,0.70)");
  g.addColorStop(1.00, "rgba(7,12,20,0.95)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);

  // Subtle flowing haze overlay (moves slowly to feel fluid)
  const haze = ctx.createLinearGradient(0, 0, W, H);
  haze.addColorStop(0,   "rgba(150,190,255,0.04)");
  haze.addColorStop(0.5, "rgba(0,0,0,0.00)");
  haze.addColorStop(1.0, "rgba(150,190,255,0.03)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = haze;
  ctx.fillRect(0,0,W,H);
  ctx.globalCompositeOperation = "source-over";

  // Concentric rings with gentle ripple distortion
  const rings = 7;
  const baseR = Math.min(W,H)*0.14;
  ctx.strokeStyle = "rgba(120,170,220,0.10)";
  ctx.lineWidth = 1.25;

  for (let i=0;i<rings;i++){
    const p = (i+1)/rings;
    const wobble = Math.sin(t*0.7 + i*0.9) * 6 + Math.sin(t*0.33 + i*1.6) * 3;
    const r = baseR + p * Math.min(W,H)*0.24 + wobble;
    ctx.beginPath();
    ctx.arc(CX, CY, r, 0, Math.PI*2);
    ctx.stroke();
  }

  // Nucleus pulse (slower, breathing)
  const pulse = 1 + Math.sin(t*0.6)*0.06 + Math.sin(t*0.11)*0.03;
  const nucleusR = Math.min(W,H)*0.045 * (0.85 + HEALTH*0.30) * pulse;

  const nGrad = ctx.createRadialGradient(CX, CY, 2, CX, CY, nucleusR*2.6);
  nGrad.addColorStop(0.00, "rgba(100,180,255,0.85)");
  nGrad.addColorStop(0.35, "rgba(70,160,240,0.40)");
  nGrad.addColorStop(1.00, "rgba(50,120,200,0.00)");
  ctx.fillStyle = nGrad;
  ctx.beginPath();
  ctx.arc(CX, CY, nucleusR*2.4, 0, Math.PI*2);
  ctx.fill();

  ctx.fillStyle = "rgba(140,200,255,.95)";
  ctx.beginPath();
  ctx.arc(CX, CY, nucleusR, 0, Math.PI*2);
  ctx.fill();

  // Motes (irregular drift)
  ctx.fillStyle = "rgba(190,220,255,0.75)";
  for (const m of motes) {
    m.j += 0.007 + Math.random()*0.003;
    const driftR = baseR*0.65 + Math.sin(m.j*0.7)*baseR*0.4;
    const ang = m.j + m.v*0.005 + Math.sin(t*0.21+m.j)*0.03;
    const x = CX + Math.cos(ang) * driftR;
    const y = CY + Math.sin(ang) * (driftR*0.62);
    const r = m.r + Math.sin(t*0.9 + m.j)*0.35;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.4, r), 0, Math.PI*2);
    ctx.fill();
  }

  requestAnimationFrame(drawWomb);
}

/***** UI binding *****/
function setHealth(v){ HEALTH = clamp(v); healthBar.style.width = `${Math.round(HEALTH*100)}%`; healthPct.textContent = `${Math.round(HEALTH*100)}%`; }
function setMutation(v){ MUTATION = clamp(v); mutBar.style.width = `${Math.round(MUTATION*100)}%`; mutPct.textContent = `${Math.round(MUTATION*100)}%`; }
function setStage(n){ STAGE = n|0; stageNum.textContent = STAGE; stageBadge.textContent = `Stage ${STAGE} · The Cell`; }
function setFlow(net){ // net: -1..+1
  const pct = clamp((net+1)/2)*100;
  flowBar.style.width = `${pct}%`;
  FLOW_NEEDLE = pct;
  if (net > .05) { flowLabel.textContent = "Feeding"; flowLabel.style.color = "#46e6ae"; }
  else if (net < -.05) { flowLabel.textContent = "Starving"; flowLabel.style.color = "#ff7b7b"; }
  else { flowLabel.textContent = "Neutral"; flowLabel.style.color = "#8aa0b8"; }
}

/***** Trades (render) *****/
function renderTrades(rows=[]) {
  tradesBody.innerHTML = "";
  rows.forEach(r => {
    const tr = document.createElement("tr");
    const type = (r.type||"").toLowerCase()==="buy" ? "feed" : "starve";
    tr.innerHTML = `
      <td class="mono">${r.time||"--:--:--"}</td>
      <td class="type-${type}">${type==="feed"?"Feed":"Starve"}</td>
      <td class="mono">$${Number(r.valueUsd||0).toFixed(2)}</td>
      <td class="mono">$${Number(r.priceUsd||0).toFixed(6)}</td>
    `;
    tradesBody.appendChild(tr);
  });
}

/***** Pollers (stubbed: wire to your backend when ready) *****/
async function pollHealth(){
  try{
    // Example:
    // const j = await fetch(`${API}/health`).then(r=>r.json());
    // priceLabel.textContent = `$${j.price.toFixed(6)}`;
    // updatedLabel.textContent = new Date(j.timestamp||Date.now()).toLocaleTimeString();
    // tiny living nudge from price tick:
    const delta = (Math.random() - 0.5) * 0.012;
    setHealth(clamp(HEALTH + delta));
  }catch(e){ console.error(e); }
}
async function pollTrades(){
  try{
    // Example shape you can adapt:
    // const arr = await fetch(`${API}/trades`).then(r=>r.json());
    // const rows = arr.map(x => ({
    //   time: new Date(x.ts).toLocaleTimeString(),
    //   type: x.side === "BUY" ? "buy" : "sell",
    //   valueUsd: x.price * x.amount, priceUsd: x.price
    // }));
    // Sim fallback:
    const rows = Array.from({length: 6}, (_,i)=> {
      const isBuy = Math.random()>0.5;
      const price = 0.006 + Math.random()*0.0009;
      const value = (4+Math.random()*28)*(isBuy?1:1);
      return {
        time: new Date(Date.now()-i*25000).toLocaleTimeString(),
        type: isBuy ? "buy" : "sell",
        valueUsd: value, priceUsd: price
      };
    });
    renderTrades(rows);

    // Net flow estimate from the simulated rows:
    const net = rows.reduce((s,r)=> s + (r.type==="buy"? r.valueUsd : -r.valueUsd), 0);
    const max = 60; // clamp window
    setFlow(clamp(net/max, -1, 1));

    // nudge health slightly so it “feels alive”
    setHealth(clamp(HEALTH + (net>=0 ? 0.006 : -0.006)));
  }catch(e){ console.error(e); }
}

/***** Buttons *****/
feedBtn.addEventListener("click", (ev) => {
  ev.preventDefault();
  setHealth( clamp(HEALTH + 0.04) );
});

/***** Boot *****/
setStage(1);
setHealth(0.54); setMutation(0.06);
pollHealth(); pollTrades();
setInterval(pollHealth, 6000);
setInterval(pollTrades, 6000);
requestAnimationFrame(drawWomb);const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- Animation state ---
let t = 0;
let pulseSize = 40; // base nucleus radius
let feedBoost = 0;  // grows when fed
let starveDrain = 0; // shrinks when starving

// drifting particles
const motes = Array.from({ length: 20 }, () => ({
  x: Math.random() * window.innerWidth,
  y: Math.random() * window.innerHeight,
  r: 1 + Math.random() * 2,
  dx: (Math.random() - 0.5) * 0.15,
  dy: (Math.random() - 0.5) * 0.15,
  driftPhase: Math.random() * Math.PI * 2
}));

function drawOrganism() {
  t += 0.01;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // amniotic fluid gradient overlay
  const g = ctx.createRadialGradient(
    canvas.width/2, canvas.height/2, 50,
    canvas.width/2, canvas.height/2, canvas.width/1.2
  );
  g.addColorStop(0, "rgba(0, 80, 120, 0.20)");
  g.addColorStop(0.6, "rgba(0, 40, 70, 0.15)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // ripple distortion rings
  ctx.strokeStyle = "rgba(0,150,200,0.08)";
  ctx.lineWidth = 1.5;
  for (let i=0;i<8;i++) {
    const wobble = Math.sin(t*0.9 + i*0.6) * 8;
    const r = 120 + i*40 + wobble;
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, r, 0, Math.PI*2);
    ctx.stroke();
  }

  // nucleus pulse (with feed/starve influence)
  const pulse = pulseSize 
              + Math.sin(t*2.1) * 6 
              + Math.sin(t*0.37) * 3
              + feedBoost
              - starveDrain;

  ctx.beginPath();
  ctx.fillStyle = "rgba(0,180,255,0.7)";
  ctx.shadowBlur = 40;
  ctx.shadowColor = "rgba(0,200,255,0.9)";
  ctx.arc(canvas.width/2, canvas.height/2, pulse, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // motes drifting (irregular)
  ctx.fillStyle = "rgba(200,255,255,0.5)";
  motes.forEach(m => {
    m.driftPhase += 0.01 + Math.random()*0.003;
    m.x += m.dx + Math.sin(t*0.5 + m.driftPhase) * 0.3;
    m.y += m.dy + Math.cos(t*0.7 + m.driftPhase) * 0.3;

    if (m.x<0) m.x=canvas.width;
    if (m.x>canvas.width) m.x=0;
    if (m.y<0) m.y=canvas.height;
    if (m.y>canvas.height) m.y=0;

    ctx.beginPath();
    ctx.arc(m.x,m.y,m.r,0,Math.PI*2);
    ctx.fill();
  });

  // decay feed/starve effects slowly
  feedBoost *= 0.97;
  starveDrain *= 0.97;

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

// --- Button interactions ---
document.getElementById("feedBtn").addEventListener("click", () => {
  feedBoost += 10; // big pulse when fed
});
document.getElementById("sfxBtn").addEventListener("click", () => {
  starveDrain += 6; // shrink when starving
});
