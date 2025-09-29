/******************************************************************
 * THE ORGANISM — clear embryo silhouette (head, torso, limbs)
 * One cord, breathing, eye blink, limb micro-sway. All procedural.
 ******************************************************************/
const canvas = document.getElementById("org-canvas");
const ctx = canvas.getContext("2d", { alpha:true });

function resize(){
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener("resize", resize); resize();

/* ---------- Palette ---------- */
const PAL = {
  space: "#070b12",
  star: "rgba(210,235,255,.7)",
  haze1: "rgba(80,20,120,.12)",
  haze2: "rgba(0,140,220,.10)",

  skinFill: "rgba(210,225,245,0.14)",   // soft translucent
  rimCool:  "rgba(150,230,255,0.9)",    // aqua rim
  rimHot:   "rgba(255,120,220,0.55)",   // magenta rim
  inner:    "rgba(240,250,255,0.25)",   // inner soft fill
  bone:     "rgba(230,245,255,0.35)",   // ribs/vertebra hint

  eyeIris:  "rgba(190,220,255,.9)",
  eyePupil: "rgba(8,12,18,.96)",
  eyeSpec:  "rgba(255,255,255,.75)",

  cordCore: "rgba(255,185,215,.85)",
  cordHalo: "rgba(255,150,200,.30)"
};
const TAU = Math.PI*2;
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));

/* ---------- Backdrop: stars + echo rings ---------- */
function stars(t){
  ctx.fillStyle = PAL.star;
  for(let i=0;i<56;i++){
    const x = (i*157 + Math.sin(t*0.07+i*3.1)*9999) % canvas.width;
    const y = (i* 91 + Math.cos(t*0.06+i*2.3)*7777) % canvas.height;
    const s = 0.35 + 0.65*Math.max(0, Math.sin(t*0.9 + i));
    ctx.globalAlpha = 0.12 + 0.7*s;
    ctx.fillRect((x+canvas.width)%canvas.width,(y+canvas.height)%canvas.height,1.2,1.2);
  }
  ctx.globalAlpha = 1;
}
function echo(cx,cy,scale,t){
  ctx.lineWidth = 2*scale;
  for(let i=0;i<7;i++){
    const r = 220*scale + i*36*scale + Math.sin(t*0.7+i)*6*scale;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,TAU);
    ctx.strokeStyle = `rgba(120,180,220,${0.14 - i*0.012})`;
    ctx.stroke();
  }
}

/* ---------- Utility: draw a rounded capsule ---------- */
function capsule(x1,y1,x2,y2,r){
  const a = Math.atan2(y2-y1,x2-x1);
  ctx.beginPath();
  ctx.arc(x1,y1,r, a+Math.PI/2, a-Math.PI/2, true);
  ctx.arc(x2,y2,r, a-Math.PI/2, a+Math.PI/2, true);
  ctx.closePath();
}

/* ---------- Limb chain ---------- */
function limb(baseX,baseY, seg, len, dir, t, wave, thickness, scale, glowColor){
  let x=baseX, y=baseY, a=dir;
  const pts=[[x,y]];
  for(let i=0;i<seg;i++){
    a += Math.sin(t*1.1 + i*0.9)*wave;
    const L = len*(1 - i/seg*0.25);
    x += Math.cos(a)*L;
    y += Math.sin(a)*L;
    pts.push([x,y]);
  }
  for(let i=0;i<pts.length-1;i++){
    const [ax,ay]=pts[i], [bx,by]=pts[i+1];
    const r = thickness*(1 - i/(pts.length-1)*0.4);
    ctx.save();
    ctx.shadowColor = glowColor; ctx.shadowBlur = 8*scale;
    ctx.fillStyle = PAL.skinFill; ctx.globalAlpha=0.95;
    capsule(ax,ay,bx,by,r); ctx.fill();
    ctx.restore();

    ctx.globalAlpha=0.9; ctx.lineWidth=1.2*scale;
    ctx.strokeStyle = glowColor;
    capsule(ax,ay,bx,by,r); ctx.stroke();
  }
  // small claw hint
  const [hx,hy]=pts.at(-1);
  ctx.globalAlpha=1; ctx.fillStyle="rgba(240,250,255,.9)";
  ctx.beginPath();
  ctx.moveTo(hx,hy);
  ctx.lineTo(hx+4*scale, hy+1.5*scale);
  ctx.lineTo(hx+1.5*scale, hy-4*scale);
  ctx.closePath(); ctx.fill();
}

/* ---------- Umbilical ---------- */
function cord(ax,ay,t,scale){
  const L = 320*scale, sway = Math.sin(t*0.35)*40*scale;
  const bx = ax - L*0.42, by = ay + L*0.10 + sway*0.40;
  const cx = ax - L*0.92, cy = ay - L*0.08 + sway;

  ctx.lineCap="round";
  ctx.lineWidth = 14*scale;
  ctx.strokeStyle = PAL.cordHalo;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,cx,cy); ctx.stroke();

  ctx.lineWidth = 6*scale;
  ctx.strokeStyle = PAL.cordCore;
  ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(bx,by,cx,cy); ctx.stroke();

  ctx.fillStyle = PAL.cordCore;
  ctx.beginPath(); ctx.arc(ax,ay, 5*scale, 0, TAU); ctx.fill();
}

/* ---------- Eye ---------- */
function eye(cx,cy,r,t){
  const irisR = r*0.56*(1+0.06*Math.sin(t*0.8));
  ctx.fillStyle = PAL.eyeIris;
  ctx.beginPath(); ctx.arc(cx,cy,irisR,0,TAU); ctx.fill();

  // pupil + blink
  let blink = Math.max(0, Math.sin(t*2.4 + Math.sin(t*0.7))*0.9);
  blink = blink>0.85 ? (1 - (blink-0.85)/0.15) : 1; // occasional quick blink
  const pupilR = r*0.28*blink;
  ctx.fillStyle = PAL.eyePupil;
  ctx.beginPath(); ctx.arc(cx,cy,pupilR,0,TAU); ctx.fill();

  // specular
  ctx.fillStyle = PAL.eyeSpec;
  ctx.beginPath();
  ctx.ellipse(cx-pupilR*0.45, cy-pupilR*0.55, pupilR*0.36, pupilR*0.22, -0.5, 0, TAU);
  ctx.fill();
}

/* ---------- Ribs / vertebra hints ---------- */
function ribs(cx,cy,baseR,t,scale){
  ctx.strokeStyle = PAL.bone; ctx.lineWidth = 2*scale;
  for(let i=0;i<6;i++){
    const rr = baseR + i*12*scale + 4*scale*Math.sin(t*0.9+i*0.6);
    ctx.beginPath(); ctx.arc(cx,cy, rr, Math.PI*0.15, Math.PI*0.85);
    ctx.stroke();
  }
}

/* ---------- Creature silhouette (clear anatomy) ---------- */
function creature(cx,cy,t,scale){
  const breathe = 1 + 0.07*Math.sin(t*0.8);

  // torso
  const tw = 210*scale*breathe, th = 150*scale*breathe;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(0.06*Math.sin(t*0.6));
  ctx.beginPath();
  ctx.ellipse(0, 16*scale, tw*0.52, th*0.52, 0, 0, TAU);
  ctx.fillStyle = PAL.skinFill; ctx.fill();

  // inner glow
  const g = ctx.createRadialGradient(0,0, 8*scale, 0,0, 170*scale);
  g.addColorStop(0, "rgba(255,255,255,.95)");
  g.addColorStop(1, PAL.inner);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(0, 2*scale, 48*scale, 48*scale, 0, 0, TAU); ctx.fill();

  // ribs
  ribs(cx, cy+14*scale, 78*scale, t, scale);

  // head (large)
  const hx = cx, hy = cy - 68*scale;
  ctx.beginPath();
  ctx.ellipse(hx, hy, 70*scale, 62*scale, 0, 0, TAU);
  ctx.fillStyle = PAL.skinFill; ctx.fill();

  // rims
  ctx.globalAlpha=0.95; ctx.lineWidth=2*scale;
  ctx.strokeStyle = PAL.rimCool; ctx.beginPath(); ctx.ellipse(hx,hy,70*scale,62*scale,0,0,TAU); ctx.stroke();
  ctx.globalAlpha=0.6; ctx.strokeStyle = PAL.rimHot; ctx.beginPath(); ctx.ellipse(0,16*scale, tw*0.52, th*0.52,0,0,TAU); ctx.stroke();
  ctx.globalAlpha=1;

  // eye
  eye(hx, hy, 48*scale, t);

  // limbs (2 arms, 2 legs) — jointed with slight sway
  const tJ = t*0.8;
  const armLdir = -Math.PI*0.75, armRdir =  Math.PI*0.85;
  const legLdir =  Math.PI*0.95, legRdir = -Math.PI*0.95;

  limb(cx-62*scale, cy-6*scale, 3, 36*scale, armLdir, tJ, 0.18, 12*scale, scale, PAL.rimCool);
  limb(cx+62*scale, cy+2*scale, 3, 36*scale, armRdir, tJ+0.6, 0.18, 12*scale, scale, PAL.rimHot);
  limb(cx-48*scale, cy+50*scale, 3, 38*scale, legLdir, tJ+0.2, 0.14, 13*scale, scale, PAL.rimCool);
  limb(cx+46*scale, cy+52*scale, 3, 38*scale, legRdir, tJ+0.9, 0.14, 13*scale, scale, PAL.rimHot);

  ctx.restore();

  // umbilical (single)
  cord(cx-6*scale, cy+26*scale, t, scale);
}

/* ---------- Main loop ---------- */
let t0 = performance.now();
function draw(){
  const t = (performance.now()-t0)/1000;

  // background
  ctx.fillStyle = PAL.space;
  ctx.fillRect(0,0,canvas.width,canvas.height);

  // subtle nebula curtains
  ctx.globalAlpha = 1;
  let x = canvas.width*0.82 + Math.sin(t*0.12)*18;
  const grad = ctx.createLinearGradient(x,0, x-260,canvas.height);
  grad.addColorStop(0, PAL.haze1);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle=grad; ctx.fillRect(0,0,canvas.width,canvas.height);

  x = canvas.width*0.12 + Math.cos(t*0.10)*22;
  const grad2 = ctx.createLinearGradient(x,0, x+240,canvas.height);
  grad2.addColorStop(0, PAL.haze2);
  grad2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle=grad2; ctx.fillRect(0,0,canvas.width,canvas.height);

  // stars & echo rings
  stars(t);
  const cx = canvas.width*0.5;
  const cy = canvas.height*0.58;
  const scale = Math.min(canvas.width, canvas.height)/900;
  echo(cx,cy,scale,t);

  // creature
  creature(cx,cy,t,scale);

  requestAnimationFrame(draw);
}
draw();
