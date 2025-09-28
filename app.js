(() => {
  // ---- Config
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "https://organism-backend.onrender.com";

  // ---- DOM
  const canvas = document.getElementById("org-canvas");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const heartbeatEl = document.getElementById("heartbeat");
  const stageBadge = document.getElementById("stageBadge");
  const stageNum = document.getElementById("stageNum");
  const priceLabel = document.getElementById("priceLabel");
  const updatedLabel = document.getElementById("updatedLabel");
  const healthBar = document.getElementById("health-bar");
  const mutBar = document.getElementById("mut-bar");
  const flowBar = document.getElementById("flow-bar");
  const flowLabel = document.getElementById("flowLabel");
  const tradesBody = document.getElementById("trades-body");
  const feedBtn = document.getElementById("feedBtn");
  const tradeBtn = document.getElementById("tradeBtn");
  const sfxBtn = document.getElementById("sfxBtn");

  // ---- State
  let W = 800, H = 600, DPR = Math.min(2, window.devicePixelRatio || 1);
  let health = 0.65;    // 0..1
  let mutation = 0.06;  // 0..1
  let stage = 1;        // 1..5
  let net = 0;          // -1..+1 (5m flow)
  let lastPrice = 0;

  const STAGES = [
    null,
    { name: "The Cell",     spokes: 6,  motes: 20 },
    { name: "The Polyp",    spokes: 8,  motes: 28 },
    { name: "The Organ",    spokes: 10, motes: 36 },
    { name: "The Creature", spokes: 12, motes: 46 },
    { name: "The Unknown",  spokes: 14, motes: 60 },
  ];

  // ---- Utils
  const fmtUSD = (n) => isFinite(n) ? `$${n.toFixed(n >= 1 ? 2 : 4)}` : "$—";
  const tstr = (ts) => { try { return new Date(ts).toLocaleTimeString(); } catch { return "—:—:—"; } };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function setHealth(v){ health = clamp01(v); healthBar.style.width = `${Math.round(health*100)}%`; }
  function setMut(v){ mutation = clamp01(v); mutBar.style.width = `${Math.round(mutation*100)}%`; }
  function setStage(n){
    stage = Math.max(1, Math.min(5, n));
    stageBadge.textContent = `Stage ${stage} · ${STAGES[stage].name}`;
    stageNum.textContent = stage;
    initMotes(STAGES[stage].motes);
  }
  function setFlow(v){
    net = Math.max(-1, Math.min(1, v));
    const px = Math.round(net * 48);
    flowBar.style.width = `${Math.abs(px)}%`;
    flowBar.style.transform = `translateX(${px<0?px:0}%)`;
    flowLabel.textContent = net > 0.02 ? "Feeding" : net < -0.02 ? "Starving" : "Neutral";
    heartbeatEl.textContent = net > 0.08 ? "Quickening" : net < -0.08 ? "Faltering" : "Stable";
  }

  // ---- Canvas sizing
  function resize(){
    const r = canvas.getBoundingClientRect();
    W = Math.max(360, Math.floor(r.width));
    H = Math.max(270, Math.floor(r.height));
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  resize(); addEventListener("resize", resize);

  // ---- Creature drawing
  const motes = [];
  function initMotes(n){
    motes.length = 0;
    for(let i=0;i<n;i++){
      motes.push({
        r: 40 + Math.random()*Math.min(W,H)*0.32,
        a: Math.random()*Math.PI*2,
        s: 0.001 + Math.random()*0.004,
        size: 1 + Math.random()*2,
        tw: Math.random()*999
      });
    }
  }
  let t = 0;
  function draw(){
    t += 1/60;
    ctx.clearRect(0,0,W,H);

    const cx=W/2, cy=H/2, baseR=Math.min(W,H)*0.23 + Math.sin(t*0.4)*2.5;
    const feed = (net+1)/2;
    const hue = 150*feed + 5*(1-feed); // red→greenish
    const alpha = 0.28 + health*0.28;

    const g = ctx.createRadialGradient(cx,cy,0,cx,cy,baseR*1.35);
    g.addColorStop(0, `hsla(${hue}, 90%, ${65+health*20}%, ${0.45+alpha*0.25})`);
    g.addColorStop(1, `hsla(${hue+20}, 80%, 10%, 0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,baseR*1.35,0,Math.PI*2); ctx.fill();

    ctx.fillStyle = `hsla(${hue}, 100%, ${70+Math.sin(t*2)*5}%, ${0.18+alpha*0.2})`;
    ctx.beginPath(); ctx.arc(cx,cy,baseR*0.55 + Math.sin(t*3)*1.8,0,Math.PI*2); ctx.fill();

    ctx.save(); ctx.translate(cx,cy); ctx.rotate(t*0.15);
    ctx.strokeStyle = `hsla(${hue+10}, 100%, 80%, .10)`; ctx.lineWidth = 2;
    for(let i=0;i<STAGES[stage].spokes;i++){
      ctx.rotate((Math.PI*2)/STAGES[stage].spokes);
      ctx.beginPath(); ctx.moveTo(0, baseR*0.2); ctx.lineTo(0, baseR*1.15 + Math.sin(t*0.8+i)*3); ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = `hsla(${hue}, 90%, 75%, .30)`;
    for(const m of motes){
      m.a += m.s * (0.5 + health);
      const x = cx + Math.cos(m.a)*m.r;
      const y = cy + Math.sin(m.a)*m.r;
      const s = m.size + Math.sin(t*1.5 + m.tw)*0.5;
      ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  // ---- Data polling
  async function pollHealth(){
    try {
      const r = await fetch(`${API}/health`);
      const j = await r.json();
      lastPrice = Number(j.price) || 0;
      priceLabel.textContent = fmtUSD(lastPrice);
      updatedLabel.textContent = tstr(j.timestamp || Date.now());
      statusEl.textContent = j.status || "Alive";

      const target = clamp01(0.35 + Math.tanh((lastPrice-0.005)*120)*0.3 + net*0.22);
      const delta = (target - health) * 0.15;
      setHealth(health + delta);

      setMut(mutation + Math.max(0, health-0.35)*0.02);
      if (mutation >= 1 && stage < 5){ setMut(0); setStage(stage+1); }
    } catch (e) {
      console.error("health error", e);
      heartbeatEl.textContent = "Uncertain";
    }
  }

  async function pollTrades(){
    try {
      const r = await fetch(`${API}/trades`);
      const raw = (await r.text()).trim();
      let list = [];
      try {
        const j = JSON.parse(raw);
        list = Array.isArray(j) ? j : (Array.isArray(j.trades) ? j.trades : []);
      } catch {}

      tradesBody.innerHTML = "";
      let buys=0, sells=0;

      for (const t of list.slice(0, 12)){
        const side = String(t.side||"").toUpperCase();
        const price = Number(t.price)||0;
        const amount = Number(t.amount)||0;
        const value = price * amount;

        if (side==="BUY") buys += value;
        else if (side==="SELL") sells += value;

        const tr = document.createElement("tr");
        const badge = side==="BUY"
          ? `<span class="badge feed">🟢 Feed</span>`
          : `<span class="badge starve">🔴 Starve</span>`;

        tr.innerHTML = `
          <td>${badge}</td>
          <td class="right">${fmtUSD(price)}</td>
          <td class="right">${fmtUSD(value)}</td>
          <td class="right">${tstr(t.ts||t.time||Date.now())}</td>
        `;
        tradesBody.appendChild(tr);
      }

      const sum = buys + sells;
      const dir = sum>0 ? (buys - sells)/sum : 0;
      setFlow(dir);

      // tiny nudge from fresh flow
      setHealth(health + dir*0.02);
    } catch (e) {
      console.error("trades error", e);
    }
  }

  // ---- Decay + Interactions
  function tickDecay(){
    setHealth(health - 0.01);
    if (health <= 0.02 && stage>1){ setStage(stage-1); setMut(0); }
  }

  let sfx=false;
  sfxBtn.addEventListener("click",(e)=>{ e.preventDefault(); sfx=!sfx; sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off"; });
  feedBtn.addEventListener("click",(e)=>{ e.preventDefault(); setHealth(health+0.04); setMut(mutation+0.015); });

  // Optionally set your Jupiter swap URL:
  // tradeBtn.href = "https://jup.ag/swap/SOL-<YOUR_MINT>";

  // ---- Schedules
  setInterval(tickDecay, 10_000);
  setInterval(pollHealth, 6_000);
  setInterval(pollTrades, 6_000);

  // ---- Start
  setStage(1);
  pollHealth(); pollTrades();
  initMotes(STAGES[1].motes);
  requestAnimationFrame(draw);
})();
