(() => {
  // ===== Config =====
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "https://organism-backend.onrender.com";
  const TOKEN_SWAP_URL = cfg.swapUrl || "#";

  // ===== DOM =====
  const canvas = document.getElementById('org-canvas');
  const ctx = canvas.getContext('2d');

  const stageBadge = document.getElementById('stageBadge');
  const statusWord = document.getElementById('status');
  const heartbeat  = document.getElementById('heartbeat');

  const feedBtn  = document.getElementById('feedBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const sfxBtn   = document.getElementById('sfxBtn');

  const priceLabel   = document.getElementById('priceLabel');
  const updatedLabel = document.getElementById('updatedLabel');

  const flowFill  = document.getElementById('flowFill');
  const flowLabel = document.getElementById('flowLabel');

  const healthFill = document.getElementById('healthFill');
  const mutFill    = document.getElementById('mutFill');
  const stageNum   = document.getElementById('stageNum');

  const sparksEl   = document.getElementById('sparks');
  const tradesBody = document.getElementById('trades-body');

  tradeBtn.href = TOKEN_SWAP_URL;

  // ===== Formatters =====
  const fmtUSD   = (n) => `$${Number(n).toLocaleString(undefined,{minimumFractionDigits:4,maximumFractionDigits:6})}`;
  const fmtUSDc  = (n) => `$${Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const fmtTs    = (ts) => new Date(ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});

  // ===== Organism render (mysterious “womb” pulse) =====
  let t0 = performance.now();
  let health = 0.35, mutation = 0.06;

  function setHealth(v){
    health = Math.max(0, Math.min(1, v));
    healthFill.style.width = (health*100)+'%';
  }
  function setMutation(v){
    mutation = Math.max(0, Math.min(1, v));
    mutFill.style.width = (mutation*100)+'%';
  }
  function setFlow(x){
    // x in [-1,1]  left=starving, right=feeding
    const pct = (x+1)/2;
    flowFill.style.transform = `scaleX(${pct})`;
    flowFill.style.transformOrigin = 'left';
    flowLabel.textContent = x > .05 ? 'Feeding' : x < -.05 ? 'Starving' : 'Neutral';
  }

  function draw(now){
    const t = (now - t0)/1000;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);

    // large diffuse womb gradient
    const womb = ctx.createRadialGradient(w/2,h/2, 60, w/2,h/2, w*0.5);
    womb.addColorStop(0, `rgba(54,251,209, ${0.18+0.06*Math.sin(t*0.8)})`);
    womb.addColorStop(0.55, `rgba(54,251,209, 0.03)`);
    womb.addColorStop(1, `rgba(109,121,255, 0.00)`);
    ctx.fillStyle = womb;
    ctx.beginPath(); ctx.arc(w/2,h/2,w*0.49,0,Math.PI*2); ctx.fill();

    // core – responsive to health
    const breath = 0.04 + 0.02*Math.sin(t*2.1);
    const r = w*(0.10 + 0.18*health + breath);
    const core = ctx.createRadialGradient(w/2,h/2, r*0.2, w/2,h/2, r);
    core.addColorStop(0, `rgba(200,255,238,0.9)`);
    core.addColorStop(1, `rgba(54,251,209,0.0)`);
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(w/2,h/2, r, 0, Math.PI*2); ctx.fill();

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  // ambience sparks
  for(let i=0;i<28;i++){
    const li = document.createElement('li');
    li.style.left = (8 + Math.random()*84)+'%';
    li.style.top  = (8 + Math.random()*84)+'%';
    li.style.opacity = .08 + Math.random()*.12;
    li.style.width = li.style.height = (2+Math.random()*3)+'px';
    sparksEl.appendChild(li);
  }

  // ===== Polling =====
  let sfx = false;
  let recent = []; // 5m net window

  const fmtPriceHealth = (p) => Math.max(.05, Math.min(1, p*10));

  async function pollHealth(){
    try{
      const res = await fetch(`${API}/health`);
      const j = await res.json();

      priceLabel.textContent = fmtUSD(j.price || 0);
      updatedLabel.textContent = fmtTs(j.timestamp || Date.now());

      // price nudges target-health, then ease toward it
      const target = fmtPriceHealth(j.price || 0);
      setHealth( health + (target - health)*0.08 );

      statusWord.textContent = 'Alive';
      statusWord.classList.add('ok');
    }catch(e){
      console.error('health error', e);
      statusWord.textContent = 'Offline';
      statusWord.classList.remove('ok');
    }
  }

  const WINDOW_MS = 5*60*1000;

  async function pollTrades(){
    try{
      const res = await fetch(`${API}/trades`);
      const raw = await res.text();

      let data;
      try { data = JSON.parse(raw); }
      catch {
        // normalize the pseudo-JSON your backend shows
        const fixed = raw
          .replace(/^ok[^[]*\[/,'[')
          .replace(/,\s*]$/ ,']')
          .replace(/\]}\s*$/,'}]');
        data = JSON.parse(fixed);
      }

      const list = Array.isArray(data) ? data : (data.trades || []);

      tradesBody.innerHTML = '';
      const now = Date.now();

      // push to recent + render rows
      for(const r of list){
        const sideRaw = String(r.side || r.action || '').toUpperCase();
        const side = sideRaw.includes('BUY') ? 'BUY' : 'SELL';
        const price = Number(r.price || 0);
        const amount = Number(r.amount || r.size || 0);
        const ts = r.ts || r.time || now;
        const value = price * amount;

        recent.push({ ts, side, price, amount });

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="right mono">${fmtTs(ts)}</td>
          <td>${ side==='BUY' ? '<span class="feed">FEED</span>' : '<span class="starve">STARVE</span>' }</td>
          <td class="right mono">${fmtUSDc(value)}<br><span class="sub">${amount.toLocaleString()} tokens</span></td>
          <td class="right mono">${fmtUSD(price)}</td>
        `;
        tradesBody.appendChild(tr);
      }

      // prune old + compute net flow
      for(let i=recent.length-1;i>=0;i--) if(now - recent[i].ts > WINDOW_MS) recent.splice(i,1);
      let sum=0, denom=0;
      for(const r of recent){
        const v = (r.price||0)*(r.amount||0);
        denom += v;
        sum   += (r.side==='BUY' ? v : -v);
      }
      const net = denom ? Math.max(-1, Math.min(1, sum/denom)) : 0;
      setFlow(net);

      // gentle health/mutation nudge from flow
      const delta = 0.22 * net;
      setHealth(health + delta);
      setMutation(Math.min(1, mutation + Math.max(0,delta)*0.3));

    }catch(e){
      console.error('trades error', e);
    }
  }

  // ===== Interactions & schedules =====
  sfxBtn.addEventListener('click', () => {
    sfx = !sfx;
    sfxBtn.textContent = sfx ? '🔊 SFX On' : '🔇 SFX Off';
  });
  feedBtn.addEventListener('click', (e) => {
    e.preventDefault();
    setHealth(health + 0.06);
    setMutation(Math.min(1, mutation + 0.03));
  });

  setInterval(()=> setHealth(health - 0.01), 10_000); // passive decay
  setInterval(pollHealth, 6_000);
  setInterval(pollTrades, 6_000);

  // boot
  pollHealth();
  pollTrades();
})();
