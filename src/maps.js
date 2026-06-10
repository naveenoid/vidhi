// Vidhi - Game Maps
// Tamil temple-themed levels, defined as character grids:
//   .  floor          #  stone wall      R  red/terracotta wall
//   D  dark stone     G  gold/ornate     +  wooden door (E to open)
//   r  red key door   b  blue key door   g  gold key door
//   S  secret wall (looks like stone; E to open)

import { TILE_SIZE, T_SECRET, DOOR_TILES } from './constants.js';

const CHAR_TILES = {
  '.': 0, '#': 1, 'R': 2, 'D': 3, 'G': 4,
  '+': 5, 'r': 6, 'b': 7, 'g': 8, 'S': 9,
};

class GameMap {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }

  getTile(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 1;
    return this.data[y * this.width + x];
  }

  setTile(x, y, val) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.data[y * this.width + x] = val;
    }
  }
}

// Level 1: Kovil Vasal (Temple Entrance)
// Entry rooms -> pillared gate hall -> grand courtyard. The red key lies
// at the bottom of a dark crypt; the red door guards the exit chamber.
const LEVEL_1 = {
  name: 'KOVIL VASAL',
  playerStart: { x: 3.5, y: 2.5, angle: 0 },
  fogColor: 0x0d0a07,
  fogDensity: 0.055,
  ambient: 0.26,
  grid: [
    '################################',
    '#......#####.........#.........#',
    '#......#.............#.........#',
    '#......+.............+.........#',
    '#......#.............#.........#',
    '############.........#.........#',
    '############.........#.........#',
    '############.........#.........#',
    '############.........###########',
    '################+###############',
    '#.......#......................#',
    '#.......+......................#',
    '#DDDDD..#......................#',
    '#.......#......................#',
    '#.......#.....GG......GG.......#',
    '#..DDDDD#.....GG......GG.......#',
    '#.......#......................#',
    '#.......#......................#',
    '#DDDDD..#..RR..............RR..#',
    '#.......#..RR..............RR..#',
    '#.......#......................#',
    '#..DDDDD#......................#',
    '#.......########r#########+#####',
    '#.......#...........#..........#',
    '#.......#...........#..........#',
    '#.......#...........#..........#',
    '#.......#...........#..........#',
    '#.......#...........#..........#',
    '#DDDSDDD#GGGGGGGGGSG#..........#',
    '#DD...DD#GGGGGGGG..G#..........#',
    '#DD...DD#GGGGGGGG..G#..........#',
    '################################',
  ],
  enemies: [
    { type: 'asura', x: 14.5, y: 4.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'asura', x: 18.5, y: 6.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'asura', x: 23.5, y: 2.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'naga', x: 26.5, y: 4.5, health: 60, speed: 1.2, damage: 10, ranged: true },
    { type: 'asura', x: 12.5, y: 12.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'naga', x: 18.5, y: 15.5, health: 60, speed: 1.2, damage: 10, ranged: true },
    { type: 'asura', x: 25.5, y: 11.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'rakshasa', x: 15.5, y: 19.5, health: 100, speed: 1.0, damage: 20 },
    { type: 'asura', x: 21.5, y: 19.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'asura', x: 4.5, y: 13.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'naga', x: 4.5, y: 16.5, health: 60, speed: 1.2, damage: 10, ranged: true },
    { type: 'rakshasa', x: 4.5, y: 24.5, health: 100, speed: 1.0, damage: 20 },
    { type: 'asura', x: 24.5, y: 26.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'asura', x: 28.5, y: 24.5, health: 40, speed: 1.6, damage: 8 },
    { type: 'naga', x: 14.5, y: 24.5, health: 60, speed: 1.2, damage: 10, ranged: true },
  ],
  pickups: [
    { type: 'health', x: 3.5, y: 3.5 },
    { type: 'ammo', x: 13.5, y: 2.5 },
    { type: 'ammo', x: 28.5, y: 2.5 },
    { type: 'health', x: 24.5, y: 6.5 },
    { type: 'health', x: 10.5, y: 20.5 },
    { type: 'ammo', x: 28.5, y: 10.5 },
    { type: 'health', x: 19.5, y: 10.5 },
    { type: 'health', x: 2.5, y: 23.5 },
    { type: 'key', x: 4.5, y: 26.5, color: 'red' },
    { type: 'ammo', x: 3.5, y: 29.5 },
    { type: 'health', x: 4.5, y: 30.5 },
    { type: 'health', x: 11.5, y: 24.5 },
    { type: 'ammo', x: 17.5, y: 29.5 },
    { type: 'health', x: 18.5, y: 30.5 },
    { type: 'ammo', x: 26.5, y: 25.5 },
    { type: 'armor', x: 27.5, y: 28.5 },
  ],
  decorations: [
    { type: 'pillar', x: 13.5, y: 1.5 },
    { type: 'pillar', x: 19.5, y: 1.5 },
    { type: 'pillar', x: 13.5, y: 7.5 },
    { type: 'pillar', x: 19.5, y: 7.5 },
    { type: 'pillar', x: 13.5, y: 16.5 },
    { type: 'pillar', x: 25.5, y: 16.5 },
  ],
  exit: { x: 14, y: 25 },
};

// Level 2: Irulil Nadai (Walk in Darkness)
// Near-black catacombs: a maze of dark stone, ranged nagas in the gloom.
// The blue key sits in a sealed vault at the heart of the maze.
const LEVEL_2 = {
  name: 'IRULIL NADAI',
  playerStart: { x: 3.5, y: 2.5, angle: 0 },
  fogColor: 0x04050a,
  fogDensity: 0.085,
  ambient: 0.13,
  grid: [
    '################################',
    '#.....#######.......#..........#',
    '#.....+.............+..........#',
    '#.....#.............#..........#',
    '#.....#######.......#..........#',
    '#############.......#..........#',
    '#############.......############',
    '################+###############',
    '#..............................#',
    '#..............................#',
    '#DD..DDDDDDDDDD..DDDDDDDDDD..DD#',
    '#DD..DDDDDDDDDD..DDDDDDDDDD..DD#',
    '#DD..DDDDDDDDDD..DDDDDDDDDD..DD#',
    '#..............................#',
    '#..............................#',
    '#DDDDDD..DDDDD+DDDDDD..DDDDDDDD#',
    '#DDDDDD..DDD......DDD..DDDDDDDD#',
    '#DDDDDD..DDD......DDD..DDDDDDDD#',
    '#..............................#',
    '#..............................#',
    '###############b################',
    '#......#................#......#',
    '#......#................#......#',
    '#......S................S......#',
    '#......#................#......#',
    '#......#................#......#',
    '###############+################',
    '#############......#############',
    '#############......#############',
    '#############......#############',
    '#############......#############',
    '################################',
  ],
  enemies: [
    { type: 'asura', x: 15.5, y: 3.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'asura', x: 17.5, y: 5.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'naga', x: 25.5, y: 3.5, health: 80, speed: 1.3, damage: 12, ranged: true },
    { type: 'asura', x: 28.5, y: 2.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'asura', x: 10.5, y: 8.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'naga', x: 20.5, y: 9.5, health: 80, speed: 1.3, damage: 12, ranged: true },
    { type: 'asura', x: 27.5, y: 8.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'rakshasa', x: 5.5, y: 13.5, health: 120, speed: 1.0, damage: 22 },
    { type: 'naga', x: 19.5, y: 13.5, health: 80, speed: 1.3, damage: 12, ranged: true },
    { type: 'asura', x: 25.5, y: 14.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'naga', x: 13.5, y: 16.5, health: 80, speed: 1.3, damage: 12, ranged: true },
    { type: 'naga', x: 16.5, y: 17.5, health: 80, speed: 1.3, damage: 12, ranged: true },
    { type: 'asura', x: 5.5, y: 18.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'naga', x: 24.5, y: 19.5, health: 80, speed: 1.3, damage: 12, ranged: true },
    { type: 'rakshasa', x: 12.5, y: 23.5, health: 120, speed: 1.0, damage: 22 },
    { type: 'rakshasa', x: 19.5, y: 23.5, health: 120, speed: 1.0, damage: 22 },
    { type: 'naga', x: 15.5, y: 22.5, health: 80, speed: 1.3, damage: 12, ranged: true },
  ],
  pickups: [
    { type: 'health', x: 2.5, y: 2.5 },
    { type: 'ammo', x: 14.5, y: 2.5 },
    { type: 'health', x: 29.5, y: 4.5 },
    { type: 'ammo', x: 23.5, y: 1.5 },
    { type: 'health', x: 1.5, y: 8.5 },
    { type: 'ammo', x: 29.5, y: 9.5 },
    { type: 'health', x: 29.5, y: 13.5 },
    { type: 'ammo', x: 1.5, y: 14.5 },
    { type: 'health', x: 8.5, y: 18.5 },
    { type: 'ammo', x: 22.5, y: 18.5 },
    { type: 'key', x: 14.5, y: 16.5, color: 'blue' },
    { type: 'health', x: 10.5, y: 24.5 },
    { type: 'ammo', x: 21.5, y: 24.5 },
    { type: 'armor', x: 3.5, y: 23.5 },
    { type: 'ammo', x: 2.5, y: 22.5 },
    { type: 'health', x: 27.5, y: 23.5 },
    { type: 'ammo', x: 28.5, y: 22.5 },
  ],
  decorations: [
    { type: 'pillar', x: 14.5, y: 1.5 },
    { type: 'pillar', x: 18.5, y: 1.5 },
    { type: 'pillar', x: 9.5, y: 13.5 },
    { type: 'pillar', x: 22.5, y: 13.5 },
  ],
  exit: { x: 15, y: 29 },
};

// Level 3: Sivan Kovil (Shiva's Temple) - Boss level
// A processional approach into a vast pillared arena. Mahishasura holds
// the gold key; the sanctum door north opens only with it.
const LEVEL_3 = {
  name: 'SIVAN KOVIL',
  playerStart: { x: 16, y: 29, angle: -Math.PI / 2 },
  fogColor: 0x0d0606,
  fogDensity: 0.05,
  ambient: 0.2,
  grid: [
    '################################',
    '#############......#############',
    '#############......#############',
    '#############......#############',
    '#############......#############',
    '#############......#############',
    '###############g################',
    '######....................######',
    '#....#....................#....#',
    '#....#....................#....#',
    '#....#...GG..........GG...#....#',
    '#....#...GG..........GG...#....#',
    '#....+....................+....#',
    '#....#....................#....#',
    '#....#....................#....#',
    '#....#....................#....#',
    '#....#....................#....#',
    '#....#...GG..........GG...#....#',
    '#....+...GG..........GG...+....#',
    '#....#....................#....#',
    '#....#....................#....#',
    '#....#....................#....#',
    '#############......#############',
    '############........############',
    '############........############',
    '############........############',
    '############........############',
    '##########............##########',
    '######...S............##########',
    '######...#............##########',
    '##########............##########',
    '################################',
  ],
  enemies: [
    { type: 'asura', x: 13.5, y: 24.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'asura', x: 18.5, y: 25.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'asura', x: 8.5, y: 9.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'asura', x: 23.5, y: 9.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'naga', x: 8.5, y: 20.5, health: 100, speed: 1.4, damage: 14, ranged: true },
    { type: 'naga', x: 23.5, y: 20.5, health: 100, speed: 1.4, damage: 14, ranged: true },
    { type: 'rakshasa', x: 11.5, y: 14.5, health: 150, speed: 1.1, damage: 25 },
    { type: 'rakshasa', x: 20.5, y: 14.5, health: 150, speed: 1.1, damage: 25 },
    { type: 'asura', x: 15.5, y: 8.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'asura', x: 15.5, y: 20.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'naga', x: 2.5, y: 10.5, health: 100, speed: 1.4, damage: 14, ranged: true },
    { type: 'naga', x: 2.5, y: 19.5, health: 100, speed: 1.4, damage: 14, ranged: true },
    { type: 'naga', x: 29.5, y: 10.5, health: 100, speed: 1.4, damage: 14, ranged: true },
    { type: 'naga', x: 29.5, y: 19.5, health: 100, speed: 1.4, damage: 14, ranged: true },
    // Boss: Mahishasura
    { type: 'rakshasa', x: 16, y: 11.5, health: 650, speed: 0.9, damage: 35, boss: true, name: 'MAHISHASURA' },
  ],
  pickups: [
    { type: 'health', x: 12.5, y: 28.5 },
    { type: 'ammo', x: 19.5, y: 28.5 },
    { type: 'armor', x: 7.5, y: 28.5 },
    { type: 'ammo', x: 6.5, y: 28.5 },
    { type: 'ammo', x: 15.5, y: 24.5 },
    { type: 'health', x: 7.5, y: 8.5 },
    { type: 'health', x: 24.5, y: 20.5 },
    { type: 'ammo', x: 7.5, y: 20.5 },
    { type: 'ammo', x: 24.5, y: 8.5 },
    { type: 'health', x: 2.5, y: 14.5 },
    { type: 'ammo', x: 29.5, y: 14.5 },
    { type: 'health', x: 29.5, y: 16.5 },
    { type: 'health', x: 14.5, y: 2.5 },
    { type: 'ammo', x: 16.5, y: 2.5 },
  ],
  decorations: [
    { type: 'pillar', x: 11.5, y: 10.5 },
    { type: 'pillar', x: 20.5, y: 10.5 },
    { type: 'pillar', x: 11.5, y: 18.5 },
    { type: 'pillar', x: 20.5, y: 18.5 },
  ],
  exit: { x: 15, y: 3 },
};

const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];

function parseGrid(grid) {
  const height = grid.length;
  const width = grid[0].length;
  const data = new Array(width * height);
  for (let y = 0; y < height; y++) {
    if (grid[y].length !== width) {
      throw new Error(`Map row ${y} has length ${grid[y].length}, expected ${width}`);
    }
    for (let x = 0; x < width; x++) {
      const tile = CHAR_TILES[grid[y][x]];
      if (tile === undefined) throw new Error(`Unknown map char '${grid[y][x]}' at ${x},${y}`);
      data[y * width + x] = tile;
    }
  }
  return new GameMap(data, width, height);
}

// Deterministic torch placement: floor cells hugging a wall, spaced out
function generateTorches(map) {
  const torches = [];
  const hash = (x, y) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.getTile(x, y) !== 0) continue;
      if (hash(x, y) > 0.14) continue;
      // Find a solid wall neighbor (not a door) to mount the torch on
      const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      let mount = null;
      for (const [dx, dy] of dirs) {
        const t = map.getTile(x + dx, y + dy);
        if (t > 0 && !DOOR_TILES.has(t)) {
          mount = [dx, dy];
          break;
        }
      }
      if (!mount) continue;
      const tx = x + 0.5 + mount[0] * 0.36;
      const ty = y + 0.5 + mount[1] * 0.36;
      // Keep torches spread apart
      let tooClose = false;
      for (const o of torches) {
        if ((o.x - tx) ** 2 + (o.y - ty) ** 2 < 2.4 * 2.4) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) torches.push({ x: tx, y: ty });
      if (torches.length >= 30) return torches;
    }
  }
  return torches;
}

function loadLevel(levelIndex) {
  const level = LEVELS[levelIndex];
  if (!level) return null;

  const map = parseGrid(level.grid);

  const sprites = [];

  for (const e of level.enemies) {
    sprites.push({
      type: e.type,
      x: e.x * TILE_SIZE,
      y: e.y * TILE_SIZE,
      health: e.health,
      maxHealth: e.health,
      speed: e.speed,
      damage: e.damage,
      ranged: e.ranged || false,
      active: true,
      state: 'idle', // idle, chase, dying
      deathT: 0,
      hurt: false,
      hurtTimer: 0,
      attackCooldown: 0,
      windupTimer: 0,
      windupMax: 0,
      boss: e.boss || false,
      name: e.name || e.type.toUpperCase(),
      alertRange: e.boss ? 16 : 9,
      attackRange: e.boss ? 2.5 : 1.5,
    });
  }

  for (const p of level.pickups) {
    sprites.push({
      type: p.type,
      x: p.x * TILE_SIZE,
      y: p.y * TILE_SIZE,
      active: true,
      color: p.color || null,
    });
  }

  for (const d of level.decorations) {
    sprites.push({
      type: d.type,
      x: d.x * TILE_SIZE,
      y: d.y * TILE_SIZE,
      active: true,
    });
  }

  // Doors and secret walls become animated entities
  const doors = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = map.getTile(x, y);
      if (DOOR_TILES.has(t)) {
        doors.push({ x, y, tile: t, openT: 0, opening: false });
      }
    }
  }

  return {
    map,
    sprites,
    doors,
    playerStart: {
      x: level.playerStart.x * TILE_SIZE,
      y: level.playerStart.y * TILE_SIZE,
      angle: level.playerStart.angle,
    },
    levelName: level.name,
    levelDef: {
      fogColor: level.fogColor,
      fogDensity: level.fogDensity,
      ambient: level.ambient,
      torches: generateTorches(map),
      exit: level.exit,
    },
    exit: level.exit,
    totalEnemies: level.enemies.length,
    totalSecrets: doors.filter((d) => d.tile === T_SECRET).length,
  };
}

export { GameMap, loadLevel, LEVELS };
