/***** CONFIG *****/
const API = "https://organism-backend.onrender.com";

/***** DOM *****/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const statusWord   = document.getElementById("status");
const heartbeat    = document.getElementById("heartbeat");
const healthBar    = document.getElementById("healthBar");
const mutBar       = document.getElementById("mutBar");
const healthPct    = document.getElementById("healthPct");
const mutPct       = document.getElementById("mutPct");
const decayRate    = document.getElementById("decayRate");
const stageNum     = document.getElementById("stageNum");
const priceLabel   = document.getElementById("priceLabel");
const updatedLabel = document.getElementById("updatedLabel");
const flowNeedle   = document.getElementById("flowNeedle");
const flowLabel    = document.getElementById("flowLabel");
const tradesBody   = document.getElementById("trades-body");
const sfxBtn       = document.getElementById("sfxBtn");
const feedBtn      = document.getElementById("feedBtn");

/***** helpers *****/
const clamp = (v, a=0, b=1) => Math.max(a, Math.min(b, v));
const fmtUSD = n => (n==null || isNaN(n)) ? "$—" : `$${Number(n).toFixed(4).replace(/\.?0+$/,'')}`;
const fmtMoney = n => (n==null || isNaN(n)) ? "$—" : `$${Number(n).toFixed(2)}`;
const pad2 = n => String(n).padStart(2,"0");
const ts2hhmmss = ts => { const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };

/***** canvas sizing *****/
function resizeCanvas(){ canvas.width = innerWidth; canvas.height = innerHeight; }
resizeCanvas(); addEventListener("resize", resizeCanvas);

/***** draw womb *****/
let HEALTH=0.54, MUT=0.06, t0=performance.now();
function drawOrganism(){
  const now = performance.now(); const t = (now - t0)/1000;
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = "rgba(3,8,12,.5)"; ctx.fillRect(0,0,W,H);

  const cx = W*0.55, cy = H*0.62;

  // concentric rings
  for(let i=0;i<7;i++){
    const r = 110 + i*62;
    const a = 0.06 + 0.035*Math.sin(t*0.6 + i);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = `rgba(130,200,220,${a})`;
    ctx.lineWidth = 1.15; ctx.stroke();
  }

  // motes
  ctx.fillStyle = "rgba(170,230,255,.35)";
  for(let i=0;i<22;i++){
    const a = i*17 + t*0.25 + i*.3;
    const r = 60 + (i*21 % 220);
    const x = cx + Math.cos(a)*r;
    const y = cy + Math.sin(a*1.2)*r*0.6 + Math.sin(t+i)*2;
    const sz = 1 + (i%3)*0.6;
    ctx.beginPath(); ctx.arc(x,y,sz,0,Math.PI*2); ctx.fill();
  }

  // nucleus
  const hue = 160 + Math.sin(t*0.35)*10;
  const base = 48 + 24*Math.sin(t*0.9 + HEALTH*2);
  const grad = ctx.createRadialGradient(cx,cy,0, cx,cy, base+60);
  grad.addColorStop(0, `hsla(${hue}, 80%, 68%, 0.95)`);
  grad.addColorStop(.5, `hsla(${hue}, 70%, 35%, 0.45)`);
  grad.addColorStop(1, `rgba(0,0,0,0)`);
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx,cy,base+60,0,Math.PI*2); ctx.fill();

  requestAnimationFrame(drawOrganism);
}
requestAnimationFrame(drawOrganism);

/***** SFX *****/
let AC=null, gain=null, lfo=null, sfx=false;
function initAudio(){
  if(AC) return;
  AC = new (window.AudioContext||window.webkitAudioContext)();
  const osc = AC.createOscillator(); gain = AC.createGain(); gain.gain.value = 0.0;
  lfo = AC.createOscillator(); lfo.frequency.value = 0.15;
  const lfoGain = AC.createGain(); lfoGain.gain.value = 6;
  lfo.connect(lfoGain).connect(osc.frequency);
  osc.type="sine"; osc.frequency.value=36;
  osc.connect(gain).connect(AC.destination); osc.start(); lfo.start();
}
sfxBtn?.addEventListener("click",()=>{
  if(!AC) initAudio(); sfx=!sfx;
  sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
  if(gain) gain.gain.linearRampToValueAtTime(sfx? 0.03 : 0.0, AC.currentTime + 0.15);
});

/***** UI setters *****/
function setHealth(p){ HEALTH=clamp(p); healthBar.style.width=`${HEALTH*100|0}%`; healthPct.textContent=`${(HEALTH*100|0)}%`; }
function setMutation(m){ MUT=clamp(m); mutBar.style.width=`${MUT*100|0}%`; mutPct.textContent=`${(MUT*100|0)}%`; }
function setStage(n){ stageNum.textContent=String(n); document.getElementById("stageName").textContent = n===1 ? "Stage 1 · The Cell" : `Stage ${n}`; }
function setFlow(v){ const x=(clamp((v+1)/2,0,1)*100); flowNeedle.style.left=`${x}%`; flowLabel.textContent = v>0.05?"Feeding":v<-0.05?"Starving":"Neutral"; }

/***** Pollers *****/
const POLL_HEALTH_MS=6000, POLL_TRADES_MS=6000;
let flowWindow=[], lastPrice=0;

async function pollHealth(){
  try{
    const r = await fetch(`${API}/health`); const j = await r.json();
    const price = Number(j.price)||0; lastPrice=price; priceLabel.textContent = fmtMoney(price);
    const t = Number(j.timestamp)||Date.now(); updatedLabel.textContent = ts2hhmmss(t);

    const target = clamp(price>0 ? Math.min(1, 0.3 + Math.log10(1+price*200)) : 0.2, 0, 1);
    setHealth( HEALTH + (target - HEALTH)*0.08 );
    setHealth( HEALTH - 0.001 );

    statusWord.textContent="Alive"; statusWord.className="ok"; heartbeat.textContent="Stable";
  }catch(e){ console.error("health fetch:", e); heartbeat.textContent="Err"; }
}

async function pollTrades(){
  try{
    const r = await fetch(`${API}/trades`); const data = await r.json();
    const mapped = (Array.isArray(data)?data:(data.items||[])).map(x=>{
      if("valueUsd" in x) return x;
      const side = (x.side||x.type||"").toString().toUpperCase();
      const type = side==="BUY" ? "feed" : "starve";
      const priceUsd = Number(x.priceUsd ?? x.price ?? 0);
      const amount = Number(x.amount ?? x.size ?? 0);
      const valueUsd = priceUsd * amount;
      const time = x.time ?? x.ts ?? x.blockTime*1000 ?? Date.now();
      return { time, type, valueUsd, priceUsd };
    });

    tradesBody.innerHTML="";
    let buys=0, sells=0;
    mapped.slice(0,12).forEach(tr=>{
      const el=document.createElement("tr");
      const typeClass = tr.type==="feed" ? "type-feed" : "type-starve";
      const typeLabel = tr.type==="feed" ? "Feed" : "Starve";
      el.innerHTML = `
        <td class="tl">${ts2hhmmss(tr.time)}</td>
        <td class="tl ${typeClass}">${typeLabel}</td>
        <td class="tr">${fmtMoney(tr.valueUsd||0)}</td>
        <td class="tr">${fmtUSD(tr.priceUsd||0)}</td>
      `;
      tradesBody.appendChild(el);
      if(tr.type==="feed") buys+=tr.valueUsd||0; else sells+=tr.valueUsd||0;
      const now = Date.now(); flowWindow.push({t:now, v: tr.type==="feed" ? (tr.valueUsd||0) : -(tr.valueUsd||0)});
    });

    const cutoff = Date.now()-5*60*1000; flowWindow = flowWindow.filter(x=>x.t>=cutoff);
    const sum = flowWindow.reduce((a,b)=>a+b.v,0);
    const maxSpan=200; setFlow(clamp(sum/maxSpan,-1,1));
    const delta = clamp(sum/1200,-0.05,0.05); setHealth(HEALTH + delta);
  }catch(e){ console.error("trades fetch:", e); }
}

/***** Interactions *****/
feedBtn?.addEventListener("click",(ev)=>{ ev.preventDefault(); setHealth(clamp(HEALTH + 0.04)); });

/***** Boot *****/
decayRate.textContent = "1% / 10m";
setHealth(HEALTH); setMutation(MUT); setStage(1);
pollHealth(); pollTrades();
setInterval(pollHealth, POLL_HEALTH_MS);
setInterval(pollTrades, POLL_TRADES_MS);
