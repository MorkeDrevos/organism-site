/******** Canvas: cinematic “specimen” ********/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha:true });

function fit(){ canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', fit); fit();

let t = 0;
const motes = Array.from({length:24},()=>({
  x: Math.random()*canvas.width,
  y: Math.random()*canvas.height,
  vx:(Math.random()-.5)*0.22,
  vy:(Math.random()-.5)*0.22,
  r: 1 + Math.random()*1.6
}));

function draw(){
  t += 0.01;
  const W=canvas.width, H=canvas.height;

  ctx.clearRect(0,0,W,H);

  // Fluid haze (cool midnight)
  const haze = ctx.createRadialGradient(W*0.5, H*0.65, H*0.06, W*0.5, H*0.7, H*0.95);
  haze.addColorStop(0,'rgba(20,56,100,.55)');
  haze.addColorStop(0.6,'rgba(8,20,40,.25)');
  haze.addColorStop(1,'rgba(6,12,22,0)');
  ctx.fillStyle=haze; ctx.fillRect(0,0,W,H);

  // Slow ripple rings
  ctx.save(); ctx.translate(W*0.5, H*0.7);
  for(let i=0;i<9;i++){
    const R = 60 + i*70 + Math.sin(t*0.35+i)*2.2;
    ctx.strokeStyle=`rgba(110,170,230,${0.16 - i*0.013})`;
    ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // Nucleus
  const nx = W*0.5 + Math.sin(t*0.6)*10;
  const ny = H*0.7 + Math.cos(t*0.7)*8;
  const pulse = 26 + Math.sin(t*2)*2;

  const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, 140);
  glow.addColorStop(0,'rgba(160,210,255,.55)');
  glow.addColorStop(1,'rgba(160,210,255,0)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(nx,ny,140,0,Math.PI*2); ctx.fill();

  const orb = ctx.createRadialGradient(nx, ny, 0, nx, ny, 52+pulse);
  orb.addColorStop(0,'rgba(210,240,255,1)');
  orb.addColorStop(1,'rgba(150,190,230,.07)');
  ctx.fillStyle=orb; ctx.beginPath(); ctx.arc(nx,ny,52+pulse,0,Math.PI*2); ctx.fill();

  // Tether curve
  ctx.strokeStyle='rgba(175,220,255,.7)'; ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath();
  const cp1x = nx-140, cp1y = ny-80 + Math.sin(t*.9)*16;
  const endx = nx-280 + Math.sin(t*.6)*9, endy = ny-36 + Math.cos(t*.7)*12;
  ctx.moveTo(nx-10,ny-10); ctx.quadraticCurveTo(cp1x,cp1y,endx,endy); ctx.stroke();

  // Motes
  for(const m of motes){
    m.x += m.vx + Math.sin(t*0.5)*0.02;
    m.y += m.vy + Math.cos(t*0.4)*0.02;
    if(m.x<0)m.x=W; if(m.x>W)m.x=0; if(m.y<0)m.y=H; if(m.y>H)m.y=0;
    ctx.fillStyle='rgba(190,220,255,.55)';
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

const clamp = (v,min=0,max=1)=>Math.max(min,Math.min(max,v));
const nowHHMMSS = ()=>{ const d=new Date(), p=n=>String(n).padStart(2,'0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const fmtUSD = n=>`$${Number(n).toFixed(2)}`;

/******** Gauges (conic arcs) ********/
function setGauge(el, pct){
  const deg = Math.round(clamp(pct)*360);
  el.style.setProperty('--val', deg);
}
function setHealth(v){ setGauge(gaugeHealth, v); healthPct.textContent = `${Math.round(clamp(v)*100)}%`; }
function setMutation(v){ setGauge(gaugeMut, v);   mutPct.textContent   = `${Math.round(clamp(v)*100)}%`; }
function setStage(n){ stageNum.textContent=n; stageBadge.textContent=`Stage ${n} · The Cell`; }
function setFlow(x){
  const pct=((x+1)/2)*100; flowBar.style.width=pct+'%';
  flowLabel.textContent = x>0.12?'Feeding':x<-0.12?'Starving':'Neutral';
}

/******** Toast renderer (max 5) ********/
function renderTrades(items){
  tradesBody.innerHTML='';
  const rows = items.slice(-5).reverse();
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
  const o=AC.createOscillator(), g1=AC.createGain(); o.type='sine'; o.frequency.value=58; g1.gain.value=0.02; o.connect(g1);
  // womb noise
  const n=AC.createBufferSource(); const buf=AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate);
  const ch=buf.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*0.12;
  n.buffer=buf; n.loop=true; const g2=AC.createGain(); g2.gain.value=0.03; n.connect(g2);
  gain=AC.createGain(); gain.gain.value=0; g1.connect(gain); g2.connect(gain); gain.connect(AC.destination);
  o.start(); n.start();
}
sfxBtn.addEventListener('click',()=>{
  if(!AC){ initAudio(); sfxBtn.textContent='🔊 SFX On'; gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.35); }
  else if(gain.gain.value>0){ gain.gain.linearRampToValueAtTime(0.0, AC.currentTime+0.2); sfxBtn.textContent='🔇 SFX Off'; }
  else { gain.gain.linearRampToValueAtTime(0.06, AC.currentTime+0.3); sfxBtn.textContent='🔊 SFX On'; }
});

/******** Tiny simulator (swap later) ********/
let HEALTH=0.44, MUT=0.06, FLOW=0.0, STAGE=1;
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

feedBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  HEALTH = clamp(HEALTH + 0.03); setHealth(HEALTH);
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

/* === Hook real endpoints later:
   GET /health -> { price:Number, timestamp:String|ms, health?:Number, mutation?:Number, stage?:Number }
   GET /trades -> [ { time:"HH:MM:SS", type:"Feed"|"Starve", valueUsd:Number, priceUsd:Number }, ... ]
   Then call set* & renderTrades(items)
*/
