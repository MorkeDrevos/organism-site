/* ====== State ====== */
let HEALTH = 0.54;       // 0..1
let MUT = 0.06;          // 0..1
let STAGE = 1;
let FLOW = 0.5;          // 0..1 (0 left / sell, 1 right / buy)
let AC = null;           // web audio context
let GAIN = null;

const MAX_ROWS = 6;

/* ====== DOM ====== */
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha:true });

const statusEl = document.getElementById('status');
const heartbeatEl = document.getElementById('heartbeat');
const stageBadge = document.getElementById('stageBadge');
const stageNum = document.getElementById('stageNum');

const priceLabel = document.getElementById('priceLabel');
const updatedLabel = document.getElementById('updatedLabel');

const flowBar = document.getElementById('flowBar');
const flowLabel = document.getElementById('flowLabel');

const healthBar = document.getElementById('healthBar');
const mutBar = document.getElementById('mutBar');
const healthPct = document.getElementById('healthPct');
const mutPct = document.getElementById('mutPct');
const decayRate = document.getElementById('decayRate');

const sfxBtn = document.getElementById('sfxBtn');
const feedBtn = document.getElementById('feedBtn');
const tradeBtn = document.getElementById('tradeBtn');
const tradesBody = document.getElementById('trades-body');

/* ====== Utils ====== */
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const fmtUSD = n => n == null ? '$—' : `$${Number(n).toFixed(2)}`;
const nowHHMMSS = () => {
  const d = new Date();
  const p = (x)=> String(x).padStart(2,'0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/* ====== Canvas sizing ====== */
function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/* ====== Womb animation ====== */
let t = 0;
// random motes
const motes = Array.from({length: 26}, () => ({
  x: Math.random()*canvas.width,
  y: Math.random()*canvas.height,
  dx: (Math.random()-.5) * 0.6,
  dy: (Math.random()-.5) * 0.6,
  r: 0.8 + Math.random()*1.6
}));

function drawOrganism(){
  t += 0.01;

  // subtle warm haze (dark to warm)
  const g = ctx.createRadialGradient(canvas.width*0.25, canvas.height*0.85, 50, canvas.width*0.75, canvas.height*0.15, Math.max(canvas.width, canvas.height));
  g.addColorStop(0, 'rgba(180,80,40,0.03)');
  g.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.62; // sit slightly low
  const pulse = 8 + Math.sin(t*2) * 2 * (0.7 + HEALTH*0.3);

  // concentric ripple rings
  ctx.lineWidth = 1.2;
  for(let r=110; r<=Math.min(canvas.width, canvas.height)*0.45; r+=60){
    const drift = Math.sin(t*0.25 + r) * 16;
    ctx.strokeStyle = `rgba(240,170,130,0.10)`;
    ctx.beginPath();
    ctx.arc(cx, cy, r + drift, 0, Math.PI*2);
    ctx.stroke();
  }

  // nucleus (glowing)
  const base = 44 + 10*Math.sin(t*2.1);
  const hue = 22 + 5*Math.sin(t*0.6);
  const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, base + pulse);
  grad.addColorStop(0, `hsla(${hue},85%,92%,0.95)`);
  grad.addColorStop(1, `hsla(${hue},70%,62%,0.10)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, base + pulse, 0, Math.PI*2);
  ctx.fill();

  // soft tether cord (like umbilical), slow sway
  const sway = Math.sin(t*0.8)*60;
  ctx.strokeStyle = 'rgba(230,160,130,0.65)';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx+base*0.6, cy-8);
  ctx.quadraticCurveTo(cx+120+sway*0.1, cy-60, cx+180+sway, cy-40+Math.sin(t)*40);
  ctx.stroke();

  // floating motes
  for(const m of motes){
    m.x += m.dx; m.y += m.dy;
    if (m.x < 0) m.x = canvas.width;
    if (m.x > canvas.width) m.x = 0;
    if (m.y < 0) m.y = canvas.height;
    if (m.y > canvas.height) m.y = 0;

    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(250,230,210,0.35)';
    ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

/* ====== Audio (optional) ====== */
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  const osc = AC.createOscillator();
  GAIN = AC.createGain();
  const lfo = AC.createOscillator();
  const lfoGain = AC.createGain();

  osc.type = 'sawtooth';
  osc.frequency.value = 35;             // womb hum
  GAIN.gain.value = 0.0;

  lfo.type = 'sine';
  lfo.frequency.value = 1.1;            // heartbeat
  lfoGain.gain.value = 0.25;

  lfo.connect(lfoGain);
  lfoGain.connect(GAIN.gain);
  osc.connect(GAIN).connect(AC.destination);

  osc.start(); lfo.start();
}

/* ====== UI setters ====== */
function setHealth(v){
  HEALTH = clamp(v); healthBar.style.width = `${Math.round(HEALTH*100)}%`;
  healthPct.textContent = `${Math.round(HEALTH*100)}%`;
}
function setMutation(v){
  MUT = clamp(v); mutBar.style.width = `${Math.round(MUT*100)}%`;
  mutPct.textContent = `${Math.round(MUT*100)}%`;
}
function setStage(n){
  STAGE = n;
  if (stageBadge) stageBadge.textContent = `Stage ${STAGE} · The Cell`;
  if (stageNum) stageNum.textContent = STAGE;
}
function setFlow(f){ // 0..1
  FLOW = clamp(f);
  // bar width around center (0.5)
  const center = 0.5;
  const magnitude = Math.abs(FLOW-center) * 2; // 0..1
  const px = Math.max(6, 240 * magnitude);
  flowBar.style.width = `${px}px`;
  flowBar.style.transform = `translateX(${(FLOW-center)*120}px)`;
  const side = (FLOW>0.52) ? 'Feeding' : (FLOW<0.48 ? 'Starving' : 'Neutral');
  flowLabel.textContent = side;
}

/* ====== Trades (sim / parsing) ====== */
function addTradeRow({ time, type, valueUsd, priceUsd }){
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${time}</td>
    <td class="${type==='Feed' ? 'type-feed' : 'type-starve'}">${type}</td>
    <td>${fmtUSD(valueUsd)}</td>
    <td>${fmtUSD(priceUsd)}</td>
  `;
  tradesBody.prepend(tr);
  // keep short
  while (tradesBody.children.length > MAX_ROWS){
    tradesBody.lastElementChild.remove();
  }
}
function simTradesTick(){
  // random-ish buys/sells around 50/50
  const buy = Math.random() > 0.5;
  const amt = 5 + Math.random()*40;
  const price = 0.01; // placeholder
  addTradeRow({
    time: nowHHMMSS(),
    type: buy ? 'Feed' : 'Starve',
    valueUsd: amt,
    priceUsd: price
  });

  // nudge net flow & health a touch
  const delta = buy ? 0.02 : -0.02;
  setFlow(clamp(FLOW + delta*0.3));
  setHealth(clamp(HEALTH + delta*0.08 - 0.005)); // slight natural drift
}

/* ====== Buttons ====== */
sfxBtn.addEventListener('click', () => {
  if (!AC) { initAudio(); sfxBtn.textContent = '🔊 SFX On'; if (GAIN) GAIN.gain.value = 0.08; return; }
  if (AC.state === 'suspended'){ AC.resume(); if (GAIN) GAIN.gain.value = 0.08; sfxBtn.textContent = '🔊 SFX On'; }
  else { if (GAIN) GAIN.gain.value = 0.0; AC.suspend(); sfxBtn.textContent = '🔇 SFX Off'; }
});

feedBtn.addEventListener('click', (ev) => {
  ev.preventDefault();
  // micro “feed” nudge
  setHealth(clamp(HEALTH + 0.06));
  setFlow(clamp(FLOW + 0.06));
});

/* ====== Boot ====== */
decayRate.textContent = '1% / 10m';
setStage(1);
setHealth(HEALTH);
setMutation(MUT);
priceLabel.textContent = fmtUSD(0.01);
updatedLabel.textContent = nowHHMMSS();
setFlow(0.5);

// schedules
setInterval(() => updatedLabel.textContent = nowHHMMSS(), 1000);
setInterval(simTradesTick, 6000);       // sim trades every 6s
setInterval(() => {                     // slow health decay toward ~0.5 baseline
  const tgt = 0.5 + (FLOW-0.5)*0.2;
  const next = HEALTH + (tgt-HEALTH)*0.04 - 0.004;
  setHealth(clamp(next));
}, 4000);

/* ====== (Optional) hook real backend later ======
   When you have real endpoints, replace simTradesTick + price here:
   - fetch /health -> { price, timestamp }  -> update priceLabel, updatedLabel
   - fetch /trades -> [{ time, type, valueUsd, priceUsd }, ...] -> addTradeRow for new items
*/
