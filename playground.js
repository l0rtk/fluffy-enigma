"use strict";

// ─────────────────────────────────────────────────────────────
//  THE PLAYGROUND
//
//  A 3D world with the boring parts already done:
//  a screen, a camera, sunlight with shadows, a ground,
//  and a little hero you can walk around with WASD.
//
//  Everything else is yours. Add things to the world,
//  make E do something, invent rules — build a game.
// ─────────────────────────────────────────────────────────────

// ── The screen ──
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0xbfe0f5); // sky
document.getElementById("app").appendChild(renderer.domElement);

// ── Light ──
scene.add(new THREE.HemisphereLight(0xbfd8ef, 0x6d8a4e, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d9, 0.95);
sun.position.set(8, 12, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -12;
sun.shadow.camera.right = sun.shadow.camera.top = 12;
scene.add(sun);

// ── The ground ──
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ color: 0x86a85c, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Faint grid, so you can see distances while building. Delete me anytime.
const grid = new THREE.GridHelper(40, 40, 0x6d8a4e, 0x9ab873);
grid.position.y = 0.01;
scene.add(grid);

// ── The hero ──
// A humble box, waiting to become someone.
const hero = new THREE.Mesh(
  new THREE.BoxGeometry(0.7, 1.0, 0.7),
  new THREE.MeshStandardMaterial({ color: 0xd97a2b, roughness: 1 })
);
hero.position.y = 0.5;
hero.castShadow = true;
scene.add(hero);

// ── Your world goes here ──────────────────────────────────────
//
//  Some parts to play with:
//
//    const thing = new THREE.Mesh(
//      new THREE.SphereGeometry(0.5),                        // or Box, Cone, Torus...
//      new THREE.MeshStandardMaterial({ color: 0xc79a18 })
//    );
//    thing.position.set(3, 0.5, -2);
//    thing.castShadow = true;
//    scene.add(thing);
//
// ──────────────────────────────────────────────────────────────

function interact() {
  // E was pressed while standing at hero.position.
  // Make something happen!
  console.log(`E pressed at x=${hero.position.x.toFixed(1)}, z=${hero.position.z.toFixed(1)}`);
}

// ── Controls ──
const keys = new Set();
addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) keys.add(k);
  else if (k === "e" || k === " ") interact();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── The loop: runs ~60 times a second, forever ──
const clock = new THREE.Clock();
const SPEED = 4;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // Walk.
  let dx = 0, dz = 0;
  if (keys.has("w") || keys.has("arrowup")) dz -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dz += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  if (dx || dz) {
    const len = Math.hypot(dx, dz);
    hero.position.x = THREE.MathUtils.clamp(hero.position.x + (dx / len) * SPEED * dt, -19, 19);
    hero.position.z = THREE.MathUtils.clamp(hero.position.z + (dz / len) * SPEED * dt, -19, 19);
    hero.rotation.y = Math.atan2(dx, dz);
  }

  // The camera follows the hero.
  camera.position.lerp(
    new THREE.Vector3(hero.position.x + 5.5, 8, hero.position.z + 5.5),
    0.06
  );
  camera.lookAt(hero.position.x, 0.6, hero.position.z);

  renderer.render(scene, camera);
}

camera.position.set(5.5, 8, 9);
animate();
