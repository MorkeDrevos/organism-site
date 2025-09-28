(() => {
  const cfg = window.__CONFIG__ || {};
  const API = cfg.apiBase || "";

  const priceLabel = document.getElementById("priceLabel");
  const updatedLabel = document.getElementById("updatedLabel");
  const flowBar = document.getElementById("flowBar");
  const flowLabel = document.getElementById("flowLabel");
  const healthBar = document.getElementById("healthBar");
  const mutBar = document.getElementById("mutBar");
  const tradesBody = document.getElementById("trades-body");
  const swapBtn = document.getElementById("swapBtn");

  // Optional: prefill your jupiter swap URL once your mint is final
  // swapBtn.href = `https://jup.ag/swap/SOL-${YOUR_MINT}`;

  let health = 0.55;      // 0..1
  let mutation = 0.10;    // 0..1
  let netWindow = [];     // last ~5m trades (we use each poll as 1 bucket)
  const BUCKETS = 30;

  function fmtUSD(n){ return `$${Number(n).toFixed(4)}` }
  function fmtUSD2(n){ return `$${Number(n).toFixed(2)}` }

  // --------- Canvas “womb” animation ----------
  const canvas = document.getElementById("org-canvas");
  const ctx = canvas.getContext("2d");
  function draw(t){
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    // Pulsing nucleus depends on health
    const pulse = 1 + 0.06*Math.sin(t*1.2);
    const base = 90 + 60*health;
    const r = base * pulse;

    // glow
    const grd = ctx.createRadialGradient(W/2,H/2, r*0.2, W/2,H/2, r*1.25);
    const hue = 168 + 40*health;
    grd.addColorStop(0, `hsla(${hue},90%,55%,.35)`);
    grd.addColorStop(1, `hsla(${hue},60%,8%,0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(W/2,H/2, r*1.25, 0, Math.PI*2); ctx.fill();

    // concentric rings
    ctx.lineWidth = 1.2;
    for(let i=0;i<5;i++){
      const rr = 120 + i*55 + 6*Math.sin(t*0.7+i);
      ctx.strokeStyle = `rgba(110,170,220,${0.08 + i*0.03})`;
      ctx.beginPath(); ctx.arc(W/2,H/2, rr, 0, Math.PI*2); ctx.stroke();
    }

    // drifting specks
    for(let i=0;i<26;i++){
      const a = (i/26)*Math.PI*2 + t*0.12 + i*0.33;
      const rr = 60 + (i%7)*35 + 12*Math.sin(t*0.6+i);
      const x = W/2 + Math.cos(a)*rr, y = H/2 + Math.sin(a)*rr;
      ctx.fillStyle = `rgba(180,230,255,${0.12+ (i%5)*0.05})`;
      ctx.beginPath(); ctx.arc(x,y,1.4 + (i%3)*0.5,0,Math.PI*2); ctx.fill();
    }

    requestAnimationFrame(()=>draw(t+0.016));
  }
  draw(0);

  // --------- Pollers ----------
  async function pollPrice(){
    try{
      const r = await fetch(`${API}/health`);
      const j = await r.json();
      const price = Number(j.price)||0;
      priceLabel.textContent = fmtUSD(price);
      updatedLabel.textContent = new Date(j.ts).toLocaleTimeString();

      // Slightly bias health toward price drift (purely aesthetic)
      const bias = Math.max(-0.01, Math.min(0.01, (price%0.02)-0.01));
      health = clamp01(health + bias*0.2);
      setHealth(health);
    }catch(e){ /* ignore */ }
  }

  async function pollTrades(){
    try{
      const r = await fetch(`${API}/trades`);
      const arr = await r.json();
      tradesBody.innerHTML = "";

      let buys=0, sells=0;
      arr.forEach(t=>{
        if(!t) return;
        const time = new Date(t.time||Date.now()).toLocaleTimeString();
        const type = (t.type||"buy").toLowerCase()==="buy" ? "Feed" : "Starve";
        const cls = type==="Feed" ? "feed" : "starve";
        const valueUsd = Number(t.valueUsd)||0;
        const priceUsd = Number(t.priceUsd)||0;
        if(type==="Feed") buys += valueUsd; else sells += valueUsd;

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="left">${time}</td>
          <td class="left ${cls}">${type}</td>
          <td class="left">${fmtUSD2(valueUsd)}</td>
          <td class="left">${fmtUSD(priceUsd)}</td>`;
        tradesBody.appendChild(tr);
      });

      // Net flow over ~5m (buys - sells)
      const net = (buys - sells);
      netWindow.push(net);
      if(netWindow.length>BUCKETS) netWindow.shift();
      const sum = netWindow.reduce((a,b)=>a+b,0);
      setFlow(sum);

      // Nudge vitals
      const delta = clamp(-0.06, 0.06, (sum/200)); // tame range
      setHealth( clamp01( health + delta ) );
      setMutation( clamp01( mutation + Math.abs(delta)*0.25 ) );
    }catch(e){ /* ignore */ }
  }

  function setHealth(x){
    health = x;
    healthBar.style.width = `${Math.round(health*100)}%`;
  }
  function setMutation(x){
    mutation = x;
    mutBar.style.width = `${Math.round(mutation*100)}%`;
  }
  function setFlow(sum){
    // map sum USD -> 0..100 bar centered
    const pct = clamp(-100,100, (sum/60)*100);  // -100..100
    const mid = 50 + (pct/2);                   // visual center shift
    flowBar.style.width = `${clamp(0,100,mid)}%`;
    flowBar.style.background = pct>=0
      ? "linear-gradient(90deg,#3eeea2,#2fe1f3)"
      : "linear-gradient(90deg,#ff6c6c,#ff9a6c)";
    flowLabel.textContent = pct>=0 ? "Feeding" : "Starving";
    flowLabel.className = pct>=0 ? "feed" : "starve";
  }
  const clamp = (a,b,x)=>Math.max(a,Math.min(b,x));
  const clamp01 = (x)=>clamp(0,1,x);

  // Decay tick gives a living feel
  setInterval(()=> setHealth(clamp01(health-0.01)), 10000);

  // Buttons
  document.getElementById("feedBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    setHealth(clamp01(health+0.06));
  });
  document.getElementById("sfxBtn").addEventListener("click", (e)=>{
    e.preventDefault();
    // placeholder – hook up audio later
  });

  // Kickoff
  pollPrice();  pollTrades();
  setInterval(pollPrice, 6000);
  setInterval(pollTrades, 6000);
})();
