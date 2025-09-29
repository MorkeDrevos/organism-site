import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/******** Setup ********/
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060913);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.z = 6;
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

/******** Lights ********/
const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 1.0);
scene.add(hemi);
const point = new THREE.PointLight(0xffaaff, 1.2, 15);
point.position.set(3, 3, 5);
scene.add(point);

/******** Organism ********/
const organism = new THREE.Group();
scene.add(organism);
organism.scale.set(2, 2, 2);

/* Torso */
const torsoGeo = new THREE.SphereGeometry(1.0, 42, 42);
torsoGeo.scale(1.3, 0.9, 1.1);
const torso = new THREE.Mesh(
  torsoGeo,
  new THREE.MeshStandardMaterial({ color: 0xe9efff, roughness: 0.6, metalness: 0.2 })
);
organism.add(torso);

/* Head */
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 42, 42),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 })
);
head.position.set(0.2, 1.0, 0.1);
organism.add(head);

/* Eye */
const iris = new THREE.Mesh(
  new THREE.SphereGeometry(0.15, 24, 24),
  new THREE.MeshStandardMaterial({ color: 0x98c5ff })
);
iris.position.set(0.35, 1.0, 0.35);
organism.add(iris);

const pupil = new THREE.Mesh(
  new THREE.SphereGeometry(0.07, 22, 22),
  new THREE.MeshStandardMaterial({ color: 0x0b0f18 })
);
pupil.position.copy(iris.position).add(new THREE.Vector3(0, 0, 0.05));
organism.add(pupil);

/* Limb buds */
function limb(len = 1.0, thick = 0.1) {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(thick, len, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xf5d5ff })
  );
}
const armL = limb(1.0); armL.rotation.z = 1.0; armL.position.set(-0.8, 0.2, 0.2);
const armR = limb(1.0); armR.rotation.z = -1.0; armR.position.set(0.8, 0.2, 0.2);
const legL = limb(1.2); legL.rotation.z = 1.6; legL.position.set(-0.5, -0.8, 0.2);
const legR = limb(1.2); legR.rotation.z = -1.6; legR.position.set(0.5, -0.8, 0.2);
organism.add(armL, armR, legL, legR);

/******** Animation ********/
function animate(time) {
  requestAnimationFrame(animate);
  const t = time * 0.001;

  // breathing scale
  const breathe = 1 + 0.05 * Math.sin(t * 2.0);
  torso.scale.set(1.3 * breathe, 0.9 * breathe, 1.1 * breathe);

  // limb sway
  armL.rotation.z = 1.0 + 0.2 * Math.sin(t * 1.5);
  armR.rotation.z = -1.0 + 0.2 * Math.cos(t * 1.5);
  legL.rotation.z = 1.6 + 0.15 * Math.sin(t * 1.2);
  legR.rotation.z = -1.6 + 0.15 * Math.cos(t * 1.2);

  renderer.render(scene, camera);
}
animate();

/******** Resize ********/
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
