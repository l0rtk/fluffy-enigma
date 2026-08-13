# fluffy-enigma · The Playground 🎮

An empty 3D world, waiting to become a game. **You** build it — with Claude Code as your pair programmer.

## Start

```sh
./serve.sh        # then open http://localhost:8000
```

(Any static server works — the page needs one because browsers won't let a double-clicked file load the 3D tree models from disk.)

You get a sunlit meadow — wild grass, trees, rocks, bushes — a camera that follows you, and a little blue villager you walk around with **WASD**. Pressing **E** calls `interact()` — which currently does nothing. That's the whole point: everything from here is yours to invent.

All the code lives in **`playground.js`** — read all of it, it's commented for you. The rocks and bushes are built from basic shapes in code; the trees are real 3D models from [Quaternius](https://quaternius.com)' Stylized Nature pack (CC0, free for anything) in `assets/trees/` — grab more models from there or [Kenney](https://kenney.nl) whenever your game needs them. The 3D engine is [three.js](https://threejs.org) (`lib/three.min.js`, already included).

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
