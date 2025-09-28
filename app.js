/********** Canvas + Theme-less Creature (no lab UI) **********/
const canvas = document.getElementById('org-canvas');
const ctx = canvas.getContext('2d', { alpha:true });

function resize(){ canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

let t=0;
let HEALTH=0.52, MUT=0.08, STAGE=1, FLOW=0.50, PRICE=0.01;

const motes = Array.from({length:34},()=>({
  x: Math.random()*innerWidth,
  y: Math.random()*innerHeight,
  dx:(Math.random()-.5)*.28,
  dy:(Math.random()-.5)*.28,
  r:.6+Math.random()*1.6
}));

function draw(){
  t += 0.01;
  const W=canvas.width, H=canvas.height, CX=W*.5, CY=H*.62;

  ctx.clearRect(0,0,W,H);

  // Soft radial haze
  const haze = ctx.createRadialGradient(CX,CY,H*.06, CX,CY,H*.95);
  haze.addColorStop(0,'rgba(12,16,24,.92)');
  haze.addColorStop(.7,'rgba(6,8,12,.66)');
  haze.addColorStop(1,'rgba(4,6,10,1)');
  ctx.fillStyle=haze; ctx.fillRect(0,0,W,H);

  // Circular viewport hint (mask-like vignette)
  ctx.save();
  ctx.globalCompositeOperation='overlay';
  ctx.strokeStyle='rgba(150,200,255,.10)';
  ctx.lineWidth=1;
  for(let i=1;i<=8;i++){
    ctx.beginPath(); ctx.arc(CX,CY,i*90,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // Core glow
  const pulse=(Math.sin(t*1.35)+1)/2;
  const coreR=46 + pulse*6 + HEALTH*14;
  const glow=ctx.createRadialGradient(CX,CY, coreR*.2, CX,CY, coreR*1.9);
  glow.addColorStop(0,'rgba(210,245,255,.95)');
  glow.addColorStop(.35,'rgba(170,230,255,.42)');
  glow.addColorStop(.9,'rgba(80,140,200,.02)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(CX,CY, coreR*1.9, 0, Math.PI*2); ctx.fill();

  // “organism” body (metaball-ish blob)
  const wob = 10 + HEALTH*18;
  ctx.fillStyle='rgba(140,220,255,.12)';
  ctx.beginPath();
  for(let i=0;i<12;i++){
    const a = (i/12)*Math.PI*2 + t*0.3;
    const r = coreR + wob*Math.sin(t*0.8 + i);
    const x = CX + Math.cos(a)*r;
    const y = CY + Math.sin(a)*r;
    i? ctx.lineTo(x,y): ctx.moveTo(x,y);
  }
  ctx.closePath(); ctx.fill();

  // Mutation visuals
  if(MUT>=0.12){ // biolume rays
    ctx.save(); ctx.translate(CX,CY); ctx.rotate(t*0.06);
    for(let k=0;k<8;k++){
      const ang=k*(Math.PI*2/8);
      const len=coreR+30+MUT*80;
      ctx.strokeStyle='rgba(110,255,240,.18)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(Math.cos(ang)*coreR*.6, Math.sin(ang)*coreR*.6);
      ctx.lineTo(Math.cos(ang)*len, Math.sin(ang)*len); ctx.stroke();
    }
    ctx.restore();
  }
  if(MUT>=0.26){ // fronds
    ctx.save(); ctx.translate(CX,CY); ctx.rotate(-t*0.04);
    const arms = 5 + Math.floor(MUT*4);
    for(let i=0;i<arms;i++){
      const ang=i*(Math.PI*2/arms);
      const len=60 + Math.sin(t*1.1+i)*14 + MUT*60;
      const sway=Math.sin(t*1.3+i)*10;
      ctx.strokeStyle='rgba(120,235,210,.35)'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.quadraticCurveTo(Math.cos(ang)*(len*.3+sway), Math.sin(ang)*(len*.3-sway), Math.cos(ang)*len, Math.sin(ang)*len);
      ctx.stroke();
    }
    ctx.restore();
  }
  if(MUT>=0.38){ // eye sparks
    const count = 3 + Math.floor(MUT*6);
    for(let i=0;i<count;i++){
      const a=i*(Math.PI*2/count)+t*0.3, r=coreR+24+Math.sin(t*1.3+i)*8;
      const x=CX+Math.cos(a)*r, y=CY+Math.sin(a)*r;
      const gr=ctx.createRadialGradient(x,y,2,x,y,10);
      gr.addColorStop(0,'rgba(255,255,255,.9)');
      gr.addColorStop(1,'rgba(255,120,200,.12)');
      ctx.fillStyle=gr; ctx.beginPath(); ctx.arc(x,y,10,0,Math.PI*2); ctx.fill();
    }
  }
  if(MUT>=0.52){ // echo rings
    ctx.save(); ctx.translate(CX,CY);
    for(let i=0;i<3;i++){
      const rr = coreR + 40 + (t*40 + i*35)%120;
      ctx.strokeStyle=`rgba(130,200,255,${0.26 - i*0.06})`; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(0,0, rr, 0, Math.PI*2); ctx.stroke();
    }
    ctx.restore();
  }

  // ambient motes
  ctx.fillStyle='rgba(200,220,255,.20)';
  for(const m of motes){
    m.x += m.dx + (HEALTH-0.5)*0.06;
    m.y += m.dy + (FLOW-0.5)*0.06;
    if(m.x<0) m.x=W; if(m.x>W) m.x=0; if(m.y<0) m.y=H; if(m.y>H) m.y=0;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

/********** DOM refs **********/
const healthBar = document.getElementById('healthBar');
const healthNum = document.getElementById('healthNum');
const mutBar    = document.getElementById('mutBar');
const mutNum    = document.getElementById('mutNum');
const stageNum  = document.getElementById('stageNum');
const statusEl  = document.getElementById('status');
const heartbeat = document.getElementById('heartbeat');
const priceEl   = document.getElementById('priceLabel');
const updatedEl = document.getElementById('updatedLabel');
const flowBar   = document.getElementById('flowBar');
const flowLabel = document.getElementById('flowLabel');
const feedBtn   = document.getElementById('feedBtn');
const sfxBtn    = document.getElementById('sfxBtn');
const tradeBtn  = document.getElementById('tradeBtn');
const traitsRow = document.getElementById('traitsRow');
const tradePills= document.getElementById('tradePills');

/********** Helpers **********/
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const pct = x => Math.round(x*100);
const nowHHMMSS=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;}
const usd = v => `$${Number(v).toFixed(2)}`;

/********** UI setters **********/
function setHealth(p){ HEALTH=clamp(p); healthBar.style.width=pct(HEALTH)+'%'; healthNum.textContent=pct(HEALTH)+'%'; }
function setMutation(p){ MUT=clamp(p); mutBar.style.width=pct(MUT)+'%'; mutNum.textContent=pct(MUT)+'%'; renderTraits(); }
function setStage(n){ STAGE=n; stageNum.textContent=String(n); }
function setFlow(v){
  FLOW=clamp(v);
  flowBar.style.width = Math.round((FLOW)*100)+'%';
  flowLabel.textContent = FLOW>0.55?'feed' : (FLOW<0.45?'starve':'neutral');
}
function setPrice(v){ PRICE=v; priceEl.textContent=usd(v); updatedEl.textContent=nowHHMMSS(); }

/********** Traits **********/
const TRAITS = [
  { key:'biolume', pct:0.12, label:'biolume' },
  { key:'fronds',  pct:0.26, label:'fronds'  },
  { key:'eyes',    pct:0.38, label:'eye-spots' },
  { key:'echo',    pct:0.52, label:'echo-rings' }
];
function renderTraits(){
  traitsRow.innerHTML='';
  for(const tr of TRAITS){
    if(MUT>=tr.pct){
      const el=document.createElement('div');
      el.className='badge';
      el.innerHTML=`<span class="dot"></span><span>${tr.label}</span>`;
      traitsRow.appendChild(el);
    }
  }
}

/********** Trades (vertical 3 pills) **********/
const trades=[]; // { t, type:'feed'|'starve', valueUsd, priceUsd }
function pushTrade(type, valueUsd){
  trades.push({ t: nowHHMMSS(), type, valueUsd, priceUsd: PRICE });
  if(trades.length>60) trades.shift();
  renderTrades();
}
function renderTrades(){
  tradePills.innerHTML='';
  trades.slice(-3).reverse().forEach(tr=>{
    const el=document.createElement('div');
    el.className='pill '+tr.type;
    el.innerHTML=`
      <span class="tag">${tr.type==='feed'?'Feed':'Starve'}</span>
      <span class="v mono">${usd(tr.valueUsd)}</span>
      <span class="t mono">${tr.t}</span>`;
    tradePills.appendChild(el);
  });
}

/********** Audio (optional) **********/
let AC=null,gain=null;
function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  const o=AC.createOscillator(), g1=AC.createGain(); o.type='sine'; o.frequency.value=58; g1.gain.value=.018; o.connect(g1);
  const n=AC.createBufferSource(), buf=AC.createBuffer(1, AC.sampleRate*2, AC.sampleRate);
  const ch=buf.getChannelData(0); for(let i=0;i<ch.length;i++) ch[i]=(Math.random()*2-1)*.11;
  n.buffer=buf; n.loop=true; const g2=AC.createGain(); g2.gain.value=.028; n.connect(g2);
  gain=AC.createGain(); gain.gain.value=0; g1.connect(gain); g2.connect(gain); gain.connect(AC.destination);
  o.start(); n.start();
}
sfxBtn.addEventListener('click',()=>{
  if(!AC){ initAudio(); sfxBtn.classList.add('on'); gain.gain.linearRampToValueAtTime(.06, AC.currentTime+.35); }
  else if(gain.gain.value>0){ gain.gain.linearRampToValueAtTime(0, AC.currentTime+.2); sfxBtn.classList.remove('on'); }
  else { gain.gain.linearRampToValueAtTime(.06, AC.currentTime+.3); sfxBtn.classList.add('on'); }
});

/********** Interactions **********/
feedBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  setFlow(clamp(FLOW+0.12));
  setHealth(clamp(HEALTH+0.04));
  pushTrade('feed', 15+Math.random()*35);
});

/********** Sim / Timers (replace with real API later) **********/
function simTrade(){
  const buy = Math.random()>.5;
  setFlow(clamp(FLOW + (buy?+0.04:-0.04)));
  setMutation(clamp(MUT + (Math.random()-.5)*0.01));
  if(buy) setHealth(clamp(HEALTH + 0.01 + Math.random()*0.01));
  else    setHealth(clamp(HEALTH - 0.008 - Math.random()*0.01));
  pushTrade(buy?'feed':'starve', 8+Math.random()*28);
}
function simPrice(){ setPrice( 0.01 + Math.sin(Date.now()/5000)*0.002 ); }

setInterval(simTrade, 7500);
setInterval(simPrice, 6000);
setInterval(()=>{ // drift to flow
  const target=.55+(FLOW-.5)*.25;
  setHealth(clamp(HEALTH+(target-HEALTH)*.035));
}, 4000);

/********** Boot **********/
function boot(){
  setStage(1);
  setHealth(HEALTH);
  setMutation(MUT);
  setFlow(0.5);
  setPrice(0.01);
  renderTraits();
  renderTrades();
}
boot();
