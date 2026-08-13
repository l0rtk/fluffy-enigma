# fluffy-enigma · The Playground 🎮

A 3D meadow, waiting to become a living world. **You** build it — with Claude Code as your pair programmer.

## Start

```sh
./serve.sh        # then open http://localhost:8000
```

(Any static server works — the page needs one because browsers won't let a double-clicked file load the 3D tree models from disk.)

You get a sunlit meadow — wild grass, trees, rocks, bushes — a camera that follows you, and a little blue villager you walk around with **WASD**. Pressing **E** calls `interact()` — which currently does nothing. That's the whole point: everything from here is yours to invent.

All the code lives in **`playground.js`** — read all of it, it's commented for you. The rocks and bushes are built from basic shapes in code; the trees are real 3D models from [Quaternius](https://quaternius.com)' Stylized Nature pack (CC0, free for anything) in `assets/trees/` — grab more models from there or [Kenney](https://kenney.nl) whenever your world needs them. The 3D engine is [three.js](https://threejs.org) (`lib/three.min.js`, already included).

## The mission: a living world

Turn the meadow into a small ecosystem — **flowers** that grow, **bees** that work, **weather** that answers to no one. No player, no score screen: the game is keeping the world alive. Build it in the order below; every quest is one Claude Code session, and the world should still run after each one.

Time works like this: the world animates smoothly, but the simulation moves in small ticks grouped into **game-days** (a day ≈ 20–30 real seconds; a speed control can come later). Days are the world's heartbeat — weather changes by day, the hive eats by day, winter is counted in days.

### Quest map

1. **🌦 Weather.** The world's foundation — it answers to no one, so it comes first. A simple cycle on a timer: ☀️ sun, 🌧 rain (sky darkens, rain falls — steal the particles from `finished-game/3d.js`), 💨 wind. Each weather is just a few numbers in the world's state (`flowerGrowth`, `beesCanFly`) that nothing reads *yet* — and that's fine. **Stop at three states and a few numbers**; don't polish weather forever, the meadow is waiting.
2. **🌸 Flowers.** They sprout at random spots, grow through stages (sprout → bud → bloom), wilt after a while — and they read the weather: rain means `flowerGrowth` is high and the meadow explodes into bloom. Your first life from rules, already living in its climate.
3. **🐝 One bee.** Give it a hive (pick a tree) and a three-state brain: *find a bloom → drink nectar → carry it home* — and it checks `beesCanFly` before leaving (rain grounds it, wind blows it off course). Congratulations — you've built your first agent: it perceives, decides, and acts, on a loop.
4. **🍯 The hive.** Bees deposit nectar; the hive slowly consumes it; enough surplus → a new bee is born; empty stores → a bee starves. Now the world has an economy — and rainy days *cost* something, because grounded bees still eat.
5. **🌼 Pollination.** A visited bloom seeds a new flower nearby. This closes the big loop: bees make flowers make nectar make bees. Then watch what happens — does it bloom forever, or boom and crash? That's *emergence*, and you built it.
6. **📊 The dashboard.** Flower count, bee count, honey stores, day and weather, and a tiny population graph over time. One glance = is the world healthy? (This later becomes the AI's report card — see phase 2.)
7. **🧤 The gardener's gloves.** The villager gets real powers: walk somewhere and press **E** to plant a flower; stand at the hive to pick it up and carry it. Now *you* are the gardener, playing by hand. (In phase 2, the AI gets exactly these powers — no more, no less. Fair fight.)

**Side quest, any time:** give **E** its first job early — point at a bee, flower, or hive and show its state (what it's doing, how much nectar). A window into the world's mind.

**❄️ Boss fight:** winter. Several rain-and-cold days in a row where nothing grows. Can your ecosystem survive on the honey it stored?

**The world is finished when:** the dashboard exists ✅ the gardener's gloves work ✅ and winter has been attempted at least once ✅ — *surviving* it is not required. If your world dies, that's not failure, that's the setup for phase 2: *can the AI save what you couldn't?*

### Three golden rules

- **Rules and drawing stay separate.** The world is data (`world`) plus one function that moves time forward (`tick(world)`); three.js only *shows* it. Everything in phase 2 depends on this split.
- **Seeded randomness.** Same seed → same weather, same flower spots, same run. That's how you compare two versions of your world fairly. (See `makeRandom` in `playground.js` — already there.)
- **One loop at a time.** Finish a quest, watch the world live, commit, then start the next.

## Phase 2: the gardener

When the world lives, we hire an AI. Not as a bee — the bees stay ten lines of scripted brain each — but as a **gardener god**: an LLM agent with tools (plant flowers, move the hive, read the forecast) and one goal in plain English: *keep the ecosystem alive*. Your dashboard becomes its score, winter becomes its exam, and you'll see the whole difference between a script and an agent — because you'll have built both.

## Spoilers

`finished-game/` holds a complete example game built on these bones — a 30-day farming game, in both 2D (`finished-game/index.html`) and 3D (`finished-game/3d.html`). Peek when you're curious, not before you've tried.
