// Vidhi - Sprite sheet baking
// Enemy/pickup/effect art is painted once at load time onto offscreen
// canvases (idle/walk/windup/death poses) and used as billboard textures.

import * as THREE from 'three';

const S = 128; // frame size in px

function frame() {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  return c;
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

// pose: { phase 0..1, windup 0..1, dead 0..1 }
// All painters draw a figure standing on the bottom edge, centered.

function paintAsura(ctx, pose) {
  const { phase = 0, windup = 0, dead = 0 } = pose;
  const sway = Math.sin(phase * Math.PI * 2);
  const cx = S / 2;
  const slump = dead * 52; // body sinks when dying
  const lean = dead * 0.6;

  ctx.save();
  ctx.translate(cx, S);
  ctx.rotate(lean * 0.5);
  ctx.translate(0, slump);

  // Gaunt red demon: elongated limbs, hunched, glowing eyes
  const skin = '#7d1c14';
  const skinDark = '#54110c';
  const skinLight = '#a32a1c';

  // Legs (alternate with walk phase)
  ctx.strokeStyle = skinDark;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, -52);
  ctx.lineTo(-12 + sway * 7, -26);
  ctx.lineTo(-14 + sway * 10, -2);
  ctx.moveTo(8, -52);
  ctx.lineTo(12 - sway * 7, -26);
  ctx.lineTo(14 - sway * 10, -2);
  ctx.stroke();

  // Torso: hunched, ribbed
  const tg = ctx.createLinearGradient(-18, -95, 18, -50);
  tg.addColorStop(0, skinDark);
  tg.addColorStop(0.5, skin);
  tg.addColorStop(1, skinDark);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-17, -88);
  ctx.quadraticCurveTo(-22, -68, -10, -48);
  ctx.lineTo(10, -48);
  ctx.quadraticCurveTo(22, -68, 17, -88);
  ctx.quadraticCurveTo(0, -96, -17, -88);
  ctx.fill();
  // Rib shadows
  ctx.strokeStyle = 'rgba(30,5,4,0.6)';
  ctx.lineWidth = 2;
  for (let r = 0; r < 3; r++) {
    ctx.beginPath();
    ctx.moveTo(-12, -78 + r * 9);
    ctx.quadraticCurveTo(0, -74 + r * 9, 12, -78 + r * 9);
    ctx.stroke();
  }

  // Arms: long, clawed; raise on windup
  const armLift = windup * 40;
  ctx.strokeStyle = skin;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-15, -82);
  ctx.lineTo(-28 - windup * 6, -62 - armLift + sway * 4);
  ctx.lineTo(-30 - windup * 8, -34 - armLift);
  ctx.moveTo(15, -82);
  ctx.lineTo(28 + windup * 6, -62 - armLift - sway * 4);
  ctx.lineTo(30 + windup * 8, -34 - armLift);
  ctx.stroke();
  // Claws
  ctx.strokeStyle = '#d8cdb8';
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    const hx = side * (30 + windup * 8);
    const hy = -34 - armLift;
    for (let cl = -1; cl <= 1; cl++) {
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + cl * 4, hy + 9);
      ctx.stroke();
    }
  }

  // Head: narrow skull
  ctx.fillStyle = skinLight;
  ctx.beginPath();
  ctx.ellipse(0, -100, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jaw / open mouth on windup
  ctx.fillStyle = '#2a0503';
  ctx.beginPath();
  ctx.ellipse(0, -92, 5, 3 + windup * 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Fangs
  ctx.fillStyle = '#e8e0d0';
  ctx.beginPath();
  ctx.moveTo(-4, -94); ctx.lineTo(-2.5, -88 - windup * 3); ctx.lineTo(-1, -94);
  ctx.moveTo(4, -94); ctx.lineTo(2.5, -88 - windup * 3); ctx.lineTo(1, -94);
  ctx.fill();

  // Horns
  ctx.strokeStyle = '#473a28';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-8, -110);
  ctx.quadraticCurveTo(-16, -120, -12, -127);
  ctx.moveTo(8, -110);
  ctx.quadraticCurveTo(16, -120, 12, -127);
  ctx.stroke();

  // Glowing eyes (flare on windup, fade on death)
  const eyeA = (1 - dead) * (0.8 + windup * 0.2);
  glow(ctx, -5, -103, 7 + windup * 4, `rgba(255,160,20,${eyeA})`);
  glow(ctx, 5, -103, 7 + windup * 4, `rgba(255,160,20,${eyeA})`);
  ctx.fillStyle = `rgba(255,220,80,${eyeA})`;
  ctx.fillRect(-7, -105, 4, 3);
  ctx.fillRect(3, -105, 4, 3);

  ctx.restore();
}

function paintNaga(ctx, pose) {
  const { phase = 0, windup = 0, dead = 0 } = pose;
  const sway = Math.sin(phase * Math.PI * 2);
  const cx = S / 2;
  const slump = dead * 60;

  ctx.save();
  ctx.translate(cx, S);
  ctx.translate(0, slump);

  const scale1 = '#1d4a33';
  const scale2 = '#2c6a48';
  const belly = '#7da26b';

  // Coiled base
  ctx.fillStyle = scale1;
  ctx.beginPath();
  ctx.ellipse(0, -10, 26, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = scale2;
  ctx.beginPath();
  ctx.ellipse(sway * 4, -18, 20, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sinuous rising body
  const bend = sway * 8 - windup * 6;
  const bg = ctx.createLinearGradient(-10, -90, 10, -20);
  bg.addColorStop(0, scale2);
  bg.addColorStop(1, scale1);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-10, -20);
  ctx.quadraticCurveTo(bend - 14, -55, -8 + bend, -84);
  ctx.lineTo(8 + bend, -84);
  ctx.quadraticCurveTo(bend + 14, -55, 10, -20);
  ctx.closePath();
  ctx.fill();
  // Belly stripe
  ctx.fillStyle = belly;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(-3, -20);
  ctx.quadraticCurveTo(bend - 4, -55, -2 + bend, -82);
  ctx.lineTo(2 + bend, -82);
  ctx.quadraticCurveTo(bend + 4, -55, 3, -20);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Cobra hood: flares wide on windup
  const hoodW = 26 + windup * 12;
  const hg = ctx.createRadialGradient(bend, -98, 4, bend, -98, hoodW + 8);
  hg.addColorStop(0, scale2);
  hg.addColorStop(0.8, scale1);
  hg.addColorStop(1, '#10291c');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(bend, -98, hoodW, 27, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hood spectacle marking
  ctx.strokeStyle = 'rgba(190,200,90,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(bend - 9, -102, 6, 0, Math.PI * 2);
  ctx.arc(bend + 9, -102, 6, 0, Math.PI * 2);
  ctx.stroke();

  // Face
  ctx.fillStyle = scale2;
  ctx.beginPath();
  ctx.ellipse(bend, -94, 10, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fangs and tongue on windup
  if (windup > 0.1) {
    ctx.fillStyle = '#0f1f16';
    ctx.beginPath();
    ctx.ellipse(bend, -86, 5, 4 + windup * 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.moveTo(bend - 4, -88); ctx.lineTo(bend - 2.5, -81); ctx.lineTo(bend - 1, -88);
    ctx.moveTo(bend + 4, -88); ctx.lineTo(bend + 2.5, -81); ctx.lineTo(bend + 1, -88);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#c03040';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bend, -86);
    ctx.lineTo(bend + sway * 3, -79);
    ctx.moveTo(bend + sway * 3, -79);
    ctx.lineTo(bend + sway * 3 - 2, -75);
    ctx.moveTo(bend + sway * 3, -79);
    ctx.lineTo(bend + sway * 3 + 2, -75);
    ctx.stroke();
  }

  // Hypnotic eyes
  const eyeA = (1 - dead) * (0.85 + windup * 0.15);
  glow(ctx, bend - 5, -98, 7 + windup * 3, `rgba(190,255,40,${eyeA})`);
  glow(ctx, bend + 5, -98, 7 + windup * 3, `rgba(190,255,40,${eyeA})`);
  ctx.fillStyle = `rgba(230,255,90,${eyeA})`;
  ctx.fillRect(bend - 7, -100, 4, 4);
  ctx.fillRect(bend + 3, -100, 4, 4);
  ctx.fillStyle = `rgba(10,10,10,${eyeA})`;
  ctx.fillRect(bend - 5.5, -100, 1.5, 4);
  ctx.fillRect(bend + 4.5, -100, 1.5, 4);

  // Crown gem
  glow(ctx, bend, -112, 6, `rgba(255,60,60,${(1 - dead) * 0.8})`);

  ctx.restore();
}

function paintRakshasa(ctx, pose, boss) {
  const { phase = 0, windup = 0, dead = 0 } = pose;
  const sway = Math.sin(phase * Math.PI * 2);
  const cx = S / 2;
  const slump = dead * 48;

  ctx.save();
  ctx.translate(cx, S);
  ctx.rotate(dead * 0.35);
  ctx.translate(0, slump);

  const skin = '#3a2440';
  const skinDark = '#241328';
  const armor = '#1c1e26';
  const armorEdge = '#4a4e5e';

  if (boss) {
    // Infernal aura
    glow(ctx, 0, -70, 62, 'rgba(255,60,20,0.22)');
  }

  // Massive legs
  ctx.strokeStyle = skinDark;
  ctx.lineWidth = 15;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, -55);
  ctx.lineTo(-16 + sway * 6, -25);
  ctx.lineTo(-18 + sway * 8, -3);
  ctx.moveTo(13, -55);
  ctx.lineTo(16 - sway * 6, -25);
  ctx.lineTo(18 - sway * 8, -3);
  ctx.stroke();

  // Hulking torso
  const tg = ctx.createLinearGradient(-30, -100, 30, -50);
  tg.addColorStop(0, skinDark);
  tg.addColorStop(0.5, skin);
  tg.addColorStop(1, skinDark);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-30, -95);
  ctx.quadraticCurveTo(-34, -70, -16, -50);
  ctx.lineTo(16, -50);
  ctx.quadraticCurveTo(34, -70, 30, -95);
  ctx.quadraticCurveTo(0, -106, -30, -95);
  ctx.fill();

  // Chest armor plate with skull emblem
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.moveTo(-20, -92);
  ctx.lineTo(20, -92);
  ctx.lineTo(14, -62);
  ctx.lineTo(-14, -62);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = armorEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Skull emblem
  ctx.fillStyle = 'rgba(200,190,210,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -79, 6, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = armor;
  ctx.fillRect(-4, -80, 3, 3);
  ctx.fillRect(1, -80, 3, 3);

  // Arms: huge, spiked bracers; raise overhead on windup
  const armLift = windup * 46;
  ctx.strokeStyle = skin;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-26, -90);
  ctx.lineTo(-40, -68 - armLift + sway * 3);
  ctx.lineTo(-42, -36 - armLift);
  ctx.moveTo(26, -90);
  ctx.lineTo(40, -68 - armLift - sway * 3);
  ctx.lineTo(42, -36 - armLift);
  ctx.stroke();
  // Spiked bracers
  ctx.fillStyle = armor;
  for (const side of [-1, 1]) {
    const bx = side * 41;
    const by = -52 - armLift;
    ctx.fillRect(bx - 7, by - 8, 14, 16);
    ctx.strokeStyle = armorEdge;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 7, by - 8, 14, 16);
    ctx.beginPath();
    ctx.moveTo(bx - 7, by);
    ctx.lineTo(bx - 13 * 1, by);
    ctx.moveTo(bx + 7, by);
    ctx.lineTo(bx + 13, by);
    ctx.stroke();
  }

  // Brutish head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(0, -108, 14, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Heavy brow
  ctx.fillStyle = skinDark;
  ctx.fillRect(-12, -114, 24, 5);

  // Tusked maw, gapes on windup
  ctx.fillStyle = '#1a050f';
  ctx.beginPath();
  ctx.ellipse(0, -99, 7, 3 + windup * 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ddd2bc';
  ctx.beginPath();
  ctx.moveTo(-6, -98); ctx.lineTo(-4.5, -104 - windup * 2); ctx.lineTo(-3, -98);
  ctx.moveTo(6, -98); ctx.lineTo(4.5, -104 - windup * 2); ctx.lineTo(3, -98);
  ctx.fill();

  // Huge curved horns
  ctx.strokeStyle = '#4d4434';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-12, -116);
  ctx.quadraticCurveTo(-26, -124, -22, -127.5);
  ctx.moveTo(12, -116);
  ctx.quadraticCurveTo(26, -124, 22, -127.5);
  ctx.stroke();

  if (boss) {
    // Gold crown
    ctx.fillStyle = '#c8a020';
    ctx.fillRect(-11, -123, 22, 6);
    ctx.beginPath();
    for (const px of [-9, -3, 3, 9]) {
      ctx.moveTo(px - 2, -123);
      ctx.lineTo(px, -127.8);
      ctx.lineTo(px + 2, -123);
    }
    ctx.fill();
    glow(ctx, 0, -120, 9, 'rgba(255,80,80,0.8)'); // crown jewel
  }

  // Three glowing eyes
  const eyeA = (1 - dead) * (0.85 + windup * 0.15);
  glow(ctx, -6, -109, 7 + windup * 3, `rgba(255,60,10,${eyeA})`);
  glow(ctx, 6, -109, 7 + windup * 3, `rgba(255,60,10,${eyeA})`);
  glow(ctx, 0, -116, 8 + windup * 4, `rgba(255,120,10,${eyeA})`);
  ctx.fillStyle = `rgba(255,120,40,${eyeA})`;
  ctx.fillRect(-8, -111, 4, 3);
  ctx.fillRect(4, -111, 4, 3);
  ctx.fillRect(-2, -118, 4, 3);

  ctx.restore();
}

const PAINTERS = {
  asura: (ctx, pose) => paintAsura(ctx, pose),
  naga: (ctx, pose) => paintNaga(ctx, pose),
  rakshasa: (ctx, pose) => paintRakshasa(ctx, pose, false),
  boss: (ctx, pose) => paintRakshasa(ctx, pose, true),
};

function bakeEnemyFrames(painter) {
  const bake = (pose) => {
    const c = frame();
    painter(c.getContext('2d'), pose);
    return toTexture(c);
  };
  return {
    idle: [bake({ phase: 0 }), bake({ phase: 0.5 })],
    walk: [bake({ phase: 0.25 }), bake({ phase: 0.75 })],
    windup: [bake({ windup: 1 })],
    dead: [bake({ dead: 0.45 }), bake({ dead: 1 })],
  };
}

// ---- Pickups, decorations, effects ----

function paintHealth(ctx) {
  // Glowing lotus
  glow(ctx, S / 2, S / 2, 44, 'rgba(60,255,150,0.5)');
  ctx.fillStyle = '#4be08c';
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    ctx.save();
    ctx.translate(S / 2, S / 2 + 12);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, -22, 8, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#bfffd9';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2 + 6, 9, 0, Math.PI * 2);
  ctx.fill();
}

function paintAmmo(ctx) {
  glow(ctx, S / 2, S / 2, 40, 'rgba(255,170,30,0.5)');
  ctx.strokeStyle = '#ffb830';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 26, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.cos(a) * 8, S / 2 + Math.sin(a) * 8);
    ctx.lineTo(S / 2 + Math.cos(a) * 26, S / 2 + Math.sin(a) * 26);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 7, 0, Math.PI * 2);
  ctx.fill();
}

function paintArmor(ctx) {
  glow(ctx, S / 2, S / 2, 44, 'rgba(70,140,255,0.5)');
  // Shield with temple-flame crest
  ctx.fillStyle = '#3a7bd8';
  ctx.beginPath();
  ctx.moveTo(S / 2, S / 2 - 30);
  ctx.quadraticCurveTo(S / 2 + 26, S / 2 - 24, S / 2 + 24, S / 2 - 2);
  ctx.quadraticCurveTo(S / 2 + 20, S / 2 + 26, S / 2, S / 2 + 36);
  ctx.quadraticCurveTo(S / 2 - 20, S / 2 + 26, S / 2 - 24, S / 2 - 2);
  ctx.quadraticCurveTo(S / 2 - 26, S / 2 - 24, S / 2, S / 2 - 30);
  ctx.fill();
  ctx.strokeStyle = '#9cc4ff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#bfdcff';
  ctx.beginPath();
  ctx.moveTo(S / 2, S / 2 - 16);
  ctx.quadraticCurveTo(S / 2 + 9, S / 2 - 2, S / 2, S / 2 + 18);
  ctx.quadraticCurveTo(S / 2 - 9, S / 2 - 2, S / 2, S / 2 - 16);
  ctx.fill();
}

function paintKey(ctx, color) {
  glow(ctx, S / 2, S / 2, 46, color.replace('1)', '0.55)'));
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2 - 16, 15, 0, Math.PI * 2);
  ctx.moveTo(S / 2, S / 2 - 1);
  ctx.lineTo(S / 2, S / 2 + 34);
  ctx.moveTo(S / 2, S / 2 + 24);
  ctx.lineTo(S / 2 + 13, S / 2 + 24);
  ctx.moveTo(S / 2, S / 2 + 34);
  ctx.lineTo(S / 2 + 10, S / 2 + 34);
  ctx.stroke();
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
  ctx.arc(S / 2, S / 2, 8, 0, Math.PI * 2);
  ctx.fill();
}

function paintChakraDisc(ctx) {
  glow(ctx, S / 2, S / 2, 50, 'rgba(255,210,40,0.5)');
  ctx.strokeStyle = '#ffdd30';
  ctx.lineWidth = 4;
  ctx.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 === 0 ? 38 : 31;
    const x = S / 2 + Math.cos(a) * r;
    const y = S / 2 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(S / 2 + Math.cos(a) * 8, S / 2 + Math.sin(a) * 8);
    ctx.lineTo(S / 2 + Math.cos(a) * 30, S / 2 + Math.sin(a) * 30);
    ctx.stroke();
  }
  ctx.fillStyle = '#fff8d0';
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 6, 0, Math.PI * 2);
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
  painter(c.getContext('2d'), ...args);
  return toTexture(c);
}

export function createSpriteFrames() {
  return {
    enemies: {
      asura: bakeEnemyFrames(PAINTERS.asura),
      naga: bakeEnemyFrames(PAINTERS.naga),
      rakshasa: bakeEnemyFrames(PAINTERS.rakshasa),
      boss: bakeEnemyFrames(PAINTERS.boss),
    },
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
