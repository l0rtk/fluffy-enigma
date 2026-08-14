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
// Render at most ~2.3 megapixels: huge windows scale down slightly
// instead of dropping frames on weaker graphics chips.
function fitResolution() {
  const scale = Math.min(1, Math.sqrt(2_300_000 / (innerWidth * innerHeight)));
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2) * scale);
  renderer.setSize(innerWidth, innerHeight);
}
fitResolution();
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
THREE.ColorManagement.legacyMode = false; // hex colors render as written
renderer.setClearColor(0xa8cbe0); // sky
document.getElementById("app").appendChild(renderer.domElement);
scene.fog = new THREE.Fog(0xa8cbe0, 30, 70);

// ── Light: warm afternoon sun ──
// Kept in variables, not thrown away: the weather is going to reach in
// here later and dim them when it rains.
const hemi = new THREE.HemisphereLight(0xcfe0ef, 0x51702f, 0.5);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe4b0, 1.35);
sun.position.set(9, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
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

// The seed lives in the address bar: ?seed=42 grows a different meadow.
// No seed given → 1097, the house map.
const SEED = Number(new URLSearchParams(location.search).get("seed")) || 1097;

// TWO dice bags, deliberately kept apart:
//   rand    — builds the map. Only ever called while the world is being built.
//   simRand — will drive the rules (where a flower sprouts, which way the wind turns).
//
// Why not share one? The trees load from disk asynchronously — they get
// planted *after* the game loop has already started running. If the rules
// pulled from the same bag, then a slow disk would mean more numbers eaten
// before the trees got theirs, and the same seed would grow a different
// meadow every load. Two bags, and neither can disturb the other.
const rand = makeRandom(SEED);
const simRand = makeRandom(SEED ^ 0x9e3779b9);

// Anything purely decorative (raindrop positions, sparkles) should use
// plain Math.random() instead — it doesn't affect the rules, so it must
// not be allowed to shift either sequence.

// Where the beehive stands. Declared up here, before anything is scattered,
// because the map-builder needs to know to leave this patch of grass alone —
// otherwise a tree lands on the hive and the bees live inside a trunk.
const HIVE_X = 4.2, HIVE_Z = -4.2;
const HIVE_CLEARANCE = 2;

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

// Everything solid the hero can bump into: just a circle on the ground.
// Drawing and blocking are separate jobs — the meshes live in the scene,
// their footprints live here, as plain numbers.
const obstacles = [];

function rock(x, z) {
  const r = 0.2 + rand() * 0.35;
  const m = new THREE.Mesh(
    new THREE.IcosahedronGeometry(r, 0),
    new THREE.MeshStandardMaterial({ color: jitterColor(0x8d8d85, 0.1), roughness: 1 })
  );
  m.position.set(x, 0.08, z);
  m.scale.y = 0.55 + rand() * 0.3;
  m.rotation.y = rand() * Math.PI * 2;
  m.castShadow = true;
  scene.add(m);
  obstacles.push({ x, z, r: r * 0.9 }); // a touch smaller than it looks, so it feels fair
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
  // Experiment: delete this line and bushes become walk-through undergrowth.
  obstacles.push({ x, z, r: 0.35 });
}

// Scatter it all — but keep a clearing around the spawn point.
function scatter(count, minRadius, place) {
  let placed = 0;
  while (placed < count) {
    const x = (rand() - 0.5) * 40, z = (rand() - 0.5) * 40;
    if (Math.hypot(x, z) < minRadius) continue;
    if (Math.hypot(x - HIVE_X, z - HIVE_Z) < HIVE_CLEARANCE) continue; // the hive's doorstep
    place(x, z);
    placed++;
  }
}
scatter(12, 4, rock);
scatter(14, 4, bush);

// ── Trees: real 3D models (Quaternius' Stylized Nature pack, CC0) ──
// Each .gltf file in assets/trees/ is a hand-made model. We load the
// five kinds once, then plant copies all over the meadow.
const loader = new THREE.GLTFLoader();
const TREE_KINDS = ["MapleTree_1", "MapleTree_2", "MapleTree_3", "BirchTree_1", "BirchTree_2"];

function loadTree(name) {
  return new Promise((resolve) =>
    loader.load(`assets/trees/${name}.gltf`, (gltf) => {
      const model = gltf.scene;
      model.traverse((part) => { if (part.isMesh) part.castShadow = true; });
      // Trees come in random sizes — measure, so we can plant them at ours.
      const height = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y;
      model.userData.baseScale = 2.8 / height;
      resolve(model);
    })
  );
}

// The maples come autumn-red, but the pack includes a black & white
// leaf texture made for tinting — so most maples get summer greens.
const leafMask = new THREE.TextureLoader().load("assets/trees/MapleTree_Leaves_BW.png");
leafMask.flipY = false; // gltf textures are stored flipped vs. three.js
leafMask.encoding = THREE.sRGBEncoding;

Promise.all(TREE_KINDS.map(loadTree)).then((models) => {
  // Three shades of summer green, borrowed from the maple leaf material.
  let greens = [];
  models[0].traverse((part) => {
    if (part.isMesh && part.material.name === "MapleTree_Leaves" && !greens.length) {
      greens = [0x4d7c2c, 0x5d8f35, 0x446f28].map((color) => {
        const m = part.material.clone();
        m.map = leafMask;
        m.color.set(color);
        return m;
      });
    }
  });

  scatter(26, 6, (x, z) => {
    const t = models[(rand() * models.length) | 0].clone();
    // 7 of 10 maples turn green; the rest keep their autumn reds.
    if (rand() < 0.7) {
      const green = greens[(rand() * greens.length) | 0];
      t.traverse((part) => {
        if (part.isMesh && part.material.name === "MapleTree_Leaves") part.material = green;
      });
    }
    const size = 0.75 + rand() * 0.6;
    t.scale.setScalar(t.userData.baseScale * size);
    t.position.set(x, 0, z);
    t.rotation.y = rand() * Math.PI * 2;
    scene.add(t);
    // Only the trunk blocks you — a canopy-sized circle would wall off
    // half the meadow with invisible walls high above your head.
    obstacles.push({ x, z, r: 0.3 * size });
  });

  // The map is now complete — stamp it, so two runs can be compared.
  console.log(`🌱 seed ${SEED} · map fingerprint ${fingerprint()} · ${obstacles.length} solid things`);
});

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

// ── The A/B run ──
// Two runs of the same seed must produce the same world, or you can never
// tell whether a change you made helped or whether you just got lucky.
// This squashes the whole map into eight characters: same map, same stamp.
//
// Later, when the world has flowers and bees, fingerprint the simulation
// state too — then "did my change matter?" becomes a stamp comparison
// instead of an argument.
function hashOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

// The map: does the same seed grow the same meadow?
function fingerprint() {
  return hashOf(obstacles.map((o) => `${o.x.toFixed(3)},${o.z.toFixed(3)},${o.r.toFixed(3)}`).join(";"));
}

// The living world: do the same rules, run twice, reach the same day?
// This is the socket the population graphs will plug into later.
function worldFingerprint() {
  return hashOf(
    `day${world.day};${world.weather};${world.weatherDaysLeft};honey${world.hive.honey.toFixed(4)};` +
    world.flowers.map((f) => `${f.id},${f.x.toFixed(3)},${f.z.toFixed(3)},${f.growth.toFixed(4)},${f.water.toFixed(4)}`).join(";") +
    "|" +
    world.bees.map((b) => `${b.id},${b.state},${b.x.toFixed(3)},${b.z.toFixed(3)},${b.nectar.toFixed(4)}`).join(";")
  );
}

const seedLabel = document.getElementById("seed");
if (seedLabel) seedLabel.textContent = SEED;

// ── The hero: a villager (give them a face, a story...) ──
// Two nested groups, on purpose:
//   hero — where the villager IS and which way they face
//   body — the wobbling, breathing, arm-swinging part
// Keeping them apart means the walk animation can bounce the body around
// without ever confusing the code that decides where the villager stands.
const hero = new THREE.Group();
const body = new THREE.Group();
hero.add(body);

const skin = new THREE.MeshStandardMaterial({ color: 0xf2c9a0, roughness: 1 });
const tunic = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.26, 0.4, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0x3f6db5, roughness: 1 }) // player blue
);
tunic.position.y = 0.55;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), skin);
head.position.y = 1.0;
for (const part of [tunic, head]) { part.castShadow = true; body.add(part); }

// Eyes, so you can tell which way they're looking. The villager's own
// +z is "forward", so that's where the face goes.
for (const side of [-1, 1]) {
  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 1 })
  );
  eye.position.set(side * 0.075, 1.03, 0.175);
  body.add(eye);
}

// Arms. Each one hangs from a pivot at the shoulder — rotate the pivot and
// the arm swings from the top, like a real shoulder, instead of spinning
// around its own middle.
function makeArm(side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.25, 0.74, 0);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), skin);
  arm.position.y = -0.15;
  arm.castShadow = true;
  shoulder.add(arm);
  body.add(shoulder);
  return shoulder;
}
const armLeft = makeArm(-1);
const armRight = makeArm(1);

scene.add(hero);

// ══════════════════════════════════════════════════════════════
//  THE WORLD
//
//  Everything below this line is DATA and RULES. Not one line of
//  it knows that three.js exists. You could delete the entire 3D
//  view, run this in a black terminal window, and the meadow
//  would carry on living exactly the same.
//
//  That's golden rule #1, and everything in phase 2 depends on it:
//  an AI gardener can read `world` and understand the meadow
//  completely, without ever looking at a screen.
// ══════════════════════════════════════════════════════════════

const world = {
  day: 1,
  ticks: 0,        // total ticks since the beginning of time
  flowers: [],
  bees: [],
  hive: null,      // built below, once the meadow exists

  // ── The world's dials ──
  // Weather sets these every tick; everything else only ever READS them.
  // That's the whole trick: the sky doesn't know what a flower is, and a
  // flower doesn't know what rain is. They meet here, on three numbers.
  flowerGrowth: 1, // 1 = normal pace
  waterChange: 0,  // how fast the soil gains or loses water, per day
  beesCanFly: true,

  // Weather state
  weather: "sun",
  weatherDaysLeft: 3,
  dryDays: 0,      // days in a row without rain — this is how a drought is born
  windAngle: 0,    // which way the wind is blowing

  // A tally of every way this world has failed so far. Not decoration:
  // when the meadow collapses, this tells you WHICH rule killed it.
  lost: { dried: 0, rotted: 0, aged: 0, starved: 0 },
};

// ── Time ──
// A day is 96 ticks of a quarter-second each = 24 real seconds.
const TICK_SECONDS = 0.25;
const TICKS_PER_DAY = 96;

// ══════════════════════════════════════════════════════════════
//  WEATHER — the world's foundation. It answers to no one.
//
//  Each kind of weather is nothing but a handful of numbers. It
//  never touches a flower or a bee directly; it just turns the
//  dials on `world`, and everything else notices on its own.
// ══════════════════════════════════════════════════════════════

const WEATHER = {
  sun: {
    icon: "☀️", label: "Sunny",
    growth: 1.15,   // sunshine grows things...
    water: -0.22,   // ...but drinks the soil dry, a fifth of a tank a day
    canFly: true,
    wind: 0.06,     // barely a breeze
    sky: 0xa8cbe0, sunLight: 1.35, hemiLight: 0.5, fogNear: 30,
  },
  rain: {
    icon: "🌧", label: "Rainy",
    growth: 1.35,   // the meadow explodes into bloom
    water: +0.34,   // three days of this and the roots drown
    canFly: false,  // wet wings don't fly. The hive still eats, though.
    wind: 0.15,
    sky: 0x8e9fae, sunLight: 0.45, hemiLight: 0.75, fogNear: 16,
  },
  wind: {
    icon: "💨", label: "Windy",
    growth: 0.85,   // buffeted plants grow slowly
    water: -0.12,   // wind dries the ground too, just gently
    canFly: true,   // bees CAN fly — they just get blown off course
    wind: 1,
    sky: 0x9fb9c9, sunLight: 1.0, hemiLight: 0.6, fogNear: 24,
  },
};

// How long one spell of weather lasts. The world should feel changeable,
// but not twitchy — you must be able to *plan* around the sky.
const WEATHER_MIN_DAYS = 2;
const WEATHER_MAX_DAYS = 4;

// What comes after what. Never the same weather twice running — otherwise
// "2 to 4 days" quietly becomes "eleven days of rain" and the world stops
// changing at all.
//
// Rain is the likeliest follow-up to any dry spell, and that is not a
// detail: with a flat coin-flip the meadow spends most of its life in
// drought, because sun AND wind are both dry. Two dry faces, one wet one —
// so the wet one needs the heavier weight to balance the dice.
const WEATHER_ODDS = {
  sun: { rain: 0.65, wind: 0.35 },
  wind: { rain: 0.6, sun: 0.4 },
  rain: { sun: 0.55, wind: 0.45 },
};

function rollWeather() {
  // Spin a wheel: walk the options, subtracting each one's slice until the
  // roll runs out. Whichever slice it lands in, wins.
  let roll = simRand();
  for (const [kind, chance] of Object.entries(WEATHER_ODDS[world.weather])) {
    roll -= chance;
    if (roll <= 0) { world.weather = kind; break; }
  }
  world.weatherDaysLeft = WEATHER_MIN_DAYS + Math.floor(simRand() * (WEATHER_MAX_DAYS - WEATHER_MIN_DAYS + 1));
  world.windAngle = simRand() * Math.PI * 2;
}

// Called every tick: copy today's sky onto the world's dials.
function applyWeather() {
  const w = WEATHER[world.weather];
  world.flowerGrowth = w.growth;
  world.waterChange = w.water;
  world.beesCanFly = w.canFly;
}

// A drought isn't a fourth kind of weather — it's what several dry days in
// a row FEEL like. Sun, then wind, then sun again, and the meadow is parched.
// Nobody programmed a drought; it emerged.
const DROUGHT_DAYS = 6;
function isDrought() {
  return world.dryDays >= DROUGHT_DAYS;
}

// ── Flowers ──
// A flower's whole life is one number: `growth`, counted in days.
// Every stage is just a line drawn across that number.
const STAGES = [
  { name: "sprout", until: 1, icon: "🌱" },
  { name: "bud", until: 2, icon: "🌿" },
  { name: "bloom", until: 5, icon: "🌸" },
  { name: "wilting", until: 6, icon: "🥀" },
];
const FLOWER_LIFESPAN = 6; // days, after which it's compost

function stageOf(flower) {
  for (const stage of STAGES) if (flower.growth < stage.until) return stage;
  return { name: "gone", icon: "🍂" };
}

const FLOWER_COLORS = [0xe8607d, 0xf2a03d, 0xd9d34e, 0xb96fd6, 0xf4f0e6, 0xe86a4a];
let nextFlowerId = 1;

// ── Thirst ──
// A flower's health is ONE number: `water`, from 0 to 2.
//   1.0  perfect
//   0.0  died of drought — dried to straw
//   2.0  died of rot     — drowned in a swamp
// Both ends of the same number kill you. That's why a single number is
// better here than a "healthy / dry / rotting" label: the flower is always
// somewhere on the line, and you can SEE it sliding toward one end.
const WATER_PERFECT = 1;
const WATER_MAX = 2;

// How happy is this flower right now? 1 at perfect water, 0 at either death.
function comfortOf(flower) {
  return Math.max(0, 1 - Math.abs(flower.water - WATER_PERFECT));
}

// One door into the world for new flowers. You press E; the meadow seeds
// itself; later the bees will pollinate. Same door, three different hands.
function plantFlower(x, z) {
  const flower = {
    id: nextFlowerId++,
    x,
    z,
    growth: 0,
    // Not everyone starts equally watered. Without this jitter every flower
    // in the meadow crosses the drowning line on the same tick, and a rainy
    // spell wipes out the entire meadow at once instead of thinning it.
    water: WATER_PERFECT + (simRand() - 0.5) * 0.4,
    nectar: 0,          // refilled while blooming, drunk by bees
    plantedOn: world.day,
    // From the SIM bag, not the map bag — this is part of the world's story,
    // so it has to replay identically from the same seed.
    color: FLOWER_COLORS[(simRand() * FLOWER_COLORS.length) | 0],
    spin: simRand() * Math.PI * 2, // so no two flowers face the same way
  };
  world.flowers.push(flower);
  return flower;
}

// ── The meadow seeds itself ──
// Wild flowers appear on their own, faster in good weather. Without this
// the world is a garden that only grows when you're holding the E key —
// and there is nothing for the bees to live on.
const SPROUT_CHANCE_PER_DAY = 2.6; // in perfect weather
const MAX_FLOWERS = 70;            // the meadow has a carrying capacity

function trySprout() {
  if (world.flowers.length >= MAX_FLOWERS) return;
  // Drought-struck ground doesn't seed at all.
  const rate = SPROUT_CHANCE_PER_DAY * world.flowerGrowth * (isDrought() ? 0.15 : 1);
  if (simRand() > rate / TICKS_PER_DAY) return;

  const x = (simRand() - 0.5) * 40;
  const z = (simRand() - 0.5) * 40;
  for (const o of obstacles) {
    if (Math.hypot(x - o.x, z - o.z) < o.r + 0.25) return; // landed on a rock
  }
  plantFlower(x, z);
}

function nearestFlower(x, z, within) {
  let best = null, bestDist = within;
  for (const f of world.flowers) {
    const d = Math.hypot(f.x - x, f.z - z);
    if (d < bestDist) { best = f; bestDist = d; }
  }
  return best;
}

// ══════════════════════════════════════════════════════════════
//  BEES — your first agent.
//
//  A bee has no plan and no memory. It has one word describing
//  what it is doing right now, and a rule for what to do next.
//  That is a STATE MACHINE, and it is the whole brain:
//
//      seeking ──arrives──▶ drinking ──full──▶ homing
//         ▲                     │                 │
//         └──────not full───────┘                 │
//         └────────── delivered ──────────────────┘
//
//  And above all of it, one question asked every single tick:
//  can I fly today?
// ══════════════════════════════════════════════════════════════

const BEE_SPEED = 2.4;       // metres per second in still air
const BEE_SIP_TICKS = 6;     // a second and a half nose-down in a flower
const SIP_AMOUNT = 0.45;     // nectar taken per visit
const BEE_CAPACITY = 0.9;    // how much a bee can carry home at once

// The hive's economy. These five numbers decide whether your world lives.
// Nudge any one of them and watch the population graph change shape.
const HIVE_EATS_PER_BEE = 0.22; // honey eaten per bee, per day — RAIN OR SHINE
const HONEY_FOR_NEW_BEE = 12;   // surplus needed before the hive raises a bee
const NEW_BEE_COST = 5;
const MAX_BEES = 12;
const MIN_BEES = 1;             // the queen. A hive with a queen can come back
                                // from one bad winter; a hive at zero cannot.

let nextBeeId = 1;

function addBee() {
  world.bees.push({
    id: nextBeeId++,
    x: world.hive.x,
    z: world.hive.z,
    state: "seeking",  // seeking | drinking | homing | grounded
    targetId: null,
    nectar: 0,
    sip: 0,
    phase: simRand() * Math.PI * 2, // so they don't all bob in unison
  });
}

// Fly toward a point. Returns true once we've arrived.
// This is where the wind actually bites: it's a shove sideways that the
// bee cannot steer out of, plus a straight speed penalty.
function flyToward(bee, tx, tz) {
  const w = WEATHER[world.weather];
  let dx = tx - bee.x, dz = tz - bee.z;
  const dist = Math.hypot(dx, dz);

  const speed = BEE_SPEED * (1 - w.wind * 0.4);  // wind slows them down
  const step = speed * TICK_SECONDS;

  // ── Arrive, don't overshoot ──
  // A bee covers up to 0.6 metres in one tick. Testing "am I within 0.3 of
  // the flower?" means it can step clean OVER the target and bounce around
  // it forever, never arriving, never delivering any honey. So: if this
  // tick's step would carry us past the target, land exactly on it instead.
  if (dist <= step) {
    bee.x = tx;
    bee.z = tz;
    return true;
  }

  const gust = w.wind * 0.85;  // the sideways shove — pure wind, unsteerable
  bee.x += ((dx / dist) * speed + Math.cos(world.windAngle) * gust) * TICK_SECONDS;
  bee.z += ((dz / dist) * speed + Math.sin(world.windAngle) * gust) * TICK_SECONDS;

  // Even a blown-about bee stays inside the meadow.
  bee.x = Math.max(-21, Math.min(21, bee.x));
  bee.z = Math.max(-21, Math.min(21, bee.z));
  return false;
}

// The nearest bloom worth visiting that no other bee has already claimed —
// so twelve bees don't all pile onto one flower.
function pickFlowerForBee(bee) {
  const claimed = new Set(world.bees.map((b) => b.targetId).filter((id) => id !== null));
  let best = null, bestDist = Infinity;
  for (const f of world.flowers) {
    if (f.nectar < 0.15) continue;
    if (stageOf(f).name !== "bloom") continue;
    if (claimed.has(f.id) && f.id !== bee.targetId) continue;
    const d = Math.hypot(f.x - bee.x, f.z - bee.z);
    if (d < bestDist) { best = f; bestDist = d; }
  }
  return best;
}

function tickBee(bee) {
  const hive = world.hive;

  // ── The question that comes before every plan ──
  // Rain grounds the bee wherever it is. It heads home and sits it out.
  if (!world.beesCanFly) {
    bee.state = "grounded";
    flyToward(bee, hive.x, hive.z);
    return;
  }
  if (bee.state === "grounded") bee.state = bee.nectar > 0 ? "homing" : "seeking";

  if (bee.state === "seeking") {
    let target = world.flowers.find((f) => f.id === bee.targetId);
    if (!target || target.nectar < 0.1 || stageOf(target).name !== "bloom") {
      target = pickFlowerForBee(bee);
      bee.targetId = target ? target.id : null;
    }
    if (!target) {
      // Nothing in bloom anywhere. Circle the hive and wait for better days.
      const angle = world.ticks * 0.06 + bee.phase;
      flyToward(bee, hive.x + Math.cos(angle) * 1.4, hive.z + Math.sin(angle) * 1.4);
      return;
    }
    if (flyToward(bee, target.x, target.z)) {
      bee.state = "drinking";
      bee.sip = BEE_SIP_TICKS;
    }
  } else if (bee.state === "drinking") {
    const target = world.flowers.find((f) => f.id === bee.targetId);
    if (!target) { bee.state = "seeking"; bee.targetId = null; return; } // it died mid-sip
    bee.sip--;
    if (bee.sip <= 0) {
      const taken = Math.min(target.nectar, SIP_AMOUNT, BEE_CAPACITY - bee.nectar);
      target.nectar -= taken;
      bee.nectar += taken;
      bee.targetId = null;
      bee.state = bee.nectar >= BEE_CAPACITY - 0.01 ? "homing" : "seeking";
    }
  } else if (bee.state === "homing") {
    if (flyToward(bee, hive.x, hive.z)) {
      world.hive.honey += bee.nectar;   // nectar becomes honey
      world.hive.brought += bee.nectar; // lifetime total, for the dashboard
      bee.nectar = 0;
      bee.state = "seeking";
    }
  }
}

// ── The hive settles up, once a day ──
// This is the whole economy in six lines, and it's what makes rain COST
// something: grounded bees bring nothing home, but they still eat.
function hiveDay() {
  const hive = world.hive;
  hive.honey -= world.bees.length * HIVE_EATS_PER_BEE;

  if (hive.honey < 0) {
    hive.honey = 0;
    if (world.bees.length > MIN_BEES) {
      world.bees.pop();
      world.lost.starved++;
    }
  } else if (hive.honey >= HONEY_FOR_NEW_BEE && world.bees.length < MAX_BEES) {
    hive.honey -= NEW_BEE_COST;
    addBee();
  }
}

// ── The heartbeat ──
// The ONE function that moves time forward. Everything that happens in
// this world happens here — which means to understand the world, you read
// one function, not the whole file.
function tick(world) {
  world.ticks++;

  // ── A new day ──
  if (world.ticks % TICKS_PER_DAY === 0) {
    world.day++;
    world.weatherDaysLeft--;
    if (world.weatherDaysLeft <= 0) rollWeather();
    // Count the dry streak AFTER the roll, so today's sky is what counts.
    world.dryDays = world.weather === "rain" ? 0 : world.dryDays + 1;
    hiveDay();
  }

  // The sky sets the dials. Everything below just reads them.
  applyWeather();

  // ── Flowers: drink, grow, make nectar ──
  // A drought bites harder than plain sunshine: dry ground gives up its
  // last water faster. One line, and dry days start feeding on themselves.
  const drain = world.waterChange * (isDrought() && world.waterChange < 0 ? 1.35 : 1);

  for (const flower of world.flowers) {
    flower.water += drain / TICKS_PER_DAY;
    const comfort = comfortOf(flower);
    // A thirsty or waterlogged flower still grows — just badly.
    flower.growth += world.flowerGrowth * (0.3 + 0.7 * comfort) / TICKS_PER_DAY;
    if (stageOf(flower).name === "bloom") {
      flower.nectar = Math.min(1, flower.nectar + comfort * 1.0 / TICKS_PER_DAY);
    }
  }

  // ── The dead are cleared away — and we record HOW they died ──
  world.flowers = world.flowers.filter((f) => {
    if (f.water <= 0) { world.lost.dried++; return false; }        // 🏜 drought
    if (f.water >= WATER_MAX) { world.lost.rotted++; return false; } // 🌧 rot
    if (f.growth >= FLOWER_LIFESPAN) { world.lost.aged++; return false; } // old age
    return true;
  });

  trySprout();
  for (const bee of world.bees) tickBee(bee);
}

// ── Day one ──
// The world doesn't start empty. A hive, a few bees, and a scattering of
// flowers already growing — otherwise the bees starve before the first
// bloom opens, and you never see the loop run at all.
world.hive = { x: HIVE_X, z: HIVE_Z, honey: 14, brought: 0 };
obstacles.push({ x: HIVE_X, z: HIVE_Z, r: 0.55 });

for (let i = 0; i < 10; i++) {
  const angle = simRand() * Math.PI * 2;
  const dist = 3 + simRand() * 12;
  const flower = plantFlower(Math.cos(angle) * dist, Math.sin(angle) * dist);
  flower.growth = simRand() * 3; // staggered ages, so blooms don't all arrive at once
}
for (let i = 0; i < 3; i++) addBee();
rollWeather();
world.weather = "sun"; // but always open on a fair day, so day 1 is readable

// ══════════════════════════════════════════════════════════════
//  THE VIEW — the only part that knows about three.js.
//  It never decides anything; it just makes the screen agree
//  with `world`, every single frame.
// ══════════════════════════════════════════════════════════════

// Two numbers the whole view shares. They are purely cosmetic — the rules
// never read them, so they can be as smooth and frame-rate-dependent as
// they like without ever disturbing the simulation.
let viewTime = 0;  // seconds since the page loaded
let windSway = 0;  // eases toward the current weather's wind, so the meadow
                   // doesn't snap from calm to gale between one day and the next

// Shared shapes: seventy flowers, but only four geometries in memory.
// Geometry is the expensive part; a material is cheap, so each flower owns
// its own colours and they all borrow the same shapes.
const STEM_GEO = new THREE.CylinderGeometry(0.016, 0.026, 1, 5);
const CENTER_GEO = new THREE.SphereGeometry(0.048, 9, 7);
const PETAL_GEO = new THREE.SphereGeometry(0.042, 8, 6);
const LEAF_GEO = new THREE.SphereGeometry(0.04, 6, 5);
const BUD_GREEN = 0x5f8f3a;
const WILT_BROWN = 0x8a7a55;

// What thirst and rot look like. A parched flower bleaches toward straw;
// a drowned one goes dark and sodden.
const PARCHED = new THREE.Color(0xd8c48f);
const SODDEN = new THREE.Color(0x556052);
const scratchColor = new THREE.Color(); // reused every frame, so we don't
                                        // allocate 70 colour objects per frame

// flower id → the group of meshes showing it.
const flowerMeshes = new Map();

function makeFlowerMesh(flower) {
  const group = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4e7a34, roughness: 1 });
  const stem = new THREE.Mesh(STEM_GEO, stemMat);
  group.add(stem);

  // Two leaves partway up the stem — cheap, and they read as "plant"
  // instantly in a way a bare stick never does.
  const leaves = new THREE.Group();
  for (const side of [-1, 1]) {
    const leaf = new THREE.Mesh(LEAF_GEO, stemMat);
    leaf.position.set(side * 0.055, 0, 0);
    leaf.scale.set(1.8, 0.3, 0.9);
    leaf.rotation.z = side * -0.55;
    leaves.add(leaf);
  }
  leaves.rotation.y = flower.spin;
  group.add(leaves);

  // The head is its own group so it can open, droop and sway as one piece.
  const head = new THREE.Group();
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.85 });
  const center = new THREE.Mesh(CENTER_GEO, centerMat);
  center.position.y = 0.012;
  head.add(center);

  const petalMat = new THREE.MeshStandardMaterial({ color: flower.color, roughness: 1 });

  // TWO rings of petals, the inner ring turned half a step and tilted up
  // more steeply. That offset is the entire difference between "six balls
  // in a circle" and "a flower".
  //
  // Each petal hangs off its own little pivot at the centre of the head.
  // Rotate the pivot and the petal swings around the middle like a real
  // petal does — far easier than working out where to put it with sin/cos.
  for (let ring = 0; ring < 2; ring++) {
    const count = 6;
    const radius = 0.075 - ring * 0.028;
    const tilt = 0.2 + ring * 0.6; // outer petals lie flat, inner ones cup up
    for (let i = 0; i < count; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / count) * Math.PI * 2 + ring * (Math.PI / count) + flower.spin;
      const petal = new THREE.Mesh(PETAL_GEO, petalMat);
      petal.position.set(radius, ring * 0.016, 0);
      petal.scale.set(1.9, 0.32, 0.95); // long, thin, and squashed flat
      petal.rotation.z = tilt;
      pivot.add(petal);
      head.add(pivot);
    }
  }

  group.add(head);
  group.position.set(flower.x, 0, flower.z);
  // Remember the movable parts, so updating doesn't mean searching for them.
  group.userData = { stem, head, leaves, center, centerMat, petalMat, stemMat, phase: flower.spin };
  return group;
}

function updateFlowerMesh(mesh, flower) {
  const stage = stageOf(flower);
  const { stem, head, leaves, center, centerMat, petalMat, stemMat, phase } = mesh.userData;

  // The stem rises over the first two days, then stops.
  const height = 0.13 + (Math.min(flower.growth, 2) / 2) * 0.36;
  stem.scale.y = height;
  stem.position.y = height / 2;
  head.position.y = height;
  leaves.position.y = height * 0.42;
  leaves.visible = flower.growth > 0.6;
  head.visible = stage.name !== "sprout";
  head.rotation.z = 0;

  // ── Thirst shows in the greenery first ──
  // Yellowing leaves are the meadow warning you a day before anything dies.
  stemMat.color.setHex(
    flower.water < 0.55 ? 0x9d9048 :  // going yellow — thirsty
    flower.water > 1.5 ? 0x3b5a30 :   // dark and soft — waterlogged
    0x4e7a34
  );

  if (stage.name === "bud") {
    head.scale.setScalar(0.4);
    petalMat.color.set(BUD_GREEN);
    centerMat.color.set(BUD_GREEN);
  } else if (stage.name === "bloom") {
    // Opens over the first half-day of blooming, instead of popping.
    head.scale.setScalar(THREE.MathUtils.clamp((flower.growth - 2) / 0.5, 0.4, 1));

    // Start from the flower's own colour, then drag it toward straw or
    // toward sodden grey depending on which way the water is going wrong.
    scratchColor.setHex(flower.color);
    if (flower.water < 0.75) {
      scratchColor.lerp(PARCHED, Math.min(1, (0.75 - flower.water) / 0.75));
    } else if (flower.water > 1.35) {
      scratchColor.lerp(SODDEN, Math.min(1, (flower.water - 1.35) / 0.65));
    }
    petalMat.color.copy(scratchColor);

    // A full flower has a fat golden middle; a drained one is flat and pale.
    // This is the bees' dinner, drawn where you can see it disappear.
    center.scale.setScalar(0.75 + flower.nectar * 0.5);
    centerMat.color.setHex(flower.nectar > 0.3 ? 0xf2c14e : 0xc9b98a);
  } else if (stage.name === "wilting") {
    head.scale.setScalar(0.7);
    petalMat.color.set(WILT_BROWN);
    centerMat.color.set(0x7c6a45);
    center.scale.setScalar(0.8);
    head.rotation.z = 0.7; // hangs its head
  }

  // ── Wind ──
  // The whole plant leans from its base, like a stem bending. Every flower
  // gets its own phase, so the meadow ripples instead of marching in step.
  const sway = windSway * (0.05 + height * 0.3);
  mesh.rotation.z = Math.sin(viewTime * 2.2 + phase) * sway;
  mesh.rotation.x = Math.cos(viewTime * 1.7 + phase * 1.3) * sway * 0.6;
}

// Make the screen agree with the data: build what's new, update what's
// there, throw away what died. The world never has to tell it anything.
function syncFlowers() {
  for (const flower of world.flowers) {
    let mesh = flowerMeshes.get(flower.id);
    if (!mesh) {
      mesh = makeFlowerMesh(flower);
      flowerMeshes.set(flower.id, mesh);
      scene.add(mesh);
    }
    updateFlowerMesh(mesh, flower);
  }

  const living = new Set(world.flowers.map((f) => f.id));
  for (const [id, mesh] of flowerMeshes) {
    if (living.has(id)) continue;
    scene.remove(mesh);
    // Geometries are shared, but each flower owns its materials — so those
    // are ours to clean up. Skip this and you leak memory for every flower
    // that ever lived.
    mesh.userData.centerMat.dispose();
    mesh.userData.petalMat.dispose();
    mesh.userData.stem.material.dispose();
    flowerMeshes.delete(id);
  }
}

// ── The hive ──
// A straw skep: three squashed domes stacked smallest-on-top, with a dark
// doorway. Built once, never updated — it just stands there being home.
function buildHiveMesh(hive) {
  const group = new THREE.Group();
  const straw = new THREE.MeshStandardMaterial({ color: 0xd9b25f, roughness: 1 });

  const tiers = [
    { r: 0.42, y: 0.09, h: 0.18 },
    { r: 0.34, y: 0.26, h: 0.16 },
    { r: 0.23, y: 0.40, h: 0.14 },
  ];
  for (const t of tiers) {
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(t.r * 0.86, t.r, t.h, 12), straw);
    dome.position.y = t.y;
    dome.castShadow = true;
    group.add(dome);
  }
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), straw);
  cap.position.y = 0.49;
  cap.scale.y = 0.6;
  cap.castShadow = true;
  group.add(cap);

  // The doorway, pushed just proud of the front wall so it doesn't z-fight.
  const door = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.03, 10),
    new THREE.MeshStandardMaterial({ color: 0x2e2415, roughness: 1 })
  );
  door.rotation.x = Math.PI / 2;
  door.position.set(0, 0.13, 0.4);
  group.add(door);

  // A little landing board, because every real hive has one.
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.03, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 1 })
  );
  board.position.set(0, 0.06, 0.45);
  board.castShadow = true;
  group.add(board);

  group.position.set(hive.x, 0, hive.z);
  scene.add(group);
  return group;
}
const hiveMesh = buildHiveMesh(world.hive);

// ── Bees ──
// Shared geometry again: twelve bees, five shapes.
const BEE_BODY_GEO = new THREE.SphereGeometry(0.055, 8, 6);
const BEE_HEAD_GEO = new THREE.SphereGeometry(0.038, 8, 6);
const BEE_STRIPE_GEO = new THREE.SphereGeometry(0.056, 8, 6);
const BEE_WING_GEO = new THREE.SphereGeometry(0.05, 6, 5);
const BEE_YELLOW = new THREE.MeshStandardMaterial({ color: 0xf0c33c, roughness: 0.9 });
const BEE_BLACK = new THREE.MeshStandardMaterial({ color: 0x2b2419, roughness: 0.9 });
const BEE_WING = new THREE.MeshStandardMaterial({
  color: 0xdfeaf2, roughness: 0.4, transparent: true, opacity: 0.55,
});

const beeMeshes = new Map();

function makeBeeMesh() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(BEE_BODY_GEO, BEE_YELLOW);
  body.scale.set(1, 0.9, 1.5); // stretched along +z, which is "forward"
  body.castShadow = true;
  group.add(body);

  // Two stripes: the same sphere, slightly bigger, squashed into a band.
  for (const z of [-0.01, 0.035]) {
    const stripe = new THREE.Mesh(BEE_STRIPE_GEO, BEE_BLACK);
    stripe.scale.set(1.01, 0.92, 0.16);
    stripe.position.z = z;
    group.add(stripe);
  }

  const head = new THREE.Mesh(BEE_HEAD_GEO, BEE_BLACK);
  head.position.z = 0.075;
  group.add(head);

  const wings = [];
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(BEE_WING_GEO, BEE_WING);
    wing.position.set(side * 0.045, 0.04, -0.01);
    wing.scale.set(0.6, 0.12, 1.5);
    wings.push(wing);
    group.add(wing);
  }

  group.userData = { wings, lastX: 0, lastZ: 0, heading: 0 };
  scene.add(group);
  return group;
}

function syncBees() {
  for (const bee of world.bees) {
    let mesh = beeMeshes.get(bee.id);
    if (!mesh) {
      mesh = makeBeeMesh();
      mesh.userData.lastX = bee.x;
      mesh.userData.lastZ = bee.z;
      beeMeshes.set(bee.id, mesh);
    }
    const d = mesh.userData;
    const grounded = bee.state === "grounded";

    // Height: cruising bees fly, grounded ones crawl on the landing board.
    const flying = grounded ? 0.09 : 0.55 + Math.sin(viewTime * 6 + bee.phase) * 0.06;
    mesh.position.set(bee.x, flying, bee.z);

    // Point where you're going. Work the heading out from how far the bee
    // actually moved — the view never needs to ask the rules anything.
    const dx = bee.x - d.lastX, dz = bee.z - d.lastZ;
    if (Math.hypot(dx, dz) > 0.001) {
      d.heading = turnToward(d.heading, Math.atan2(dx, dz), 0.25);
    }
    d.lastX = bee.x;
    d.lastZ = bee.z;
    mesh.rotation.y = d.heading;

    // Wings blur when flying, fold when grounded.
    const flap = grounded ? 0.1 : Math.sin(viewTime * 55 + bee.phase) * 0.7 + 0.4;
    d.wings[0].rotation.z = flap;
    d.wings[1].rotation.z = -flap;

    // A loaded bee tips nose-up, like something heavy is hanging behind it.
    mesh.rotation.x = -bee.nectar * 0.35;
  }

  const living = new Set(world.bees.map((b) => b.id));
  for (const [id, mesh] of beeMeshes) {
    if (living.has(id)) continue;
    scene.remove(mesh);      // geometry and materials are all shared here,
    beeMeshes.delete(id);    // so there is nothing of our own to dispose
  }
}

// ══════════════════════════════════════════════════════════════
//  THE SKY — weather, but only the part you can see.
//  Not one line of this changes what happens; it just makes
//  the screen agree with `world.weather`.
// ══════════════════════════════════════════════════════════════

const RAIN_COUNT = 500;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_COUNT * 3);
for (let i = 0; i < RAIN_COUNT; i++) {
  // Math.random, deliberately: raindrops are decoration, and must never
  // eat numbers out of the seeded bags that decide the world's story.
  rainPos[i * 3] = (Math.random() - 0.5) * 26;
  rainPos[i * 3 + 1] = Math.random() * 12;
  rainPos[i * 3 + 2] = (Math.random() - 0.5) * 26;
}
rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.Points(
  rainGeo,
  new THREE.PointsMaterial({ color: 0x9fc4e2, size: 0.075, transparent: true, opacity: 0.8 })
);
rain.visible = false;
scene.add(rain);

const skyColor = new THREE.Color(WEATHER.sun.sky);

function updateSky(dt) {
  const w = WEATHER[world.weather];

  // Everything eases. A sky that snapped from blue to grey the instant the
  // day rolled over would look like a bug, even though it would be correct.
  const ease = Math.min(1, dt * 1.5);
  skyColor.lerp(scratchColor.setHex(w.sky), ease);
  renderer.setClearColor(skyColor);
  scene.fog.color.copy(skyColor);
  scene.fog.near += (w.fogNear - scene.fog.near) * ease;
  sun.intensity += (w.sunLight - sun.intensity) * ease;
  hemi.intensity += (w.hemiLight - hemi.intensity) * ease;
  windSway += (w.wind - windSway) * ease;

  // Rain falls in a box that follows you, so it always rains where you're
  // looking without drawing raindrops over the whole meadow.
  rain.visible = world.weather === "rain";
  if (rain.visible) {
    rain.position.set(hero.position.x, 0, hero.position.z);
    const pos = rainGeo.attributes.position;
    for (let i = 0; i < RAIN_COUNT; i++) {
      let y = pos.getY(i) - 15 * dt;
      if (y < 0) y = 12;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }
}

// ── The little bits of screen furniture ──
const hudEl = document.getElementById("hud");
const toastEl = document.getElementById("toast");
let toastTimer = 0;

function say(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

function updateHud() {
  const blooming = world.flowers.filter((f) => stageOf(f).name === "bloom").length;
  const w = WEATHER[world.weather];
  const drought = isDrought() ? ` · 🏜 drought (${world.dryDays}d)` : "";
  const grounded = world.beesCanFly ? "" : " (grounded)";
  hudEl.textContent =
    `Day ${world.day} · ${w.icon} ${w.label}${drought} · ` +
    `🌸 ${blooming}/${world.flowers.length} · 🐝 ${world.bees.length}${grounded} · ` +
    `🍯 ${world.hive.honey.toFixed(1)}`;
}

// How thirsty is this flower, in words?
function waterWord(flower) {
  if (flower.water < 0.4) return "🏜 parched";
  if (flower.water < 0.75) return "🥵 thirsty";
  if (flower.water > 1.6) return "🫗 drowning";
  if (flower.water > 1.25) return "💧 soggy";
  return "🙂 happy";
}

// ── E: the gardener's first tool ──
function interact() {
  const hx = hero.position.x, hz = hero.position.z;

  // Standing at the hive? Then E asks the hive how it's doing.
  if (Math.hypot(hx - world.hive.x, hz - world.hive.z) < 1.6) {
    const busy = world.bees.filter((b) => b.state !== "grounded").length;
    say(
      `🍯 ${world.hive.honey.toFixed(1)} honey · 🐝 ${world.bees.length} bees (${busy} out) · ` +
      `eats ${(world.bees.length * HIVE_EATS_PER_BEE).toFixed(1)}/day`
    );
    return;
  }

  // Standing over a flower? Then E is a question, not a shovel.
  const flower = nearestFlower(hx, hz, 1.0);
  if (flower) {
    const stage = stageOf(flower);
    say(
      `${stage.icon} ${stage.name} · ${waterWord(flower)} · ` +
      `nectar ${Math.round(flower.nectar * 100)}% · ${flower.growth.toFixed(1)} days old`
    );
    return;
  }

  // Nothing grows inside a rock.
  for (const o of obstacles) {
    if (Math.hypot(hx - o.x, hz - o.z) < o.r + 0.15) {
      say("🚫 No room to plant here");
      return;
    }
  }

  plantFlower(hx, hz);
  say("🌱 Planted");
}

// ── Controls ──
const keys = new Set();
addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
  if (e.repeat) return;
  const k = e.key.toLowerCase();
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) keys.add(k);
  else if (k === "e" || k === " ") interact();
  // R rerolls the map. The new seed goes in the address bar, so any world
  // you stumble into is one you can come back to — or send to someone else.
  else if (k === "r") location.search = `?seed=${Math.floor(Math.random() * 10000)}`;
  // F stamps the living world — run the same seed twice, do the same
  // things, and these should match.
  else if (k === "f") say(`🔍 day ${world.day} · world ${worldFingerprint()}`);
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

// ── Zoom: the scroll wheel pulls the camera in and out ──
// We store a target and ease toward it, so a flick of the wheel glides
// instead of snapping.
let zoom = 1;
let zoomTarget = 1;
addEventListener("wheel", (e) => {
  e.preventDefault();
  // Math.sign, not the raw amount: mice and trackpads report wildly
  // different numbers, and we want one notch to mean one step on both.
  zoomTarget = THREE.MathUtils.clamp(zoomTarget * (1 + Math.sign(e.deltaY) * 0.12), 0.45, 2.2);
}, { passive: false });

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitResolution();
});

// ── The loop: runs ~60 times a second, forever ──
const clock = new THREE.Clock();
const SPEED = 4;
const HERO_RADIUS = 0.3;
const CAMERA_OFFSET = new THREE.Vector3(5.5, 8.5, 5.5);

// Turn the shortest way round: facing +170° and asked for -170° should be a
// 20° nudge, not a 340° spin.
function turnToward(current, target, amount) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * amount;
}

// Collision, the simple way: walk first, apologise afterwards. If we ended
// up inside something, shove straight back out along the line between the
// two centres. Push out sideways rather than stopping dead, and you slide
// along a tree instead of sticking to it.
function pushOutOfObstacles(p) {
  // Twice, because escaping one rock can bury you in its neighbour.
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const gap = o.r + HERO_RADIUS;
      const dist = Math.hypot(dx, dz);
      if (dist < gap && dist > 0.0001) {
        const push = (gap - dist) / dist;
        p.x += dx * push;
        p.z += dz * push;
      }
    }
  }
}

let walkPhase = 0; // where we are in the walk cycle
let stride = 0;    // 0 = standing still, 1 = walking. Eased, so it fades in and out.

// Left-over real time that hasn't been spent on a tick yet.
let unspentTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  // ── The heartbeat: a FIXED timestep ──
  // Drawing happens as often as your screen can manage — 60, 144, whatever.
  // But the world moves in ticks of exactly a quarter-second, always.
  //
  // Why not just tick once per frame? Because then a fast computer would
  // run the world faster than a slow one, and the same seed would give you
  // a different meadow on a different machine. The rules must not care how
  // pretty your graphics card is. We save up real time, and spend it in
  // exact quarter-seconds.
  unspentTime += dt;
  while (unspentTime >= TICK_SECONDS) {
    unspentTime -= TICK_SECONDS;
    tick(world);
  }

  // Walk.
  let dx = 0, dz = 0;
  if (keys.has("w") || keys.has("arrowup")) dz -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dz += 1;
  if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  const moving = dx !== 0 || dz !== 0;
  if (moving) {
    const len = Math.hypot(dx, dz);
    hero.position.x += (dx / len) * SPEED * dt;
    hero.position.z += (dz / len) * SPEED * dt;
    pushOutOfObstacles(hero.position);
    hero.position.x = THREE.MathUtils.clamp(hero.position.x, -21, 21);
    hero.position.z = THREE.MathUtils.clamp(hero.position.z, -21, 21);
    hero.rotation.y = turnToward(hero.rotation.y, Math.atan2(dx, dz), Math.min(1, dt * 12));
  }

  // ── Bring the villager to life ──
  // stride eases toward 1 while walking and back to 0 when stopped, so the
  // whole animation fades in and out instead of switching on like a light.
  stride += ((moving ? 1 : 0) - stride) * Math.min(1, dt * 10);
  if (moving) walkPhase += dt * 9;
  const step = Math.sin(walkPhase);
  body.position.y = Math.abs(step) * 0.06 * stride     // bounce, twice per stride
    + Math.sin(time * 2) * 0.012 * (1 - stride);       // and breathing when still
  body.rotation.x = 0.12 * stride;                     // lean into the walk
  body.rotation.z = step * 0.05 * stride;              // gentle sway
  armLeft.rotation.x = step * 0.85 * stride;           // arms swing opposite
  armRight.rotation.x = -step * 0.85 * stride;         // each other, like yours do

  // The camera follows the hero, at whatever distance the wheel asked for.
  zoom += (zoomTarget - zoom) * Math.min(1, dt * 8);
  camera.position.lerp(
    new THREE.Vector3(
      hero.position.x + CAMERA_OFFSET.x * zoom,
      CAMERA_OFFSET.y * zoom,
      hero.position.z + CAMERA_OFFSET.z * zoom
    ),
    0.06
  );
  camera.lookAt(hero.position.x, 0.6, hero.position.z);

  // Last: make the screen agree with the world.
  viewTime = time;
  updateSky(dt);   // sets windSway, which the flowers lean with
  syncFlowers();
  syncBees();
  updateHud();

  renderer.render(scene, camera);
}

camera.position.set(5.5, 8.5, 9);
animate();
