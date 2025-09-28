(() => {
  // ---------- CONFIG ----------
  const API = "https://organism-backend.onrender.com"; // change if your backend URL differs
  const DECAY_PER_TICK = 0.01;         // visual 1% per tick
  const TICK_MS = 10_000;              // organism decay driver
  const HEALTH_POLL_MS = 6_000;        // /health polling
  const TRADES_POLL_MS = 6_000;        // /trades polling
  const FLOW_WINDOW = 5 * 60 * 1000;   // 5 minutes

  // ---------- DOM ----------
  const canvas = document.getElementById("org-canvas");
  const ctx = canvas.getContext("2d");

  const stageBadge = document.getElementById("stageBadge");
  const statusWord = document.getElementById("status");
  const heartbeat = document.getElementById("heartbeat");

  const feedBtn = document.getElementById("feedBtn");
  const tradeBtn = document.getElementById("tradeBtn");
  const sfxBtn   = document.getElementById("sfxBtn");

  const priceLabel   = document.getElementById("priceLabel");
  const updatedLabel = document.getElementById("updatedLabel");
  const flowBar   = document.getElementById("flowBar");
  const flowLabel = document.getElementById("flowLabel");

  const healthBar = document.getElementById("health-bar");
  const healthPct = document.getElementById("healthPct");
  const mutBar    = document.getElementById("mutBar");
  const mutPct    = document.getElementById("mutPct");
  const decayRate = document.getElementById("decayRate");
  const stageNum  = document.getElementById("stageNum");

  const tradesBody = document.getElementById("trades-body");

  // ---------- STATE ----------
  let sfx = false;
  let health = 0.62;      // 0..1
  let mutation = 0.08;    // 0..1
  let stage = 1;

  let lastPrice = 0;      // usd
  let lastTs = 0;

  let flows = [];         // {ts, dir:+1|-1, usd}

  // ---------- Helpers ----------
  const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const pad2 = (x)=>String(x).padStart(2,"0");
  const fmtClock = (ts)=>{ const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
  const fmtUSD = (n)=> n===0 ? "$0.0000" : (isFinite(n) ? `$${n.toFixed(4)}` : "$—");
  const fmtUSDc = (n)=> n===0 ? "$0.00" : (isFinite(n) ? `$${n.toFixed(2)}` : "$—");

  const setHealth = (v)=>{
    health = clamp(v);
    healthBar.style.width = `${Math.round(health*100)}%`;
    healthPct.textContent = `${Math.round(health*100)}%`;
  };
  const setMutation = (v)=>{
    mutation = clamp(v);
    mutBar.style.width = `${Math.round(mutation*100)}%`;
    mutPct.textContent = `${Math.round(mutation*100)}%`;
  };
  const setStage = (n)=>{
    stage = n;
    stageNum.textContent = String(n);
    stageBadge.textContent = n===1 ? "Stage 1 · The Cell" : `Stage ${n}`;
  };

  // ---------- Canvas organism (mysterious “womb” glow) ----------
  const W = canvas.width, H = canvas.height, Cx=W/2, Cy=H/2;
  let t0 = performance.now();

  function drawOrganism(now){
    const t = (now - t0)/1000;
    ctx.clearRect(0,0,W,H);

    // Nucleus glow (greener with health)
    const baseR = 60 + 24*Math.sin(t*1.2);
    const hue = 150 + 30*(health-0.5);
    const g = ctx.createRadialGradient(Cx, Cy, 0, Cx, Cy, baseR);
    g.addColorStop(0, `hsla(${hue},70%,70%,.85)`);
    g.addColorStop(1, `hsla(${hue},70%,35%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(Cx, Cy, baseR, 0, Math.PI*2); ctx.fill();

    // Concentric rings drifting
    for(let i=1;i<=5;i++){
      const r = 110 + i*40 + 8*Math.sin(t*0.9 + i);
      ctx.strokeStyle = `rgba(140, 200, 170, ${0.08 - i*0.008})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(Cx, Cy, r, 0, Math.PI*2); ctx.stroke();
    }

    // drifting specks
    for(let i=0;i<18;i++){
      const a = t*0.3 + i*0.7, r = 190 + (i%5)*22 + 8*Math.sin(t*.8+i);
      const x = Cx + Math.cos(a)*r, y = Cy + Math.sin(a)*r;
      ctx.fillStyle = `rgba(160,240,210,${0.22 - (i%6)*0.03})`;
      ctx.beginPath(); ctx.arc(x,y, 1.6 + (i%3)*.4, 0, Math.PI*2); ctx.fill();
    }

    requestAnimationFrame(drawOrganism);
  }
  requestAnimationFrame(drawOrganism);

  // ---------- Networking ----------
  async function getJSON(url){
    const r = await fetch(url);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function pollHealth(){
    try{
      const j = await getJSON(`${API}/health`);
      lastPrice = Number(j.price)||0;
      lastTs = Number(j.timestamp)||Date.now();

      priceLabel.textContent   = fmtUSD(lastPrice);
      updatedLabel.textContent = fmtClock(lastTs);
      statusWord.textContent = "Alive";
      statusWord.classList.add("ok");
      heartbeat.textContent = "Stable";

      // small nudge from price motion
      const delta = (Math.min(lastPrice, 0.02)*5); // tiny
      setHealth(clamp(health + delta*0.02));
    }catch(e){
      heartbeat.textContent = "Err";
    }
  }

  // Expect backend /trades to return:
  // { ok:true, mint:"...", source:"...", trades:[ {side:"buy"|"sell", price:<usd>, amount:<tokens>, ts:<ms>} ... ] }
  async function pollTrades(){
    try{
      const j = await getJSON(`${API}/trades`);
      const arr = Array.isArray(j.trades) ? j.trades.slice(0,10) : [];

      // render rows (Time, Type, Value, Price)
      tradesBody.innerHTML = "";
      let buys=0, sells=0, sum=0;

      for(const t of arr){
        const ts = Number(t.ts)||Date.now();
        const price = Number(t.price)||0;
        const amount = Number(t.amount)||0; // tokens
        const value = price * amount;       // USD

        const side = (String(t.side).toLowerCase()==="buy") ? "Feed" : "Starve";
        const cls = side==="Feed" ? "feed" : "starve";

        // flow calc
        const dir = side==="Feed" ? +1 : -1;
        sum += dir * value;
        (side==="Feed") ? buys+=value : sells+=value;
        flows.push({ts, dir, usd:value});

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="mono">${fmtClock(ts)}</td>
          <td class="${cls}">${side}</td>
          <td class="mono">${fmtUSDc(value)}</td>
          <td class="mono">${fmtUSD(price)}</td>
        `;
        tradesBody.appendChild(tr);
      }

      // prune flow window & compute net
      const cutoff = Date.now() - FLOW_WINDOW;
      flows = flows.filter(f=>f.ts >= cutoff);
      const net = flows.reduce((a,f)=>a + f.dir*f.usd, 0);
      const pct = clamp(0.5 + Math.tanh(net/50)/2, 0, 1); // map usd imbalance to 0..1
      flowBar.style.width = `${Math.round(pct*100)}%`;
      flowLabel.textContent = net>0 ? "Feeding" : (net<0 ? "Starving" : "Neutral");

      // gentle health nudge from net
      setHealth(clamp(health + Math.sign(net)*0.02));
      setMutation(clamp(mutation + Math.abs(net)*0.0001));

    }catch(e){
      // leave previous rows, show subtle warning in heartbeat
      heartbeat.textContent = "Network…";
    }
  }

  // ---------- Decay driver ----------
  function tickDecay(){
    setHealth(health - DECAY_PER_TICK);
  }

  // ---------- Interactions ----------
  sfxBtn.addEventListener("click", ()=>{
    sfx = !sfx;
    sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
  });

  feedBtn.addEventListener("click",(ev)=>{
    ev.preventDefault();
    setHealth(health + 0.04);
  });

  // (optional) put your Jupiter swap URL
  // tradeBtn.href = "https://jup.ag/swap/...";

  // ---------- Init ----------
  setStage(1);
  decayRate.textContent = "1% / 10m";

  pollHealth();
  pollTrades();
  setInterval(tickDecay, TICK_MS);
  setInterval(pollHealth, HEALTH_POLL_MS);
  setInterval(pollTrades, TRADES_POLL_MS);
})();
