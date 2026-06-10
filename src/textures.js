// Vidhi - Procedural texture generation
// All wall/floor/ceiling art is painted onto offscreen canvases at load time
// and uploaded as THREE.CanvasTexture. No external assets.

import * as THREE from 'three';

const TEX_SIZE = 256;

// Deterministic pseudo-random, so textures look the same every run
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = TEX_SIZE;
  c.height = TEX_SIZE;
  return c;
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Scatter cracks: dark jagged random-walk lines
function paintCracks(ctx, rng, count, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    let x = rng() * TEX_SIZE;
    let y = rng() * TEX_SIZE * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 4 + Math.floor(rng() * 6);
    for (let s = 0; s < segs; s++) {
      x += (rng() - 0.5) * 30;
      y += rng() * 25;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Soot / grime blotches
function paintGrime(ctx, rng, count, rgba) {
  for (let i = 0; i < count; i++) {
    const x = rng() * TEX_SIZE;
    const y = rng() * TEX_SIZE;
    const r = 15 + rng() * 50;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// Per-pixel brightness noise for rough stone grain
function paintNoise(ctx, rng, strength) {
  const img = ctx.getImageData(0, 0, TEX_SIZE, TEX_SIZE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * strength;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

// Stone block courses with mortar joints
function paintBlocks(ctx, rng, base, mortar, rows, jitter) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  const rowH = TEX_SIZE / rows;
  ctx.fillStyle = mortar;
  for (let r = 0; r <= rows; r++) {
    ctx.fillRect(0, r * rowH - 1, TEX_SIZE, 3);
  }
  for (let r = 0; r < rows; r++) {
    const cols = 2 + Math.floor(rng() * 2);
    const offset = rng() * TEX_SIZE;
    for (let c = 0; c < cols; c++) {
      const x = (offset + (c * TEX_SIZE) / cols + (rng() - 0.5) * jitter) % TEX_SIZE;
      ctx.fillRect(x, r * rowH, 3, rowH);
    }
  }
  // Per-block shading variation
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 4; c++) {
      if (rng() < 0.5) continue;
      const shade = rng() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)';
      ctx.fillStyle = shade;
      ctx.fillRect((c * TEX_SIZE) / 4, r * rowH + 2, TEX_SIZE / 4, rowH - 4);
    }
  }
}

// Carved relief band: repeating temple motif silhouettes
function paintCarvingBand(ctx, rng, y, h, dark, light) {
  ctx.fillStyle = dark;
  ctx.fillRect(0, y, TEX_SIZE, h);
  const n = 8;
  const w = TEX_SIZE / n;
  for (let i = 0; i < n; i++) {
    const cx = i * w + w / 2;
    ctx.fillStyle = light;
    // Lotus / flame motif: diamond with center notch
    ctx.beginPath();
    ctx.moveTo(cx, y + h * 0.15);
    ctx.lineTo(cx + w * 0.3, y + h * 0.5);
    ctx.lineTo(cx, y + h * 0.85);
    ctx.lineTo(cx - w * 0.3, y + h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(cx, y + h * 0.5, w * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
}

function stoneWall() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const rng = makeRng(101);
  paintBlocks(ctx, rng, '#5a5048', '#332d26', 5, 60);
  paintCarvingBand(ctx, rng, TEX_SIZE * 0.38, TEX_SIZE * 0.16, '#46403a', '#5f574d');
  paintGrime(ctx, rng, 8, 'rgba(10,8,5,0.35)');
  paintGrime(ctx, rng, 3, 'rgba(35,45,25,0.25)'); // moss
  paintCracks(ctx, rng, 6, 'rgba(20,16,12,0.6)');
  paintNoise(ctx, rng, 18);
  return c;
}

function redWall() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const rng = makeRng(202);
  paintBlocks(ctx, rng, '#6e3528', '#3a1c14', 4, 80);
  paintCarvingBand(ctx, rng, TEX_SIZE * 0.30, TEX_SIZE * 0.22, '#582a20', '#7d4030');
  paintGrime(ctx, rng, 9, 'rgba(15,5,5,0.4)');
  paintCracks(ctx, rng, 5, 'rgba(25,10,8,0.6)');
  paintNoise(ctx, rng, 16);
  return c;
}

function darkWall() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const rng = makeRng(303);
  paintBlocks(ctx, rng, '#33363e', '#1b1d22', 6, 50);
  paintGrime(ctx, rng, 10, 'rgba(5,5,8,0.45)');
  paintGrime(ctx, rng, 5, 'rgba(28,42,30,0.3)'); // heavy moss
  paintCracks(ctx, rng, 8, 'rgba(10,10,14,0.7)');
  paintNoise(ctx, rng, 14);
  return c;
}

function goldWall() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const rng = makeRng(404);
  paintBlocks(ctx, rng, '#705c22', '#3d3110', 4, 70);
  paintCarvingBand(ctx, rng, TEX_SIZE * 0.12, TEX_SIZE * 0.18, '#5c4a18', '#8a7430');
  paintCarvingBand(ctx, rng, TEX_SIZE * 0.62, TEX_SIZE * 0.18, '#5c4a18', '#8a7430');
  paintGrime(ctx, rng, 7, 'rgba(20,14,4,0.4)'); // tarnish
  paintNoise(ctx, rng, 15);
  return c;
}

function doorTexture(emblemColor) {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const rng = makeRng(505);
  // Vertical wooden planks
  ctx.fillStyle = '#3c2616';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  const planks = 6;
  for (let p = 0; p < planks; p++) {
    const x = (p * TEX_SIZE) / planks;
    ctx.fillStyle = p % 2 ? '#42291a' : '#372112';
    ctx.fillRect(x, 0, TEX_SIZE / planks - 2, TEX_SIZE);
    ctx.fillStyle = '#241307';
    ctx.fillRect(x + TEX_SIZE / planks - 2, 0, 2, TEX_SIZE);
    // Wood grain
    ctx.strokeStyle = 'rgba(20,10,4,0.5)';
    for (let g = 0; g < 4; g++) {
      const gx = x + 4 + rng() * (TEX_SIZE / planks - 8);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 6, TEX_SIZE * 0.33, gx - 6, TEX_SIZE * 0.66, gx, TEX_SIZE);
      ctx.stroke();
    }
  }
  // Iron bands
  for (const y of [TEX_SIZE * 0.15, TEX_SIZE * 0.8]) {
    ctx.fillStyle = '#26282c';
    ctx.fillRect(0, y, TEX_SIZE, 18);
    ctx.fillStyle = '#3a3d44';
    ctx.fillRect(0, y + 2, TEX_SIZE, 3);
    for (let b = 0; b < 6; b++) {
      ctx.fillStyle = '#15161a';
      ctx.beginPath();
      ctx.arc(20 + b * 44, y + 9, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (emblemColor) {
    // Glowing key emblem in the center
    const cx = TEX_SIZE / 2, cy = TEX_SIZE / 2;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50);
    g.addColorStop(0, emblemColor);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 50, cy - 50, 100, 100);
    ctx.strokeStyle = emblemColor;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 14, 0, Math.PI * 2);
    ctx.moveTo(cx, cy + 6);
    ctx.lineTo(cx, cy + 30);
    ctx.moveTo(cx, cy + 22);
    ctx.lineTo(cx + 10, cy + 22);
    ctx.stroke();
  }
  paintGrime(ctx, rng, 4, 'rgba(0,0,0,0.3)');
  return c;
}

function floorTexture() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const rng = makeRng(606);
  ctx.fillStyle = '#3a342c';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  // Flagstones: 4x4 irregular grid
  const n = 4;
  const cell = TEX_SIZE / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const inset = 2 + rng() * 3;
      const v = 0.85 + rng() * 0.3;
      ctx.fillStyle = `rgb(${Math.floor(58 * v)},${Math.floor(52 * v)},${Math.floor(44 * v)})`;
      ctx.fillRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
    }
  }
  paintGrime(ctx, rng, 10, 'rgba(8,6,4,0.4)');
  paintGrime(ctx, rng, 2, 'rgba(60,8,4,0.22)'); // old blood stains
  paintCracks(ctx, rng, 7, 'rgba(15,12,8,0.6)');
  paintNoise(ctx, rng, 14);
  return c;
}

function ceilingTexture() {
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const rng = makeRng(707);
  ctx.fillStyle = '#211e1c';
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
  paintBlocks(ctx, rng, '#262220', '#141210', 4, 40);
  paintGrime(ctx, rng, 12, 'rgba(0,0,0,0.5)');
  paintNoise(ctx, rng, 10);
  return c;
}

// Build every texture once; keyed by tile code plus floor/ceiling
export function createTextures() {
  return {
    1: toTexture(stoneWall()),
    2: toTexture(redWall()),
    3: toTexture(darkWall()),
    4: toTexture(goldWall()),
    5: toTexture(doorTexture(null)),
    6: toTexture(doorTexture('rgba(255,40,60,0.85)')),
    7: toTexture(doorTexture('rgba(60,120,255,0.85)')),
    8: toTexture(doorTexture('rgba(255,200,40,0.85)')),
    9: toTexture(stoneWall()), // secret walls look identical to stone
    floor: toTexture(floorTexture()),
    ceiling: toTexture(ceilingTexture()),
  };
}
