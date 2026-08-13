"use strict";

// ── Fluffy Acres: the human player. ──
// This file only reads state and sends actions to the engine —
// exactly what the AI agent will do in phase 2, minus the clicking.

const boardEl = document.getElementById("board");
const dayEl = document.getElementById("day");
const weatherEl = document.getElementById("weather");
const goldEl = document.getElementById("gold");
const energyEl = document.getElementById("energy");
const toolsEl = document.getElementById("tools");
const seedsEl = document.getElementById("seeds");
const logEl = document.getElementById("log");
const fieldNoteEl = document.getElementById("field-note");
const endDayBtn = document.getElementById("end-day");
const newGameBtn = document.getElementById("new-game");
const gameoverEl = document.getElementById("gameover");
const finalGoldEl = document.getElementById("final-gold");
const playAgainBtn = document.getElementById("play-again");

const TOOLS = [
  { id: "till", label: "Till", emoji: "🚜", hint: "Turn grass into soil you can plant in." },
  { id: "water", label: "Water", emoji: "💧", hint: "A crop only grows on nights it was watered." },
  { id: "harvest", label: "Harvest", emoji: "🧺", hint: "Sell a ready crop for gold." },
];

let state = newGame(Math.floor(Math.random() * 1e9));
let tool = { kind: "till" };

function buildToolButtons() {
  for (const t of TOOLS) {
    const btn = document.createElement("button");
    btn.className = "tool";
    btn.dataset.tool = t.id;
    btn.title = t.hint;
    btn.innerHTML = `<span class="tool-emoji">${t.emoji}</span>${t.label}`;
    btn.addEventListener("click", () => { tool = { kind: t.id }; render(); });
    toolsEl.appendChild(btn);
  }
  for (const [type, crop] of Object.entries(CROPS)) {
    const btn = document.createElement("button");
    btn.className = "seed";
    btn.dataset.seed = type;
    btn.title = `Needs ${crop.nights} watered nights.`;
    btn.innerHTML =
      `<span class="seed-emoji">${crop.emoji}</span>` +
      `<span class="seed-name">${crop.name}</span>` +
      `<span class="seed-econ">${crop.cost}g → ${crop.sell}g · ${crop.nights} nights</span>`;
    btn.addEventListener("click", () => { tool = { kind: "plant", crop: type }; render(); });
    seedsEl.appendChild(btn);
  }
}

function log(message, ok = true) {
  const li = document.createElement("li");
  li.textContent = message;
  if (!ok) li.className = "nope";
  logEl.appendChild(li);
  logEl.scrollTop = logEl.scrollHeight;
}

function onTileClick(r, c) {
  const action =
    tool.kind === "plant"
      ? { type: "plant", crop: tool.crop, r, c }
      : { type: tool.kind, r, c };
  const result = applyAction(state, action);
  log(result.message, result.ok);
  render();
}

function tileFace(tile) {
  if (!tile.crop) return "";
  if (isReady(tile.crop)) return CROPS[tile.crop.type].emoji;
  return tile.crop.grown === 0 ? "🌱" : "🌿";
}

function render() {
  dayEl.textContent = state.day;
  goldEl.textContent = state.gold;
  weatherEl.textContent = state.weather === "rain" ? "🌧 Rainy" : "☀️ Sunny";
  weatherEl.title =
    state.weather === "rain" ? "Every crop is watered for free today." : "Crops need watering today.";

  energyEl.innerHTML = "";
  for (let i = 0; i < AP_PER_DAY; i++) {
    const pip = document.createElement("span");
    pip.className = i < state.ap ? "pip" : "pip spent";
    energyEl.appendChild(pip);
  }

  boardEl.innerHTML = "";
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const tile = state.grid[r][c];
      const btn = document.createElement("button");
      btn.className = "tile";
      if (tile.tilled) btn.classList.add("tilled");
      if (tile.crop?.watered) btn.classList.add("watered");
      if (tile.crop && isReady(tile.crop)) btn.classList.add("ready");
      btn.textContent = tileFace(tile);
      const crop = tile.crop && CROPS[tile.crop.type];
      btn.title = crop
        ? `${crop.name}: ${Math.min(tile.crop.grown, crop.nights)}/${crop.nights} nights` +
          (isReady(tile.crop) ? " — ready!" : tile.crop.watered ? ", watered" : ", thirsty")
        : tile.tilled ? "Tilled soil" : "Grass";
      btn.addEventListener("click", () => onTileClick(r, c));
      boardEl.appendChild(btn);
    }
  }

  for (const btn of toolsEl.querySelectorAll(".tool"))
    btn.classList.toggle("selected", tool.kind === btn.dataset.tool);
  for (const btn of seedsEl.querySelectorAll(".seed")) {
    btn.classList.toggle("selected", tool.kind === "plant" && tool.crop === btn.dataset.seed);
    btn.disabled = state.gold < CROPS[btn.dataset.seed].cost;
  }

  endDayBtn.disabled = state.over;
  fieldNoteEl.textContent = `field #${state.seed}`;
  gameoverEl.classList.toggle("hidden", !state.over);
  if (state.over) finalGoldEl.textContent = state.gold;
}

function startSeason(seed) {
  state = newGame(seed);
  tool = { kind: "till" };
  logEl.innerHTML = "";
  log(`A new season begins on field #${state.seed}. ${state.weather === "rain" ? "It's raining!" : "The sun is out."}`);
  render();
}

endDayBtn.addEventListener("click", () => {
  for (const message of endDay(state).messages) log(message);
  render();
});
newGameBtn.addEventListener("click", () => startSeason(Math.floor(Math.random() * 1e9)));
playAgainBtn.addEventListener("click", () => startSeason(Math.floor(Math.random() * 1e9)));

buildToolButtons();
startSeason(state.seed);
