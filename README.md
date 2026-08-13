# fluffy-enigma · The Playground 🎮

An empty 3D world, waiting to become a game. **You** build it — with Claude Code as your pair programmer.

## Start

Open `index.html` in a browser. No install, no build step.

You get a sunlit field, a camera that follows you, and a little orange box you can walk around with **WASD**. Pressing **E** calls `interact()` — which currently does nothing. That's the whole point: everything from here is yours to invent.

All the code lives in **`playground.js`** (~150 lines, read all of it). The 3D engine is [three.js](https://threejs.org) (`lib/three.min.js`, already included).

## The plan

1. **Build a game** (you + Claude Code). Any game. Add things to the world, give E a job, invent rules, keep score.
2. **Add an AI player** (phase 2). Once your game has rules, we'll plug in an AI agent that plays it — and you'll learn how agentic systems actually work.

One tip that makes phase 2 easy: keep your *rules* (what the world is, what actions do) separate from your *drawing* (meshes, colors, camera). An AI player can only play a game whose rules exist as data + functions, not as pixels.

## Ideas if you're stuck

- Make the hero a real character (stack some boxes and spheres)
- Scatter coins to collect, with a score counter
- Things that grow, day/night, weather
- Fences, houses, creatures that wander

## Spoilers

`finished-game/` holds a complete example built on these bones — a 30-day farming game, in both 2D (`finished-game/index.html`) and 3D (`finished-game/3d.html`). Peek when you're curious, not before you've tried.
