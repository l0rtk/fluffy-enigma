"use strict";

// ── Fluffy Acres: the game rules. No UI code in this file. ──
//
// Everything a player does goes through applyAction(state, action).
// That means a "player" is just anything that produces actions from
// a state — a human clicking buttons, a scripted bot, or (phase 2)
// an AI agent. legalActions() and serialize() exist for that future
// player: one lists what's possible, the other turns the farm into
// text an agent can read.

const GRID = 6;
const LAST_DAY = 30;
const AP_PER_DAY = 5;
const START_GOLD = 20;
const RAIN_CHANCE = 0.3;

const CROPS = {
  lettuce: { name: "Lettuce", emoji: "🥬", cost: 5,  nights: 2, sell: 9 },
  pumpkin: { name: "Pumpkin", emoji: "🎃", cost: 12, nights: 4, sell: 28 },
  melon:   { name: "Melon",   emoji: "🍈", cost: 30, nights: 8, sell: 90 },
};

// Deterministic random numbers (mulberry32). Same seed → same weather
// every day of the season, so two players can be compared on an
// identical game. The RNG state lives inside the game state.
function rand(state) {
  let t = (state.rngState = (state.rngState + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function forEachTile(state, fn) {
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++) fn(state.grid[r][c], r, c);
}

function rollWeather(state) {
  state.weather = rand(state) < RAIN_CHANCE ? "rain" : "sun";
  if (state.weather === "rain")
    forEachTile(state, (tile) => { if (tile.crop) tile.crop.watered = true; });
}

function newGame(seed) {
  const state = {
    seed: (seed ?? 1) >>> 0 || 1,
    rngState: (seed ?? 1) >>> 0 || 1,
    day: 1,
    gold: START_GOLD,
    ap: AP_PER_DAY,
    weather: "sun",
    over: false,
    grid: Array.from({ length: GRID }, () =>
      Array.from({ length: GRID }, () => ({ tilled: false, crop: null }))
    ),
  };
  rollWeather(state);
  return state;
}

function isReady(crop) {
  return crop.grown >= CROPS[crop.type].nights;
}

// One action costs 1 energy. Returns { ok, message } — on ok:false the
// state is untouched and the message says why (this rejection message
// is exactly what an agent will read to correct itself).
function applyAction(state, action) {
  if (state.over) return { ok: false, message: "The season is over." };
  if (state.ap <= 0) return { ok: false, message: "Out of energy — end the day." };
  const tile = state.grid[action.r]?.[action.c];
  if (!tile) return { ok: false, message: "That's outside the farm." };
  const at = `(${action.r + 1},${action.c + 1})`;

  switch (action.type) {
    case "till": {
      if (tile.tilled) return { ok: false, message: `${at} is already tilled.` };
      tile.tilled = true;
      state.ap--;
      return { ok: true, message: `Tilled ${at}.` };
    }
    case "plant": {
      const crop = CROPS[action.crop];
      if (!crop) return { ok: false, message: "Unknown seed." };
      if (!tile.tilled) return { ok: false, message: `${at} isn't tilled yet — till it first.` };
      if (tile.crop) return { ok: false, message: `${at} already has a crop.` };
      if (state.gold < crop.cost)
        return { ok: false, message: `Not enough gold for ${crop.name.toLowerCase()} seeds (${crop.cost}g).` };
      state.gold -= crop.cost;
      tile.crop = { type: action.crop, grown: 0, watered: state.weather === "rain" };
      state.ap--;
      return { ok: true, message: `Planted ${crop.name.toLowerCase()} at ${at} — ready after ${crop.nights} watered nights.` };
    }
    case "water": {
      if (!tile.crop) return { ok: false, message: `Nothing planted at ${at}.` };
      if (isReady(tile.crop)) return { ok: false, message: `${at} is ready — harvest it instead.` };
      if (tile.crop.watered) return { ok: false, message: `${at} is already watered today.` };
      tile.crop.watered = true;
      state.ap--;
      return { ok: true, message: `Watered ${at}.` };
    }
    case "harvest": {
      if (!tile.crop) return { ok: false, message: `Nothing to harvest at ${at}.` };
      if (!isReady(tile.crop)) return { ok: false, message: `${at} isn't ready yet.` };
      const crop = CROPS[tile.crop.type];
      state.gold += crop.sell;
      tile.crop = null;
      state.ap--;
      return { ok: true, message: `Harvested ${crop.name.toLowerCase()} at ${at}: +${crop.sell}g.` };
    }
    default:
      return { ok: false, message: "Unknown action." };
  }
}

// Night falls: watered crops grow one step, then a new day begins with
// fresh energy and new weather. Rain waters every crop for free.
function endDay(state) {
  if (state.over) return { messages: ["The season is over."] };
  let grew = 0, thirsty = 0, ready = 0;
  forEachTile(state, (tile) => {
    const crop = tile.crop;
    if (!crop) return;
    if (isReady(crop)) { ready++; return; }
    if (crop.watered) {
      crop.grown++;
      crop.watered = false;
      grew++;
      if (isReady(crop)) ready++;
    } else {
      thirsty++;
    }
  });

  const messages = [];
  if (grew) messages.push(`${grew} crop${grew > 1 ? "s" : ""} grew overnight.`);
  if (thirsty) messages.push(`${thirsty} went unwatered and didn't grow.`);
  if (ready) messages.push(`${ready} ready to harvest.`);

  if (state.day >= LAST_DAY) {
    state.over = true;
    state.ap = 0;
    messages.push(`The season is over — final harvest: ${state.gold} gold.`);
    return { messages };
  }

  state.day++;
  state.ap = AP_PER_DAY;
  rollWeather(state);
  messages.push(
    state.weather === "rain"
      ? `Day ${state.day}: rain — every crop drinks for free today.`
      : `Day ${state.day}: sunshine.`
  );
  return { messages };
}

// Every action that would succeed right now. This is the future
// agent's menu (and handy for bots and tests).
function legalActions(state) {
  const actions = [];
  if (state.over || state.ap <= 0) return actions;
  forEachTile(state, (tile, r, c) => {
    if (!tile.tilled) {
      actions.push({ type: "till", r, c });
    } else if (!tile.crop) {
      for (const type of Object.keys(CROPS))
        if (state.gold >= CROPS[type].cost) actions.push({ type: "plant", crop: type, r, c });
    } else if (isReady(tile.crop)) {
      actions.push({ type: "harvest", r, c });
    } else if (!tile.crop.watered) {
      actions.push({ type: "water", r, c });
    }
  });
  return actions;
}

// The farm as plain text — what an AI agent will "see".
function serialize(state) {
  const legend = Object.entries(CROPS)
    .map(([key, c]) => `${key[0]}=${key} (${c.cost}g, ${c.nights} nights, sells ${c.sell}g)`)
    .join(", ");
  const rows = state.grid
    .map((row) =>
      row
        .map((tile) => {
          if (!tile.crop) return tile.tilled ? "~~" : "..";
          const letter = tile.crop.type[0];
          if (isReady(tile.crop)) return letter.toUpperCase() + "!";
          return letter + tile.crop.grown + (tile.crop.watered ? "*" : "");
        })
        .join(" ")
    )
    .join("\n");
  return [
    `Day ${state.day}/${LAST_DAY} · weather: ${state.weather} · gold: ${state.gold} · energy: ${state.ap}`,
    `Tiles: ..=grass  ~~=tilled  letter+digit=crop nights grown (*=watered today, !=ready)`,
    `Crops: ${legend}`,
    rows,
  ].join("\n");
}

// Lets the same file run in the browser (globals) and in Node (tests).
if (typeof module !== "undefined") {
  module.exports = { newGame, applyAction, endDay, legalActions, serialize, isReady, CROPS, GRID, LAST_DAY, AP_PER_DAY, START_GOLD };
}
