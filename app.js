/***** THEME: Lab Lights public toggle *****/
const THEME_KEY = 'organismTheme';
function applySavedTheme(){
  const saved = localStorage.getItem(THEME_KEY);
  const body = document.body;
  if(saved === 'warm'){ body.classList.remove('theme-cool'); body.classList.add('theme-warm'); }
  else { body.classList.remove('theme-warm'); body.classList.add('theme-cool'); }
}
applySavedTheme();

const themeBtn = document.getElementById('themeBtn');
themeBtn.addEventListener('click', ()=>{
  const body = document.body;
  const nowWarm = !body.classList.contains('theme-warm');
  body.classList.toggle('theme-warm', nowWarm);
  body.classList.toggle('theme-cool', !nowWarm);
  localStorage.setItem(THEME_KEY, nowWarm ? 'warm' : 'cool');
});

/***** DOM refs *****/
const canvas   = document.getElementById('org-canvas');
const ctx      = canvas.getContext('2d', { alpha:true });

const priceLabel   = document.getElementById('priceLabel');
const updatedLabel = document.getElementById('updatedLabel');
const flowBarTop   = document.getElementById('flowBar');
const flowLabelTop = document.getElementById('flowLabel');

const needle   = document.getElementById('needle');
const flowTiny = document.getElementById('flowTiny');

const healthPct = document.getElementById('healthPct');
const mutPct    = document.getElementById('mutPct');
const healthRing= document.getElementById('healthRing');
const mutRing   = document.getElementById('mutRing');

const healthBar = document.getElementById('healthBar');
const mutBar    = document.getElementById('mutBar');
const healthNum = document.getElementById('healthNum');
const mutNum    = document.getElementById('mutNum');

const decayText = document.getElementById('decayText');
const stageText = document.getElementById('stageText');
const stageSmall= document.getElementById('stageSmall');
const stageNum  = document.getElementById('stageNum');

const tradesBody = document.getElementById('trades-body');
const feedBtn    = document.getElementById('feedBtn');
const sfxBtn     = document.getElementById('sfxBtn');

/***** State *****/
let W=0, H=0, t=0;
let HEALTH=0.48, MUT=0.07, FLOW=0.0;   // 0..1, -1..+1 for FLOW
let STAGE=1;

/***** Utils *****/
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
function nowHHMMSS(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }

/***** Resize *****/
function resizeCanvas(){
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

/***** Read CSS color variables (theme-driven) *****/
function cssVar(name){
  return getComputedStyle(document.body).getPropertyValue(name).trim() || null;
}

/***** Womb draw (uses theme vars for tint) *****/
const motes = Array.from({length:28},()=>({
  x: Math.random()*window.innerWidth,
  y: Math.random()*window.innerHeight,
  dx:(Math.random()-.5)*0.3,
  dy:(Math.random()-.5)*0.3,
  r: 0.6 + Math.random()*1.6
}));
let tetherPhase = 0;

function drawOrganism(){
  t += 0.01;

  const hazeTint   = cssVar('--hazeTint') || 'rgba(60,140,160,.12)';
  const ringStroke = cssVar('--ringStroke') || 'rgba(140,200,255,0.10)';
  const tetherTint = cssVar('--tetherTint') || 'rgba(95,243,209,.55)';

  ctx.clearRect(0,0,W,H);

  // Deep vignette base
  const gbg = ctx.createRadialGradient(W*0.5,H*0.6, H*0.05,  W*0.5,H*0.6, H*0.9);
  gbg.addColorStop(0,   'rgba(10,14,22,0.92)');
  gbg.addColorStop(0.65,'rgba(8,10,16,0.66)');
  gbg.addColorStop(1,   'rgba(5,7,10,1)');
  ctx.fillStyle=gbg; ctx.fillRect(0,0,W,H);

  // Theme haze wash
  ctx.fillStyle = hazeTint; ctx.fillRect(0,0,W,H);

  // Concentric rings
  ctx.strokeStyle = ringStroke;
  ctx.lineWidth=1.1;
  const cx=W*0.5, cy=H*0.62;
  for(let i=1;i<=9;i++){
    ctx.beginPath();
    ctx.arc(cx,cy, i*80, 0, Math.PI*2);
    ctx.stroke();
  }

  // Haze glow center
  const glow = ctx.createRadialGradient(cx,cy, 10, cx,cy, 220);
  glow.addColorStop(0,'rgba(210,230,255,0.75)');
  glow.addColorStop(0.4,'rgba(160,200,255,0.28)');
  glow.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=glow;
  ctx.beginPath(); ctx.arc(cx,cy, 220, 0, Math.PI*2); ctx.fill();

  // Nucleus
  const R = 40 + 16*Math.sin(t*1.4);
  const nuc = ctx.createRadialGradient(cx,cy, 2, cx,cy, R);
  nuc.addColorStop(0,'rgba(255,255,255,0.95)');
  nuc.addColorStop(1,'rgba(180,210,255,0.14)');
  ctx.fillStyle=nuc;
  ctx.beginPath(); ctx.arc(cx,cy, R, 0, Math.PI*2); ctx.fill();

  // Umbilical tether (theme tint)
  tetherPhase += 0.012;
  const anchorX = cx - 220;
  const anchorY = cy - 120;
  const ctrlX   = cx - 140;
  const ctrlY   = cy - 40 + Math.sin(tetherPhase)*30;
  ctx.strokeStyle= tetherTint;
  ctx.lineWidth=6; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(anchorX,anchorY);
  ctx.quadraticCurveTo(ctrlX,ctrlY, cx,cy);
  ctx.stroke();

  // Floating motes
  for(const m of motes){
    m.x += m.dx; m.y += m.dy;
    if(m.x<0) m.x=W; if(m.x>W) m.x=0;
    if(m.y<0) m.y=H; if(m.y>H) m.y=0;
    ctx.fillStyle='rgba(200,220,255,0.22)';
    ctx.beginPath(); ctx.arc(m.x,m.y, m.r, 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(drawOrganism);
}

/***** UI setters *****/
function setHealth(p){ // p: 0..1
  p = clamp(p,0,1);
  const pct = Math.round(p*100);
  healthPct.textContent = pct+'%';
  healthBar.style.width = pct+'%';
  healthNum.textContent = pct+'%';
  healthRing.style.setProperty('--val', 360*p);
  HEALTH = p;
}
function setMutation(p){ // p:0..1
  p = clamp(p,0,1);
  const pct = Math.round(p*100);
  mutPct.textContent = pct+'%';
  mutBar.style.width = pct+'%';
  mutNum.textContent = pct+'%';
  mutRing.style.setProperty('--val', 360*p);
  MUT = p;
}
function setFlow(v){ // v:-1..+1
  v = clamp(v,-1,1);
  const w = Math.round((v*0.5+0.5)*100);
  flowBarTop.style.width = w+'%';
  needle.style.width = w+'%';
  const label = v>0.05 ? 'Feeding' : v<-0.05 ? 'Starving' : 'Neutral';
  flowLabelTop.textContent = label;
  flowTiny.textContent = label;
  FLOW = v;
}
function setStage(n){
  STAGE = n;
  stageNum.textContent = n;
  stageSmall.textContent = n;
  stageText.textContent = n;
}

/***** Trades (minimal list) *****/
const MAX_TRADES = 4;
function renderTrades(items){
  tradesBody.innerHTML = '';
  const subset = items.slice(0,MAX_TRADES);
  for(const it of subset){
    const row = document.createElement('div');
    row.className='row';
    row.innerHTML = `
      <div class="t">${it.time}</div>
      <div class="type ${it.type==='Starve'?'starve':''}">${it.type}</div>
      <div class="v">$${Number(it.valueUsd).toFixed(2)}</div>
      <div class="p">$${Number(it.priceUsd).toFixed(2)}</div>
    `;
    tradesBody.appendChild(row);
  }
}

/***** Simulator (replace with real fetch later) *****/
const simTrades = [];
function simTradesTick(){
  const buy = Math.random() < 0.5;
  const amt = 5 + Math.random()*40;
  const price = 0.01;
  simTrades.unshift({ time: nowHHMMSS(), type: buy? 'Feed':'Starve', valueUsd: amt, priceUsd: price });
  renderTrades(simTrades);

  // nudge flow & health
  const delta = (buy? +1 : -1) * (amt/100);
  setFlow( clamp(FLOW*0.8 + delta*0.4, -1, 1) );
  setHealth( clamp(HEALTH + delta*0.02, 0, 1) );
  setMutation( clamp(MUT + (Math.random()-0.5)*0.01, 0, 1) );
}

/***** Clock + buttons + audio *****/
function updateTopClock(){ updatedLabel.textContent = nowHHMMSS(); }
feedBtn.addEventListener('click', (e)=>{ e.preventDefault(); setHealth( clamp(HEALTH + 0.04, 0, 1) ); setFlow( clamp(FLOW+0.15, -1, 1) ); });

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

/***** Boot *****/
function boot(){
  document.getElementById('decayRate').textContent = '1% / 10m';
  document.getElementById('decayText').textContent = '1% / 10m';
  setStage(1);
  setHealth(HEALTH);
  setMutation(MUT);
  setFlow(0.0);
  priceLabel.textContent = '$0.01';
  updateTopClock();

  // run loops
  drawOrganism();
  setInterval(updateTopClock, 6000);
  setInterval(simTradesTick, 4000);
  setInterval(()=>{
    const tgt = 0.55 + (FLOW-0.5)*0.2;
    setHealth( clamp( HEALTH + (tgt-HEALTH)*0.04, 0, 1) );
  }, 4000);
}
boot();
