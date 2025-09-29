/*************************
 * ORGANISM — Embryo v2  *
 * head/torso/limbs/tail *
 *************************/

const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
addEventListener("resize", resize);

/* --------- Palette (dark cosmos + aqua/magenta bioluminescence) --------- */
const PAL = {
  bg:      "#0a0e16",
  vignHi:  "rgba(0,0,0,0.00)",
  vignLo:  "rgba(0,0,0,0.55)",
  star:    "rgba(220,240,255,0.75)",
  skin:    "rgba(210,230,255,0.12)",        // translucent “skin”
  subsurf: "rgba(90,150,230,0.18)",         // subsurface tint
  rimA:    "rgba(180,230,255,0.55)",        // cool rim
  rimB:    "rgba(255,120,220,0.35)",        // magenta rim
  coreA:   "rgba(255,255,255,0.95)",        // bright nucleus
  coreB:   "rgba(160,220,255,0.20)",        // outer bloom
  aqua:    "#6bd7ff",
  mag:     "#de5bd7",
  cord:    "rgba(255,200,220,0.75)",
  cordHalo:"rgba(255,160,200,0.25)",
  bone:    "rgba(210,235,255,0.28)",
  claw:    "rgba(220,245,255,0.85)"
};

const TAU = Math.PI*2;
const clamp = (v,lo=0,hi=1)=>Math.max(lo,Math.min(hi,v));
const lerp  = (a,b,t)=>a+(b-a)*t;
const ease  = t => 0.5 - 0.5*Math.cos(Math.PI*t);

/* --------- Motion knobs --------- */
const K = {
  breatheHz: 0.08,    // whole body breath
  pulseHz:   0.9,     // sparkle/glint
  swayHz:    0.025,   // gentle drift
  blinkHz:   0.03,
  scale:     1.0
};

/* --------- Scene utilities --------- */
function vignette() {
  const g = ctx.createRadialGradient(canvas.width*0.5, canvas.height*0.6, canvas.height*0.25,
                                     canvas.width*0.5, canvas.height*0.6, canvas.height*0.9);
  g.addColorStop(0, PAL.vignHi);
  g.addColorStop(1, PAL.vignLo);
  ctx.fillStyle = PAL.bg; ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
}

function stars(t) {
  ctx.fillStyle = PAL.star;
  for (let i=0;i<42;i++){
    const x = (i*173 + Math.sin(t*0.05+i)*9999) % canvas.width;
    const y = (i*97  + Math.cos(t*0.04+i*2)*7777) % canvas.height;
    const s = 0.6 + 0.6*Math.max(0, Math.sin(t*0.6 + i));
    ctx.globalAlpha = 0.25 + 0.55*s;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  ctx.globalAlpha = 1;
}

/* --------- Primitive: rounded capsule + bone chains --------- */
function capsule(x1,y1,x2,y2,r){
  const ang = Math.atan2(y2-y1,x2-x1);
  const dx = Math.cos(ang), dy = Math.sin(ang);
  ctx.beginPath();
  ctx.arc(x1,y1,r,ang+Math.PI/2, ang-Math.PI/2, true);
  ctx.arc(x2,y2,r,ang-Math.PI/2, ang+Math.PI/2, true);
  ctx.closePath();
}
function boneChain(ax,ay, seg, len, spread, t, jitter=0.0){
  // returns joint positions for a simple IK-ish wavy limb
  const pts = [[ax,ay]];
  let x=ax, y=ay, dir = spread;
  for (let i=0;i<seg;i++){
    const w = (Math.sin(t*0.8 + i*0.9)+1)*0.5;
    dir += spread*0.15 + (jitter? (Math.sin(t*1.3+i*2.7)*jitter):0);
    x += Math.cos(dir)*len*(0.92 - i*0.12);
    y += Math.sin(dir)*len*(0.92 - i*0.12);
    pts.push([x,y]);
    dir += (w-0.5)*0.35;
  }
  return pts;
}

/* --------- Anatomy drawing --------- */
function drawTail(ax,ay, t, scale){
  // segmented tail/umbilical — glowing tip
  const L = 280*scale, sway = Math.sin(t*K.swayHz*TAU)*60*scale;
  const bx = ax - L*0.42, by = ay + L*0.10 + sway*0.25;
  const cx = ax - L*0.95, cy = ay - L*0.05 + sway;

  // halo
  ctx.lineCap="round";
  ctx.lineWidth = 14*scale;
  ctx.strokeStyle = PAL.cordHalo;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,cx,cy); ctx.stroke();

  // core
  ctx.lineWidth = 6*scale;
  ctx.strokeStyle = PAL.cord;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,cx,cy); ctx.stroke();

  ctx.fillStyle = PAL.cord;
  ctx.beginPath(); ctx.arc(ax,ay, 5*scale, 0, TAU); ctx.fill();
}

function drawEye(cx,cy,r,t){
  const irisR = r*0.55*(1+0.06*Math.sin(t*K.breatheHz*TAU));
  const pupilR = r*0.27;
  const g = ctx.createRadialGradient(cx,cy,irisR*0.2, cx,cy,irisR);
  g.addColorStop(0, "rgba(210,240,255,0.9)");
  g.addColorStop(1, "rgba(60,120,200,0.05)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx,cy,irisR,0,TAU); ctx.fill();
  ctx.fillStyle = "rgba(8,10,16,0.95)"; ctx.beginPath(); ctx.arc(cx,cy,pupilR,0,TAU); ctx.fill();

  // spec glint
  const gl = 0.45 + 0.35*Math.max(0, Math.sin(t*K.pulseHz*TAU));
  ctx.fillStyle = `rgba(255,255,255,${0.65*gl})`;
  ctx.beginPath();
  ctx.ellipse(cx-pupilR*0.4, cy-pupilR*0.5, pupilR*0.35, pupilR*0.22, -0.5, 0, TAU);
  ctx.fill();
}

function drawRibs(cx,cy,r,t,scale){
  ctx.strokeStyle = PAL.bone;
  ctx.lineWidth = 2*scale;
  for (let i=0;i<6;i++){
    const rr = r*0.65 + i*10*scale + 3*scale*Math.sin(t*0.9+i);
    ctx.beginPath(); ctx.arc(cx,cy, rr, Math.PI*0.15, Math.PI*0.85);
    ctx.stroke();
  }
}

function drawLimb(pts, thickness, glow, scale){
  // draw caps between joints
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1]=pts[i], [x2,y2]=pts[i+1];
    const r = thickness*(1 - i/(pts.length-1)*0.35);
    // glow outline
    ctx.save();
    ctx.shadowColor = glow; ctx.shadowBlur = 12*scale;
    ctx.fillStyle = PAL.skin; ctx.globalAlpha = 0.9;
    capsule(x1,y1,x2,y2,r); ctx.fill();
    ctx.restore();

    // rim
    ctx.strokeStyle = PAL.rimA; ctx.lineWidth = 1.25*scale; ctx.globalAlpha=0.9;
    capsule(x1,y1,x2,y2,r); ctx.stroke();
  }
  // tiny claw
  const [hx,hy]=pts.at(-1);
  ctx.fillStyle=PAL.claw;
  ctx.beginPath(); ctx.moveTo(hx,hy);
  ctx.lineTo(hx+6*scale, hy+2*scale);
  ctx.lineTo(hx+2*scale, hy-6*scale);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha=1;
}

function drawBody(cx, cy, t, scale){
  const breathe = 1 + 0.06*Math.sin(t*K.breatheHz*TAU);

  // Torso silhouette (capsule)
  const torsoW = 180*scale*breathe, torsoH = 125*scale*breathe;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.03*Math.sin(t*0.6));
  ctx.beginPath();
  ctx.ellipse(0, 12*scale, torsoW*0.55, torsoH*0.55, 0, 0, TAU);
  ctx.closePath();
  ctx.fillStyle = PAL.skin;   ctx.fill();

  // subsurface core
  const sg = ctx.createRadialGradient(0,0, 10*scale, 0,0, 180*scale);
  sg.addColorStop(0, PAL.coreA);
  sg.addColorStop(1, PAL.coreB);
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(0, 0, 50*scale, 50*scale, 0,0,TAU); ctx.fill();

  // ribs/vertebra hint
  drawRibs(cx, cy+10*scale, 80*scale, t, scale);

  // Head (bulb) + eye
  const headX = cx, headY = cy - 58*scale;
  ctx.beginPath();
  ctx.ellipse(headX, headY, 65*scale, 58*scale, 0, 0, TAU);
  ctx.fillStyle = PAL.skin; ctx.fill();

  // rim lights
  ctx.strokeStyle = PAL.rimA; ctx.lineWidth = 2*scale; ctx.globalAlpha=0.9;
  ctx.beginPath(); ctx.ellipse(headX, headY, 65*scale, 58*scale, 0, 0, TAU); ctx.stroke();
  ctx.strokeStyle = PAL.rimB; ctx.globalAlpha=0.6;
  ctx.beginPath(); ctx.ellipse(cx, cy+12*scale, torsoW*0.55, torsoH*0.55, 0, 0, TAU); ctx.stroke();
  ctx.globalAlpha=1;

  // eye
  drawEye(headX, headY, 46*scale, t);

  // Limb buds (2 arms / 2 legs) with joints
  const armBaseL = [cx - 58*scale, cy - 4*scale];
  const armBaseR = [cx + 58*scale, cy + 2*scale];
  const legBaseL = [cx - 44*scale, cy + 46*scale];
  const legBaseR = [cx + 42*scale, cy + 48*scale];

  const tJ = t*0.7;
  const armL = boneChain(armBaseL[0], armBaseL[1], 3, 34*scale, -Math.PI*0.65, tJ, 0.08);
  const armR = boneChain(armBaseR[0], armBaseR[1], 3, 34*scale,  Math.PI*0.75, tJ+0.6, 0.08);
  const legL = boneChain(legBaseL[0], legBaseL[1], 3, 36*scale,  Math.PI*0.85, tJ+0.2, 0.06);
  const legR = boneChain(legBaseR[0], legBaseR[1], 3, 36*scale, -Math.PI*0.85, tJ+0.9, 0.06);

  drawLimb(armL, 11*scale, "rgba(150,220,255,0.45)", scale);
  drawLimb(armR, 11*scale, "rgba(255,160,230,0.45)", scale);
  drawLimb(legL, 12*scale, "rgba(150,220,255,0.35)", scale);
  drawLimb(legR, 12*scale, "rgba(255,160,230,0.35)", scale);

  ctx.restore();

  // Tail/umbilical attaches slightly under belly
  drawTail(cx-6*scale, cy+22*scale, t, scale);
}

function echoMembrane(cx,cy,t,scale){
  // circular echo rings behind the body for depth
  for (let i=0;i<7;i++){
    const r = 120*scale + i*26*scale + 5*scale*Math.sin(t*0.7+i);
    ctx.beginPath(); ctx.arc(cx,cy, r, 0, TAU);
    ctx.strokeStyle = `rgba(120,200,255,${0.11 - i*0.012})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/* --------- Main loop --------- */
let t0 = performance.now();
function draw() {
  const now = performance.now();
  const t = (now - t0) / 1000;

  // background
  vignette();
  stars(t);

  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.58;
  const scale = Math.min(canvas.width, canvas.height)/900 * K.scale;

  // parallax sway
  ctx.save();
  const drift = Math.sin(t*K.swayHz*TAU)*8*scale;
  ctx.translate(drift, -drift*0.6);

  // depth order
  echoMembrane(cx, cy, t, scale);   // back
  drawBody(cx, cy, t, scale);       // organism

  ctx.restore();

  requestAnimationFrame(draw);
}
draw();
