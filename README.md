# fluffy-enigma · Fluffy Acres 🌾

A tiny farm game built to learn two things, in order:

1. **How to build software with Claude Code** — this phase: make the game fun and playable by hand.
2. **How agentic systems work** — next phase: replace the human player with an AI agent and watch it farm.

## Play

Open `index.html` in a browser. No install, no build step.

**Rules:** You run a farm for a 30-day season. Each day you have 5 energy; every action (till, plant, water, harvest) costs 1. A crop only grows on nights it was watered — rain waters everything for free. Quick crops pay a little, slow crops pay a lot:

| Crop | Seed | Nights | Sells |
|------|------|--------|-------|
| 🥬 Lettuce | 5g | 2 | 9g |
| 🎃 Pumpkin | 12g | 4 | 28g |
| 🍈 Melon | 30g | 8 | 90g |

Most gold when the season ends wins. Each game is a numbered "field" (a random seed) — the same field number always gets the same weather, so two players can race on identical seasons.

## How the code is laid out

- **`engine.js`** — all the rules, zero UI. State in, actions in, new state out.
- **`ui.js`** — the human player: draws the state, turns clicks into actions.
- **`index.html` / `style.css`** — the page and its look.

The important idea: a *player* is anything that produces actions from a state. The engine already has the sockets the agent will use in phase 2:

- `legalActions(state)` — everything that's possible right now (the agent's menu)
- `serialize(state)` — the farm as plain text (what the agent will "see")
- `applyAction(state, action)` — rejects illegal moves with a reason (the feedback the agent learns from)

## Ideas to build next (with Claude Code)

- Crops wither if unwatered too long
- 🚿 Sprinklers you can buy — *automation*: a script, cheap and dumb
- Market prices that change daily
- **Phase 2:** an AI farmhand you hire — *agency*: give it a goal in plain English and watch it plan, act, and react to weather. Then race it: human vs. script vs. agent, same field number, most gold wins.
