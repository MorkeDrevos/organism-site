/* Organism */
const organism = new THREE.Group();
scene.add(organism);
organism.scale.set(2.5, 2.5, 2.5); // scale up so it's definitely visible

/* Torso */
const torsoGeo = new THREE.SphereGeometry(1.1, 42, 42);
torsoGeo.scale(1.3, 0.9, 1.1);
const torso = new THREE.Mesh(
  torsoGeo,
  new THREE.MeshStandardMaterial({ color: 0xe9efff, roughness: 0.5, metalness: 0.2 })
);
organism.add(torso);

/* Head */
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.75, 48, 48),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 })
);
head.position.set(0.2, 0.65, 0.1);
organism.add(head);

/* Eye */
const iris = new THREE.Mesh(
  new THREE.SphereGeometry(0.12, 24, 24),
  new THREE.MeshStandardMaterial({ color: 0x98c5ff })
);
iris.position.set(0.36, 0.65, 0.35);
organism.add(iris);

const pupil = new THREE.Mesh(
  new THREE.SphereGeometry(0.06, 22, 22),
  new THREE.MeshStandardMaterial({ color: 0x0b0f18 })
);
pupil.position.copy(iris.position).add(new THREE.Vector3(0, 0, 0.04));
organism.add(pupil);

/* Limb buds */
function limb(len = 1.2, thick = 0.09) {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(thick, len, 12, 24),
    new THREE.MeshStandardMaterial({ color: 0xf5d5ff })
  );
}
const armL = limb(1.1); armL.rotation.z = 0.9; armL.position.set(-0.6, 0.1, 0.4);
const armR = limb(1.0); armR.rotation.z = -1.0; armR.position.set(0.75, 0.05, 0.2);
const legL = limb(1.2); legL.rotation.z = 1.6; legL.position.set(-0.5, -0.65, 0.2);
const legR = limb(1.15); legR.rotation.z = -1.6; legR.position.set(0.5, -0.7, 0.2);
organism.add(armL, armR, legL, legR);
camera.lookAt(0, 0, 0);
