// Vidhi - Sprite sheet baking
// Pickup, decoration and effect art is painted once at load time onto
// offscreen canvases and used as billboard textures. Enemies are no longer
// billboards - see src/models3d.js for the rigged 3D monsters.

import * as THREE from 'three';

const S = 128; // logical frame size the art below is authored in
const SS = 2;  // supersample factor: canvases are 256px for crisp billboards
const PI2 = Math.PI * 2;

function frame() {
  const c = document.createElement('canvas');
  c.width = S * SS;
  c.height = S * SS;
  return c;
}

// Context scaled so painters keep drawing in the authored 128px space
function frameCtx(c) {
  const ctx = c.getContext('2d');
  ctx.scale(SS, SS);
  return ctx;
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

function glow(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ---- Pickups, decorations, effects ----

function paintHealth(ctx) {
  const c = S / 2;
  glow(ctx, c, c + 4, 42, 'rgba(80,255,160,0.45)');
  // Lotus: dark outer petals behind, luminous inner petals in front
  const layers = [
    { n: 7, len: 30, w: 10, from: '#177a49', to: '#2fae6d' },
    { n: 5, len: 22, w: 9, from: '#7de8b2', to: '#e6fff2' },
  ];
  const baseY = c + 22;
  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      const a = -Math.PI / 2 + (i - (L.n - 1) / 2) * 0.42;
      ctx.save();
      ctx.translate(c, baseY);
      ctx.rotate(a);
      const g = ctx.createLinearGradient(0, 0, 0, -L.len);
      g.addColorStop(0, L.from);
      g.addColorStop(1, L.to);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -L.len / 2, L.w / 2, L.len / 2, 0, 0, PI2);
      ctx.fill();
      ctx.restore();
    }
  }
  // Gold center bud
  const bg = ctx.createRadialGradient(c - 2, baseY - 8, 1, c, baseY - 6, 8);
  bg.addColorStop(0, '#fff2b0');
  bg.addColorStop(1, '#c8952f');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(c, baseY - 6, 7, 0, PI2);
  ctx.fill();
  ctx.fillStyle = 'rgba(120,70,10,0.7)';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI2;
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * 4, baseY - 6 + Math.sin(a) * 4, 1, 0, PI2);
    ctx.fill();
  }
  // Sparkles
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.4;
  for (const [sx, sy, r] of [[c - 20, c - 14, 4], [c + 22, c - 4, 3]]) {
    ctx.beginPath();
    ctx.moveTo(sx - r, sy); ctx.lineTo(sx + r, sy);
    ctx.moveTo(sx, sy - r); ctx.lineTo(sx, sy + r);
    ctx.stroke();
  }
}

function paintAmmo(ctx) {
  const c = S / 2;
  glow(ctx, c, c, 42, 'rgba(255,150,30,0.45)');
  // Gold mandala ring
  const ring = ctx.createLinearGradient(c - 30, c - 30, c + 30, c + 30);
  ring.addColorStop(0, '#8a5a10');
  ring.addColorStop(0.5, '#f0c050');
  ring.addColorStop(1, '#8a5a10');
  ctx.strokeStyle = ring;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(c, c, 27, 0, PI2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,30,5,0.8)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(c, c, 30.5, 0, PI2);
  ctx.moveTo(c + 23.5, c);
  ctx.arc(c, c, 23.5, 0, PI2);
  ctx.stroke();
  // Spokes
  ctx.strokeStyle = '#e8b840';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI2 + Math.PI / 8;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 9, c + Math.sin(a) * 9);
    ctx.lineTo(c + Math.cos(a) * 23, c + Math.sin(a) * 23);
    ctx.stroke();
  }
  // Gems on the ring
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI2 + Math.PI / 4;
    const gx = c + Math.cos(a) * 27;
    const gy = c + Math.sin(a) * 27;
    ctx.fillStyle = '#c02020';
    ctx.beginPath();
    ctx.arc(gx, gy, 3, 0, PI2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,220,0.9)';
    ctx.beginPath();
    ctx.arc(gx - 1, gy - 1, 1, 0, PI2);
    ctx.fill();
  }
  // Flame heart
  const fg = ctx.createRadialGradient(c, c + 2, 1, c, c, 10);
  fg.addColorStop(0, '#fff0c0');
  fg.addColorStop(0.5, '#ff9020');
  fg.addColorStop(1, '#a02808');
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(c, c - 11);
  ctx.quadraticCurveTo(c + 8, c - 2, c + 5, c + 6);
  ctx.quadraticCurveTo(c + 3, c + 9, c, c + 9);
  ctx.quadraticCurveTo(c - 3, c + 9, c - 5, c + 6);
  ctx.quadraticCurveTo(c - 8, c - 2, c, c - 11);
  ctx.closePath();
  ctx.fill();
}

function paintArmor(ctx) {
  const c = S / 2;
  glow(ctx, c, c, 44, 'rgba(70,140,255,0.45)');
  // Kite shield with layered metal
  const mg = ctx.createLinearGradient(c - 24, c - 30, c + 24, c + 34);
  mg.addColorStop(0, '#6fa0e8');
  mg.addColorStop(0.5, '#2c5aa8');
  mg.addColorStop(1, '#1b3a72');
  ctx.fillStyle = mg;
  const shield = () => {
    ctx.beginPath();
    ctx.moveTo(c, c - 32);
    ctx.quadraticCurveTo(c + 24, c - 26, c + 22, c - 2);
    ctx.quadraticCurveTo(c + 19, c + 24, c, c + 36);
    ctx.quadraticCurveTo(c - 19, c + 24, c - 22, c - 2);
    ctx.quadraticCurveTo(c - 24, c - 26, c, c - 32);
    ctx.closePath();
  };
  shield();
  ctx.fill();
  // Gold rim
  ctx.strokeStyle = '#d9ae4a';
  ctx.lineWidth = 3.5;
  shield();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(40,25,5,0.6)';
  ctx.lineWidth = 1;
  shield();
  ctx.stroke();
  // Engraved chevrons
  ctx.strokeStyle = 'rgba(220,235,255,0.35)';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 2; i++) {
    const y = c - 12 + i * 16;
    ctx.beginPath();
    ctx.moveTo(c - 13, y);
    ctx.lineTo(c, y + 8);
    ctx.lineTo(c + 13, y);
    ctx.stroke();
  }
  // Center boss
  const bg = ctx.createRadialGradient(c - 2, c - 6, 1, c, c - 4, 8);
  bg.addColorStop(0, '#f4d878');
  bg.addColorStop(1, '#8a641c');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.arc(c, c - 4, 6.5, 0, PI2);
  ctx.fill();
  // Rivets
  ctx.fillStyle = '#e8cf90';
  for (const [rx, ry] of [[c - 16, c - 16], [c + 16, c - 16], [c - 13, c + 12], [c + 13, c + 12]]) {
    ctx.beginPath();
    ctx.arc(rx, ry, 1.8, 0, PI2);
    ctx.fill();
  }
}

function paintKey(ctx, color) {
  glow(ctx, S / 2, S / 2, 44, color.replace('1)', '0.5)'));
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.rotate(0.5);
  // Trefoil bow
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -20, 8, 0, PI2);
  ctx.moveTo(-2.5, -31);
  ctx.arc(-7.5, -31, 5, 0, PI2);
  ctx.moveTo(12.5, -31);
  ctx.arc(7.5, -31, 5, 0, PI2);
  ctx.stroke();
  // Shaft with collar bands and two teeth
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 28);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(-5, -6); ctx.lineTo(5, -6);
  ctx.moveTo(-4, 2); ctx.lineTo(4, 2);
  ctx.moveTo(0, 28); ctx.lineTo(12, 28);
  ctx.moveTo(0, 20); ctx.lineTo(9, 20);
  ctx.stroke();
  // Specular edge
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-1.6, -12);
  ctx.lineTo(-1.6, 26);
  ctx.stroke();
  ctx.restore();
}

function paintPillar(ctx) {
  const g = ctx.createLinearGradient(S / 2 - 18, 0, S / 2 + 18, 0);
  g.addColorStop(0, '#3a332a');
  g.addColorStop(0.5, '#5c5244');
  g.addColorStop(1, '#322c24');
  ctx.fillStyle = g;
  ctx.fillRect(S / 2 - 16, 8, 32, S - 8);
  // Capital and base
  ctx.fillStyle = '#4a4238';
  ctx.fillRect(S / 2 - 22, 0, 44, 12);
  ctx.fillRect(S / 2 - 22, S - 10, 44, 10);
  // Carved rings
  ctx.fillStyle = 'rgba(20,16,12,0.6)';
  for (let y = 26; y < S - 16; y += 22) {
    ctx.fillRect(S / 2 - 16, y, 32, 3);
  }
}

function paintFlame(ctx, seed) {
  const rng = (n) => Math.abs(Math.sin(seed * 78.23 + n * 12.9898)) % 1;
  const cx = S / 2;
  const base = S * 0.82;
  glow(ctx, cx, base - 28, 52, 'rgba(255,120,20,0.45)');
  // Layered flame tongues
  const layers = [
    { w: 26, h: 64, color: 'rgba(200,50,10,0.9)' },
    { w: 17, h: 48, color: 'rgba(255,140,20,0.95)' },
    { w: 9, h: 30, color: 'rgba(255,230,120,1)' },
  ];
  for (let li = 0; li < layers.length; li++) {
    const L = layers[li];
    const wob = (rng(li) - 0.5) * 14;
    ctx.fillStyle = L.color;
    ctx.beginPath();
    ctx.moveTo(cx - L.w, base);
    ctx.quadraticCurveTo(cx - L.w * 0.8, base - L.h * 0.55, cx + wob, base - L.h);
    ctx.quadraticCurveTo(cx + L.w * 0.8, base - L.h * 0.55, cx + L.w, base);
    ctx.closePath();
    ctx.fill();
  }
}

function paintOrb(ctx, inner, outer) {
  glow(ctx, S / 2, S / 2, 56, outer);
  glow(ctx, S / 2, S / 2, 26, inner);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 8, 0, PI2);
  ctx.fill();
}

function paintChakraDisc(ctx) {
  glow(ctx, S / 2, S / 2, 50, 'rgba(255,210,40,0.5)');
  ctx.strokeStyle = '#ffdd30';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * PI2;
    const r = i % 2 === 0 ? 38 : 31;
    const x = S / 2 + Math.cos(a) * r;
    const y = S / 2 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI2;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.cos(a) * 8, S / 2 + Math.sin(a) * 8);
    ctx.lineTo(S / 2 + Math.cos(a) * 30, S / 2 + Math.sin(a) * 30);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff8d0';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 6, 0, PI2);
  ctx.fill();
}

function paintParticleDot(ctx) {
  glow(ctx, S / 2, S / 2, 48, 'rgba(255,255,255,1)');
}

function paintPortal(ctx) {
  // Vertical shimmering gate of light
  const g = ctx.createLinearGradient(0, 0, 0, S);
  g.addColorStop(0, 'rgba(255,250,200,0.05)');
  g.addColorStop(0.45, 'rgba(255,210,60,0.65)');
  g.addColorStop(0.55, 'rgba(255,230,120,0.9)');
  g.addColorStop(0.7, 'rgba(255,170,30,0.5)');
  g.addColorStop(1, 'rgba(255,120,0,0.1)');
  const h = ctx.createLinearGradient(0, 0, S, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'source-over';
}

function bakeSimple(painter, ...args) {
  const c = frame();
  painter(frameCtx(c), ...args);
  return toTexture(c);
}

export function createSpriteFrames() {
  return {
    pickups: {
      health: bakeSimple(paintHealth),
      armor: bakeSimple(paintArmor),
      ammo: bakeSimple(paintAmmo),
      key_red: bakeSimple(paintKey, 'rgba(255,60,90,1)'),
      key_blue: bakeSimple(paintKey, 'rgba(80,140,255,1)'),
      key_gold: bakeSimple(paintKey, 'rgba(255,210,60,1)'),
    },
    pillar: bakeSimple(paintPillar),
    flames: [bakeSimple(paintFlame, 1), bakeSimple(paintFlame, 2), bakeSimple(paintFlame, 3)],
    projectiles: {
      chakra: bakeSimple(paintChakraDisc),
      brahmastra: bakeSimple(paintOrb, 'rgba(230,120,255,0.95)', 'rgba(160,30,255,0.5)'),
      venom: bakeSimple(paintOrb, 'rgba(150,255,90,0.95)', 'rgba(60,200,40,0.5)'),
    },
    particle: bakeSimple(paintParticleDot),
    portal: bakeSimple(paintPortal),
  };
}
