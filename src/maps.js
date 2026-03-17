// Vidhi - Game Maps
// Tamil temple-themed levels

import { TILE_SIZE } from './engine.js';

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
const LEVEL_1 = {
  name: 'KOVIL VASAL',
  width: 24,
  height: 24,
  playerStart: { x: 2.5 * TILE_SIZE, y: 2.5 * TILE_SIZE, angle: 0 },
  map: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,2,2,0,0,2,2,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,3,3,0,0,1,
    1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,1,
    1,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,2,2,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,1,
    1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,
    1,0,0,0,0,0,0,4,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,4,0,0,0,0,0,0,0,4,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,
    1,0,0,2,2,0,0,0,0,0,0,3,3,0,0,0,0,0,1,1,1,0,0,1,
    1,0,0,0,0,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0,0,0,0,1,
    1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,1,
    1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,
    1,0,0,0,0,0,1,0,0,0,0,0,5,0,0,0,0,1,0,0,0,0,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  enemies: [
    { type: 'asura', x: 10.5, y: 4.5, health: 40, speed: 1.5, damage: 8 },
    { type: 'asura', x: 14.5, y: 4.5, health: 40, speed: 1.5, damage: 8 },
    { type: 'asura', x: 5.5, y: 10.5, health: 40, speed: 1.5, damage: 8 },
    { type: 'naga', x: 11.5, y: 11.5, health: 60, speed: 1.2, damage: 12 },
    { type: 'asura', x: 19.5, y: 5.5, health: 40, speed: 1.5, damage: 8 },
    { type: 'asura', x: 19.5, y: 10.5, health: 40, speed: 1.5, damage: 8 },
    { type: 'rakshasa', x: 11.5, y: 16.5, health: 100, speed: 1.0, damage: 20 },
    { type: 'asura', x: 3.5, y: 19.5, health: 40, speed: 1.5, damage: 8 },
    { type: 'asura', x: 20.5, y: 19.5, health: 40, speed: 1.5, damage: 8 },
    { type: 'naga', x: 11.5, y: 21.5, health: 60, speed: 1.2, damage: 12 },
  ],
  pickups: [
    { type: 'health', x: 8.5, y: 1.5 },
    { type: 'ammo', x: 15.5, y: 1.5 },
    { type: 'health', x: 1.5, y: 10.5 },
    { type: 'ammo', x: 22.5, y: 7.5 },
    { type: 'health', x: 11.5, y: 7.5 },
    { type: 'ammo', x: 11.5, y: 13.5 },
    { type: 'key', x: 11.5, y: 22.5, color: 'red' },
    { type: 'health', x: 22.5, y: 19.5 },
  ],
  decorations: [
    { type: 'pillar', x: 9.5, y: 3.5 },
    { type: 'pillar', x: 14.5, y: 3.5 },
    { type: 'pillar', x: 9.5, y: 9.5 },
    { type: 'pillar', x: 14.5, y: 9.5 },
  ],
  exit: { x: 12, y: 22 },
};

// Level 2: Irulil Nadai (Walk in Darkness)
const LEVEL_2 = {
  name: 'IRULIL NADAI',
  width: 24,
  height: 24,
  playerStart: { x: 1.5 * TILE_SIZE, y: 1.5 * TILE_SIZE, angle: Math.PI / 4 },
  map: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,0,0,0,3,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0,3,0,0,1,
    1,0,0,0,3,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0,3,0,0,1,
    1,0,0,0,0,0,0,3,3,0,0,0,0,0,0,3,3,0,0,0,0,0,0,1,
    1,3,3,0,0,0,0,3,0,0,0,0,0,0,0,0,3,0,0,0,0,3,3,1,
    1,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,1,
    1,0,0,0,0,2,0,0,0,0,0,4,4,0,0,0,0,0,2,0,0,0,0,1,
    1,0,0,3,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,3,0,0,1,
    1,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1,
    1,0,0,0,0,0,0,0,0,2,2,0,0,2,2,0,0,0,0,0,0,0,0,1,
    1,3,3,0,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,0,3,3,0,1,
    1,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,1,
    1,0,0,0,0,0,4,0,0,0,0,0,0,0,0,0,0,4,0,0,0,0,0,1,
    1,3,3,0,0,0,0,0,0,2,0,0,0,0,2,0,0,0,0,0,3,3,0,1,
    1,0,0,0,0,0,0,0,0,2,2,0,0,2,2,0,0,0,0,0,0,0,0,1,
    1,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,1,
    1,0,0,3,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,3,0,0,1,
    1,0,0,0,0,2,0,0,0,0,0,4,4,0,0,0,0,0,2,0,0,0,0,1,
    1,0,0,0,0,2,2,0,0,0,0,0,0,0,0,0,0,2,2,0,0,0,0,1,
    1,3,3,0,0,0,0,3,0,0,0,0,0,0,0,0,3,0,0,0,0,3,3,1,
    1,0,0,0,0,0,0,3,3,0,0,0,0,0,0,3,3,0,0,0,0,0,0,1,
    1,0,0,0,3,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0,3,0,0,1,
    1,0,0,0,3,0,0,0,0,0,3,0,0,3,0,0,0,0,0,0,3,0,0,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  enemies: [
    { type: 'asura', x: 6.5, y: 2.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'asura', x: 17.5, y: 2.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'naga', x: 11.5, y: 6.5, health: 80, speed: 1.4, damage: 15 },
    { type: 'rakshasa', x: 5.5, y: 9.5, health: 120, speed: 1.0, damage: 22 },
    { type: 'asura', x: 18.5, y: 9.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'naga', x: 3.5, y: 11.5, health: 80, speed: 1.4, damage: 15 },
    { type: 'naga', x: 20.5, y: 11.5, health: 80, speed: 1.4, damage: 15 },
    { type: 'rakshasa', x: 11.5, y: 11.5, health: 150, speed: 1.0, damage: 25 },
    { type: 'asura', x: 6.5, y: 17.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'asura', x: 17.5, y: 17.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'rakshasa', x: 11.5, y: 20.5, health: 120, speed: 1.0, damage: 22 },
    { type: 'asura', x: 3.5, y: 22.5, health: 50, speed: 1.8, damage: 10 },
    { type: 'asura', x: 20.5, y: 22.5, health: 50, speed: 1.8, damage: 10 },
  ],
  pickups: [
    { type: 'health', x: 1.5, y: 7.5 },
    { type: 'ammo', x: 22.5, y: 7.5 },
    { type: 'health', x: 11.5, y: 11.5 },
    { type: 'ammo', x: 1.5, y: 15.5 },
    { type: 'health', x: 22.5, y: 15.5 },
    { type: 'ammo', x: 11.5, y: 3.5 },
    { type: 'key', x: 11.5, y: 21.5, color: 'blue' },
    { type: 'health', x: 11.5, y: 19.5 },
  ],
  decorations: [
    { type: 'pillar', x: 7.5, y: 7.5 },
    { type: 'pillar', x: 16.5, y: 7.5 },
    { type: 'pillar', x: 7.5, y: 16.5 },
    { type: 'pillar', x: 16.5, y: 16.5 },
  ],
  exit: { x: 12, y: 22 },
};

// Level 3: Sivan Kோyil (Shiva's Temple) - Boss level
const LEVEL_3 = {
  name: 'SIVAN KOVIL',
  width: 24,
  height: 24,
  playerStart: { x: 12.5 * TILE_SIZE, y: 22.5 * TILE_SIZE, angle: -Math.PI / 2 },
  map: [
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
    1,4,4,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,4,1,
    1,4,0,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,4,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,0,1,
    1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1,
    1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,1,
    1,4,4,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,4,4,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,4,0,0,0,0,0,0,0,0,4,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,4,4,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,4,4,0,1,
    1,0,0,0,0,0,0,0,0,0,0,4,4,0,0,0,0,0,0,0,0,0,0,1,
    1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1,
    1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1,
    1,0,0,0,2,2,2,0,0,0,0,0,0,0,0,0,0,2,2,2,0,0,0,1,
    1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,
    1,4,0,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,4,1,
    1,4,4,0,0,0,0,0,4,0,0,0,0,0,0,4,0,0,0,0,0,0,4,1,
    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
  ],
  enemies: [
    { type: 'asura', x: 3.5, y: 3.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'asura', x: 20.5, y: 3.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'naga', x: 5.5, y: 5.5, health: 100, speed: 1.5, damage: 18 },
    { type: 'naga', x: 18.5, y: 5.5, health: 100, speed: 1.5, damage: 18 },
    { type: 'rakshasa', x: 3.5, y: 11.5, health: 150, speed: 1.2, damage: 25 },
    { type: 'rakshasa', x: 20.5, y: 11.5, health: 150, speed: 1.2, damage: 25 },
    { type: 'asura', x: 5.5, y: 17.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'asura', x: 18.5, y: 17.5, health: 60, speed: 2.0, damage: 12 },
    { type: 'naga', x: 8.5, y: 14.5, health: 100, speed: 1.5, damage: 18 },
    { type: 'naga', x: 15.5, y: 14.5, health: 100, speed: 1.5, damage: 18 },
    // Boss: Mahishasura
    { type: 'rakshasa', x: 12.5, y: 7.5, health: 500, speed: 0.8, damage: 40, boss: true, name: 'MAHISHASURA' },
  ],
  pickups: [
    { type: 'health', x: 1.5, y: 1.5 },
    { type: 'health', x: 22.5, y: 1.5 },
    { type: 'ammo', x: 1.5, y: 22.5 },
    { type: 'ammo', x: 22.5, y: 22.5 },
    { type: 'health', x: 12.5, y: 14.5 },
    { type: 'ammo', x: 12.5, y: 9.5 },
    { type: 'health', x: 8.5, y: 8.5 },
    { type: 'ammo', x: 16.5, y: 8.5 },
  ],
  decorations: [
    { type: 'pillar', x: 8.5, y: 1.5 },
    { type: 'pillar', x: 15.5, y: 1.5 },
    { type: 'pillar', x: 8.5, y: 22.5 },
    { type: 'pillar', x: 15.5, y: 22.5 },
    { type: 'pillar', x: 7.5, y: 7.5 },
    { type: 'pillar', x: 16.5, y: 7.5 },
    { type: 'pillar', x: 7.5, y: 16.5 },
    { type: 'pillar', x: 16.5, y: 16.5 },
  ],
  exit: { x: 12, y: 1 },
};

const LEVELS = [LEVEL_1, LEVEL_2, LEVEL_3];

function loadLevel(levelIndex) {
  const level = LEVELS[levelIndex];
  if (!level) return null;

  const map = new GameMap([...level.map], level.width, level.height);

  const sprites = [];

  // Add enemies
  for (const e of level.enemies) {
    sprites.push({
      type: e.type,
      x: e.x * TILE_SIZE,
      y: e.y * TILE_SIZE,
      health: e.health,
      maxHealth: e.health,
      speed: e.speed,
      damage: e.damage,
      active: true,
      state: 'idle', // idle, chase, attack, hurt, dead
      stateTimer: 0,
      hurt: false,
      hurtTimer: 0,
      attackCooldown: 0,
      widthRatio: e.boss ? 1.5 : 1,
      verticalOffset: 0,
      boss: e.boss || false,
      name: e.name || e.type.toUpperCase(),
      alertRange: e.boss ? 15 : 8,
      attackRange: e.boss ? 2.5 : 1.5,
    });
  }

  // Add pickups
  for (const p of level.pickups) {
    sprites.push({
      type: p.type,
      x: p.x * TILE_SIZE,
      y: p.y * TILE_SIZE,
      active: true,
      widthRatio: 0.5,
      verticalOffset: 10,
      color: p.color || null,
    });
  }

  // Add decorations
  for (const d of level.decorations) {
    sprites.push({
      type: d.type,
      x: d.x * TILE_SIZE,
      y: d.y * TILE_SIZE,
      active: true,
      widthRatio: 0.4,
      verticalOffset: 0,
    });
  }

  return {
    map,
    sprites,
    playerStart: { ...level.playerStart },
    levelName: level.name,
    exit: level.exit,
    totalEnemies: level.enemies.length,
  };
}

export { GameMap, loadLevel, LEVELS };
