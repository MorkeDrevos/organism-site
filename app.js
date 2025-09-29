/* ========= Scene ========= */
const root = document.getElementById('app');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x060913, 40, 220);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
camera.position.set(0, 0.9, 7.5);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x060913, 1);
root.appendChild(renderer.domElement);

/* ========= Post FX (bloom) ========= */
const composer = new THREE.EffectComposer(renderer);
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(1,1), 0.8, 0.8, 0.85);
composer.addPass(bloom);

/* ========= Lights ========= */
const hemi = new THREE.HemisphereLight(0x88baff, 0x28122f, 0.7);
scene.add(hemi);

const key = new THREE.SpotLight(0xaad8ff, 1.35, 0, Math.PI/6, 0.4, 1.5);
key.position.set(3, 6, 8);
scene.add(key);

const fill = new THREE.PointLight(0xff66dd, 0.5, 0);
fill.position.set(-6, -2, -4);
scene.add(fill);

/* ========= Palette ========= */
const PAL = {
  skin:   new THREE.Color('#e4ecff'),
  rim:    new THREE.Color('#8de9ff'),
  mag:    new THREE.Color('#ff83dd'),
  cord:   new THREE.Color('#ff9fd6'),
  eye:    new THREE.Color('#0b0f18'),
  iris:   new THREE.Color('#98c5ff'),
  haze:   new THREE.Color('#1a223a'),
};

/* ========= Helpers ========= */
function makeMat({color=0xffffff, emissive=0x000000, metalness=0.05, roughness=0.4, transmission=0, opacity=1}={}){
  const m = new THREE.MeshPhysicalMaterial({
    color, emissive, metalness, roughness, clearcoat:0.6, clearcoatRoughness:0.3,
    transmission, transparent: opacity<1, opacity, sheen:1, sheenRoughness:0.7,
  });
  return m;
}
function easeOutSine(x){ return Math.sin((x*Math.PI)/2); }
function rnd(a,b){ return a + Math.random()*(b-a); }

/* ========= Organism Group ========= */
const organism = new THREE.Group();
scene.add(organism);

/* ---- Torso (slightly translucent) ---- */
const torsoGeo = new THREE.SphereGeometry(1.1, 42, 42);
torsoGeo.scale(1.3, 0.9, 1.1);
const torsoMat = makeMat({ color: PAL.skin, roughness:0.55, transmission:0.25, opacity:0.9 });
const torso = new THREE.Mesh(torsoGeo, torsoMat);
torso.position.set(0, 0, 0);
organism.add(torso);

/* ---- Head (big, bright) ---- */
const headGeo = new THREE.SphereGeometry(0.75, 48, 48);
const headMat  = makeMat({ color:0xffffff, emissive:0x263a55, roughness:0.25, transmission:0.35, opacity:0.95 });
const head = new THREE.Mesh(headGeo, headMat);
head.position.set(0.2, 0.65, 0.1);
organism.add(head);

/* Iris + pupil */
const irisGeo = new THREE.SphereGeometry(0.12, 24, 24);
const irisMat = new THREE.MeshStandardMaterial({ color: PAL.iris, emissive:0x223b77, roughness:0.2, metalness:0.1 });
const iris = new THREE.Mesh(irisGeo, irisMat);
iris.position.set(0.36, 0.65, 0.35);
organism.add(iris);

const pupilGeo = new THREE.SphereGeometry(0.06, 22, 22);
const pupilMat = new THREE.MeshStandardMaterial({ color: PAL.eye, roughness:0.7 });
const pupil = new THREE.Mesh(pupilGeo, pupilMat);
pupil.position.copy(iris.position).add(new THREE.Vector3(0, 0, 0.04));
organism.add(pupil);

/* ---- Limb buds (4) – tapered capsules ---- */
function limb(length=1.2, thickness=0.09){
  const g = new THREE.CapsuleGeometry(thickness, length, 12, 24);
  const m = new THREE.MeshStandardMaterial({ color: 0xf5d5ff, roughness:0.6, metalness:0.05, emissive:0x331433, emissiveIntensity:0.3 });
  const mesh = new THREE.Mesh(g, m);
  return mesh;
}
const armL = limb(1.1); armL.rotation.z =  0.9; armL.position.set(-0.6,  0.1, 0.4);
const armR = limb(1.0); armR.rotation.z = -1.0; armR.position.set( 0.75, 0.05, 0.2);
const legL = limb(1.2); legL.rotation.z =  1.6; legL.position.set(-0.5,-0.65, 0.2);
const legR = limb(1.15);legR.rotation.z = -1.6; legR.position.set( 0.5,-0.7,  0.2);
organism.add(armL, armR, legL, legR);

/* ---- Umbilical cord (animated tube) ---- */
let cordCurve;
let cordTube;
const cordMat = new THREE.MeshStandardMaterial({
  color: PAL.cord, emissive:0x551b3f, emissiveIntensity:0.6, roughness:0.5, metalness:0.05
});
function buildCord(){
  if (cordTube) organism.remove(cordTube);
  const pts = [];
  const attach = new THREE.Vector3(-0.25, -0.25, 0.2); // belly
  const p1 = attach.clone().add(new THREE.Vector3(-0.6, -0.05, 0.0));
  const p2 = attach.clone().add(new THREE.Vector3(-1.5,  0.15, 0.1));
  const tip= attach.clone().add(new THREE.Vector3(-2.8,  0.05, -0.1));
  pts.push(attach, p1, p2, tip);
  cordCurve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(cordCurve, 80, 0.06, 16, false);
  cordTube = new THREE.Mesh(geo, cordMat);
  organism.add(cordTube);
}
buildCord();

/* ---- Subtle “ribs” lines (wire) ---- */
const ribs = new THREE.Group();
for(let i=0;i<6;i++){
  const r = 0.55 + i*0.06;
  const ring = new THREE.TorusGeometry(r, 0.003, 8, 80);
  const mat  = new THREE.MeshBasicMaterial({ color:0xbfd9ff, transparent:true, opacity:0.08 });
  const mesh = new THREE.Mesh(ring, mat);
  mesh.rotation.x = Math.PI/2.8;
  ribs.add(mesh);
}
ribs.position.set(-0.1, -0.1, 0.05);
organism.add(ribs);

/* ---- Echo rings around organism (world space) ---- */
const rings = new THREE.Group();
for(let i=0;i<7;i++){
  const r = 2.0 + i*0.45;
  const ring = new THREE.TorusGeometry(r, 0.0035, 8, 160);
  const mat  = new THREE.MeshBasicMaterial({ color:0x7fb5ff, transparent:true, opacity:0.06 });
  const mesh = new THREE.Mesh(ring, mat);
  mesh.rotation.x = Math.PI/2;
  rings.add(mesh);
}
scene.add(rings);

/* ---- Star field ---- */
{
  const starGeo = new THREE.BufferGeometry();
  const N = 800;
  const pos = new Float32Array(N*3);
  for(let i=0;i<N;i++){
    pos[i*3+0] = rnd(-120,120);
    pos[i*3+1] = rnd(-120,120);
    pos[i*3+2] = rnd(-120,120);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const starMat = new THREE.PointsMaterial({ color:0xdfe9ff, size:0.02, transparent:true, opacity:0.7 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}

/* ========= Animation state ========= */
let t0 = performance.now();
function now(){ return (performance.now()-t0)/1000; }

/* ========= Resize ========= */
function resize(){
  const w = root.clientWidth, h = root.clientHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  camera.aspect = w/h || 1;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize, {passive:true});
resize();

/* ========= Animate ========= */
function animate(){
  const t = now();

  // “breathing” inflate/deflate
  const breathe = 1 + 0.06 * Math.sin(t*0.9);
  torso.scale.set(1.3*breathe, 0.9*breathe, 1.1*breathe);

  // head bob + blink
  head.position.y = 0.65 + 0.05*Math.sin(t*1.4);
  const blink = Math.sin(t*3.2+1.1) > 0.95 ? 0.15 : 1.0;
  iris.scale.y = blink; pupil.scale.y = blink;

  // gentle organism sway
  organism.rotation.z = Math.sin(t*0.35)*0.06;
  organism.rotation.x = Math.sin(t*0.27)*0.03;

  // limb buds sway
  const sway = 0.25*Math.sin(t*1.3);
  armL.rotation.z =  0.9 + sway*0.25;
  armR.rotation.z = -1.0 - sway*0.2;
  legL.rotation.z =  1.6 - sway*0.15;
  legR.rotation.z = -1.6 + sway*0.18;

  // update umbilical curve (subtle noise)
  const pts = cordCurve.points;
  const wob = Math.sin(t*1.1)*0.1;
  pts[1].y += Math.sin(t*1.7)*0.002;
  pts[2].y += Math.cos(t*1.3)*0.002;
  pts[3].y = pts[3].y + wob*0.01;
  cordCurve.pointsNeedUpdate = true;
  cordTube.geometry.dispose();
  cordTube.geometry = new THREE.TubeGeometry(cordCurve, 80, 0.06, 16, false);

  // grow/contract echo opacity a bit with the “heart”
  const heart = (0.5+0.5*Math.sin(t*1.1))**2;
  rings.children.forEach((r,i)=> r.material.opacity = 0.04 + 0.03*heart);

  composer.render();
  requestAnimationFrame(animate);
}
animate();
