// Vidhi - Shared constants

export const TILE_SIZE = 64;          // game-logic world units per map tile
export const WORLD_SCALE = 1 / TILE_SIZE; // scene units (1 unit = 1 tile)
export const FOV = Math.PI / 3;
export const HALF_FOV = FOV / 2;

export const MOVE_SPEED = 3.4;        // tiles per second
export const ROT_SPEED = 2.4;         // radians per second (keyboard)
export const MOUSE_SENSITIVITY = 0.0022;
export const PLAYER_RADIUS = 12;      // game units
export const EYE_HEIGHT = 0.5;        // tiles
export const WALL_HEIGHT = 1.4;       // tiles (tall temple halls; boss fits under)
export const MAX_PITCH = 0.55;        // radians

// Tile codes
export const T_FLOOR = 0;
export const T_STONE = 1;
export const T_RED = 2;
export const T_DARK = 3;
export const T_GOLD = 4;
export const T_DOOR = 5;
export const T_DOOR_RED = 6;
export const T_DOOR_BLUE = 7;
export const T_DOOR_GOLD = 8;
export const T_SECRET = 9;

export const DOOR_TILES = new Set([T_DOOR, T_DOOR_RED, T_DOOR_BLUE, T_DOOR_GOLD, T_SECRET]);
export const KEY_FOR_DOOR = { [T_DOOR_RED]: 'red', [T_DOOR_BLUE]: 'blue', [T_DOOR_GOLD]: 'gold' };

export const isTouchDevice = () =>
  window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
