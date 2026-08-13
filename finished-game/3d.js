"use strict";

// ── Fluffy Acres 3D: a walk-around view over the same engine. ──
// Nothing about the rules lives here. This file draws state.grid,
// moves a farmer, and turns the E key into the same applyAction()
// calls the 2D page (and later, the AI agent) uses.

(function () {
  // ── Scene basics ──
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById("app").appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xbfd8ef, 0x6d8a4e, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2d9, 0.95);
  sun.position.set(8, 12, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -10;
  sun.shadow.camera.right = sun.shadow.camera.top = 10;
  scene.add(sun);

  // ── Materials & geometry, shared across tiles ──
  const MAT = {
    grass: new THREE.MeshStandardMaterial({ color: 0xa9c47c, roughness: 1 }),
    soil: new THREE.MeshStandardMaterial({ color: 0xa0764f, roughness: 1 }),
    soilWet: new THREE.MeshStandardMaterial({ color: 0x7c5a3c, roughness: 1 }),
    ground: new THREE.MeshStandardMaterial({ color: 0x86a85c, roughness: 1 }),
    sprout: new THREE.MeshStandardMaterial({ color: 0x4f7d33, roughness: 1 }),
    bush: new THREE.MeshStandardMaterial({ color: 0x5e8f3f, roughness: 1 }),
    lettuce: new THREE.MeshStandardMaterial({ color: 0x9ccb58, roughness: 1 }),
    pumpkin: new THREE.MeshStandardMaterial({ color: 0xd97a2b, roughness: 1 }),
    melon: new THREE.MeshStandardMaterial({ color: 0xbfd9a4, roughness: 1 }),
    stem: new THREE.MeshStandardMaterial({ color: 0x5d4a2f, roughness: 1 }),
    ring: new THREE.MeshStandardMaterial({ color: 0xd9a514, roughness: 0.5 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 1 }),
    leaves: new THREE.MeshStandardMaterial({ color: 0x4c7a3a, roughness: 1 }),
    barn: new THREE.MeshStandardMaterial({ color: 0xb5502f, roughness: 1 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x6e4a30, roughness: 1 }),
    overalls: new THREE.MeshStandardMaterial({ color: 0x4e86be, roughness: 1 }),
    skin: new THREE.MeshStandardMaterial({ color: 0xf2c9a0, roughness: 1 }),
    hat: new THREE.MeshStandardMaterial({ color: 0xd9a514, roughness: 1 }),
  };
  const GEO = {
    tile: new THREE.BoxGeometry(0.92, 0.12, 0.92),
    sprout: new THREE.ConeGeometry(0.09, 0.24, 6),
    bush: new THREE.IcosahedronGeometry(0.17, 0),
    fruit: new THREE.SphereGeometry(0.23, 14, 10),
    stem: new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6),
    ring: new THREE.TorusGeometry(0.32, 0.028, 8, 28),
  };

  // ── The world ──
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(34, 34), MAT.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const tileX = (c) => c - (GRID - 1) / 2;
  const tileZ = (r) => r - (GRID - 1) / 2;

  const cells = [];
  for (let r = 0; r < GRID; r++) {
    cells.push([]);
    for (let c = 0; c < GRID; c++) {
      const box = new THREE.Mesh(GEO.tile, MAT.grass);
      box.position.set(tileX(c), 0.06, tileZ(r));
      box.receiveShadow = true;
      scene.add(box);
      const cropGroup = new THREE.Group();
      cropGroup.position.set(tileX(c), 0.12, tileZ(r));
      scene.add(cropGroup);
      cells[r].push({ box, cropGroup });
    }
  }

  // Selector frame that follows the farmer's tile.
  const selector = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 0.16, 1.0)),
    new THREE.LineBasicMaterial({ color: 0x2f331d })
  );
  selector.position.y = 0.08;
  scene.add(selector);

  // A little scenery: trees and a barn, outside the plot.
  function tree(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.7, 7), MAT.trunk);
    trunk.position.y = 0.35;
    const lower = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.0, 8), MAT.leaves);
    lower.position.y = 1.1;
    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 8), MAT.leaves);
    upper.position.y = 1.7;
    for (const m of [trunk, lower, upper]) { m.castShadow = true; g.add(m); }
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    scene.add(g);
  }
  tree(-4.8, -4.4, 1.15); tree(4.7, -5.1, 0.9); tree(5.4, 3.6, 1.25);
  tree(-5.6, 4.4, 1.0); tree(3.7, 5.6, 0.8); tree(-6.2, -0.6, 0.95);

  const barn = new THREE.Group();
  const barnBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.2, 1.5), MAT.barn);
  barnBody.position.y = 0.6;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.85, 4), MAT.roof);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.25, 1, 0.9);
  roof.position.y = 1.6;
  for (const m of [barnBody, roof]) { m.castShadow = true; barn.add(m); }
  barn.position.set(-5.2, 0, -2.2);
  barn.rotation.y = 0.45;
  scene.add(barn);

  // ── The farmer ──
  const farmer = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.42, 6, 12), MAT.overalls);
  body.position.y = 0.55;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), MAT.skin);
  head.position.y = 1.02;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 14), MAT.hat);
  brim.position.y = 1.16;
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 14), MAT.hat);
  cap.position.y = 1.28;
  for (const m of [body, head, brim, cap]) { m.castShadow = true; farmer.add(m); }
  farmer.position.set(0, 0, 3.6);
  scene.add(farmer);

  // ── Rain ──
  const RAIN_COUNT = 400;
  const rainGeo = new THREE.BufferGeometry();
  const rainPos = new Float32Array(RAIN_COUNT * 3);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainPos[i * 3] = (Math.random() - 0.5) * 18;
    rainPos[i * 3 + 1] = Math.random() * 10;
    rainPos[i * 3 + 2] = (Math.random() - 0.5) * 18;
  }
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(
    rainGeo,
    new THREE.PointsMaterial({ color: 0x6f9cc8, size: 0.07, transparent: true, opacity: 0.75 })
  );
  rain.visible = false;
  scene.add(rain);

  // ── Game state & HUD ──
  let state = newGame(Math.floor(Math.random() * 1e9));
  let selectedSeed = "lettuce";
  let animated = []; // ready-crop rings and fruits that bob

  const dayEl = document.getElementById("day");
  const weatherEl = document.getElementById("weather");
  const goldEl = document.getElementById("gold");
  const energyEl = document.getElementById("energy");
  const seedsEl = document.getElementById("seeds");
  const logEl = document.getElementById("log");
  const nightEl = document.getElementById("night");
  const nightTextEl = document.getElementById("night-text");
  const gameoverEl = document.getElementById("gameover");
  const finalGoldEl = document.getElementById("final-gold");

  const SEED_KEYS = Object.keys(CROPS); // 1, 2, 3 in order

  function buildSeedBar() {
    SEED_KEYS.forEach((type, i) => {
      const crop = CROPS[type];
      const btn = document.createElement("button");
      btn.className = "seed";
      btn.dataset.seed = type;
      btn.innerHTML =
        `<span class="kbd">${i + 1}</span>` +
        `<span class="seed-emoji">${crop.emoji}</span>` +
        `<span class="seed-name">${crop.name}</span>` +
        `<span class="seed-econ">${crop.cost}g → ${crop.sell}g · ${crop.nights} nights</span>`;
      btn.addEventListener("click", () => { selectedSeed = type; hud(); });
      seedsEl.appendChild(btn);
    });
  }

  function log(message, ok = true) {
    const li = document.createElement("li");
    li.textContent = message;
    if (!ok) li.className = "nope";
    logEl.appendChild(li);
    while (logEl.children.length > 60) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function hud() {
    dayEl.textContent = state.day;
    goldEl.textContent = state.gold;
    weatherEl.textContent = state.weather === "rain" ? "🌧 Rainy" : "☀️ Sunny";
    energyEl.innerHTML = "";
    for (let i = 0; i < AP_PER_DAY; i++) {
      const pip = document.createElement("span");
      pip.className = i < state.ap ? "pip" : "pip spent";
      energyEl.appendChild(pip);
    }
    for (const btn of seedsEl.children) {
      btn.classList.toggle("selected", btn.dataset.seed === selectedSeed);
      btn.classList.toggle("broke", state.gold < CROPS[btn.dataset.seed].cost);
    }
    gameoverEl.classList.toggle("hidden", !state.over);
    if (state.over) finalGoldEl.textContent = state.gold;
  }

  // ── Drawing the farm from state ──
  function fruitMesh(type) {
    const g = new THREE.Group();
    const fruit = new THREE.Mesh(GEO.fruit, MAT[type]);
    fruit.castShadow = true;
    fruit.position.y = 0.2;
    if (type === "lettuce") fruit.scale.set(1, 0.8, 1);
    if (type === "pumpkin") {
      fruit.scale.set(1.05, 0.72, 1.05);
      const stem = new THREE.Mesh(GEO.stem, MAT.stem);
      stem.position.y = 0.42;
      g.add(stem);
    }
    g.add(fruit);
    return g;
  }

  function syncFarm() {
    animated = [];
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const tile = state.grid[r][c];
        const cell = cells[r][c];
        cell.box.material = !tile.tilled
          ? MAT.grass
          : tile.crop && tile.crop.watered ? MAT.soilWet : MAT.soil;
        cell.cropGroup.clear();
        if (!tile.crop) continue;
        if (isReady(tile.crop)) {
          const fruit = fruitMesh(tile.crop.type);
          const ring = new THREE.Mesh(GEO.ring, MAT.ring);
          ring.rotation.x = Math.PI / 2;
          ring.position.y = 0.62;
          cell.cropGroup.add(fruit, ring);
          animated.push({ mesh: ring, baseY: 0.62, phase: r * 7 + c });
        } else if (tile.crop.grown === 0) {
          const sprout = new THREE.Mesh(GEO.sprout, MAT.sprout);
          sprout.castShadow = true;
          sprout.position.y = 0.12;
          cell.cropGroup.add(sprout);
        } else {
          const bush = new THREE.Mesh(GEO.bush, MAT.bush);
          bush.castShadow = true;
          const f = 0.5 + 0.5 * (tile.crop.grown / CROPS[tile.crop.type].nights);
          bush.scale.setScalar(f);
          bush.position.y = 0.14 * f;
          cell.cropGroup.add(bush);
        }
      }
    }
  }

  function applyWeather() {
    const rainy = state.weather === "rain";
    const sky = rainy ? 0x93a7b8 : 0xbfe0f5;
    renderer.setClearColor(sky);
    scene.fog = new THREE.Fog(sky, 20, 42);
    sun.intensity = rainy ? 0.4 : 0.95;
    hemi.intensity = rainy ? 0.65 : 0.9;
    rain.visible = rainy;
  }

  // ── Playing ──
  function farmerTile() {
    const c = Math.round(farmer.position.x + (GRID - 1) / 2);
    const r = Math.round(farmer.position.z + (GRID - 1) / 2);
    if (r < 0 || r >= GRID || c < 0 || c >= GRID) return null;
    return { r, c };
  }

  // One context-sensitive "work" key: do whatever this tile needs next.
  // The engine still receives plain till/plant/water/harvest actions.
  function workTile() {
    const rc = farmerTile();
    if (!rc) return log("Walk onto the field first.", false);
    const tile = state.grid[rc.r][rc.c];
    let action = null;
    if (!tile.tilled) action = { type: "till", ...rc };
    else if (!tile.crop) action = { type: "plant", crop: selectedSeed, ...rc };
    else if (isReady(tile.crop)) action = { type: "harvest", ...rc };
    else if (!tile.crop.watered) action = { type: "water", ...rc };
    if (!action) return log("That crop is watered and growing — nothing to do.");
    const result = applyAction(state, action);
    log(result.message, result.ok);
    syncFarm();
    hud();
  }

  let sleeping = false;
  function sleep() {
    if (state.over || sleeping) return;
    sleeping = true;
    const { messages } = endDay(state);
    nightTextEl.textContent = "🌙 " + messages.join(" ");
    nightEl.classList.add("show");
    setTimeout(() => {
      nightEl.classList.remove("show");
      for (const m of messages) log(m);
      syncFarm();
      applyWeather();
      hud();
      sleeping = false;
    }, 900);
  }

  function startSeason(seed) {
    state = newGame(seed);
    selectedSeed = "lettuce";
    logEl.innerHTML = "";
    farmer.position.set(0, 0, 3.6);
    log(`A new season begins on field #${state.seed}. ${state.weather === "rain" ? "It's raining!" : "The sun is out."}`);
    syncFarm();
    applyWeather();
    hud();
  }

  // ── Input ──
  const keys = new Set();
  addEventListener("keydown", (e) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) keys.add(k);
    else if (k === "e" || k === " ") workTile();
    else if (k === "n" || k === "enter") sleep();
    else if (["1", "2", "3"].includes(k)) { selectedSeed = SEED_KEYS[Number(k) - 1]; hud(); }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

  document.getElementById("end-day").addEventListener("click", sleep);
  document.getElementById("play-again").addEventListener("click", () =>
    startSeason(Math.floor(Math.random() * 1e9))
  );

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  // ── The loop ──
  const clock = new THREE.Clock();
  const SPEED = 3.8;
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    let dx = 0, dz = 0;
    if (keys.has("w") || keys.has("arrowup")) dz -= 1;
    if (keys.has("s") || keys.has("arrowdown")) dz += 1;
    if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
    if (keys.has("d") || keys.has("arrowright")) dx += 1;
    const moving = dx !== 0 || dz !== 0;
    if (moving && !state.over) {
      const len = Math.hypot(dx, dz);
      farmer.position.x = THREE.MathUtils.clamp(farmer.position.x + (dx / len) * SPEED * dt, -7, 7);
      farmer.position.z = THREE.MathUtils.clamp(farmer.position.z + (dz / len) * SPEED * dt, -7, 7);
      farmer.rotation.y = Math.atan2(dx, dz);
      body.position.y = 0.55 + Math.abs(Math.sin(t * 9)) * 0.06;
    } else {
      body.position.y = 0.55;
    }

    const rc = farmerTile();
    selector.visible = !!rc && !state.over;
    if (rc) selector.position.set(tileX(rc.c), 0.08, tileZ(rc.r));

    for (const a of animated) {
      a.mesh.rotation.z = t * 1.5 + a.phase;
      a.mesh.position.y = a.baseY + Math.sin(t * 2 + a.phase) * 0.04;
    }

    if (rain.visible) {
      const pos = rainGeo.attributes.position;
      for (let i = 0; i < RAIN_COUNT; i++) {
        let y = pos.getY(i) - 13 * dt;
        if (y < 0) y = 10;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }

    const target = new THREE.Vector3(
      farmer.position.x + 5.5,
      8.2,
      farmer.position.z + 5.5
    );
    camera.position.lerp(target, 0.06);
    camera.lookAt(farmer.position.x, 0.6, farmer.position.z);

    renderer.render(scene, camera);
  }

  buildSeedBar();
  startSeason(state.seed);
  camera.position.set(5.5, 8.2, 9);
  animate();
})();
