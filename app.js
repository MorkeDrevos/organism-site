// Minimal demo logic — simulates health decay & feeding. Replace with backend later.
(() => {
  const cfg = window.__CONFIG__;
  const canvas = document.getElementById('organismCanvas');
  const ctx = canvas.getContext('2d');
  const feedBtn = document.getElementById('feedBtn');
  const tradeBtn = document.getElementById('tradeBtn');
  const healthBar = document.getElementById('healthBar');
  const mutBar = document.getElementById('mutBar');
  const healthPct = document.getElementById('healthPct');
  const mutPct = document.getElementById('mutPct');
  const alertBox = document.getElementById('alert');
  const feedLog = document.getElementById('feedLog');
  const heartbeatRate = document.getElementById('heartbeatRate');

  tradeBtn.href = cfg.jupiterUrl;

  let health = 100, mutation = 0, stage = 1, t = 0, alive = true;
  let decayMs = 10 * 60 * 1000; // stage 1 decay: 1% / 10m

  function stageDecayMs(s){ return [0,10,7,5,3,2][s] * 60 * 1000 || 2*60*1000; }

  function setAlert(text, level){
    if(!text){ alertBox.className='alert hidden'; alertBox.textContent=''; return; }
    alertBox.textContent = text; alertBox.className = 'alert ' + (level||'');
  }
  function log(msg){ const li = document.createElement('li'); li.textContent = msg; feedLog.prepend(li); }

  function redraw(){
    ctx.clearRect(0,0,canvas.width, canvas.height);
    const cx = canvas.width/2, cy = canvas.height/2 + 10;
    const beat = (Math.sin(t/400)+1)/2; // 0..1
    const healthFactor = Math.max(0.5, health/100);
    const radius = 70 + beat*22*healthFactor + stage*3;
    const grd = ctx.createRadialGradient(cx,cy,radius*0.2,cx,cy,radius);
    grd.addColorStop(0,'rgba(100,255,200,0.9)');
    grd.addColorStop(1,'rgba(20,40,60,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.fill();

    ctx.strokeStyle = 'rgba(140,210,255,0.25)';
    for(let i=0;i<stage*8;i++){
      const ang = (i/stage)*Math.PI/4 + t/3000 + i*0.13;
      const len = radius + 20 + (Math.sin(t/900+i)*12);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(ang)*len, cy+Math.sin(ang)*len); ctx.stroke();
    }
  }

  function updateUI(){
    healthBar.style.width = Math.max(0, Math.min(100, health)) + '%';
    healthPct.textContent = Math.round(Math.max(0, health)) + '%';
    mutBar.style.width = Math.max(0, Math.min(100, mutation)) + '%';
    mutPct.textContent = Math.round(Math.max(0, mutation)) + '%';

    if (health <= 0){
      alive = false;
      document.querySelector('.status').textContent = 'Dead';
      document.querySelector('.status').classList.remove('alive');
      document.querySelector('.status').classList.add('dead');
      heartbeatRate.textContent = 'Flatline';
      setAlert('COLLAPSE: The organism has died. Awaiting rebirth protocol.', 'crit');
    } else if (health < 10){
      setAlert('Critical starvation. Immediate feeding required.', 'crit');
      heartbeatRate.textContent = 'Faint';
    } else if (health < 30){
      setAlert('Starvation detected. Mutations at risk of failure.', 'warn');
      heartbeatRate.textContent = 'Weak';
    } else {
      setAlert('', '');
      heartbeatRate.textContent = 'Stable';
    }
  }

  function maybeMutate(){
    if (mutation >= 100 && health >= 25){
      stage += 1; mutation = 0; decayMs = stageDecayMs(stage);
      log(`✨ Mutation achieved → Stage ${stage}.`);
      const archive = document.getElementById('archive');
      const li = document.createElement('li');
      const names = {
        2:'The Organism — Tendrils extend outward. Hungrier.',
        3:'The Eye — It sees who feeds and who starves.',
        4:'The Hybrid — Circuits through flesh. Unnatural.',
        5:'The Apex — Beautiful and terrifying.'
      };
      li.innerHTML = `<strong>Stage ${stage}:</strong> ${names[stage] || '???'}`;
      archive.appendChild(li);
    }
  }

  setInterval(() => {
    if (!alive) return;
    t += 50;

    // decay: 1% per decayMs
    const dt = 50;
    const decayPerMs = 1 / decayMs;
    health -= decayPerMs * dt * 1000;
    if (health < 0) health = 0;

    // passive mutation progress (placeholder)
    mutation += 0.005; if (mutation > 100) mutation = 100;

    redraw(); updateUI(); maybeMutate();
  }, 50);

  // Simulated feed button (for demo). Replace with real tx listener later.
  feedBtn.addEventListener('click', () => {
    if (!alive){ log('Rebirth protocol not implemented in demo.'); return; }
    const sol = (Math.random()*1.2 + 0.1).toFixed(2);
    const gain = Math.min(20, parseFloat(sol) * 2);
    health = Math.min(100, health + gain);
    mutation = Math.min(100, mutation + gain * 0.6);
    log(`+${sol} SOL fed — Health +${gain.toFixed(2)}%, Mutation +${(gain*0.6).toFixed(2)}%`);
    updateUI();
  });

  // Optional backend polling (disabled by default)
  async function poll(){
    if (!cfg.apiBase) return;
    try{
      const r = await fetch(cfg.apiBase + '/state');
      if (r.ok){
        const s = await r.json();
        health = s.health; mutation = s.mutation; stage = s.stage;
      }
    }catch(e){}
    setTimeout(poll, 5000);
  }
  poll();
})();
