# VIDHI - Tamil Horror FPS

A browser-playable horror FPS rendered with WebGL (Three.js). You return to
your grandfather's village and descend into a sealed kovil where *vidhi*
(fate) sleeps — torch-lit stone corridors, fog, asuras in the dark, and
Mahishasura waiting in the inner sanctum.

## Play

Visit the GitHub Pages deployment for this repo. Works on desktop
(mouse + keyboard) and phones (virtual joystick + swipe look).

## Controls

### Desktop
- **WASD** - Move / strafe
- **Mouse** - Look (click to capture)
- **Left Click** - Fire
- **1-4** - Switch weapons
- **E** - Open doors and secret walls
- **M** - Padam (map) &nbsp; **ESC** - Pause

### Phone
- **Left thumb** - Virtual joystick (move/strafe)
- **Right thumb** - Swipe to look
- **FIRE / WPN / E / MAP** - On-screen buttons

## Weapons

| # | Name | Description |
|---|------|-------------|
| 1 | Trishul | Trident melee (infinite ammo) |
| 2 | Agni | Fire shotgun |
| 3 | Sudarshana Chakra | Disc launcher |
| 4 | Brahmastra | Explosive divine weapon (dropped by the boss) |

## Enemies

- **Asura** - Fast gaunt demons that swarm
- **Naga** - Serpent warriors that spit venom from range
- **Rakshasa** - Armored heavy demons
- **Mahishasura** - The final boss; carries the gold key to the sanctum

## Levels

1. **Kovil Vasal** (Temple Entrance) — find the red key in the crypt
2. **Irulil Nadai** (Walk in Darkness) — near-black catacombs, blue key vault
3. **Sivan Kovil** (Shiva's Temple) — the boss arena

Locked doors need matching keys. Secret walls (press **E** on suspicious
stone) hide armor and supplies.

## Tech

- **Rendering**: Three.js (vendored in `lib/`, no build step) — merged
  tile-grid geometry, procedural canvas textures, billboard sprite sheets,
  torch light pool with flicker, exponential fog
- **Simulation**: 2D tile-based game logic (`src/game.js`), unchanged-style
  Doom movement and hitscan
- **Audio**: fully procedural Web Audio — weapon SFX, looping horror drone,
  alert stingers, low-health heartbeat
- **Art**: every texture and sprite is painted onto offscreen canvases at
  load time; the repo ships zero image assets

Run locally with any static server, e.g. `python3 -m http.server`.
