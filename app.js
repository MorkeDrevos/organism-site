(() => {
  // ---------- CONFIG ----------
  const API = "https://organism-backend.onrender.com"; // change if your backend URL differs

  // decay + poll intervals
  const DECAY_PER_TICK = 0.01;     // visual health decay per tick (1%)
  const TICK_MS        = 10_000;   // decay driver
  const HEALTH_POLL_MS = 6_000;    // /health polling
  const TRADES_POLL_MS = 6_000;    // /trades polling

  // growth model
  const FLOW_WINDOW_MS = 5 * 60 * 1000; // net flow window
  const USD_TO_XP      = 0.12;          // how much XP 1 USD of net feeding grants
  const BUY_HEALTH_BOOST  = 0.012;      // per buy event (scaled by value)
  const SELL_HEALTH_PENAL = 0.010;      // per sell event (scaled by value)
  const PRICE_HEALTH_TAP  = 0.02;       // tiny nudge from price (visual only)

  // stage thresholds (total XP)
  const STAGES = [
    { name: "The Cell",       need:    0 },
    { name: "Embryo",         need:  120 },
    { name: "Organ Cluster",  need:  380 },
    { name: "Proto-Organism", need:  880 },
    { name: "Awakening",      need: 1680 },
  ];

  // ---------- DOM ----------
  const canvas = document.getElementById("org-canvas");
  const ctx = canvas.getContext("2d");

  const stageBadge = document.getElementById("stageBadge");
  const statusWord = document.getElementById("status");
  const heartbeat  = document.getElementById("heartbeat");

  const feedBtn  = document.getElementById("feedBtn");
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

  let health = 0.62;   // 0..1
  let totalXP = 0;     // cumulative growth XP
  let priceUSD = 0;
  let lastTs = 0;

  // stage index from STAGES
  let stageIdx = 0;

  // recent flows and last few trades for display
  let flows = [];  // { ts, dir:+1|-1, usd }

  // ---------- Helpers ----------
  const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const lerp  = (a,b,t)=>a+(b-a)*t;
  const pad2  = (x)=>String(x).padStart(2,"0");
  const fmtClock = (ts)=>{ const d = new Date(ts); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; };
  const fmtUSD  = (n)=> isFinite(n) ? `$${n.toFixed(4)}` : "$—";
  const fmtUSDc = (n)=> isFinite(n) ? `$${n.toFixed(2)}` : "$—";

  const currentStage = ()=> STAGES[stageIdx];
  const nextStage    = ()=> STAGES[Math.min(stageIdx+1, STAGES.length-1)];

  const setHealth = (v)=>{
    health = clamp(v);
    healthBar.style.width = `${Math.round(health*100)}%`;
    healthPct.textContent = `${Math.round(health*100)}%`;
  };

  const setStageIdx = (i)=>{
    stageIdx = clamp(i, 0, STAGES.length-1);
    stageNum.textContent = String(stageIdx+1);
    stageBadge.textContent = `Stage ${stageIdx+1} · ${currentStage().name}`;
  };

  const setMutationBar = ()=>{
    const currNeed = currentStage().need;
    const nextNeed = nextStage().need;
    const span = Math.max(1, nextNeed - currNeed);
    const prog = clamp((totalXP - currNeed) / span, 0, 1);
    mutBar.style.width = `${Math.round(prog*100)}%`;
    mutPct.textContent = `${Math.round(prog*100)}%`;
  };

  // Called whenever XP may have changed
  const recalcStage = ()=>{
    // find highest stage whose need <= totalXP
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++){
      if (totalXP >= STAGES[i].need) idx = i;
    }
    const changed = idx !== stageIdx;
    if (changed){
      setStageIdx(idx);
      // small celebratory health pulse on evolution
      setHealth(health + 0.08);
    }
    setMutationBar();
  };

  // ---------- Canvas organism (grows with stage) ----------
  const W = canvas.width, H = canvas.height, Cx=W/2, Cy=H/2;
  let t0 = performance.now();

  function drawOrganism(now){
    const t = (now - t0)/1000;
    ctx.clearRect(0,0,W,H);

    // Stage-driven parameters
    const s = stageIdx;                    // 0..(N-1)
    const baseHue = lerp(154, 190, s/(STAGES.length-1));        // hue shifts with stage
    const pulse   = 1 + 0.08*Math.sin(t*1.2 + s*0.6);
    const nucleusR = lerp(56, 120, s/(STAGES.length-1)) * (0.85 + 0.25*health) * pulse;

    // Nucleus glow
    const g = ctx.createRadialGradient(Cx, Cy, 0, Cx, Cy, nucleusR);
    g.addColorStop(0, `hsla(${baseHue},75%,70%,.88)`);
    g.addColorStop(1, `hsla(${baseHue},75%,35%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(Cx, Cy, nucleusR, 0, Math.PI*2); ctx.fill();

    // Rings (count grows with stage)
    const rings = 4 + s*2;
    for(let i=1;i<=rings;i++){
      const r = nucleusR + 30 + i*26 + 8*Math.sin(t*0.9 + i);
      ctx.strokeStyle = `rgba(160, 220, 200, ${0.08 - i*0.006})`;
      ctx.lineWidth = 1.1 + 0.15*s;
      ctx.beginPath(); ctx.arc(Cx, Cy, r, 0, Math.PI*2); ctx.stroke();
    }

    // Spikes / tendrils (grow with stage & health)
    const spikes = 6 + s*3;
    for(let i=0;i<spikes;i++){
      const a = (i/spikes) * Math.PI*2 + t*0.18;
      const L = lerp(24, 68, health) + 16*Math.sin(t*1.6 + i);
      const r0 = nucleusR*0.45, r1 = nucleusR*0.45 + L;
      const x0 = Cx + Math.cos(a)*r0, y0 = Cy + Math.sin(a)*r0;
      const x1 = Cx + Math.cos(a)*r1, y1 = Cy + Math.sin(a)*r1;
      ctx.strokeStyle = `hsla(${baseHue+10},90%,70%,.22)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    }

    // drifting specks
    const dots = 15 + s*6;
    for(let i=0;i<dots;i++){
      const a = t*0.35 + i*0.6, r = nucleusR + 70 + (i%5)*22 + 8*Math.sin(t*.8+i);
      const x = Cx + Math.cos(a)*r, y = Cy + Math.sin(a)*r;
      ctx.fillStyle = `rgba(170,245,215,${0.25 - (i%6)*0.03})`;
      ctx.beginPath(); ctx.arc(x,y, 1.3 + (i%3)*.5, 0, Math.PI*2); ctx.fill();
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

  // health + tiny growth tap from price heartbeat
  async function pollHealth(){
    try{
      const j = await getJSON(`${API}/health`);
      priceUSD = Number(j.price)||0;
      lastTs   = Number(j.timestamp)||Date.now();

      priceLabel.textContent   = fmtUSD(priceUSD);
      updatedLabel.textContent = fmtClock(lastTs);
      statusWord.textContent = "Alive";
      statusWord.classList.add("ok");
      heartbeat.textContent = "Stable";

      // micro visual nudge from price (bounded)
      const pDelta = Math.min(priceUSD, 0.02) * PRICE_HEALTH_TAP;
      setHealth(health + pDelta*0.25);
    }catch(e){
      heartbeat.textContent = "Err";
    }
  }

  // Expect backend /trades -> { ok:true, trades:[ {side:"buy"/"sell", price:<usd>, amount:<tokens>, ts:<ms>} ] }
  async function pollTrades(){
    try{
      const j = await getJSON(`${API}/trades`);
      const arr = Array.isArray(j.trades) ? j.trades.slice(0,10) : [];

      tradesBody.innerHTML = "";

      // render & apply growth from trades
      let localFlowsUSD = 0;

      for(const t of arr){
        const ts     = Number(t.ts)||Date.now();
        const price  = Number(t.price)||0;
        const amount = Number(t.amount)||0;
        const value  = price * amount;

        const isBuy  = String(t.side).toLowerCase()==="buy";
        const typeTxt= isBuy ? "Feed" : "Starve";
        const cls    = isBuy ? "feed" : "starve";

        // live UI row (Time, Type, Value, Price)
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="mono">${fmtClock(ts)}</td>
          <td class="${cls}">${typeTxt}</td>
          <td class="mono">${fmtUSDc(value)}</td>
          <td class="mono">${fmtUSD(price)}</td>
        `;
        tradesBody.appendChild(tr);

        // growth application (weighted by USD value)
        const scale = clamp(value / 25, 0, 1); // dampen huge prints a bit

        if (isBuy){
          setHealth(health + BUY_HEALTH_BOOST * scale);
          totalXP += value * USD_TO_XP;
          localFlowsUSD += value;
          flows.push({ ts, dir:+1, usd:value });
        }else{
          setHealth(health - SELL_HEALTH_PENAL * scale);
          totalXP = Math.max(0, totalXP - value * USD_TO_XP * 0.12); // small “stress” regression
          localFlowsUSD -= value;
          flows.push({ ts, dir:-1, usd:value });
        }
      }

      // prune flow window & compute net
      const cutoff = Date.now() - FLOW_WINDOW_MS;
      flows = flows.filter(f=>f.ts >= cutoff);
      const net = flows.reduce((a,f)=>a + f.dir*f.usd, 0);

      // map net -> 0..1 position (left starving, right feeding)
      const pct = clamp(0.5 + Math.tanh(net/60)/2, 0, 1);
      flowBar.style.width = `${Math.round(pct*100)}%`;
      flowLabel.textContent = net>0 ? "Feeding" : (net<0 ? "Starving" : "Neutral");

      // tiny health nudge from *recent* net
      setHealth(health + Math.sign(localFlowsUSD)*0.01);

      // recompute stage after XP changes
      recalcStage();

    }catch(e){
      // keep previous rows
      heartbeat.textContent = "Network…";
    }
  }

  // ---------- Decay driver ----------
  function tickDecay(){
    setHealth(health - DECAY_PER_TICK);
    // slow background “metabolism” → a whisper of XP drift toward 0 if starving
    if (flowLabel.textContent === "Starving") {
      totalXP = Math.max(0, totalXP - 0.4);
      recalcStage();
    }
  }

  // ---------- Interactions ----------
  sfxBtn.addEventListener("click", ()=>{
    sfx = !sfx;
    sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
  });

  feedBtn.addEventListener("click",(ev)=>{
    ev.preventDefault();
    // manual small nourishment
    setHealth(health + 0.05);
    totalXP += 1.2;      // tiny demo XP
    recalcStage();
  });

  // (optional) put your Jupiter swap URL (preselect when your token launches)
  // tradeBtn.href = "https://jup.ag/swap/...";

  // ---------- Init ----------
  setStageIdx(0);
  setHealth(health);
  setMutationBar();
  decayRate.textContent = "1% / 10m";

  pollHealth();
  pollTrades();
  setInterval(tickDecay, TICK_MS);
  setInterval(pollHealth, HEALTH_POLL_MS);
  setInterval(pollTrades, TRADES_POLL_MS);

})();
