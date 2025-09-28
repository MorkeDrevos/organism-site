const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// --- Animation state ---
let t = 0;
const motes = Array.from({ length: 20 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: 1 + Math.random() * 2,
  dx: (Math.random() - 0.5) * 0.3,
  dy: (Math.random() - 0.5) * 0.3
}));

function drawOrganism() {
  t += 0.01;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // amniotic fluid gradient
  const g = ctx.createRadialGradient(
    canvas.width/2, canvas.height/2, 50,
    canvas.width/2, canvas.height/2, canvas.width/1.2
  );
  g.addColorStop(0, "rgba(0, 80, 120, 0.25)");
  g.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // ripple distortion
  ctx.strokeStyle = "rgba(0,150,200,0.08)";
  ctx.lineWidth = 2;
  for (let i=0;i<8;i++) {
    const r = 120 + i*40 + Math.sin(t*0.7 + i) * 10;
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, r, 0, Math.PI*2);
    ctx.stroke();
  }

  // nucleus pulse
  const pulse = 40 + Math.sin(t*2.1) * 6 + Math.sin(t*0.37) * 3;
  ctx.beginPath();
  ctx.fillStyle = "rgba(0,180,255,0.7)";
  ctx.shadowBlur = 40;
  ctx.shadowColor = "rgba(0,200,255,0.9)";
  ctx.arc(canvas.width/2, canvas.height/2, pulse, 0, Math.PI*2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // motes drifting
  ctx.fillStyle = "rgba(200,255,255,0.5)";
  motes.forEach(m => {
    m.x += m.dx + Math.sin(t + m.y*0.01) * 0.15;
    m.y += m.dy + Math.cos(t + m.x*0.01) * 0.15;

    if (m.x<0) m.x=canvas.width;
    if (m.x>canvas.width) m.x=0;
    if (m.y<0) m.y=canvas.height;
    if (m.y>canvas.height) m.y=0;

    ctx.beginPath();
    ctx.arc(m.x,m.y,m.r,0,Math.PI*2);
    ctx.fill();
  });

  requestAnimationFrame(drawOrganism);
}

drawOrganism();
