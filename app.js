/* ======= Safe, minimal Three.js organism (no bloom) ======= */

const root = document.getElementById('app');
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x060913, 40, 220);

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1000);
camera.position.set(0, 0.9, 7.5);

const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
renderer.setClearColor(0x060913, 1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
root.appendChild(renderer.domElement);

/* Lights */
const hemi = new THREE.HemisphereLight(0x88baff, 0x28122f, 0.8);
scene.add(hemi);
const key = new THREE.SpotLight(0xaad8ff, 1.3, 0, Math.PI/6, 0.4, 1.5);
key.position.set(3, 6, 8);
scene.add(key);
const fill = new THREE.PointLight(0xff66dd, 0.45, 0);
fill.position.set(-6, -2, -4);
scene.add(fill);

/* Helpers */
function rnd(a,b){ return a + Math.random()*(b-a); }
function makePhys({color=0xffffff, emissive=0x000000, metalness=0.05, roughness=0.4, transmission=0, opacity=1}={}){
  return new THREE.MeshPhysicalMaterial({
    color, emissive, metalness, roughness,
    clearcoat:0.6, clearcoatRoughness:0.3,
    transmission, transparent: opacity<1, opacity
  });
}

/* Organism */
const organism = new THREE.Group(); scene.add(organism);

/* Torso */
const torsoGeo = new THREE.SphereGeometry(1.1, 42, 42); torsoGeo.scale(1.3, 0.9, 1.1);
const torso = new THREE.Mesh(torsoGeo, makePhys({color:0xe9efff, roughness:0.55, transmission:0.25, opacity:0.9}));
organism.add(torso);

/* Head */
const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 48, 48), makePhys({color:0xffffff, emissive:0x263a55, roughness:0.25, transmission:0.35, opacity:0.95}));
head.position.set(0.2, 0.65, 0.1); organism.add(head);

/* Eye */
const iris  = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), new THREE.MeshStandardMaterial({ color:0x98c5ff, emissive:0x223b77, roughness:0.2, metalness:0.1 }));
iris.position.set(0.36, 0.65, 0.35); organism.add(iris);
const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 22, 22), new THREE.MeshStandardMaterial({ color:0x0b0f18, roughness:0.7 }));
pupil.position.copy(iris.position).add(new THREE.Vector3(0,0,0.04)); organism.add(pupil);

/* Limb buds (4) */
function limb(len=1.2, thick=0.09){
  return new THREE.Mesh(new THREE.CapsuleGeometry(thick, len, 12, 24),
                        new THREE.MeshStandardMaterial({ color:0xf5d5ff, roughness:0.6, metalness:0.05, emissive:0x331433, emissiveIntensity:0.3 }));
}
const armL = limb(1.1); armL.rotation.z =  0.9; armL.position.set(-0.6,  0.1, 0.4);
const armR = limb(1.0); armR.rotation.z = -1.0; armR.position.set( 0.75, 0.05, 0.2);
const legL = limb(1.2); legL.rotation.z =  1.6; legL.position.set(-0.5,-0.65, 0.2);
const legR = limb(1.15);legR.rotation.z = -1.6; legR.position.set( 0.5,-0.7,  0.2);
organism.add(armL, armR, legL, legR);

/* Umbilical cord (tube along Catmull-Rom curve) */
let cordCurve, cordTube;
const cordMat = new THREE.MeshStandardMaterial({ color:0xff9fd6, emissive:0x551b3f, emissiveIntensity:0.6, roughness:0.5, metalness:0.05 });

function buildCord(){
  if (cordTube) organism.remove(cordTube);
  const attach = new THREE.Vector3(-0.25, -0.25, 0.2);
  const pts = [
    attach,
    attach.clone().add(new THREE.Vector3(-0.6, -0.05, 0.0)),
    attach.clone().add(new THREE.Vector3(-1.5,  0.15, 0.1)),
    attach.clone().add(new THREE.Vector3(-2.8,  0.05, -0.1)),
  ];
  cordCurve = new THREE.CatmullRomCurve3(pts);
  cordTube = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 80, 0.06, 16, false), cordMat);
  organism.add(cordTube);
}
buildCord();

/* Echo rings (world space) */
const rings = new THREE.Group();
for(let i=0;i<7;i++){
  const r = 2.0 + i*0.45;
  const ring = new THREE.TorusGeometry(r, 0.0035, 8, 160);
  const mat  = new THREE.MeshBasicMaterial({ color:0x7fb5ff, transparent:true, opacity:0.06 });
  const mesh = new THREE.Mesh(ring, mat);
  mesh.rotation.x = Math.PI/2; rings.add(mesh);
}
scene.add(rings);

/* Star field */
{
  const starGeo = new THREE.BufferGeometry();
  const N = 800, pos = new Float32Array(N*3);
  for(let i=0;i<N;i++){ pos[i*3]=rnd(-120,120); pos[i*3+1]=rnd(-120,120); pos[i*3+2]=rnd(-120,120); }
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const starMat = new THREE.PointsMaterial({ color:0xdfe9ff, size:0.02, transparent:true, opacity:0.7 });
  scene.add(new THREE.Points(starGeo, starMat));
}

/* Resize */
function resize(){
  const w = root.clientWidth, h = root.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = (w||1)/(h||1);
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize, {passive:true}); resize();

/* Animate */
let t0 = performance.now();
function t(){ return (performance.now()-t0)/1000; }

function animate(){
  const time = t();

  // breathing & sway
  const breathe = 1 + 0.06*Math.sin(time*0.9);
  torso.scale.set(1.3*breathe, 0.9*breathe, 1.1*breathe);
  organism.rotation.z = Math.sin(time*0.35)*0.06;
  organism.rotation.x = Math.sin(time*0.27)*0.03;

  // head bob & blink
  head.position.y = 0.65 + 0.05*Math.sin(time*1.4);
  const blink = Math.sin(time*3.2+1.1) > 0.95 ? 0.15 : 1.0;
  iris.scale.y = blink; pupil.scale.y = blink;

  // limb bud sway
  const s = 0.25*Math.sin(time*1.3);
  armL.rotation.z =  0.9 + s*0.25;
  armR.rotation.z = -1.0 - s*0.20;
  legL.rotation.z =  1.6 - s*0.15;
  legR.rotation.z = -1.6 + s*0.18;

  // cord wobble
  cordCurve.points[1].y += Math.sin(time*1.7)*0.002;
  cordCurve.points[2].y += Math.cos(time*1.3)*0.002;
  cordCurve.points[3].y += Math.sin(time*1.1)*0.001;
  cordCurve.pointsNeedUpdate = true;
  cordTube.geometry.dispose();
  cordTube.geometry = new THREE.TubeGeometry(cordCurve, 80, 0.06, 16, false);

  // echo pulse
  const heart = (0.5+0.5*Math.sin(time*1.1))**2;
  rings.children.forEach(r=> r.material.opacity = 0.04 + 0.03*heart);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
