/**************************************
 * THE ORGANISM — embryo silhouette v3
 * clear anatomy: head/eye, neck/torso,
 * 2 arms + 2 legs (jointed), one cord.
 **************************************/

const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha: true });

function resize(){
  canvas.width  = innerWidth;
  canvas.height = innerHeight;
}
addEventListener("resize", resize);
resize();

/* ===== Palette (dark cosmos + neon bio-glow) ===== */
const PAL = {
  bg: "#0a0e16",
  vignHi: "rgba(0,0,0,0.00)",
  vignLo: "rgba(0,0,0,0.55)",
  star: "rgba(220,240,255,0.7)",

  skin: "rgba(190,220,255,0.16)",
  rimCool: "rgba(150,230,255,0.7)",
  rimHot: "rgba(255,120,220,0.55)",
  core: "rgba(255,255,255,0.95)",
  coreBloom: "rgba(170,220,255,0.25)",
  bone: "rgba(220,245,255,0.32)",
  claw: "rgba(230,250,255,0.9)",

  cordCore: "rgba(255,190,220,0.85)",
  cordHalo: "rgba(255,150,200,0.30)",

  ring: "rgba(120,180,220,0.12)"
};

const TAU = Math.PI*2;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=(t)=>0.5-0.5*Math.cos(Math.PI*t);

/* ===== Scene ===== */
function vignette(){
  ctx.fillStyle = PAL.bg;
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const g = ctx.createRadialGradient(canvas.width*0.5, canvas.height*0.6, canvas.height*0.25,
                                     canvas.width*0.5, canvas.height*0.6, canvas.height*0.95);
  g.addColorStop(0, PAL.vignHi);
  g.addColorStop(1, PAL.vignLo);
  ctx.fillStyle = g;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}
function stars(t){
  ctx.fillStyle = PAL.star;
  for (let i=0;i<48;i++){
    const x = (i*177 + Math.sin(t*0.07+i)*9999) % canvas.width;
    const y = (i*93  + Math.cos(t*0.06+i*2.1)*7777) % canvas.height;
    const s = 0.5 + 0.5*Math.max(0, Math.sin(t*0.9 + i));
    ctx.globalAlpha = 0.2 + 0.6*s;
    ctx.fillRect(x,y,1.2,1.2);
  }
  ctx.globalAlpha = 1;
}
function echoRings(cx,cy,scale,t){
  for (let i=0;i<7;i++){
    const r = 220*scale + i*36*scale + 6*scale*Math.sin(t*0.7+i);
    ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU);
    ctx.strokeStyle = PAL.ring; ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/* ===== Anatomy helpers ===== */
function capsule(x1,y1,x2,y2,r){
  const a = Math.atan2(y2-y1, x2-x1);
  ctx.beginPath();
  ctx.arc(x1,y1,r, a+Math.PI/2, a-Math.PI/2, true);
  ctx.arc(x2,y2,r, a-Math.PI/2, a+Math.PI/2, true);
  ctx.closePath();
}
function boneChain(ax,ay, seg, len, dir, t, wav=0.18){
  const pts=[[ax,ay]]; let x=ax,y=ay, a=dir;
  for (let i=0;i<seg;i++){
    a += (Math.sin(t*1.2+i*0.9)*wav);
    const L = len*(1 - i/(seg)*0.25);
    x += Math.cos(a)*L; y += Math.sin(a)*L;
    pts.push([x,y]);
  }
  return pts;
}
function drawLimb(pts, thick, glow, scale){
  for (let i=0;i<pts.length-1;i++){
    const [x1,y1]=pts[i], [x2,y2]=pts[i+1];
    const r = thick*(1 - i/(pts.length-1)*0.35);
    // glow shell
    ctx.save();
    ctx.shadowColor = glow; ctx.shadowBlur = 10*scale;
    ctx.fillStyle = PAL.skin; ctx.globalAlpha = 0.95;
    capsule(x1,y1,x2,y2,r); ctx.fill();
    ctx.restore();
    // rim
    ctx.strokeStyle = PAL.rimCool; ctx.lineWidth = 1.2*scale; ctx.globalAlpha=0.9;
    capsule(x1,y1,x2,y2,r); ctx.stroke();
  }
  // tiny claw
  const [hx,hy]=pts.at(-1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.claw;
  ctx.beginPath();
  ctx.moveTo(hx,hy);
  ctx.lineTo(hx+6*scale, hy+2*scale);
  ctx.lineTo(hx+2*scale, hy-6*scale);
  ctx.closePath();
  ctx.fill();
}

/* ===== Creature ===== */
function drawTail(ax,ay, t, scale){
  const L = 320*scale, sway = Math.sin(t*0.35)*40*scale;
  const bx = ax - L*0.42, by = ay + L*0.12 + sway*0.4;
  const cx = ax - L*0.92, cy = ay - L*0.08 + sway;

  ctx.lineCap = "round";
  ctx.lineWidth = 14*scale;
  ctx.strokeStyle = PAL.cordHalo;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,cx,cy); ctx.stroke();

  ctx.lineWidth = 6*scale;
  ctx.strokeStyle = PAL.cordCore;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,cx,cy); ctx.stroke();

  // glowing tip
  ctx.fillStyle = PAL.cordCore;
  ctx.beginPath(); ctx.arc(ax,ay, 5*scale, 0, TAU); ctx.fill();
}

function drawEye(cx,cy,r,t){
  const irisR = r*0.58*(1+0.06*Math.sin(t*0.8));
  const pupilR = r*0.28;
  const g = ctx.createRadialGradient(cx,cy,irisR*0.2, cx,cy,irisR);
  g.addColorStop(0, "rgba(220,245,255,0.95)");
  g.addColorStop(1, "rgba(60,120,200,0.06)");
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,irisR,0,TAU); ctx.fill();
  ctx.fillStyle="rgba(8,12,18,0.96)"; ctx.beginPath(); ctx.arc(cx,cy,pupilR,0,TAU); ctx.fill();
  // spec
  ctx.fillStyle = `rgba(255,255,255,${0.55 + 0.35*Math.max(0,Math.sin(t*2.1))})`;
  ctx.beginPath(); ctx.ellipse(cx-pupilR*0.45, cy-pupilR*0.55, pupilR*0.36, pupilR*0.22, -0.5, 0, TAU); ctx.fill();
}

function drawRibs(cx,cy,baseR,t,scale){
  ctx.strokeStyle = PAL.bone; ctx.lineWidth = 2*scale;
  for (let i=0;i<6;i++){
    const rr = baseR + i*12*scale + 4*scale*Math.sin(t*0.9+i*0.6);
    ctx.beginPath(); ctx.arc(cx,cy, rr, Math.PI*0.12, Math.PI*0.88);
    ctx.stroke();
  }
}

function drawCreature(cx,cy,t,scale){
  const breathe = 1 + 0.07*Math.sin(t*0.8);

  // torso (ellipse)
  const tw = 210*scale*breathe, th = 150*scale*breathe;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.06*Math.sin(t*0.6));
  ctx.beginPath();
  ctx.ellipse(0, 16*scale, tw*0.52, th*0.52, 0, 0, TAU);
  ctx.fillStyle = PAL.skin; ctx.fill();

  // bloom core
  const g = ctx.createRadialGradient(0,0, 8*scale, 0,0, 170*scale);
  g.addColorStop(0, PAL.core);
  g.addColorStop(1, PAL.coreBloom);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 0, 48*scale, 48*scale, 0,0,TAU); ctx.fill();

  // ribs
  drawRibs(cx, cy+14*scale, 78*scale, t, scale);

  // head
  const hx = cx, hy = cy - 68*scale;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 70*scale, 62*scale, 0, 0, TAU);
  ctx.fillStyle = PAL.skin; ctx.fill();

  // cool/hot rims
  ctx.globalAlpha=0.9; ctx.lineWidth=2*scale;
  ctx.strokeStyle = PAL.rimCool; ctx.beginPath(); ctx.ellipse(hx,hy,70*scale,62*scale,0,0,TAU); ctx.stroke();
  ctx.globalAlpha=0.6; ctx.strokeStyle = PAL.rimHot; ctx.beginPath(); ctx.ellipse(0,16*scale, tw*0.52, th*0.52,0,0,TAU); ctx.stroke();
  ctx.globalAlpha=1;

  // eye
  drawEye(hx, hy, 48*scale, t);

  // limbs (2 arms, 2 legs)
  const tJ = t*0.8;
  const armL = boneChain(cx-62*scale, cy-6*scale, 3, 36*scale, -Math.PI*0.7, tJ, 0.18);
  const armR = boneChain(cx+62*scale, cy+2*scale, 3, 36*scale,  Math.PI*0.8, tJ+0.6, 0.18);
  const legL = boneChain(cx-48*scale, cy+50*scale, 3, 38*scale,  Math.PI*0.9, tJ+0.2, 0.14);
  const legR = boneChain(cx+46*scale, cy+52*scale, 3, 38*scale, -Math.PI*0.9, tJ+0.9, 0.14);

  drawLimb(armL, 12*scale, PAL.rimCool, scale);
  drawLimb(armR, 12*scale, PAL.rimHot,  scale);
  drawLimb(legL, 13*scale, PAL.rimCool, scale);
  drawLimb(legR, 13*scale, PAL.rimHot,  scale);

  ctx.restore();

  // single cord (belly)
  drawTail(cx-6*scale, cy+26*scale, t, scale);
}

/* ===== Loop ===== */
let t0 = performance.now();
function frame(){
  const t = (performance.now()-t0)/1000;
  vignette();
  stars(t);

  const cx = canvas.width*0.5;
  const cy = canvas.height*0.58;
  const scale = Math.min(canvas.width, canvas.height)/900;

  // depth: rings behind, creature on top
  echoRings(cx,cy,scale,t);
  drawCreature(cx,cy,t,scale);

  requestAnimationFrame(frame);
}
frame();
