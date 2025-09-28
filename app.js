(() => {
  // ===== Config =====
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "https://organism-backend.onrender.com";
  const TOKEN_MINT = cfg.mint || ""; // optional, backend already fixed

  // ===== DOM =====
  const canvas = document.getElementById("org-canvas");
  const ctx = canvas.getContext("2d");
  const statusWord = document.getElementById("status");
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
  const whispers = document.getElementById("whispers");
  const archive = document.getElementById("archive");

  // ===== Audio (optional) =====
  let sfx = false;
  sfxBtn.addEventListener("click", (e) => {
    e.preventDefault();
    sfx = !sfx;
    sfxBtn.textContent = sfx ? "🔊 SFX On" : "🔇 SFX Off";
  });

  // ===== State =====
  let W = 1280, H = 720;
  const DPR = Math.min(2, window.devicePixelRatio || 1);

  let health = 0.62;       // 0..1
  let mutation = 0.05;     // 0..1 (when hits 1 → evolve)
  let stage = 1;           // 1..5
  let lastPrice = 0;       // USD
  let net = 0;             // -1..+1 (recent 5m flow)

  // Stages define name, ring intensity, motes count, whisper lines
  const STAGES = [
    null,
    { name: "The Cell",      motes: 24, ring: 0.6, spokes: 6,  whispers: [
      "it remembers the sea", "divide, divide, divide"
    ]},
    { name: "The Polyp",     motes: 36, ring: 0.7, spokes: 8,  whispers: [
      "it grows hungry", "patterns repeat"
    ]},
    { name: "The Organ",     motes: 48, ring: 0.8, spokes: 10, whispers: [
      "something inside awakens", "a new rhythm"
    ]},
    { name: "The Creature",  motes: 64, ring: 0.9, spokes: 12, whispers: [
      "it learns to listen", "it feels your warmth"
    ]},
    { name: "The Unknown",   motes: 84, ring: 1.0, spokes: 14, whispers: [
      "the shell is thin", "who is watching whom?"
    ]},
  ];

  // motes
  const motes = [];
  function initMotes(count) {
    motes.length = 0;
    for (let i=0;i<count;i++){
      motes.push({
        r: 40 + Math.random()*Math.min(W,H)*0.35,
        a: Math.random()*Math.PI*2,
        s: 0.001 + Math.random()*0.004,
        size: 1 + Math.random()*2,
        tw: Math.random()*999
      });
    }
  }

  // ===== Helpers =====
  const fmtUSD = (n) =>
    isFinite(n) ? `$${n.toFixed(n >= 1 ? 2 : 4)}` : "$—";

  const timeStr = (ts) => {
    try { return new Date(ts).toLocaleTimeString(); }
    catch { return "—:—:—"; }
  };

  function setHealth(v) {
    health = Math.max(0, Math.min(1, v));
    healthBar.style.width = `${Math.round(health*100)}%`;
  }
  function setMutation(v) {
    mutation = Math.max(0, Math.min(1, v));
    mutBar.style.width = `${Math.round(mutation*100)}%`;
  }
  function setFlow(v) {
    net = Math.max(-1, Math.min(1, v));
    // map -1..1 to -48%..+48%
    const px = Math.round(net * 48);
    flowBar.style.width = `${Math.abs(px)}%`;
    flowBar.style.transform = `translateX(${px<0?px:0}%)`;
    flowLabel.textContent = net > 0.02 ? "Feeding" : net < -0.02 ? "Starving" : "Neutral";
  }

  function setStage(n, note=true) {
    stage = Math.max(1, Math.min(5, n));
    stageNum.textContent = String(stage);
    stageBadge.textContent = `Stage ${stage} · ${STAGES[stage].name}`;
    if (note) {
      const li = document.createElement("li");
      li.innerHTML = `<strong>Stage ${stage}: ${STAGES[stage].name}</strong> — ${stage==1?"Born weak, fragile, dependent on constant feeding.": "It changes in ways you don’t yet understand."}`;
      archive.appendChild(li);
    }
    initMotes(STAGES[stage].motes);
  }

  // gentle health pull toward price mood + decay
  function healthNudge(delta) {
    setHealth(health + delta);
    if (delta>0.01 && sfx) { /* place gentle chime here if you add audio */ }
  }

  // ===== Canvas sizing =====
  function resize(){
    const rect = canvas.getBoundingClientRect();
    W = Math.max(320, Math.floor(rect.width));
    H = Math.max(180, Math.floor(rect.height));
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  resize();
  window.addEventListener("resize", resize);

  // ===== Creature renderer =====
  let t = 0;
  function draw(){
    t += 1/60;

    ctx.clearRect(0,0,W,H);

    // background glow (faintly affected by stage)
    const ringStrength = STAGES[stage].ring;
    const cx = W/2, cy = H/2;
    const baseR = Math.min(W,H)*0.24 + Math.sin(t*0.4)*3;

    // aura hue: feed/starve nudges green<->red; health brightens
    const feed = (net+1)/2; // 0..1
    const hue = 170*feed + 5*(1-feed); // ~red ↔ teal
    const alpha = 0.35 + health*0.25;

    // core
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR*1.35);
    grd.addColorStop(0, `hsla(${hue}, 90%, ${65+health*20}%, ${0.55+health*0.25})`);
    grd.addColorStop(1, `hsla(${hue+20}, 80%, 12%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, baseR*1.35, 0, Math.PI*2); ctx.fill();

    // inner core pulse
    ctx.fillStyle = `hsla(${hue}, 100%, ${70+Math.sin(t*2)*5}%, ${0.25+alpha*0.15})`;
    ctx.beginPath(); ctx.arc(cx, cy, baseR*0.55 + Math.sin(t*3)*2, 0, Math.PI*2); ctx.fill();

    // rings
    ctx.strokeStyle = `hsla(${hue}, 80%, 70%, ${0.10*ringStrength})`;
    ctx.lineWidth = 2;
    for (let i=1;i<=3;i++){
      ctx.beginPath(); ctx.arc(cx, cy, baseR*0.8 + i*baseR*0.32, 0, Math.PI*2); ctx.stroke();
    }

    // spokes (stage-based)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t*0.15);
    ctx.strokeStyle = `hsla(${hue+10}, 100%, 80%, .12)`;
    for(let i=0;i<STAGES[stage].spokes;i++){
      ctx.rotate((Math.PI*2)/STAGES[stage].spokes);
      ctx.beginPath();
      ctx.moveTo(0, baseR*0.2);
      ctx.lineTo(0, baseR*1.2 + Math.sin(t*0.8+i)*4);
      ctx.stroke();
    }
    ctx.restore();

    // motes
    ctx.fillStyle = `hsla(${hue}, 90%, 75%, .35)`;
    for (const m of motes){
      m.a += m.s * (0.5 + health);
      const x = cx + Math.cos(m.a)*m.r;
      const y = cy + Math.sin(m.a)*m.r;
      const s = m.size + Math.sin(t*1.5 + m.tw)*0.6;
      ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  // ===== Backend polling =====
  const POLL_HEALTH_MS = 6000;
  const POLL_TRADES_MS = 6000;
  const DECAY_MS = 10000;

  async function pollHealth(){
    try{
      const r = await fetch(`${API}/health`);
      const j = await r.json();
      lastPrice = Number(j.price) || 0;
      priceLabel.textContent = fmtUSD(lastPrice);
      updatedLabel.textContent = timeStr(j.timestamp || Date.now());
      statusWord.textContent = j.status || "Alive";
      heartbeatEl.textContent = net>0.05 ? "Quickening" : net<-0.05 ? "Faltering" : "Stable";

      // nudge towards positive if price > last seen avg (simple)
      const target = Math.max(0, Math.min(1, 0.35 + Math.tanh((lastPrice-0.005)*120)*0.3 + net*0.25));
      const delta = (target - health) * 0.15;
      healthNudge(delta);

      // slow mutation growth proportional to health
      setMutation(mutation + Math.max(0, health-0.35)*0.02);

      // evolution
      if (mutation >= 1 && stage < 5){
        setMutation(0);
        setStage(stage+1);
        whisper();
      }
    }catch(e){
      console.error("health error", e);
      heartbeatEl.textContent = "Uncertain";
    }
  }

  async function pollTrades(){
    try{
      const r = await fetch(`${API}/trades`);
      const raw = await r.text(); // your /trades returns a text blob-like JSON, handle safely
      const clean = raw.trim();
      // try parse either `{ok:true,..,"trades":[...]}` or `[...]`
      let arr = [];
      try {
        const j = JSON.parse(clean);
        arr = Array.isArray(j) ? j : (Array.isArray(j.trades) ? j.trades : []);
      } catch {
        // nothing
      }

      // render rows
      tradesBody.innerHTML = "";
      let buys = 0, sells = 0;

      for (const t of arr.slice(0, 12)){
        const side = String(t.side || "").toUpperCase();
        const price = Number(t.price) || 0;
        const amount = Number(t.amount) || 0; // tokens
        const valueUsd = price * amount;

        if (side === "BUY") buys += valueUsd;
        if (side === "SELL") sells += valueUsd;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="${side==='BUY'?'buy':'sell'}">${side}</td>
          <td>${fmtUSD(price)}</td>
          <td>${fmtUSD(valueUsd)}<br><span class="sub">${amount.toLocaleString()} tokens</span></td>
          <td class="right">${timeStr((t.ts||t.time||Date.now()))}</td>
        `;
        tradesBody.appendChild(tr);
      }

      // compute recent net flow
      const sum = buys + sells;
      const dir = sum > 0 ? (buys - sells)/sum : 0;
      setFlow(dir);

      // tiny health influence from flow
      healthNudge(dir * 0.02);
    }catch(e){
      console.error("trades error", e);
    }
  }

  // decay tick — organism needs feeding
  function tickDecay(){
    setHealth(health - 0.01);         // ~1% decay per tick
    setHealth(Math.max(0, health));
    if (health <= 0.02) {
      statusWord.textContent = "Fading";
      if (stage > 1) setStage(stage-1, /*note*/true);
      setMutation(0);
      whisper("it goes quiet");
    }
  }

  // whispers (mysterious overlay)
  let whisperTimer = null;
  function whisper(line){
    const lines = STAGES[stage].whispers;
    const text = line || lines[(Math.random()*lines.length)|0];
    whispers.setAttribute("data-line", text);
    whispers.classList.add("show");
    clearTimeout(whisperTimer);
    whisperTimer = setTimeout(()=> whispers.classList.remove("show"), 2800);
  }

  // interactions
  feedBtn.addEventListener("click", (ev) => {
    ev.preventDefault();
    // “manual feed” nudge
    setHealth(health + 0.04);
    setMutation(mutation + 0.015);
    whisper("it drinks the light");
  });

  // If you want: prefill swap URL for your mint later:
  // tradeBtn.href = "https://jup.ag/swap/SOL-<YOURMINT>";

  // Schedulers
  setInterval(tickDecay, 10000);   // decay
  setInterval(pollHealth, 6000);
  setInterval(pollTrades, 6000);

  // Boot
  setStage(1, /*note*/false);
  pollHealth();
  pollTrades();
  requestAnimationFrame(draw);
})();
