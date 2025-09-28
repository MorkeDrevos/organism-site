/* ===== State ===== */
let HEALTH = 0.54, MUT = 0.06, STAGE = 1, FLOW = 0.5;
let AC=null, GAIN=null;
const MAX_ROWS = 6;

/* ===== DOM ===== */
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
const tradesList = document.getElementById('trades-list');

/* ===== Utils ===== */
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const fmtUSD = n => n==null ? '$—' : `$${Number(n).toFixed(2)}`;
const pad2 = x => String(x).padStart(2,'0');
const nowHHMMSS = () => {
  const d=new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

/* ===== Canvas sizing ===== */
function resizeCanvas(){ canvas.width=window.innerWidth; canvas.height=window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

/* ===== Womb (cool) animation ===== */
let t=0;
const motes = Array.from({length: 28}, ()=>({
  x: Math.random()*canvas.width,
  y: Math.random()*canvas.height,
  dx:(Math.random()-.5)*0.5,
  dy:(Math.random()-.5)*0.5,
  r: 0.8 + Math.random()*1.6
}));

function drawOrganism(){
  t += 0.01;

  // Cool haze
  const g = ctx.createRadialGradient(canvas.width*0.25, canvas.height*0.85, 50, canvas.width*0.75, canvas.height*0.15, Math.max(canvas.width,canvas.height));
  g.addColorStop(0, 'rgba(40,80,160,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle=g; ctx.fillRect(0,0,canvas.width,canvas.height);

  const cx = canvas.width*0.5;
  const cy = canvas.height*0.60; // a touch low
  const base = 42 + 8*Math.sin(t*2.0);
  const pulse = 8 + Math.sin(t*2.3)*2*(0.7+HEALTH*0.3);

  // Ripple rings (cool)
  ctx.lineWidth = 1.1;
  for(let r=100;r<=Math.min(canvas.width,canvas.height)*0.46;r+=58){
    const drift = Math.sin(t*0.25 + r)*14;
    ctx.strokeStyle = 'rgba(80,120,190,0.12)';
    ctx.beginPath(); ctx.arc(cx, cy, r+drift, 0, Math.PI*2); ctx.stroke();
  }

  // Nucleus (glow)
  const grad = ctx.createRadialGradient(cx,cy,2,cx,cy,base+pulse);
  grad.addColorStop(0,'rgba(190,230,255,0.95)');
  grad.addColorStop(1,'rgba(120,170,255,0.10)');
  ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(cx,cy,base+pulse,0,Math.PI*2); ctx.fill();

  // Soft tether (cool tone)
  const sway = Math.sin(t*0.8)*60;
  ctx.strokeStyle = 'rgba(150,190,255,0.55)'; ctx.lineWidth=5; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(cx+base*0.6, cy-8);
  ctx.quadraticCurveTo(cx+120+sway*0.1, cy-60, cx+180+sway, cy-40+Math.sin(t)*40);
  ctx.stroke();

  // Motes
  for(const m of motes){
    m.x+=m.dx; m.y+=m.dy;
    if(m.x<0)m.x=canvas.width; if(m.x>canvas.width)m.x=0;
    if(m.y<0)m.y=canvas.height; if(m.y>canvas.height)m.y=0;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2);
    ctx.fillStyle='rgba(200,230,255,0.35)'; ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

/* ===== Audio (optional) ===== */
function initAudio(){
  if (AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  const osc = AC.createOscillator(); GAIN = AC.createGain();
  const lfo = AC.createOscillator(); const lfoGain = AC.createGain();

  osc.type='sawtooth'; osc.frequency.value=34; GAIN.gain.value=0.0;
  lfo.type='sine'; lfo.frequency.value=1.1; lfoGain.gain.value=0.22;

  lfo.connect(lfoGain); lfoGain.connect(GAIN.gain);
  osc.connect(GAIN).connect(AC.destination);
  osc.start(); lfo.start();
}

/* ===== Setters ===== */
function setHealth(v){
  HEALTH = clamp(v);
  const pct = Math.round(HEALTH*100);
  healthBar.style.width = pct+'%'; healthPct.textContent = pct+'%';
}
function setMutation(v){
  MUT = clamp(v);
  const pct = Math.round(MUT*100);
  mutBar.style.width = pct+'%'; mutPct.textContent = pct+'%';
}
function setStage(n){
  STAGE=n; if(stageBadge) stageBadge.textContent=`Stage ${STAGE} · The Cell`;
  if(stageNum) stageNum.textContent=STAGE;
}
function setFlow(f){
  FLOW = clamp(f);
  const center=0.5, mag=Math.abs(FLOW-center)*2, px=Math.max(6,240*mag);
  flowBar.style.width = px+'px';
  flowBar.style.transform = `translateX(${(FLOW-center)*120}px)`;
  flowLabel.textContent = FLOW>0.52?'Feeding':(FLOW<0.48?'Starving':'Neutral');
}

/* ===== Trades (clean list) ===== */
function addTradeRow({ time, type, valueUsd, priceUsd }){
  const li = document.createElement('li');
  li.innerHTML = `
    <div>${time}</div>
    <div class="${type==='Feed' ? 'type-feed' : 'type-starve'}">${type}</div>
    <div>${fmtUSD(valueUsd)}</div>
    <div>${fmtUSD(priceUsd)}</div>
  `;
  tradesList.prepend(li);
  while (tradesList.children.length > MAX_ROWS) tradesList.lastElementChild.remove();
}

function simTradesTick(){
  const buy = Math.random()>0.5;
  const amt = 5 + Math.random()*40;
  addTradeRow({ time: nowHHMMSS(), type: buy?'Feed':'Starve', valueUsd: amt, priceUsd: 0.01 });
  const d = buy? 0.02 : -0.02;
  setFlow(clamp(FLOW + d*0.35));
  setHealth(clamp(HEALTH + d*0.07 - 0.004));
}

/* ===== Buttons ===== */
sfxBtn.addEventListener('click',()=>{
  if(!AC){ initAudio(); sfxBtn.textContent='🔊 SFX On'; if(GAIN) GAIN.gain.value=0.08; return; }
  if(AC.state==='suspended'){ AC.resume(); if(GAIN) GAIN.gain.value=0.08; sfxBtn.textContent='🔊 SFX On'; }
  else{ if(GAIN) GAIN.gain.value=0.0; AC.suspend(); sfxBtn.textContent='🔇 SFX Off'; }
});
feedBtn.addEventListener('click',(e)=>{ e.preventDefault(); setHealth(clamp(HEALTH+0.06)); setFlow(clamp(FLOW+0.06)); });

/* ===== Boot ===== */
decayRate.textContent='1% / 10m';
setStage(1); setHealth(HEALTH); setMutation(MUT);
priceLabel.textContent = fmtUSD(0.01);
updatedLabel.textContent = nowHHMMSS();
setFlow(0.5);

setInterval(()=> updatedLabel.textContent = nowHHMMSS(), 1000);
setInterval(simTradesTick, 6000);
setInterval(()=>{
  const tgt = 0.5 + (FLOW-0.5)*0.2;
  const next = HEALTH + (tgt-HEALTH)*0.04 - 0.0035;
  setHealth(clamp(next));
}, 4000);

/* ===== Hook real endpoints later =====
   Replace simTradesTick + price with your real /health + /trades fetchers.
   /trades shape expected:
   [{ time:"HH:MM:SS", type:"Feed"|"Starve", valueUsd:Number, priceUsd:Number }, ...]
*/
