(() => {
  // ===== Config =====
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "https://organism-backend.onrender.com";
  const TOKEN_SWAP_URL = cfg.swapUrl || "#";

  // ===== DOM =====
  const canvas   = document.getElementById('org-canvas');
  const ctx      = canvas.getContext('2d');
  const sparksEl = document.getElementById('sparks');

  const statusWord = document.getElementById('status');
  const heartbeat  = document.getElementById('heartbeat');
  const stageBadge = document.getElementById('stageBadge');

  const feedBtn  = document.getElementById('feedBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const sfxBtn   = document.getElementById('sfxBtn');

  const healthBar = document.getElementById('health-bar').querySelector('span');
  const mutBar    = document.getElementById('mutBar').querySelector('span');
  const stageNum  = document.getElementById('stageNum');

  const priceLabel   = document.getElementById('priceLabel');
  const updatedLabel = document.getElementById('updatedLabel');

  const flowBar   = document.getElementById('flowBar');
  const flowFill  = document.getElementById('flowFill');
  const flowLabel = document.getElementById('flowLabel');

  const tradesBody = document.getElementById('trades-body');

  tradeBtn.href = TOKEN_SWAP_URL;

  // ===== Helpers =====
  const fmtUSD  = (n) => `$${Number(n).toLocaleString(undefined,{minimumFractionDigits:4,maximumFractionDigits:6})}`;
  const fmtUSDc = (n) => `$${Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtTs   = (ts) => new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});

  function setHealth(v){ health = Math.max(0, Math.min(1, v)); healthBar.style.width = (health*100)+'%'; }
  function setMutation(v){ mutation = Math.max(0, Math.min(1, v)); mutBar.style.width = (mutation*100)+'%'; }
  function setFlow(x){
    // x in [-1,1] (left=starving, right=feeding)
    const pct = (x+1)/2; // 0..1
    flowFill.style.transform = `scaleX(${pct})`;
    flowFill.style.transformOrigin = 'left';
    flowLabel.textContent = x > 0.05 ? 'Feeding' : x < -0.05 ? 'Starving' : 'Neutral';
  }

  // ===== Organism render (soft womb glow) =====
  let tStart = performance.now();
  let health = 0.35, mutation = 0.05;

  function drawOrganism(now){
    const t = (now - tStart) / 1000;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    // backdrop gradient womb
    const grad = ctx.createRadialGradient(w/2,h/2,60, w/2,h/2,w*0.5);
    const c1 = `rgba(46, 216, 160, ${0.15 + 0.05*Math.sin(t*0.8)})`;
    grad.addColorStop(0, c1);
    grad.addColorStop(1, 'rgba(18, 36, 58, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(w/2,h/2,w*0.48,0,Math.PI*2); ctx.fill();

    // core pulse
    const pulse = 0.04 + 0.02*Math.sin(t*2.1);
    const coreR = w*0.12 * (1 + pulse + 0.2*health);
    const coreGrad = ctx.createRadialGradient(w/2,h/2, coreR*0.2, w/2,h/2, coreR);
    coreGrad.addColorStop(0, `rgba(170,255,218,0.85)`);
    coreGrad.addColorStop(1, `rgba(46,216,160,0.0)`);
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(w/2,h/2, coreR, 0, Math.PI*2); ctx.fill();

    requestAnimationFrame(drawOrganism);
  }
  requestAnimationFrame(drawOrganism);

  // sparks (ambient)
  for(let i=0;i<24;i++){
    const li = document.createElement('li');
    li.style.left = (10 + Math.random()*80)+'%';
    li.style.top  = (10 + Math.random()*80)+'%';
    li.style.opacity = .08 + Math.random()*.12;
    li.style.width = li.style.height = (2+Math.random()*3)+'px';
    sparksEl.appendChild(li);
  }

  // ===== Backend polling =====
  let lastHealth = { ts:0, price:0 };
  let lastTrades = [];
  let sfx = false;

  async function pollHealth(){
    try{
      const res = await fetch(`${API}/health`);
      const j = await res.json();
      lastHealth = j;

      // HUD
      priceLabel.textContent = fmtUSD(j.price || 0);
      updatedLabel.textContent = fmtTs(j.timestamp || Date.now());

      // gently map price to target-health (demo)
      const priceToHealth = Math.max(.05, Math.min(1, (j.price || 0) * 10));
      setHealth( health + (priceToHealth - health)*0.08 );
    }catch(e){
      console.error('health error', e);
    }
  }

  // net flow buffer (5m window)
  const windowMs = 5*60*1000;
  const recent = [];

  async function pollTrades(){
    try{
      const res = await fetch(`${API}/trades`);
      const t0 = await res.text();
      // endpoint returns JS-ish text; try JSON first, else eval-safe parse:
      let obj;
      try{ obj = JSON.parse(t0); }catch{
        // support simple pseudo-JSON (what your /trades shows)
        const fixed = t0
          .replace(/^ok[^[]*\[/,'[')   // strip header
          .replace(/\]}\s*$/,'}]');    // ensure last object closes
        obj = JSON.parse(fixed);
      }

      // If backend wrapped as {ok:true, trades:[...]}, normalize
      const list = Array.isArray(obj) ? obj : (obj.trades || []);

      // Build rows (Time, Type, Value USD, Price USD)
      tradesBody.innerHTML = '';
      let buys=0, sells=0;

      // keep recent for net flow over 5m
      const now = Date.now();
      // append and prune
      for(const r of list){
        const sideRaw = String(r.side || r.action || '').toUpperCase();
        const side = sideRaw.includes('BUY') ? 'BUY' : 'SELL';
        const price = Number(r.price || 0);
        const amount = Number(r.amount || r.size || 0);
        const ts = r.ts || r.time || now;

        // save to recent buffer
        recent.push({ ts, side, price, amount });

        const value = price * amount;

        if(side==='BUY') buys += value; else sells += value;

        const tr = document.createElement('tr');
        const typeHtml = side==='BUY'
          ? `<span class="feed">FEED</span>`
          : `<span class="starve">STARVE</span>`;

        tr.innerHTML = `
          <td class="right">${fmtTs(ts)}</td>
          <td>${typeHtml}</td>
          <td class="right">${fmtUSDc(value)}<br><span class="sub">${amount.toLocaleString()} tokens</span></td>
          <td class="right">${fmtUSD(price)}</td>
        `;
        tradesBody.appendChild(tr);
      }

      // calc net flow (5m)
      // prune old
      for(let i=recent.length-1;i>=0;i--){
        if(now - recent[i].ts > windowMs) recent.splice(i,1);
      }
      let sum = 0;
      for(const r of recent){
        const v = (r.price||0) * (r.amount||0);
        sum += (r.side==='BUY' ? v : -v);
      }
      // normalize
      const denom = recent.reduce((acc,r)=>acc + (r.price||0)*(r.amount||0), 0) || 1;
      const net = Math.max(-1, Math.min(1, sum / denom));
      setFlow(net);

      // nudge health slightly from fresh flow
      try{
        const delta = 0.24 * net;
        setHealth(health + delta);
        setMutation(Math.min(1, mutation + Math.max(0, delta)*0.3));
      }catch(e){}

    }catch(e){
      console.error('trades error', e);
    }
  }

  // Passive decay + pulse
  function tickDecay(){
    setHealth(health - 0.01);
    if(health < 0.08 && Number(stageNum.textContent) < 1){
      stageNum.textContent = '1';
      stageBadge.textContent = 'Stage 1 · The Cell';
    }
  }

  // Interactions
  sfxBtn.addEventListener('click', () => {
    sfx = !sfx;
    sfxBtn.textContent = sfx ? '🔊 SFX On' : '🔇 SFX Off';
  });
  feedBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    setHealth(health + 0.06);
    setMutation(Math.min(1, mutation + 0.03));
  });

  // Schedules
  setInterval(tickDecay, 10_000);
  setInterval(pollHealth, 6_000);
  setInterval(pollTrades, 6_000);

  // Boot
  pollHealth();
  pollTrades();
})();
