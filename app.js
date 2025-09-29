function drawEmbryo(cx, cy, scale, t){
  const breath = (Math.sin(t*2*Math.PI*0.08)*0.5+0.5);
  const inflate = 1 + breath*0.05;

  // --- proportions ---
  const headR   = 50 * scale * inflate;
  const torsoW  = 70 * scale;
  const torsoH  = 100 * scale;
  const limbLen = 40 * scale;

  // --- head (big circle) ---
  ctx.beginPath();
  ctx.arc(cx, cy - torsoH*0.5, headR, 0, TAU);
  ctx.fillStyle = "rgba(255,210,220,0.2)";
  ctx.fill();
  ctx.strokeStyle = "#8de9ff";
  ctx.stroke();

  // eye
  const blink = ((t % 6) < 0.12) ? 0.2 : 1.0;
  ctx.beginPath();
  ctx.arc(cx, cy - torsoH*0.5, 8*scale*blink, 0, TAU);
  ctx.fillStyle = "#0b0f18";
  ctx.fill();

  // --- torso (ellipse) ---
  ctx.beginPath();
  ctx.ellipse(cx, cy + torsoH*0.1, torsoW*0.6, torsoH*0.5, 0, 0, TAU);
  ctx.fillStyle = "rgba(255,200,220,0.15)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.stroke();

  // --- arm buds ---
  ctx.beginPath();
  ctx.arc(cx - torsoW*0.5, cy, limbLen*0.25, 0, TAU);
  ctx.arc(cx + torsoW*0.5, cy, limbLen*0.25, 0, TAU);
  ctx.fillStyle = "rgba(200,230,255,0.25)";
  ctx.fill();

  // --- leg buds ---
  ctx.beginPath();
  ctx.arc(cx - torsoW*0.3, cy + torsoH*0.4, limbLen*0.3, 0, TAU);
  ctx.arc(cx + torsoW*0.3, cy + torsoH*0.4, limbLen*0.3, 0, TAU);
  ctx.fillStyle = "rgba(200,230,255,0.25)";
  ctx.fill();

  // --- umbilical cord ---
  ctx.beginPath();
  ctx.moveTo(cx, cy + torsoH*0.5);
  ctx.bezierCurveTo(cx-50*scale, cy+torsoH*0.8, cx-120*scale, cy+torsoH*1.0, cx-180*scale, cy+torsoH*0.7);
  ctx.lineWidth = 8*scale;
  ctx.strokeStyle = "rgba(255,180,160,0.4)";
  ctx.stroke();
}
