/******** CONFIG ********/
const TOKEN_MINT = "YOUR_CA_HERE";       // ← put your CA here (used for swap link later)
const API_BASE   = "";                    // ← keep empty to use the simulator

/******** DOM ********/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha:true });

const stageNum   = document.getElementById("stageNum");
const stageChip  = document.getElementById("stageChip");
const lifeChip   = document.getElementById("lifeChip");
const priceLabel = document.getElementById("priceLabel");
const priceFoot  = document.getElementById("priceFoot");
const updated    = document.getElementById("updatedLabel");
const clockEl    = document.getElementById("clock");

const feedBtn    = document.getElementById("feedBtn");
const tradeBtn   = document.getElementById("tradeBtn");

const healthBar  = document.getElementById("healthBar");
const mutBar     = document.getElementById("mutBar");
const healthPct  = document.getElementById("healthPct");
const mutPct     = document.getElementById("mutPct");

const tradesList = document.getElementById("tradesList");
const flowBar    = document.getElementById("flowBar");

/******** Helpers ********/
const clamp = (v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const nowHHMMSS = ()=>{ const d=new Date(); const p=n=>String(n).padStart(2,"0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };
const fmtUSD = n=>`$${Number(n).toFixed(2)}`;

/******** State ********/
let W=0,H=0,t=0;
let HEALTH=.52, MUT=.08, FLOW=.5, PRICE=.01, STAGE=1;
let motes=[];

/******** Canvas ********/
function resize(){ canvas.width=W=innerWidth; canvas.height=H=innerHeight; }
addEventListener("resize", resize); resize();

function draw(){
  t+=0.016;

  // deep background
  const g = ctx.createRadialGradient(W*.5,H*.65,20, W*.5,H*.35, Math.max(W,H));
  g.addColorStop(0,"rgba(40,50,80,.20)");
  g.addColorStop(1,"rgba(5,6,10,1)");
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);

  // rings
  ctx.save();
  ctx.strokeStyle="rgba(110,242,222,.10)";
  for(let i=1;i<=10;i++){
    const r=(Math.min(W,H)*.55)*(i/10);
    ctx.lineWidth=1+Math.sin(t*.7+i)*.4;
    ctx.beginPath(); ctx.arc(W*.5,H*.62,r,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();

  // nucleus glow
  const cx=W*.5, cy=H*.62, R=42+Math.sin(t*1.5)*3+HEALTH*8;
  const glow=ctx.createRadialGradient(cx,cy,R*.2, cx,cy,R*1.7);
  glow.addColorStop(0,"rgba(210,245,255,.9)");
  glow.addColorStop(1,"rgba(110,242,222,.05)");
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,R*1.7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="rgba(220,250,255,.95)"; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();

  // tether
  ctx.strokeStyle="rgba(110,242,222,.45)"; ctx.lineWidth=6; ctx.lineCap="round";
  ctx.beginPath();
  const c1x=cx-90, c1y=cy-15+Math.sin(t*.8)*18;
  const c2x=cx-180, c2y=cy-35+Math.cos(t*.6)*16;
  ctx.moveTo(cx,cy); ctx.bezierCurveTo(c1x,c1y,c2x,c2y, cx-260, cy-60); ctx.stroke();

  // motes
  if(!motes.length){
    for(let i=0;i<26;i++){
      motes.push({x:Math.random()*W,y:Math.random()*H,dx:(Math.random()-.5)*.35,dy:(Math.random()-.5)*.35,r:1+Math.random()*1.6});
    }
  }
  ctx.fillStyle="rgba(220,235,255,.22)";
  for(const m of motes){
    m.x+=m.dx+Math.sin(t*.05+m.y*.001)*.07;
    m.y+=m.dy+Math.cos(t*.05+m.x*.001)*.07;
    if(m.x<0||m.x>W) m.dx*=-1;
    if(m.y<0||m.y>H) m.dy*=-1;
    ctx.beginPath(); ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill();
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

/******** UI setters ********/
function setStage(n){ STAGE=n; stageNum.textContent=String(n); stageChip.textContent=String(n); }
function setHealth(p){ HEALTH=clamp(p); const pc=Math.round(HEALTH*100);
  healthPct.textContent=pc+"%"; healthBar.style.width=pc+"%"; }
function setMutation(p){ MUT=clamp(p); const pc=Math.round(MUT*100);
  mutPct.textContent=pc+"%"; mutBar.style.width=pc+"%"; }
function setFlow(p){ FLOW=clamp(p); flowBar.style.width=(FLOW*100)+"%"; }
function setPrice(n){ PRICE=n; priceLabel.textContent=n.toFixed(2); priceFoot.textContent=n.toFixed(2); }
function tickClock(){ updated.textContent=nowHHMMSS(); clockEl.textContent=nowHHMMSS(); }

/******** Trades (max 3) ********/
function pushTrade(type, usd){
  const li=document.createElement("li");
  const badge=document.createElement("span"); badge.className="badge "+(type==="Feed"?"feed":"starve"); badge.textContent=type;
  const v=document.createElement("span"); v.className="val"; v.textContent=fmtUSD(usd);
  const tt=document.createElement("span"); tt.className="tt"; tt.textContent=nowHHMMSS();
  li.append(badge,v,tt);
  tradesList.insertBefore(li,tradesList.firstChild);
  while(tradesList.children.length>3) tradesList.removeChild(tradesList.lastChild);
}

/******** Sim / Pollers ********/
/* Swap these with real endpoints later, keeping the same setters.
   Example endpoints:
   GET `${API_BASE}/health?mint=${TOKEN_MINT}` -> { price:Number, time?:string, health?:0..1, mutation?:0..1 }
   GET `${API_BASE}/trades?mint=${TOKEN_MINT}&limit=3` -> [{ type:"Feed"|"Starve", valueUsd:Number, time:string }]
*/
function simVitals(){
  // gently wander health & flow so it feels alive
  const tgt=0.55+(FLOW-0.5)*0.25;
  setHealth(clamp(HEALTH + (tgt-HEALTH)*0.035 + (Math.random()-.5)*0.01));
  setMutation(clamp(MUT + (Math.random()-.5)*0.008,0,0.35));
}
function simTrade(){
  const isFeed=Math.random()>0.5;
  const n= 5+Math.random()*35;
  pushTrade(isFeed?"Feed":"Starve", n);
  const d=(n/1000)*(isFeed?+1:-1);
  setFlow(clamp(FLOW + d*2));
  setHealth(clamp(HEALTH + d*0.25));
}

/******** Buttons ********/
feedBtn.addEventListener("click", (e)=>{
  e.preventDefault();
  pushTrade("Feed", 12+Math.random()*28);
  setFlow(clamp(FLOW+.06)); setHealth(clamp(HEALTH+.02));
});

/******** Boot ********/
function boot(){
  setStage(1); setHealth(HEALTH); setMutation(MUT); setFlow(.5); setPrice(.01);
  tradeBtn.href=`https://jup.ag/swap/SOL-${TOKEN_MINT}`;

  tickClock(); setInterval(tickClock,1000);
  setInterval(simVitals, 4000);
  setInterval(simTrade, 12000);
}
boot();
