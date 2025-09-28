/******** Canvas: “womb” creature ********/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha:true });

function fit() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', fit); fit();

let t = 0;
const motes = Array.from({length:22},()=>({
  x: Math.random()*canvas.width,
  y: Math.random()*canvas.height,
  vx:(Math.random()-.5)*0.25,
  vy:(Math.random()-.5)*0.25,
  r: 1.1 + Math.random()*1.4
}));

function drawOrganism(){
  t += 0.01;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0,0,W,H);

  // Soft fluid haze (cool blues)
  const haze = ctx.createRadialGradient(W*0.52, H*0.58, H*0.05, W*0.5, H*0.64, H*0.9);
  haze.addColorStop(0,'rgba(20,60,100,.55)');
  haze.addColorStop(0.6,'rgba(10,24,42,.25)');
  haze.addColorStop(1,'rgba(6,12,22,0)');
  ctx.fillStyle = haze; ctx.fillRect(0,0,W,H);

  // Concentric ripple rings
  ctx.save(); ctx.translate(W*0.48, H*0.66);
  for(let i=0;i<9;i++){
    const r = 70 + i*68 + Math.sin(t*0.35+i)*2;
    ctx.strokeStyle = `rgba(80,140,200,${0.15 - i*0.012})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // Nucleus (breathing)
  const nx = W*0.39 + Math.sin(t*0.6)*10;
  const ny = H*0.7  + Math.cos(t*0.7)*8;
  const pulse = 26 + Math.sin(t*2)*2;

  const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 140);
  glow.addColorStop(0,'rgba(150,200,255,.55)');
  glow.addColorStop(1,'rgba(150,200,255,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(nx, ny, 140, 0, Math.PI*2); ctx.fill();

  const orb = ctx.createRadialGradient(nx, ny, 0, nx, ny, 52+pulse);
  orb.addColorStop(0,'rgba(200,235,255,1)');
  orb.addColorStop(1,'rgba(140,180,220,.08)');
  ctx.fillStyle = orb; ctx.beginPath(); ctx.arc(nx, ny, 52+pulse, 0, Math.PI*2); ctx.fill();

  // Tether (umbilical-like)
  ctx.strokeStyle = 'rgba(160,210,255,.7)';
  ctx.lineWidth = 6; ctx.lineCap='round';
  ctx.beginPath();
  const cp1x = nx-120, cp1y = ny-80 + Math.sin(t*.9)*18;
  const endx = nx-250 + Math.sin(t*.6)*8, endy = ny-40 + Math.cos(t*.8)*12;
  ctx.moveTo(nx-10,ny-10);
  ctx.quadraticCurveTo(cp1x,cp1y,endx,endy);
  ctx.stroke();

  // Motes drifting
  for(const m of motes){
    m.x += m.vx + Math.sin(t*0.5)*0.02;
    m.y += m.vy + Math.cos(t*0.4)*0.02;
    if(m.x<0)m.x=W; if(m.x>W)m.x=0; if(m.y<0)m.y=H; if(m.y>H)m.y=0;
    ctx.fillStyle = 'rgba(190,220,255,.6)';
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}
drawOrganism();

/******** UI refs ********/
const statusEl = document.getElementById('status');
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
const nowHHMMSS = ()=>{
  const d=new Date();const p=n=>String(n).padStart(2,'0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const fmtUSD = n=>`$${Number(n).toFixed(2)}`;
const fmtPrice = n=>`$${Number(n).toFixed(2)}`;

/******** HUD setters ********/
function setHealth(v){ v=clamp(v); healthBar.style.width=(v*100)+'%'; healthPct.textContent=Math.round(v*100)+'%'; }
function setMutation(v){ v=clamp(v); mutBar.style.width=(v*100)+'%'; mutPct.textContent=Math.round(v*100)+'%'; }
function setStage(n){ stageNum.textContent=n; stageBadge.textContent = `Stage ${n} · The Cell`; }
function setFlow(x){ const pct=((x+1)/2)*100; flowBar.style.width=pct+'%'; flowLabel.textContent = x>0.12?'Feeding':x<-0.12?'Starving':'Neutral'; }

/******** Trades render (list, max 6, newest on top) ********/
function renderTrades(items){
  tradesBody.innerHTML='';
  const rows = items.slice(-6).reverse();
  for(const r of rows){
    const el = document.createElement('div');
    el.className='row';
    el.innerHTML = `
      <div>${r.time}</div>
      <div class="${r.type==='Feed'?'type-feed':'type-starve'}">${r.type}</div>
      <div class="right">${fmtUSD(r.valueUsd)}</div>
      <div class="right">${fmtPrice(r.priceUsd)}</div>
    `;
    tradesBody.appendChild(el);
  }
}

/******** Optional ambient audio ********/
let AC=null,gain=null;
function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  const o = AC.createOscillator(); const g1=AC.createGain();
  o.frequency.value=58; o.type='sine'; g1.gain.value=0.02; o.connect(g1);
  const n = AC.createBufferSource(); const buf = AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate);
  const ch = buf.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*0.12;
  n.buffer=buf; n.loop=true; const g2=AC.createGain(); g2.gain.value=0.03; n.connect(g2);
  gain=AC.createGain(); gain.gain.value=0; g1.connect(gain); g2.connect(gain); gain.connect(AC.destination);
  o.start(); n.start();
}
sfxBtn.addEventListener('click',()=>{
  if(!AC){ initAudio(); sfxBtn.textContent='🔊 SFX On'; gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.4); }
  else if(gain.gain.value>0){ gain.gain.linearRampToValueAtTime(0.0, AC.currentTime+0.2); sfxBtn.textContent='🔇 SFX Off'; }
  else { gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.3); sfxBtn.textContent='🔊 SFX On'; }
});

/******** Tiny simulator (swap with real API later) ********/
let HEALTH=0.43, MUT=0.06, FLOW=0.0, STAGE=1;
const simTrades=[];
function simTick(){
  const buy = Math.random()>0.55;
  const price = 0.01;
  const usd = 6 + Math.random()*34;
  simTrades.push({ time: nowHHMMSS(), type: buy?'Feed':'Starve', valueUsd: usd, priceUsd: price });
  if(simTrades.length>40) simTrades.shift();
  FLOW = clamp(FLOW*0.5 + (buy?+0.4:-0.4), -1, 1);
  HEALTH = clamp(HEALTH + (buy?+0.014:-0.02));
}

/******** Boot + schedules ********/
decayRate.textContent='1% / 10m';
setStage(STAGE); setHealth(HEALTH); setMutation(MUT); setFlow(0.0);
priceLabel.textContent=fmtPrice(0.01); updatedLabel.textContent=nowHHMMSS();

feedBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  HEALTH = clamp(HEALTH + 0.03);
  MUT = clamp(MUT + 0.002);
  FLOW = clamp(FLOW + 0.4, -1, 1);
  simTrades.push({ time: nowHHMMSS(), type:'Feed', valueUsd: (8+Math.random()*24), priceUsd: 0.01 });
  renderTrades(simTrades);
  setHealth(HEALTH);
});

function pollHealth(){
  setHealth(HEALTH); setMutation(MUT); setStage(STAGE); setFlow(FLOW);
  priceLabel.textContent=fmtPrice(0.01); updatedLabel.textContent=nowHHMMSS();
}
function pollTrades(){ renderTrades(simTrades); }

setInterval(()=> updatedLabel.textContent=nowHHMMSS(), 6000);
setInterval(simTick, 6000);
setInterval(()=>{
  const tgt = 0.5 + (FLOW-0.5)*0.2;
  HEALTH = clamp( HEALTH + (tgt-HEALTH)*0.04 );
  setHealth(HEALTH);
}, 4000);

pollHealth(); pollTrades();

/* === Wiring to real backend later:
   /health -> { price:Number, timestamp:String|ms, health?:Number }
   /trades -> [ { time:"HH:MM:SS", type:"Feed"|"Starve", valueUsd:Number, priceUsd:Number }, ... ]
   Map into set/poll + renderTrades as above.
*/
