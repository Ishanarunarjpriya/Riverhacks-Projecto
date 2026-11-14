# Cosmos Reborn

A pixel art moon exploration game for the NASA Space Apps hackathon, built with React, Vite, TypeScript and HTML Canvas.

## Run it

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run typecheck` | Check types with TypeScript |
| `npm run lint` | Lint with oxlint |
| `npm run build` | Typecheck, then build for production into `dist/` |

## Controls

| Key | Action |
|---|---|
| ↑ / W | Walk forward |
| ↓ / S | Walk back |
| ← → / A D | Turn |
| Space | Jump (you need this to climb out of deep craters) |
| Tab | Open or close the tablet |
| Esc | Close the tablet |

## How the code is organized

React only owns the `<canvas>`. All game logic is plain TypeScript in `src/game/`.

| File | What's in it |
|---|---|
| `components/GameScreen.tsx` | React component that creates the canvas and starts/stops the game |
| `game/game.ts` | The game loop: update, then draw sky → ground → craters → objects → HUD → tablet |
| `game/constants.ts` | Every tuning number (screen size, camera, gravity, world size). Start here to tweak the feel. |
| `game/camera.ts` | Follow camera and the projection that turns world positions into curved-horizon screen positions |
| `game/world.ts` | Generates craters, pits, pebbles and boulders; ground height and collision checks |
| `game/structures.ts` | The list of structures (lander, habitat, ...) and how each one is drawn. Add a row to add a structure. |
| `game/crater.ts` | Draws craters as 3D bowls lit by the sun |
| `game/sky.ts` | Sky sphere with stars and planets that rise and set as you walk |
| `game/player.ts` | Astronaut movement, jumping, gravity and sprite |
| `game/tablet.ts` | Tablet slide-up and boot animation |
| `game/hud.ts` | Heading, nearest structure, crater warning. The minimap is off; set `SHOW_MINIMAP` in `constants.ts` to `true` to bring it back. |
| `game/text.ts` | Sharp text layer drawn over the pixel canvas at full screen resolution |
| `game/input.ts` | Keyboard handling |
| `game/pixel.ts` | Pixel-crisp drawing helpers (rectangles, ellipses, polygons, sprites) |

## Key ideas

- **Low resolution, scaled up:** the game draws at 320×180 and CSS stretches it with `image-rendering: pixelated`.
- **Pseudo-3D:** the world is a flat x/z map. The camera projects it with perspective, and points drop by `distance² / (2 × planet radius)`, which makes the horizon curve.
- **Looping moon:** positions wrap around `WORLD_SIZE`, so walking straight brings you back where you started.
