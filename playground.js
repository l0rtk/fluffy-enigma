"use strict";

// ─────────────────────────────────────────────────────────────
//  THE PLAYGROUND
//
//  A 3D world with the boring parts already done:
//  a screen, a camera, sunlight with shadows, a meadow
//  with trees and rocks, and a little villager you can
//  walk around with WASD.
//
//  Everything here is yours. Add things to the world,
//  make E do something, invent rules — build a game.
// ─────────────────────────────────────────────────────────────

// ── The screen ──
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 120);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
THREE.ColorManagement.legacyMode = false; // hex colors render as written
renderer.setClearColor(0xa8cbe0); // sky
document.getElementById("app").appendChild(renderer.domElement);
scene.fog = new THREE.Fog(0xa8cbe0, 30, 70);

// ── Light: warm afternoon sun ──
scene.add(new THREE.HemisphereLight(0xcfe0ef, 0x51702f, 0.5));
const sun = new THREE.DirectionalLight(0xffe4b0, 1.35);
sun.position.set(9, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = sun.shadow.camera.bottom = -24;
sun.shadow.camera.right = sun.shadow.camera.top = 24;
scene.add(sun);

// ── Map dice ──
// A seeded random: the same numbers every load, so the meadow
// always looks the same. Change the seed for a different map.
function makeRandom(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRandom(1097);

// ── The ground: grass painted onto a canvas, like an old map ──
function grassTexture() {
  const size = 1024;
  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = size;
  const ctx = cvs.getContext("2d");
  ctx.fillStyle = "#5c7f38";
  ctx.fillRect(0, 0, size, size);
  // Mottled greens, so it isn't one flat color.
  const greens = ["#547834", "#61893c", "#4c6e2e", "#6c9445", "#587f36"];
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = greens[(rand() * greens.length) | 0];
    ctx.globalAlpha = 0.15 + rand() * 0.25;
    ctx.beginPath();
    ctx.arc(rand() * size, rand() * size, 1.5 + rand() * 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Worn dirt patches.
  const dirts = ["#7a6438", "#6f5a33", "#857044"];
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = dirts[(rand() * dirts.length) | 0];
    ctx.globalAlpha = 0.08 + rand() * 0.1;
    const x = rand() * size, y = rand() * size, r = 25 + rand() * 70;
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      ctx.ellipse(x + (rand() - 0.5) * r, y + (rand() - 0.5) * r, r * (0.4 + rand() * 0.5), r * (0.3 + rand() * 0.4), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(cvs);
  tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 8;
  return tex;
}

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(44, 44),
  new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ── Nature ──
function jitterColor(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.1, (rand() - 0.5) * amount);
  return c;
}

function tree(x, z) {
  const g = new THREE.Group();
  const h = 0.9 + rand() * 0.6;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.15, h, 7),
    new THREE.MeshStandardMaterial({ color: jitterColor(0x6b4f32, 0.06), roughness: 1 })
  );
  trunk.position.y = h / 2;
  trunk.castShadow = true;
  g.add(trunk);
  // A crown of leafy blobs, like AoE forests.
  const blobs = 3 + (rand() * 3 | 0);
  for (let i = 0; i < blobs; i++) {
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.4 + rand() * 0.35, 1),
      new THREE.MeshStandardMaterial({ color: jitterColor(0x3f6b2f, 0.12), roughness: 1 })
    );
    leaf.position.set((rand() - 0.5) * 0.7, h + 0.3 + rand() * 0.6, (rand() - 0.5) * 0.7);
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rand() * Math.PI * 2;
  const s = 0.85 + rand() * 0.5;
  g.scale.setScalar(s);
  scene.add(g);
}

function rock(x, z) {
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.2 + rand() * 0.35, 0),
    new THREE.MeshStandardMaterial({ color: jitterColor(0x8d8d85, 0.1), roughness: 1 })
  );
  m.position.set(x, 0.08, z);
  m.scale.y = 0.55 + rand() * 0.3;
  m.rotation.y = rand() * Math.PI * 2;
  m.castShadow = true;
  scene.add(m);
}

function bush(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const blob = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18 + rand() * 0.12, 1),
      new THREE.MeshStandardMaterial({ color: jitterColor(0x4a7534, 0.1), roughness: 1 })
    );
    blob.position.set((rand() - 0.5) * 0.35, 0.15, (rand() - 0.5) * 0.35);
    blob.castShadow = true;
    g.add(blob);
  }
  g.position.set(x, 0, z);
  scene.add(g);
}

// Scatter it all — but keep a clearing around the spawn point.
function scatter(count, minRadius, place) {
  let placed = 0;
  while (placed < count) {
    const x = (rand() - 0.5) * 40, z = (rand() - 0.5) * 40;
    if (Math.hypot(x, z) < minRadius) continue;
    place(x, z);
    placed++;
  }
}
scatter(26, 6, tree);
scatter(12, 4, rock);
scatter(14, 4, bush);

// Wild grass tufts: hundreds of tiny cones, drawn in one batch.
function tufts(count, color) {
  const mesh = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.05, 0.22, 4),
    new THREE.MeshStandardMaterial({ color, roughness: 1 }),
    count
  );
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    const s = 0.7 + rand() * 0.9;
    m.makeRotationY(rand() * Math.PI);
    m.scale(new THREE.Vector3(s, s, s));
    m.setPosition((rand() - 0.5) * 42, 0.11 * s, (rand() - 0.5) * 42);
    mesh.setMatrixAt(i, m);
  }
  scene.add(mesh);
}
tufts(450, 0x4f7231);
tufts(300, 0x45662b);

// ── The hero: a villager (give them arms, a face, a story...) ──
const hero = new THREE.Group();
const tunic = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.26, 0.4, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0x3f6db5, roughness: 1 }) // player blue
);
tunic.position.y = 0.55;
const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.2, 14, 12),
  new THREE.MeshStandardMaterial({ color: 0xf2c9a0, roughness: 1 })
);
head.position.y = 1.0;
for (const part of [tunic, head]) { part.castShadow = true; hero.add(part); }
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
    hero.position.x = THREE.MathUtils.clamp(hero.position.x + (dx / len) * SPEED * dt, -21, 21);
    hero.position.z = THREE.MathUtils.clamp(hero.position.z + (dz / len) * SPEED * dt, -21, 21);
    hero.rotation.y = Math.atan2(dx, dz);
  }

  // The camera follows the hero.
  camera.position.lerp(
    new THREE.Vector3(hero.position.x + 5.5, 8.5, hero.position.z + 5.5),
    0.06
  );
  camera.lookAt(hero.position.x, 0.6, hero.position.z);

  renderer.render(scene, camera);
}

camera.position.set(5.5, 8.5, 9);
animate();
