// Frontend: renders a pulsing organism and syncs health/mutation with your backend /health endpoint.
// If the backend is unreachable, it will keep animating and show an error alert.

(() => {
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "";

  // DOM references
  const canvas = document.getElementById('organismCanvas');
  const ctx = canvas.getContext('2d');
  const feedBtn = document.getElementById('feedBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const sfxBtn = document.getElementById('sfxBtn');

  const statusWord = document.getElementById('statusWord');
  const heartbeatRate = document.getElementById('heartbeatRate');
  const healthBar = document.getElementById('healthBar');
  const mutBar = document.getElementById('mutBar');
  const healthPct = document.getElementById('healthPct');
  const mutPct = document.getElementById('mutPct');
  const stageLabel = document.getElementById('stageLabel');
  const stageBadge = document.getElementById('stageBadge');
  const decayRate = document.getElementById('decayRate');
  const priceLabel = document.getElementById('priceLabel');
  const updatedLabel = document.getElementById('updatedLabel');

  const alertBox = document.getElementById('alert');
  const feedLog = document.getElementById('feedLog');
  const orgWrap = document.querySelector('.organism-wrap');
  const hero = document.querySelector('.hero');

  if (cfg.jupiterUrl) tradeBtn.href = cfg.jupiterUrl;

  // local animation state
  let t = 0;
  let stage = 1;
  let health = 100;     // 0..100 (displayed)
  let mutation = 0;     // 0..100 (displayed)
  let alive = true;
  let sfx = false;

  function setAlert(text, level) {
    if (!text) { alertBox.className='alert hidden'; alertBox.textContent=''; return; }
    alertBox.textContent = text;
    alertBox.className = 'alert ' + (level || '');
  }
  function log(msg) {
    const li = document.createElement('li');
    li.textContent = msg;
    feedLog.prepend(li);
    while (feedLog.children.length > 40) feedLog.removeChild(feedLog.lastChild);
  }
  function fmtUsd(n){
    if (n === null || n === undefined) return '--';
    const num = Number(n);
    if (!isFinite(num)) return '--';
    if (num >= 1) return '$' + num.toFixed(4);
    if (num >= 0.01) return '$' + num.toFixed(6);
    return '$' + num.toPrecision(2);
  }

  // draw organism
  function redraw() {
    ctx.clearRect(0,0,canvas.width, canvas.height);
    const cx = canvas.width/2, cy = canvas.height/2 + 10;

    const beat = (Math.sin(t/400) + 1)/2; // 0..1
    const healthFactor = Math.max(0.5, health/100);
    const radius = 78 + beat*24*healthFactor + stage*3;

    const grd = ctx.createRadialGradient(cx, cy, radius*0.2, cx, cy, radius);
    grd.addColorStop(0, 'rgba(120,255,210,0.95)');
    grd.addColorStop(1, 'rgba(20,40,60,0)');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2); ctx.fill();

    ctx.strokeStyle = 'rgba(140,210,255,0.25)';
    for (let i=0;i<stage*8;i++){
      const ang = (i/stage)*Math.PI/4 + t/3000 + i*0.13;
      const len = radius + 24 + (Math.sin(t/900+i)*12);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang)*len, cy + Math.sin(ang)*len);
      ctx.stroke();
    }
  }

  function applyUI(alerts=[]) {
    healthBar.style.width = Math.max(0, Math.min(100, health)) + '%';
    healthPct.textContent = Math.round(Math.max(0, health)) + '%';
    mutBar.style.width = Math.max(0, Math.min(100, mutation)) + '%';
    mutPct.textContent = Math.round(Math.max(0, mutation)) + '%';

    if (health <= 0) {
      alive = false;
      statusWord.textContent = 'Dead';
      statusWord.classList.remove('alive');
      statusWord.classList.add('dead');
      heartbeatRate.textContent = 'Flatline';
    } else if (health < 10) {
      statusWord.textContent = 'Dying';
      statusWord.classList.remove('alive'); statusWord.classList.remove('dead');
      heartbeatRate.textContent = 'Faint';
    } else if (health < 30) {
      statusWord.textContent = 'Weak';
      statusWord.classList.remove('alive'); statusWord.classList.remove('dead');
      heartbeatRate.textContent = 'Weak';
    } else {
      statusWord.textContent = 'Alive';
      statusWord.classList.add('alive');
      statusWord.classList.remove('dead');
      heartbeatRate.textContent = 'Stable';
    }

    if (alerts.length) {
      const text = alerts[0];
      const level = text.startsWith('COLLAPSE') ? 'crit' : (text.includes('Critical') ? 'crit' : (text.includes('Starvation') ? 'warn' : ''));
      setAlert(text, level);
    } else setAlert('', '');

    if (health > 0 && health < 12) hero.classList.add('shake'); else hero.classList.remove('shake');
  }

  // SFX toggle (placeholder)
  sfxBtn.addEventListener('click', () => {
    sfx = !sfx;
    sfxBtn.textContent = sfx ? '🔊 SFX On' : '🔈 SFX Off';
    sfxBtn.setAttribute('aria-pressed', String(sfx));
  });

  // Backend polling (every 5s). We interpret returned price into health/mutation for display.
  async function pollBackend() {
    if (!API) return;

    try {
      const r = await fetch(`${API}/health`, { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const s = await r.json();

      // Map backend price to a visual "health" (for demo).
      // You can replace this with real /state values later.
      const price = Number(s.price || 0);
      priceLabel.textContent = fmtUsd(price);
      updatedLabel.textContent = new Date(s.timestamp || Date.now()).toLocaleTimeString();

      // simple mapping: normalize price into 0..100 band with smoothing
      const targetHealth = Math.max(5, Math.min(100, price > 0 ? Math.log10(price*1000 + 1) * 100 : 10));
      health = health + (targetHealth - health) * 0.25; // ease toward target

      // mutation drifts up a little when price > 0 (demo only)
      mutation = Math.min(100, mutation + (price > 0 ? 0.6 : 0.1));

      // Stage bump on full mutation
      if (mutation >= 100 && health >= 25) {
        mutation = 0;
        stage += 1;
        stageLabel.textContent = String(stage);
        const names = {1:'The Cell',2:'The Organism',3:'The Eye',4:'The Hybrid',5:'The Apex'};
        stageBadge.textContent = `Stage ${stage} • ${names[stage] || '???'}`;
        orgWrap.style.transform = 'scale(1.04)';
        setTimeout(()=> orgWrap.style.transform='scale(1.0)', 220);
        log(`✨ Mutation achieved → Stage ${stage}`);
      }

      applyUI([]);

    } catch (e) {
      setAlert('Backend unreachable. Showing local animation only.', 'warn');
    } finally {
      setTimeout(pollBackend, 5000);
    }
  }

  // animation ticker
  setInterval(() => { t += 50; redraw(); }, 50);

  // Decay label (static for now)
  decayRate.textContent = '1% / 10m';

  // “Feed” button (for now just a micro pulse)
  feedBtn.addEventListener('click', (ev) => {
    ev.preventDefault();
    orgWrap.style.transform = 'scale(1.02)';
    setTimeout(()=> orgWrap.style.transform = 'scale(1.0)', 120);
    log('Manual feed trigger (demo).');
  });

  // Start backend polling
  pollBackend();
})();
