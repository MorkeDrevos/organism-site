function drawOrganism(){
  const now = performance.now();
  const t = (now - t0)/1000;
  const W = canvas.width, H = canvas.height;

  ctx.clearRect(0,0,W,H);

  const cx = W*0.5, cy = H*0.38; // move higher on screen

  // translucent womb glow background
  const wombGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(W,H)*0.6);
  wombGrad.addColorStop(0, "rgba(40,80,100,0.25)");
  wombGrad.addColorStop(0.5, "rgba(20,40,60,0.18)");
  wombGrad.addColorStop(1, "rgba(5,10,15,0.05)");
  ctx.fillStyle = wombGrad;
  ctx.fillRect(0,0,W,H);

  // concentric rings (fluid layers)
  for(let i=0;i<8;i++){
    const r = 130 + i*65 + Math.sin(t*0.4+i)*6;
    const alpha = 0.05 + 0.05*Math.sin(t*0.7+i);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle = `rgba(180,230,255,${alpha})`;
    ctx.lineWidth = 1; ctx.stroke();
  }

  // drifting specks (particles)
  ctx.fillStyle = "rgba(160,200,255,0.25)";
  for(let i=0;i<25;i++){
    const a = i*17 + t*0.3 + i*0.2;
    const r = 80 + (i*29 % 260);
    const x = cx + Math.cos(a)*r*1.1;
    const y = cy + Math.sin(a*1.4)*r*0.6 + Math.sin(t+i*0.7)*3;
    ctx.beginPath();
    ctx.arc(x,y,1.2+(i%3)*0.6,0,Math.PI*2);
    ctx.fill();
  }

  // pulsing nucleus (cell)
  const base = 60 + 14*Math.sin(t*1.2 + HEALTH*3);
  const grad = ctx.createRadialGradient(cx,cy,0, cx,cy, base+60);
  grad.addColorStop(0, "rgba(100,200,180,0.9)");
  grad.addColorStop(0.6, "rgba(60,120,110,0.5)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, base+60, 0, Math.PI*2);
  ctx.fill();

  requestAnimationFrame(drawOrganism);
}
