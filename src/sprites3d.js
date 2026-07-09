// Vidhi - Sprite sheet baking
// Enemy/pickup/effect art is painted once at load time onto offscreen
// canvases (idle/walk/windup/death poses) and used as billboard textures.

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

// Cohesive lighting pass over whatever the painter drew: warm torchlight
// from the upper-left, cold shadow toward the lower-right. source-atop
// only tints the sprite's own pixels, so the alpha silhouette is kept.
function lightOverlay(ctx) {
  ctx.save();
  ctx.setTransform(SS, 0, 0, SS, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, 'rgba(255,170,90,0.18)');
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,0,22,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
}

function groundShadow(ctx, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath();
  ctx.ellipse(0, -3, rx, ry, 0, 0, PI2);
  ctx.fill();
}

// pose: { phase 0..1, windup 0..1, dead 0..1 }
// All painters draw a figure standing on the bottom edge, centered.

// ---- Asura: a gaunt, ember-cracked ghoul with talons and needle teeth
function paintAsura(ctx, pose) {
  const { phase = 0, windup = 0, dead = 0 } = pose;
  const sway = Math.sin(phase * PI2);
  const cx = S / 2;
  const slump = dead * 52;

  ctx.save();
  ctx.translate(cx, S);
  ctx.rotate(dead * 0.3);
  ctx.translate(0, slump);

  const base = '#4a100c';
  const mid = '#71190f';
  const hi = '#9c2a16';
  const bone = '#d8cdb4';

  groundShadow(ctx, 19, 4.5);

  // Legs: digitigrade with knee spikes and clawed feet
  for (const side of [-1, 1]) {
    const k = side * sway;
    const hipX = side * 8, hipY = -50;
    const kneeX = side * 15 + k * 4, kneeY = -28;
    const ankX = side * 9 + k * 7, ankY = -6;
    ctx.strokeStyle = mid;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hipX, hipY);
    ctx.lineTo(kneeX, kneeY);
    ctx.stroke();
    ctx.strokeStyle = base;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY);
    ctx.lineTo(ankX, ankY);
    ctx.stroke();
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.moveTo(kneeX, kneeY - 4);
    ctx.lineTo(kneeX + side * 7, kneeY - 9);
    ctx.lineTo(kneeX + side, kneeY + 1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = bone;
    ctx.lineWidth = 2;
    for (let t = -1; t <= 1; t++) {
      ctx.beginPath();
      ctx.moveTo(ankX, ankY);
      ctx.quadraticCurveTo(ankX + side * 4 + t * 2, ankY + 3, ankX + side * 6 + t * 3, ankY + 6);
      ctx.stroke();
    }
  }

  // Tattered loincloth
  ctx.fillStyle = '#2a0d08';
  ctx.beginPath();
  ctx.moveTo(-10, -52);
  ctx.lineTo(10, -52);
  ctx.lineTo(8, -36);
  ctx.lineTo(5, -42);
  ctx.lineTo(2, -33);
  ctx.lineTo(-2, -40);
  ctx.lineTo(-5, -32);
  ctx.lineTo(-8, -38);
  ctx.closePath();
  ctx.fill();

  // Gaunt torso
  const tg = ctx.createLinearGradient(-20, -95, 20, -50);
  tg.addColorStop(0, base);
  tg.addColorStop(0.45, mid);
  tg.addColorStop(1, '#380b06');
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-16, -88);
  ctx.quadraticCurveTo(-21, -66, -9, -48);
  ctx.lineTo(9, -48);
  ctx.quadraticCurveTo(21, -66, 16, -88);
  ctx.quadraticCurveTo(0, -95, -16, -88);
  ctx.closePath();
  ctx.fill();

  // Spine spikes over the shoulders
  ctx.fillStyle = '#33100a';
  for (const [sx, sy, l] of [[-12, -88, 7], [-5, -92, 9], [2, -93, 9], [9, -89, 7]]) {
    ctx.beginPath();
    ctx.moveTo(sx - 2.5, sy);
    ctx.lineTo(sx, sy - l);
    ctx.lineTo(sx + 2.5, sy);
    ctx.closePath();
    ctx.fill();
  }

  // Ribcage ridges
  for (let r = 0; r < 4; r++) {
    const y = -80 + r * 8;
    ctx.strokeStyle = 'rgba(210,150,110,0.26)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-11, y);
    ctx.quadraticCurveTo(0, y + 4, 11, y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,4,2,0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-11, y + 2);
    ctx.quadraticCurveTo(0, y + 6, 11, y + 2);
    ctx.stroke();
  }

  // Ember core and cracks radiating down the belly
  const emberA = (1 - dead) * (0.45 + windup * 0.5);
  glow(ctx, 0, -64, 10, `rgba(255,110,20,${emberA * 0.5})`);
  ctx.strokeStyle = `rgba(255,120,25,${emberA})`;
  ctx.lineWidth = 1.2;
  for (const seed of [1, 2, 3, 4]) {
    ctx.beginPath();
    let x = 0, y = -66;
    ctx.moveTo(x, y);
    for (let s = 0; s < 3; s++) {
      x += Math.sin(seed * 3.7 + s * 2.1) * 6;
      y += 4 + Math.abs(Math.cos(seed * 1.3 + s)) * 4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Arms: elbow spikes, hands ending in long curling talons
  const armLift = windup * 38;
  for (const side of [-1, 1]) {
    const shX = side * 14, shY = -84;
    const elX = side * (26 + windup * 5), elY = -62 - armLift + side * sway * 3;
    const haX = side * (30 + windup * 9), haY = -34 - armLift;
    ctx.strokeStyle = mid;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(elX, elY);
    ctx.stroke();
    ctx.strokeStyle = base;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(elX, elY);
    ctx.lineTo(haX, haY);
    ctx.stroke();
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.moveTo(elX, elY - 3);
    ctx.lineTo(elX + side * 8, elY - 6);
    ctx.lineTo(elX + side, elY + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(haX, haY, 3.5, 4.5, 0, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = bone;
    ctx.lineWidth = 2.2;
    for (let t = 0; t < 4; t++) {
      const spread = (t - 1.5) * 3.4;
      ctx.beginPath();
      ctx.moveTo(haX, haY + 2);
      ctx.quadraticCurveTo(
        haX + side * 3 + spread * 0.6, haY + 9,
        haX + spread + side * 4, haY + 14 - Math.abs(spread) * 0.4,
      );
      ctx.stroke();
    }
  }

  // Head: horned skull with sunken cheeks
  const hY = -101;
  ctx.strokeStyle = base;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, -88);
  ctx.lineTo(0, -96);
  ctx.stroke();

  // Ridged horns
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#3d3226';
    ctx.beginPath();
    ctx.moveTo(side * 4.5, hY - 8);
    ctx.quadraticCurveTo(side * 14, hY - 14, side * 17, hY - 26);
    ctx.quadraticCurveTo(side * 13, hY - 19, side * 8.5, hY - 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,14,8,0.7)';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 2; g++) {
      ctx.beginPath();
      ctx.moveTo(side * (4 + g * 3), hY - 8 - g * 3);
      ctx.lineTo(side * (8 + g * 3), hY - 5 - g * 3);
      ctx.stroke();
    }
  }

  // Skull
  const sg = ctx.createRadialGradient(-3, hY - 4, 2, 0, hY, 13);
  sg.addColorStop(0, hi);
  sg.addColorStop(1, base);
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(-10, hY - 6);
  ctx.quadraticCurveTo(-11, hY - 14, 0, hY - 14);
  ctx.quadraticCurveTo(11, hY - 14, 10, hY - 6);
  ctx.quadraticCurveTo(9, hY + 2, 5, hY + 6);
  ctx.lineTo(-5, hY + 6);
  ctx.quadraticCurveTo(-9, hY + 2, -10, hY - 6);
  ctx.closePath();
  ctx.fill();
  // Cheek hollows
  ctx.fillStyle = 'rgba(20,4,2,0.5)';
  ctx.beginPath();
  ctx.ellipse(-6, hY + 1, 2.6, 3.5, 0.3, 0, PI2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, hY + 1, 2.6, 3.5, -0.3, 0, PI2);
  ctx.fill();
  // Brow ridge
  ctx.fillStyle = '#33100a';
  ctx.beginPath();
  ctx.moveTo(-9, hY - 6);
  ctx.lineTo(9, hY - 6);
  ctx.lineTo(7, hY - 3.5);
  ctx.lineTo(-7, hY - 3.5);
  ctx.closePath();
  ctx.fill();

  // Sunken sockets with slanted ember slits
  const eyeA = (1 - dead) * (0.85 + windup * 0.15);
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(8,2,2,0.9)';
    ctx.beginPath();
    ctx.ellipse(side * 5, hY - 2.5, 3.4, 2.8, 0, 0, PI2);
    ctx.fill();
    glow(ctx, side * 5, hY - 2.5, 5 + windup * 3, `rgba(255,140,30,${eyeA * 0.9})`);
    ctx.fillStyle = `rgba(255,210,90,${eyeA})`;
    ctx.beginPath();
    ctx.ellipse(side * 5, hY - 2.5, 2.1, 1.1, side * -0.35, 0, PI2);
    ctx.fill();
  }

  // Wide maw of needle teeth; jaw gapes on windup
  const jaw = 3 + windup * 6;
  ctx.fillStyle = '#120302';
  ctx.beginPath();
  ctx.moveTo(-6.5, hY + 6);
  ctx.quadraticCurveTo(0, hY + 5, 6.5, hY + 6);
  ctx.quadraticCurveTo(3, hY + 8 + jaw, 0, hY + 8 + jaw);
  ctx.quadraticCurveTo(-3, hY + 8 + jaw, -6.5, hY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bone;
  for (let t = -2; t <= 2; t++) {
    const tx = t * 2.6;
    const len = Math.abs(t) === 2 ? 5.5 : 3.2;
    ctx.beginPath();
    ctx.moveTo(tx - 1.1, hY + 6);
    ctx.lineTo(tx, hY + 6 + len);
    ctx.lineTo(tx + 1.1, hY + 6);
    ctx.closePath();
    ctx.fill();
  }
  for (let t = -1; t <= 1; t++) {
    const tx = t * 3;
    ctx.beginPath();
    ctx.moveTo(tx - 0.9, hY + 8 + jaw);
    ctx.lineTo(tx, hY + 4 + jaw);
    ctx.lineTo(tx + 0.9, hY + 8 + jaw);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  lightOverlay(ctx);
}

// ---- Naga: hooded cobra rising from scaled coils
function paintNaga(ctx, pose) {
  const { phase = 0, windup = 0, dead = 0 } = pose;
  const sway = Math.sin(phase * PI2);
  const cx = S / 2;
  const slump = dead * 58;

  ctx.save();
  ctx.translate(cx, S);
  ctx.translate(0, slump);

  const dark = '#12351f';
  const mid = '#1f5230';
  const light = '#2f7345';
  const belly = '#a8b86a';

  groundShadow(ctx, 24, 5);

  // Coiled base: stacked tapering coils with scale texture
  const coils = [
    { y: -9, rx: 26, ry: 9.5 },
    { y: -17, rx: 21, ry: 8 },
    { y: -24, rx: 15, ry: 6.5 },
  ];
  for (const c of coils) {
    const g = ctx.createRadialGradient(c.rx * -0.25, c.y - c.ry * 0.5, 2, 0, c.y, c.rx);
    g.addColorStop(0, light);
    g.addColorStop(0.7, mid);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(sway * 1.5, c.y, c.rx, c.ry, 0, 0, PI2);
    ctx.fill();
    // Scale rows clipped inside the coil
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(6,22,10,0.5)';
    ctx.lineWidth = 1;
    for (let row = -1; row <= 1; row++) {
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath();
        ctx.arc(i * 4 + (row % 2) * 2, c.y - 2 + row * 4, 2.2, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Rising body, pulled back before a strike
  const bend = sway * 7 - windup * 8;
  const bg = ctx.createLinearGradient(-12, -85, 12, -25);
  bg.addColorStop(0, mid);
  bg.addColorStop(1, dark);
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-9, -26);
  ctx.quadraticCurveTo(bend - 13, -55, bend - 6, -82);
  ctx.lineTo(bend + 6, -82);
  ctx.quadraticCurveTo(bend + 13, -55, 9, -26);
  ctx.closePath();
  ctx.fill();
  // Belly plates
  ctx.strokeStyle = `rgba(168,184,106,0.5)`;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const y = -30 - t * 48;
    const x = bend * t * t + bend * t * (1 - t);
    const w = 5 - t * 1.5;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  }

  // Cobra hood: rounded dome flaring wide, wavy lower edge
  const hoodW = 24 + windup * 13;
  const hY = -97;
  const hg = ctx.createRadialGradient(bend, hY - 4, 4, bend, hY - 4, hoodW + 8);
  hg.addColorStop(0, light);
  hg.addColorStop(0.72, mid);
  hg.addColorStop(1, '#0c2413');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(bend - hoodW, hY + 4);
  ctx.quadraticCurveTo(bend - hoodW * 1.08, hY - 18, bend, hY - 24);
  ctx.quadraticCurveTo(bend + hoodW * 1.08, hY - 18, bend + hoodW, hY + 4);
  // wavy lower edge, right to left
  const segs = 5;
  for (let i = 0; i < segs; i++) {
    const x0 = bend + hoodW - (i / segs) * hoodW * 2;
    const x1 = bend + hoodW - ((i + 1) / segs) * hoodW * 2;
    const dip = i % 2 ? 15 : 10;
    ctx.quadraticCurveTo((x0 + x1) / 2, hY + dip + 6, x1, hY + (i === segs - 1 ? 4 : dip - 3));
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0a1f10';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Spectacle marking high on the dome
  ctx.strokeStyle = 'rgba(200,215,110,0.5)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(bend - 10, hY - 13, 4.5, 0, PI2);
  ctx.moveTo(bend + 14.5, hY - 13);
  ctx.arc(bend + 10, hY - 13, 4.5, 0, PI2);
  ctx.moveTo(bend - 5.5, hY - 15.5);
  ctx.quadraticCurveTo(bend, hY - 18.5, bend + 5.5, hY - 15.5);
  ctx.stroke();

  // Face: broad viper head filling the hood center
  const fg = ctx.createLinearGradient(bend, hY - 12, bend, hY + 18);
  fg.addColorStop(0, light);
  fg.addColorStop(1, mid);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.moveTo(bend - 9.5, hY - 8);
  ctx.quadraticCurveTo(bend, hY - 13, bend + 9.5, hY - 8);
  ctx.quadraticCurveTo(bend + 10, hY + 4, bend + 5, hY + 12);
  ctx.quadraticCurveTo(bend, hY + 15, bend - 5, hY + 12);
  ctx.quadraticCurveTo(bend - 10, hY + 4, bend - 9.5, hY - 8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(8,28,14,0.6)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Slit-pupil eyes
  const eyeA = (1 - dead) * (0.85 + windup * 0.15);
  for (const side of [-1, 1]) {
    ctx.fillStyle = 'rgba(6,14,6,0.9)';
    ctx.beginPath();
    ctx.ellipse(bend + side * 5, hY - 3, 3.6, 4, 0, 0, PI2);
    ctx.fill();
    glow(ctx, bend + side * 5, hY - 3, 6 + windup * 3, `rgba(200,255,50,${eyeA * 0.85})`);
    ctx.fillStyle = `rgba(235,255,110,${eyeA})`;
    ctx.beginPath();
    ctx.ellipse(bend + side * 5, hY - 3, 2.7, 3.2, 0, 0, PI2);
    ctx.fill();
    ctx.fillStyle = `rgba(10,10,6,${eyeA})`;
    ctx.fillRect(bend + side * 5 - 0.7, hY - 6.4, 1.4, 6.6);
  }

  // Strike: gaping mouth with long curved fangs and a venom bead
  if (windup > 0.1) {
    ctx.fillStyle = '#1c0a10';
    ctx.beginPath();
    ctx.ellipse(bend, hY + 9, 5.5, 4 + windup * 3.5, 0, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = '#e8e0cc';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(bend + side * 4, hY + 6);
      ctx.quadraticCurveTo(bend + side * 5.5, hY + 12, bend + side * 3.5, hY + 15 + windup * 2);
      ctx.stroke();
    }
    if (windup > 0.4) {
      glow(ctx, bend + 3.5, hY + 17 + windup * 2, 4, 'rgba(150,255,60,0.9)');
    }
  } else {
    // Flickering forked tongue
    ctx.strokeStyle = '#c03040';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(bend, hY + 11);
    ctx.lineTo(bend + sway * 3, hY + 17);
    ctx.moveTo(bend + sway * 3, hY + 17);
    ctx.lineTo(bend + sway * 3 - 2, hY + 21);
    ctx.moveTo(bend + sway * 3, hY + 17);
    ctx.lineTo(bend + sway * 3 + 2, hY + 21);
    ctx.stroke();
  }

  // Gold naga crown with a burning gem
  ctx.fillStyle = '#c8952f';
  ctx.beginPath();
  ctx.moveTo(bend - 7, hY - 22);
  ctx.lineTo(bend + 7, hY - 22);
  ctx.lineTo(bend + 5.5, hY - 26);
  ctx.lineTo(bend + 2, hY - 23.5);
  ctx.lineTo(bend, hY - 28);
  ctx.lineTo(bend - 2, hY - 23.5);
  ctx.lineTo(bend - 5.5, hY - 26);
  ctx.closePath();
  ctx.fill();
  glow(ctx, bend, hY - 24, 5, `rgba(255,70,60,${(1 - dead) * 0.8})`);

  ctx.restore();
  lightOverlay(ctx);
}

// ---- Rakshasa: hulking tusked demon with a skull garland; boss variant
// gets a mane of fire, a crown and heavier gold.
function paintRakshasa(ctx, pose, boss) {
  const { phase = 0, windup = 0, dead = 0 } = pose;
  const sway = Math.sin(phase * PI2);
  const cx = S / 2;
  const slump = dead * 46;

  ctx.save();
  ctx.translate(cx, S);
  ctx.rotate(dead * 0.3);
  ctx.translate(0, slump);

  const base = '#191322';
  const mid = '#2e2340';
  const hi = '#473558';
  const gold = '#c8952f';
  const bone = '#cdc3b0';
  const cloth = '#5c1414';

  groundShadow(ctx, 26, 6);

  if (boss) {
    glow(ctx, 0, -72, 56, 'rgba(255,60,15,0.26)');
  }

  // Spiked mane silhouette behind the head and shoulders
  ctx.fillStyle = boss ? '#2a0a08' : '#0d0a12';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.12 + (i / 8) * 0.76);
    const x = -Math.cos(a) * 26;
    const y = -104 - Math.sin(a) * 22;
    ctx.beginPath();
    ctx.moveTo(x * 0.4, -100);
    ctx.lineTo(x, y);
    ctx.lineTo(x * 0.75 + (i % 2 ? 4 : -4), -96);
    ctx.closePath();
    ctx.fill();
  }

  // Massive legs with gold anklets and clawed toes
  for (const side of [-1, 1]) {
    const k = side * sway;
    const lg = ctx.createLinearGradient(side * 8, -55, side * 22, -5);
    lg.addColorStop(0, mid);
    lg.addColorStop(1, base);
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(side * 7, -56);
    ctx.lineTo(side * 22 + k * 4, -50);
    ctx.lineTo(side * 20 + k * 6, -4);
    ctx.lineTo(side * 8 + k * 5, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.fillRect(side * 9 + k * 5.5 - 5, -12, 11, 3.5);
    ctx.fillStyle = bone;
    for (let t = 0; t < 3; t++) {
      const tx = side * (11 + t * 4) + k * 6;
      ctx.beginPath();
      ctx.moveTo(tx - 1.6, -4);
      ctx.lineTo(tx, 1);
      ctx.lineTo(tx + 1.6, -4);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Dhoti with a gold hem
  ctx.fillStyle = cloth;
  ctx.beginPath();
  ctx.moveTo(-17, -60);
  ctx.lineTo(17, -60);
  ctx.lineTo(14, -38);
  ctx.lineTo(8, -44);
  ctx.lineTo(0, -34);
  ctx.lineTo(-8, -44);
  ctx.lineTo(-14, -38);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -39.5);
  ctx.lineTo(-8, -45.5);
  ctx.lineTo(0, -35.5);
  ctx.lineTo(8, -45.5);
  ctx.lineTo(14, -39.5);
  ctx.stroke();

  // Barrel torso
  const tg = ctx.createLinearGradient(-30, -100, 30, -55);
  tg.addColorStop(0, base);
  tg.addColorStop(0.45, mid);
  tg.addColorStop(0.7, hi);
  tg.addColorStop(1, base);
  ctx.fillStyle = tg;
  ctx.beginPath();
  ctx.moveTo(-28, -95);
  ctx.quadraticCurveTo(-35, -72, -18, -55);
  ctx.lineTo(18, -55);
  ctx.quadraticCurveTo(35, -72, 28, -95);
  ctx.quadraticCurveTo(0, -105, -28, -95);
  ctx.closePath();
  ctx.fill();
  // Pecs and belly creases
  ctx.strokeStyle = 'rgba(8,4,14,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-16, -84);
  ctx.quadraticCurveTo(0, -78, 16, -84);
  ctx.moveTo(-10, -66);
  ctx.quadraticCurveTo(0, -62, 10, -66);
  ctx.stroke();

  // Ash war paint stripes
  ctx.strokeStyle = 'rgba(205,195,176,0.4)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const y = -90 + i * 7;
    ctx.beginPath();
    ctx.moveTo(-15 + i * 2, y);
    ctx.lineTo(15 - i * 2, y - 2);
    ctx.stroke();
  }

  // Skull garland across the chest
  ctx.strokeStyle = '#3a2c18';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-23, -92);
  ctx.quadraticCurveTo(0, -66, 23, -92);
  ctx.stroke();
  for (let i = -2; i <= 2; i++) {
    const t = (i + 2) / 4;
    const x = -23 + t * 46;
    const y = -92 + Math.sin(t * Math.PI) * 19;
    ctx.fillStyle = bone;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.6, 4, 0, 0, PI2);
    ctx.fill();
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(x - 2.2, y - 0.5, 1.7, 1.7);
    ctx.fillRect(x + 0.5, y - 0.5, 1.7, 1.7);
    ctx.fillStyle = bone;
    ctx.fillRect(x - 1.5, y + 2.4, 3, 1.4);
  }

  // Arms: boulder shoulders, gold armbands, talon hands (raised on windup)
  const armLift = windup * 44;
  for (const side of [-1, 1]) {
    const shX = side * 24, shY = -92;
    const elX = side * (38 + windup * 3), elY = -70 - armLift * 0.6 + side * sway * 3;
    const haX = side * (42 + windup * 4), haY = -42 - armLift;
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.ellipse(shX, shY, 9, 8, 0, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = mid;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shX, shY);
    ctx.lineTo(elX, elY);
    ctx.stroke();
    ctx.strokeStyle = base;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(elX, elY);
    ctx.lineTo(haX, haY);
    ctx.stroke();
    // Gold armband
    ctx.save();
    ctx.translate((shX + elX) / 2, (shY + elY) / 2);
    ctx.rotate(Math.atan2(elY - shY, elX - shX) + Math.PI / 2);
    ctx.fillStyle = gold;
    ctx.fillRect(-7, -2, 14, 4);
    ctx.restore();
    // Fist and talons
    ctx.fillStyle = mid;
    ctx.beginPath();
    ctx.ellipse(haX, haY, 5.5, 6, 0, 0, PI2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,4,14,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = bone;
    ctx.lineWidth = 1.9;
    for (let t = 0; t < 3; t++) {
      const spread = (t - 1) * 5.5;
      ctx.beginPath();
      ctx.moveTo(haX + spread * 0.4, haY + 5);
      ctx.quadraticCurveTo(
        haX + side * 3 + spread * 0.8, haY + 12,
        haX + spread + side * 4, haY + 18 - Math.abs(spread) * 0.35,
      );
      ctx.stroke();
    }
  }

  // Head: broad and jowly
  const hY = -112;
  const hg = ctx.createRadialGradient(-4, hY - 3, 3, 0, hY, 16);
  hg.addColorStop(0, hi);
  hg.addColorStop(1, mid);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-13, hY - 9);
  ctx.quadraticCurveTo(0, hY - 15, 13, hY - 9);
  ctx.quadraticCurveTo(15, hY + 2, 11, hY + 9);
  ctx.quadraticCurveTo(0, hY + 13, -11, hY + 9);
  ctx.quadraticCurveTo(-15, hY + 2, -13, hY - 9);
  ctx.closePath();
  ctx.fill();

  // Ram horns
  for (const side of [-1, 1]) {
    ctx.strokeStyle = '#4d4434';
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(side * 11, hY - 9);
    ctx.quadraticCurveTo(side * 22, hY - 15, side * 24, hY - 5);
    ctx.quadraticCurveTo(side * 25, hY + 1, side * 21, hY + 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(20,16,8,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(side * 14, hY - 11);
    ctx.lineTo(side * 15, hY - 7);
    ctx.moveTo(side * 18, hY - 12);
    ctx.lineTo(side * 19, hY - 7);
    ctx.stroke();
  }

  // Gold disc earrings
  for (const side of [-1, 1]) {
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(side * 13, hY + 7, 2.8, 0, PI2);
    ctx.fill();
  }

  // Heavy brow and three burning eyes (third opens wide on windup)
  ctx.fillStyle = 'rgba(10,6,16,0.85)';
  ctx.beginPath();
  ctx.moveTo(-11, hY - 5);
  ctx.lineTo(11, hY - 5);
  ctx.lineTo(9, hY - 1.5);
  ctx.lineTo(-9, hY - 1.5);
  ctx.closePath();
  ctx.fill();
  const eyeA = (1 - dead) * (0.85 + windup * 0.15);
  for (const side of [-1, 1]) {
    glow(ctx, side * 6, hY - 1, 5.5 + windup * 3, `rgba(255,70,15,${eyeA * 0.9})`);
    ctx.fillStyle = `rgba(255,150,50,${eyeA})`;
    ctx.beginPath();
    ctx.ellipse(side * 6, hY - 1, 2.4, 1.3, side * -0.3, 0, PI2);
    ctx.fill();
  }
  glow(ctx, 0, hY - 9, 6 + windup * 5, `rgba(255,120,15,${eyeA})`);
  ctx.fillStyle = `rgba(255,190,80,${eyeA})`;
  ctx.beginPath();
  ctx.ellipse(0, hY - 9, 1.4, 2.6 + windup * 1.6, 0, 0, PI2);
  ctx.fill();

  // Tusked grin: wide maw, square teeth, up-curving lower tusks
  const jaw = windup * 5;
  ctx.fillStyle = '#140309';
  ctx.beginPath();
  ctx.moveTo(-9, hY + 5);
  ctx.quadraticCurveTo(0, hY + 4, 9, hY + 5);
  ctx.quadraticCurveTo(6, hY + 10 + jaw, 0, hY + 10 + jaw);
  ctx.quadraticCurveTo(-6, hY + 10 + jaw, -9, hY + 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bone;
  for (let t = -2; t <= 2; t++) {
    ctx.fillRect(t * 2.8 - 1, hY + 5, 2, 2.6);
  }
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 8, hY + 8 + jaw);
    ctx.quadraticCurveTo(side * 11, hY + 4, side * 9.5, hY - 1);
    ctx.quadraticCurveTo(side * 7.5, hY + 4, side * 5.5, hY + 7 + jaw);
    ctx.closePath();
    ctx.fill();
  }

  if (boss) {
    // Crown
    ctx.fillStyle = gold;
    ctx.fillRect(-11, hY - 17, 22, 5);
    ctx.beginPath();
    for (const px of [-8.5, -3, 2.5, 8]) {
      ctx.moveTo(px - 2, hY - 17);
      ctx.lineTo(px + 0.5, hY - 23);
      ctx.lineTo(px + 3, hY - 17);
    }
    ctx.fill();
    glow(ctx, 0, hY - 15, 8, 'rgba(255,80,80,0.8)');
  }

  ctx.restore();
  lightOverlay(ctx);
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
    painter(frameCtx(c), pose);
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
