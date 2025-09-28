/***** Canvas (womb) + UI logic *****/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha:true });

function fitCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/* --- Womb visuals (cool midnight palette) --- */
let t = 0;
const motes = Array.from({length:22},()=>({
  x: Math.random()*canvas.width,
  y: Math.random()*canvas.height,
  vx:(Math.random()-.5)*0.25,
  vy:(Math.random()-.5)*0.25,
  r: 1.1 + Math.random()*1.4
}));

function draw(){
  t += 0.01;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // haze
  const g = ctx.createRadialGradient(W*0.52, H*0.55, H*0.05, W*0.5, H*0.6, H*0.9);
  g.addColorStop(0,   'rgba(10,30,50,.45)');
  g.addColorStop(0.6, 'rgba(8,18,30,.25)');
  g.addColorStop(1,   'rgba(6,12,22,0)');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

  // rings
  ctx.save();
  ctx.translate(W*0.5, H*0.64);
  for(let i=0;i<8;i++){
    const r = 80 + i*70 + Math.sin(t*0.3+i)*2;
    ctx.strokeStyle = `rgba(40,90,140,${0.15 - i*0.013})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // nucleus
  const nX = W*0.43 + Math.sin(t*0.6)*8;
  const nY = H*0.68 + Math.cos(t*0.7)*6;
  const pulse = 24 + Math.sin(t*2)*2;

  const glow = ctx.createRadialGradient(nX, nY, 0, nX, nY, 140);
  glow.addColorStop(0,'rgba(180,210,255,.55)');
  glow.addColorStop(1,'rgba(160,200,255,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(nX,nY,140,0,Math.PI*2); ctx.fill();

  const orb = ctx.createRadialGradient(nX, nY, 0, nX, nY, 50+pulse);
  orb.addColorStop(0,'rgba(200,235,255,1)');
  orb.addColorStop(1,'rgba(140,180,220,.1)');
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(nX,nY,50+pulse,0,Math.PI*2); ctx.fill();

  // tether
  ctx.strokeStyle = 'rgba(150,200,255,.65)';
  ctx.lineWidth = 6; ctx.lineCap='round';
  ctx.beginPath();
  const t0x = nX-10, t0y = nY-10;
  const cp1x = nX-120, cp1y = nY-80 + Math.sin(t*.9)*18;
  const endx = nX-240 + Math.sin(t*.6)*8, endy = nY-40 + Math.cos(t*.8)*12;
  ctx.moveTo(t0x,t0y);
  ctx.quadraticCurveTo(cp1x,cp1y,endx,endy);
  ctx.stroke();

  // motes
  for(const m of motes){
    m.x += m.vx + Math.sin(t*0.5)*0.02;
    m.y += m.vy + Math.cos(t*0.4)*0.02;
    if(m.x<0)m.x=W; if(m.x>W)m.x=0; if(m.y<0)m.y=H; if(m.y>H)m.y=0;
    ctx.fillStyle = 'rgba(190,220,255,.6)';
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(draw);
}
draw();

/* ===== UI wiring ===== */
const status = document.getElementById('status');
const heartbeat = document.getElementById('heartbeat');
const priceLabel = document.getElementById('priceLabel');
const updatedLabel = document.getElementById('updatedLabel');

const healthBar = document.getElementById('healthBar');
const mutBar = document.getElementById('mutBar');
const healthPct = document.getElementById('healthPct');
const mutPct = document.getElementById('mutPct');
const decayRate = document.getElementById('decayRate');
const stageNum = document.getElementById('stageNum');
const stageBadge = document.getElementById('stageBadge');

const flowBar = document.getElementById('flowBar');
const flowLabel = document.getElementById('flowLabel');

const tradesBody = document.getElementById('trades-body');
const sfxBtn = document.getElementById('sfxBtn');
const feedBtn = document.getElementById('feedBtn');
const tradeBtn = document.getElementById('tradeBtn');

const clamp = (v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const nowHHMMSS = ()=> {
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

/* meters + labels */
function setHealth(v){ v=clamp(v); healthBar.style.width=(v*100)+'%'; healthPct.textContent=Math.round(v*100)+'%'; }
function setMutation(v){ v=clamp(v); mutBar.style.width=(v*100)+'%'; mutPct.textContent=Math.round(v*100)+'%'; }
function setStage(n){ stageNum.textContent=n; stageBadge.textContent = n===1?'Stage 1 · The Cell':`Stage ${n}`; }
function setFlow(x){  // x in [-1..1]
  const pct = ((x+1)/2)*100;
  flowBar.style.width = pct+'%';
  flowLabel.textContent = x>0.12?'Feeding' : x<-0.12?'Starving' : 'Neutral';
}
function fmtUSD(n){ return `$${Number(n).toFixed(2)}`; }
function fmtPrice(n){ return `$${Number(n).toFixed(2)}`; }

/* trades render: newest on top, max 6 rows, no table gridlines */
function renderTrades(items){
  tradesBody.innerHTML = '';
  const sliced = items.slice(-6).reverse();
  for(const it of sliced){
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="cell">${it.time}</div>
      <div class="cell ${it.type==='Feed'?'type-feed':'type-starve'}">${it.type}</div>
      <div class="cell right">${fmtUSD(it.valueUsd)}</div>
      <div class="cell right">${fmtPrice(it.priceUsd)}</div>
    `;
    tradesBody.appendChild(row);
  }
}

/* optional audio */
let AC=null, gain=null;
function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  const o1 = AC.createOscillator(); const g1 = AC.createGain();
  o1.type='sine'; o1.frequency.value=58; g1.gain.value=0.02; o1.connect(g1);

  const noise = AC.createBufferSource();
  const buf = AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate);
  const data = buf.getChannelData(0);
  for(let i=0;i<data.length;i++){ data[i] = (Math.random()*2-1)*0.12; }
  noise.buffer = buf; noise.loop = true;
  const g2 = AC.createGain(); g2.gain.value=0.03; noise.connect(g2);

  gain = AC.createGain(); gain.gain.value=0.0;
  g1.connect(gain); g2.connect(gain); gain.connect(AC.destination);
  o1.start(); noise.start();
}
sfxBtn.addEventListener('click',()=>{
  if(!AC){ initAudio(); sfxBtn.textContent='🔊 SFX On'; gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.4); }
  else if(gain.gain.value>0){ gain.gain.linearRampToValueAtTime(0.0, AC.currentTime+0.2); sfxBtn.textContent='🔇 SFX Off'; }
  else { gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.3); sfxBtn.textContent='🔊 SFX On'; }
});

/* simulator (replace with your real endpoints later) */
let HEALTH = 0.43, MUT = 0.06, FLOW = 0.0, STAGE=1;
const simTrades = [];
function simTradesTick(){
  // random feed/starve
  const isBuy = Math.random()>0.55;
  const price = 0.01;
  const usd = (5 + Math.random()*35) * (isBuy?1:1);
  const type = isBuy?'Feed':'Starve';
  simTrades.push({ time: nowHHMMSS(), type, valueUsd: usd, priceUsd: price });
  if(simTrades.length>32) simTrades.shift();

  // net flow nudges health
  FLOW = clamp(FLOW*0.5 + (isBuy?+0.4:-0.4), -1, 1);
  HEALTH = clamp(HEALTH + (isBuy?+0.015:-0.02));
}

function pollHealth(){
  // if fetching real data, set these from API:
  setHealth(HEALTH);
  setMutation(MUT);
  setStage(STAGE);
  setFlow(FLOW);

  priceLabel.textContent = fmtPrice(0.01);
  updatedLabel.textContent = nowHHMMSS();
}
function pollTrades(){ renderTrades(simTrades); }

/* buttons */
feedBtn.addEventListener('click',(ev)=>{
  ev.preventDefault();
  HEALTH = clamp(HEALTH + 0.03);
  MUT = clamp(MUT + 0.002);
  FLOW = clamp(FLOW + 0.4, -1, 1);
  simTrades.push({ time: nowHHMMSS(), type:'Feed', valueUsd: (8+Math.random()*24), priceUsd: 0.01 });
  pollTrades(); pollHealth();
});

/* boot */
decayRate.textContent = '1% / 10m';
setStage(STAGE); setHealth(HEALTH); setMutation(MUT); setFlow(0.0);
priceLabel.textContent = fmtPrice(0.01); updatedLabel.textContent = nowHHMMSS();

setInterval(()=> updatedLabel.textContent = nowHHMMSS(), 6000);
setInterval(simTradesTick, 6000);
setInterval(()=>{
  const tgt = 0.5 + (FLOW-0.5)*0.2;
  const next = HEALTH + (tgt-HEALTH)*0.04;
  setHealth(HEALTH = clamp(next));
}, 4000);

pollHealth(); pollTrades();

/* ===== How to hook real endpoints later =====
  - Replace the simulator parts above with:
    fetch('/health').then(r=>r.json()).then(({price, timestamp, health}) => { ... })
    fetch('/trades').then(r=>r.json()).then(renderTradesShape)
  - And map your backend shape to { time:"HH:MM:SS", type:"Feed"|"Starve", valueUsd:Number, priceUsd:Number }
*/
