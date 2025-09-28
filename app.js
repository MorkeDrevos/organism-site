(() => {
  // ===== Config =====
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "https://organism-backend.onrender.com"; // change if you renamed

  // ===== DOM =====
  const canvas = document.getElementById('org-canvas');
  const ctx = canvas.getContext('2d');
  const feedBtn = document.getElementById('feedBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const sfxBtn = document.getElementById('sfxBtn');

  const statusWord = document.getElementById('status');
  const heartbeat = document.getElementById('heartbeat');
  const healthBar = document.getElementById('health-bar');
  const mutBar = document.getElementById('mut-bar');
  const decayRate = document.getElementById('decayRate');
  const stageNum = document.getElementById('stageNum');
  const stageBadge = document.getElementById('stageBadge');
  const priceLabel = document.getElementById('priceLabel');
  const updatedLabel = document.getElementById('updatedLabel');
  const flowBar = document.getElementById('flowBar');
  const flowFill = document.getElementById('flowFill');
  const flowLabel = document.getElementById('flowLabel');
  const tradesBody = document.getElementById('trades-body');

  const fmtUSD = (n) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', maximumFractionDigits: 6 }).format(n ?? 0);
  const fmtTime = (t) => new Date(t).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});

  // ===== State =====
  let health = 0.78;           // 0..1
  let mutation = 0.00;         // 0..1
  let targetGlow = 0.75;       // 0..1
  let sfx = false;

  // ===== Canvas Pulse =====
  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    const cx = w/2, cy = h/2;

    const pulse = (Math.sin(Date.now()/800)+1)/2; // 0..1
    const base = 90 + 40*pulse + 20*health;

    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, base);
    grd.addColorStop(0, `rgba(101,251,201, ${0.50 + 0.35*health})`);
    grd.addColorStop(0.5, `rgba(101,251,201, ${0.17 + 0.25*pulse})`);
    grd.addColorStop(1, `rgba(0,0,0,0)`);

    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, base, 0, Math.PI*2); ctx.fill();

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // ===== Health & UI updates =====
  function setHealth(h) {
    health = Math.max(0, Math.min(1, h));
    healthBar.style.setProperty('--w', `${health*100}%`);
    healthBar.style.setProperty('--c', health > 0.5 ? '#65fbc9' : '#ff6b6b');
    healthBar.style.setProperty('background', '#0d2033');
    healthBar.style.setProperty('--shadow', health > 0.6 ? '0 0 14px rgba(101,251,201,.45)' : 'none');
    healthBar.style.setProperty('--ring', health > 0.6 ? 'rgba(101,251,201,.25)' : 'rgba(255,110,110,.18)');

    // CSS bar fill (pseudo) width
    healthBar.style.setProperty('--afterW', `${Math.round(health*100)}%`);
    healthBar.style.setProperty('position','relative');
    healthBar.style.setProperty('overflow','hidden');
    healthBar.style.setProperty('--fill', `${Math.round(health*100)}%`);
    healthBar.style.setProperty('--fillColor', health > 0.5 ? 'rgba(101,251,201,.6)' : 'rgba(255,110,110,.6)');
    healthBar.style.setProperty('--edge', 'rgba(255,255,255,.06)');
    healthBar.style.setProperty('--bg', '#0d2033');
    healthBar.innerHTML = `<div style="position:absolute;inset:0;width:${Math.round(health*100)}%;background:linear-gradient(90deg, var(--fillColor), rgba(101,251,201,.15));"></div>`;
  }

  function setMutation(m) {
    mutation = Math.max(0, Math.min(1, m));
    mutBar.innerHTML = `<div style="position:absolute;inset:0;width:${Math.round(mutation*100)}%;background:linear-gradient(90deg,#ffd16666,#ffd16622);"></div>`;
  }

  // Net flow: -1..+1 mapped to 0..100%
  function setFlow(n) {
    const pct = Math.round((n+1)/2 * 100);  // -1..+1 -> 0..100
    const left = Math.round(Math.max(0, Math.min(100, pct)) * 0.8); // keep inside bar
    flowFill.style.left = `${left}%`;
    flowFill.style.width = '22%';
    flowLabel.textContent = n > 0.08 ? 'Feeding' : (n < -0.08 ? 'Starving' : 'Neutral');
  }

  // ===== Fetchers =====
  async function pollHealth() {
    try{
      const r = await fetch(`${API}/health`, { cache:'no-store' });
      const j = await r.json();
      const p = +j.price || 0;
      statusWord.textContent = 'Alive';
      statusWord.className = 'ok';
      heartbeat.textContent = 'Stable';
      priceLabel.textContent = fmtUSD(p);
      updatedLabel.textContent = fmtTime(j.timestamp || Date.now());

      // nudge health a bit with price (demo)
      const priceToHealth = Math.max(0, Math.min(1, p * 10)); // scale demo
      targetGlow = 0.4 + 0.6*priceToHealth;
    }catch(e){
      statusWord.textContent = 'Offline';
      statusWord.className = 'bad';
    }
  }

  // Expect backend /trades -> { ok, mint, source, trades:[ { side:"buy"/"sell", price:0.0071, amount:2315, ts: 169590... }, ... ] }
  async function pollTrades() {
    try{
      const r = await fetch(`${API}/trades`, { cache:'no-store' });
      const j = await r.json();

      const arr = Array.isArray(j) ? j : j.trades || [];
      tradesBody.innerHTML = '';

      let buys = 0, sells = 0;
      for(const t of arr){
        const side = (t.side || '').toLowerCase();
        const price = +t.price || 0;
        const amount = +t.amount || 0;
        const value = price * amount;       // USD
        const time = t.ts ? fmtTime(t.ts) : (t.time || '');

        if(side === 'buy') buys += value;
        if(side === 'sell') sells += value;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="${side === 'buy' ? 'buy' : 'sell'}">${side.toUpperCase()}</td>
          <td class="mono">${fmtUSD(price)}</td>
          <td class="mono">
            ${fmtUSD(value)}
            <div class="muted small">${amount.toLocaleString()} tokens</div>
          </td>
          <td class="t-right mono">${time}</td>
        `;
        tradesBody.appendChild(tr);
      }

      // Net flow over window
      const net = (buys - sells) / Math.max(1, (buys + sells)); // -1..+1
      setFlow(net);

      // gently nudge health toward target based on net flow
      const delta = 0.02 * (net);
      setHealth(health + delta);
      setMutation(Math.min(1, mutation + Math.max(0, net)*0.01));
    }catch(e){
      // keep old table; small starvation nudge
      setFlow(-0.05);
      setHealth(health - 0.01);
    }
  }

  // ===== Decay + pulse driver =====
  function tickDecay(){
    setHealth(health - 0.01); // 1% / tick (10m decay simulated by frequency)
  }

  // ===== Interactions =====
  sfxBtn.addEventListener('click', () => {
    sfx = !sfx;
    sfxBtn.textContent = sfx ? '🔊 SFX On' : '🔇 SFX Off';
  });

  feedBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    setHealth(health + 0.04);
  });

  // Swap button (set your Jupiter link here when ready)
  // tradeBtn.href = "https://jup.ag/swap/SOL-<YOUR_MINT>";

  // ===== Schedulers =====
  setInterval(tickDecay, 10_000);   // decay every 10s (demo)
  setInterval(pollHealth, 6_000);
  setInterval(pollTrades, 6_000);

  // Boot
  pollHealth();
  pollTrades();
})();
