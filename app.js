/******** Canvas: cinematic “specimen” (deep black + aqua/magenta glow) ********/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha:true });

function fit(){ canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', fit); fit();

let t = 0;
const motes = Array.from({length:26},()=>({
  x: Math.random()*canvas.width,
  y: Math.random()*canvas.height,
  vx:(Math.random()-.5)*0.22,
  vy:(Math.random()-.5)*0.22,
  r: 0.9 + Math.random()*1.6
}));

function draw(){
  t += 0.01;
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);

  // Cool womb haze + vignette (kept subtle on deep black)
  const haze = ctx.createRadialGradient(W*0.5, H*0.68, H*0.06, W*0.5, H*0.72, H*0.95);
  haze.addColorStop(0,'rgba(60,140,160,.10)');
  haze.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=haze; ctx.fillRect(0,0,W,H);

  // Ripple rings
  ctx.save(); ctx.translate(W*0.5, H*0.7);
  for(let i=0;i<9;i++){
    const R = 60 + i*70 + Math.sin(t*0.35+i)*2.2;
    ctx.strokeStyle=`rgba(140,200,255,${0.10 - i*0.01})`;
    ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // Nucleus glow (neutral white-blue so aqua/magenta UI pops)
  const nx = W*0.5 + Math.sin(t*0.6)*10;
  const ny = H*0.7 + Math.cos(t*0.7)*8;
  const pulse = 26 + Math.sin(t*2)*2;

  const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 140);
  glow.addColorStop(0,'rgba(220,235,255,.30)');
  glow.addColorStop(1,'rgba(220,235,255,0)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(nx,ny,140,0,Math.PI*2); ctx.fill();

  const orb = ctx.createRadialGradient(nx, ny, 0, nx, ny, 52+pulse);
  orb.addColorStop(0,'rgba(240,248,255,1)');
  orb.addColorStop(1,'rgba(190,210,240,.06)');
  ctx.fillStyle=orb; ctx.beginPath(); ctx.arc(nx,ny,52+pulse,0,Math.PI*2); ctx.fill();

  // Tether (slight aqua tint)
  ctx.strokeStyle='rgba(95,243,209,.55)'; ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath();
  const cp1x = nx-140, cp1y = ny-80 + Math.sin(t*.9)*16;
  const endx = nx-280 + Math.sin(t*.6)*9, endy = ny-36 + Math.cos(t*.7)*12;
  ctx.moveTo(nx-10,ny-10); ctx.quadraticCurveTo(cp1x,cp1y,endx,endy); ctx.stroke();

  // Motes
  for(const m of motes){
    m.x += m.vx + Math.sin(t*0.5)*0.02;
    m.y += m.vy + Math.cos(t*0.4)*0.02;
    if(m.x<0)m.x=W; if(m.x>W)m.x=0; if(m.y<0)m.y=H; if(m.y>H)m.y=0;
    ctx.fillStyle='rgba(210,230,255,.5)';
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(draw);
}
draw();

/******** DOM refs ********/
const priceLabel = document.getElementById('priceLabel');
const updatedLabel = document.getElementById('updatedLabel');
const stageNum = document.getElementById('stageNum');
const stageBadge = document.getElementById('stageBadge');
const decayRate = document.getElementById('decayRate');

const healthPct = document.getElementById('healthPct');
const mutPct = document.getElementById('mutPct');
const gaugeHealth = document.querySelector('.gauge.health .ring');
const gaugeMut    = document.querySelector('.gauge.mut .ring');

const flowBar = document.getElementById('flowBar');
const flowLabel = document.getElementById('flowLabel');

const tradesBody = document.getElementById('trades-body');
const sfxBtn = document.getElementById('sfxBtn');
const feedBtn = document.getElementById('feedBtn');
const tradeBtn = document.getElementById('tradeBtn');

/******** Helpers ********/
const clamp = (v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const nowHHMMSS = ()=>{ const d=new Date(), p=n=>String(n).padStart(2,'0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const fmtUSD = n=>`$${Number(n).toFixed(2)}`;

/******** Gauges (conic arcs) ********/
function setGauge(el, pct){ el.style.setProperty('--val', Math.round(clamp(pct)*360)); }
function setHealth(v){ setGauge(gaugeHealth, v); healthPct.textContent = `${Math.round(clamp(v)*100)}%`; }
function setMutation(v){ setGauge(gaugeMut, v);   mutPct.textContent   = `${Math.round(clamp(v)*100)}%`; }
function setStage(n){ stageNum.textContent=n; stageBadge.textContent=`Stage ${n} · The Cell`; }
function setFlow(x){
  const pct=((x+1)/2)*100; flowBar.style.width=pct+'%';
  flowLabel.textContent = x>0.12?'Feeding':x<-0.12?'Starving':'Neutral';
}

/******** Toast renderer (max 4, no boxes) ********/
const MAX_TOASTS = 4;
function renderTrades(items){
  tradesBody.innerHTML='';
  const rows = items.slice(-MAX_TOASTS).reverse();
  for(const r of rows){
    const node = document.createElement('div');
    node.className = 'toast';
    node.innerHTML = `
      <div>${r.time}</div>
      <div class="${r.type==='Feed'?'type-feed':'type-starve'}">${r.type}</div>
      <div class="right">${fmtUSD(r.valueUsd)}</div>
      <div class="right">${fmtUSD(r.priceUsd)}</div>
    `;
    tradesBody.appendChild(node);
  }
}

/******** Optional womb SFX ********/
let AC=null,gain=null;
function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  // heartbeat
  const o=AC.createOscillator(), g1=AC.createGain(); o.type='sine'; o.frequency.value=58; g1.gain.value=0.018; o.connect(g1);
  // womb noise
  const n=AC.createBufferSource(); const buf=AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate);
  const ch=buf.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*0.11;
  n.buffer=buf; n.loop=true; const g2=AC.createGain(); g2.gain.value=0.028; n.connect(g2);
  gain=AC.createGain(); gain.gain.value=0; g1.connect(gain); g2.connect(gain); gain.connect(AC.destination);
  o.start(); n.start();
}
sfxBtn.addEventListener('click',()=>{
  if(!AC){ initAudio(); sfxBtn.textContent='🔊 SFX On'; gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.35); }
  else if(gain.gain.value>0){ gain.gain.linearRampToValueAtTime(0.0, AC.currentTime+0.2); sfxBtn.textContent='🔇 SFX Off'; }
  else { gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.3); sfxBtn.textContent='🔊 SFX On'; }
});

/******** Simulator (swap with your real endpoints) ********/
let HEALTH=0.48, MUT=0.07, FLOW=0.0, STAGE=1;
const simTrades=[];
function tickSim(){
  const buy = Math.random()>0.55;
  const usd = 6+Math.random()*30;
  simTrades.push({ time:nowHHMMSS(), type: buy?'Feed':'Starve', valueUsd: usd, priceUsd: 0.01 });
  if(simTrades.length>50) simTrades.shift();
  FLOW = clamp(FLOW*0.5 + (buy?+0.4:-0.4), -1, 1);
  HEALTH = clamp(HEALTH + (buy?+0.012:-0.02));
}

/******** Boot & schedules ********/
decayRate.textContent='1% / 10m';
setStage(STAGE); setHealth(HEALTH); setMutation(MUT); setFlow(0.0);
priceLabel.textContent=fmtUSD(0.01); updatedLabel.textContent=nowHHMMSS();

document.getElementById('feedBtn').addEventListener('click', (e)=>{
  e.preventDefault();
  HEALTH = clamp(HEALTH + 0.04); setHealth(HEALTH);
  MUT = clamp(MUT + 0.002); setMutation(MUT);
  FLOW = clamp(FLOW + 0.4, -1, 1); setFlow(FLOW);
  simTrades.push({ time:nowHHMMSS(), type:'Feed', valueUsd:(8+Math.random()*24), priceUsd:0.01 });
  renderTrades(simTrades);
});

setInterval(()=> updatedLabel.textContent=nowHHMMSS(), 6000);
setInterval(tickSim, 6000);
setInterval(()=>{
  const tgt = 0.55 + (FLOW-0.5)*0.2;
  HEALTH = clamp(HEALTH + (tgt-HEALTH)*0.04);
  setHealth(HEALTH);
}, 4000);

renderTrades(simTrades);

/* ===== Hook real endpoints later =====
   GET /health -> { price, timestamp, health?, mutation?, stage? }
   GET /trades -> [{ time:"HH:MM:SS", type:"Feed"|"Starve", valueUsd, priceUsd }]
   Then call set* & renderTrades(items).
*/
