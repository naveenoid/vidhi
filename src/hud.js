// Vidhi - 2D HUD overlay
// Drawn on a transparent canvas stacked above the WebGL view: weapon
// sprite, status bar, minimap, crosshair, vignette and damage feedback.

import { TILE_SIZE, DOOR_TILES, isTouchDevice } from './constants.js';

// Minimap wall colors, indexed by tile code
const MAP_COLORS = ['', '#8B7355', '#AA4444', '#555566', '#C8A000',
  '#e8b84a', '#e0405a', '#4a7ce0', '#ffd24a', '#8B7355'];

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hitMarkerT = 0;
    this.dpr = 1; // set by Game.onResize; ctx transform applied per frame
    this.touch = isTouchDevice();
  }

  showHitMarker() {
    this.hitMarkerT = 0.12;
  }

  render(player, map, sprites, gameState, dt) {
    const ctx = this.ctx;
    // Canvas backing store is DPR-scaled for crisp text; draw in CSS px.
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    this.renderWeapon(ctx, player, gameState, w, h);
    this.renderVignette(ctx, gameState, w, h);
    this.renderCrosshair(ctx, gameState, w, h, dt);
    this.renderDoorPrompt(ctx, gameState, w, h);
    this.renderHUD(ctx, player, gameState, w, h);
    this.renderMinimap(ctx, player, map, sprites, gameState, w, h);
  }

  // Prompt shown when facing a door: how to open it, or which key it wants.
  renderDoorPrompt(ctx, gameState, w, h) {
    const p = gameState.doorPrompt;
    if (!p) return;
    const y = Math.round(h * 0.62);
    const pulse = 0.75 + 0.25 * Math.sin((gameState.time || 0) * 4);
    ctx.save();
    let size = w < 480 ? 15 : 18;
    ctx.font = `bold ${size}px monospace`;
    let tw = ctx.measureText(p.text).width;
    if (tw > w - 48) { // shrink to fit narrow phones
      size = Math.max(11, Math.floor(size * (w - 48) / tw));
      ctx.font = `bold ${size}px monospace`;
      tw = ctx.measureText(p.text).width;
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(w / 2 - tw / 2 - 16, y - 21, tw + 32, 32);
    ctx.strokeStyle = p.locked ? '#aa2222' : `rgba(200,160,0,${pulse})`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(w / 2 - tw / 2 - 16, y - 21, tw + 32, 32);
    ctx.fillStyle = p.locked ? '#ff5a48' : '#ffd24a';
    ctx.fillText(p.text, w / 2, y);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // Permanent horror vignette + directional damage indicator
  renderVignette(ctx, gameState, w, h) {
    const v = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.85);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    if (gameState.screenFlash > 0 && gameState.screenFlashColor === 'red') {
      // Damage: red bleed strongest on the side the hit came from
      const rel = gameState.damageRel || 0; // -PI..PI relative to facing
      const sideX = w / 2 - Math.sin(rel) * w * 0.45;
      const g = ctx.createRadialGradient(sideX, h / 2, h * 0.1, w / 2, h / 2, h * 0.9);
      g.addColorStop(0, `rgba(180,0,0,${gameState.screenFlash * 0.55})`);
      g.addColorStop(1, 'rgba(120,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  renderCrosshair(ctx, gameState, w, h, dt) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    const cx = w / 2, cy = h / 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - 4, cy);
    ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - 4);
    ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 10);
    ctx.stroke();

    if (this.hitMarkerT > 0) {
      this.hitMarkerT -= dt;
      ctx.strokeStyle = `rgba(255,80,60,${Math.min(1, this.hitMarkerT * 10)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.moveTo(cx + dx * 14, cy + dy * 14);
        ctx.lineTo(cx + dx * 7, cy + dy * 7);
      }
      ctx.stroke();
    }
  }

  renderWeapon(ctx, player, gameState, w, h) {
    const weapon = gameState.currentWeapon;
    // The weapon art is authored ~120px wide, bottom-anchored at (w/2, h).
    // Scale with BOTH axes so portrait phones don't get a screen-filling
    // staff, and push it toward the right edge, clear of the crosshair.
    const s = Math.max(1.7, Math.min(3.4, Math.min(h / 300, w / 250)));
    const bobX = Math.sin(gameState.walkCycle * 2) * 6;
    const bobY = Math.abs(Math.cos(gameState.walkCycle * 2)) * 5;
    const sway = Math.sin(gameState.time * 1.1) * 4; // idle drift
    const fireOffset = gameState.fireAnim > 0 ? -22 * gameState.fireAnim : 0;

    const weaponX = w / 2 - 60 + bobX + sway;
    const weaponY = h - 180 + bobY + fireOffset;

    const rightShift = w * (w < h ? 0.19 : 0.13);
    const downShift = h * 0.08;
    ctx.save();
    // Grow the viewmodel from a bottom anchor nudged right/down so the staff
    // sits to the side of the crosshair instead of over it.
    ctx.translate(w / 2 + rightShift, h + downShift);
    ctx.scale(s, s);
    ctx.translate(-w / 2, -h);

    // Contact shadow at the screen edge grounds the hand.
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(w / 2 + sway * 0.4, h - 4, 78, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    this.drawArm(ctx, weaponX, weaponY);
    switch (weapon) {
      case 'trishul': this.drawTrishul(ctx, weaponX, weaponY, gameState); break;
      case 'agni': this.drawAgni(ctx, weaponX, weaponY, gameState); break;
      case 'chakra': this.drawChakra(ctx, weaponX, weaponY, gameState); break;
      case 'brahmastra': this.drawBrahmastra(ctx, weaponX, weaponY, gameState); break;
    }
    this.drawGripFingers(ctx, weaponX, weaponY);
    ctx.restore();

    // Settle the bright vector art into the dim, lantern-lit scene. source-atop
    // tints only the pixels just drawn (the weapon + hand), not the empty HUD.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const shade = ctx.createLinearGradient(0, h * 0.4, 0, h);
    shade.addColorStop(0, 'rgba(6,5,12,0)');
    shade.addColorStop(1, 'rgba(2,2,8,0.5)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    const warm = ctx.createRadialGradient(w / 2, h * 0.58, 0, w / 2, h * 0.58, h * 0.5);
    warm.addColorStop(0, 'rgba(255,150,70,0.16)');
    warm.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Muzzle flash (bright, on top of the shading)
    if (gameState.fireAnim > 0.5) {
      const fx = w / 2 + rightShift + bobX * s;
      const fy = h + downShift + (weaponY - 12 - h) * s;
      const rad = 60 * gameState.fireAnim * (s / 2);
      ctx.save();
      ctx.globalAlpha = gameState.fireAnim - 0.5;
      const flashColors = {
        trishul: '#88ccff', agni: '#ff6600', chakra: '#ffdd00', brahmastra: '#ff00ff',
      };
      const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, rad);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, flashColors[weapon] || '#ffaa00');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx, fy, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // First-person forearm + fist gripping the weapon. Drawn in the same authored
  // coordinate space as the weapons (x,y is the weapon's top-left origin), so it
  // scales with the viewmodel. drawGripFingers() is called after the weapon so
  // the thumb and fingertips wrap in front of the shaft.
  drawArm(ctx, x, y) {
    const cx = x + 52;          // grip centre
    const baseY = y + 215;      // off the bottom of the screen
    const wristY = y + 120;

    // Forearm
    const fore = ctx.createLinearGradient(0, wristY, 0, baseY);
    fore.addColorStop(0, '#7a5a40');
    fore.addColorStop(0.5, '#5b4330');
    fore.addColorStop(1, '#36271b');
    ctx.fillStyle = fore;
    ctx.beginPath();
    ctx.moveTo(x - 10, baseY);
    ctx.lineTo(x + 122, baseY);
    ctx.lineTo(x + 92, wristY + 6);
    ctx.quadraticCurveTo(cx, wristY - 10, x + 24, wristY + 10);
    ctx.closePath();
    ctx.fill();

    // Shadow down the inner edge, highlight along the muscle
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.moveTo(x - 10, baseY);
    ctx.lineTo(x + 22, baseY);
    ctx.lineTo(x + 32, wristY + 12);
    ctx.lineTo(x + 24, wristY + 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(196,156,116,0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 74, baseY);
    ctx.lineTo(x + 80, wristY + 16);
    ctx.stroke();

    // Blood-dark temple cloth bracer with gold trim
    const wrapY = y + 152;
    for (let i = 0; i < 4; i++) {
      const yy = wrapY + i * 11;
      ctx.fillStyle = i % 2 ? '#491010' : '#5f1818';
      ctx.beginPath();
      ctx.moveTo(x + 4, yy);
      ctx.lineTo(x + 114, yy - 4);
      ctx.lineTo(x + 114, yy + 8);
      ctx.lineTo(x + 4, yy + 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#b8902c';
    ctx.fillRect(x + 4, wrapY - 5, 110, 3);
    ctx.fillRect(x + 4, wrapY + 44, 104, 3);

    // Fist
    const hg = ctx.createRadialGradient(cx - 4, y + 97, 3, cx, y + 104, 20);
    hg.addColorStop(0, '#8c6a4b');
    hg.addColorStop(1, '#4a3624');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(cx, y + 104, 18, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4f37';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(cx - 12 + i * 8, y + 95, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, y + 116, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGripFingers(ctx, x, y) {
    const cx = x + 52;
    // Thumb crossing in front of the shaft
    ctx.fillStyle = '#82613f';
    ctx.beginPath();
    ctx.ellipse(cx - 12, y + 106, 8, 14, -0.5, 0, Math.PI * 2);
    ctx.fill();
    // Fingertips peeking over the grip
    ctx.fillStyle = '#6f5238';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + 8 + i * 9, y + 96 + i * 5, 6, 9, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - 12, y + 100, 4, 5, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // A proper trishula: dark polished shaft, gold collar, crescent yoke and
  // three leaf-shaped steel prongs with a faint sacred glow at the tips.
  drawTrishul(ctx, x, y, gs) {
    const cx = x + 52; // aligned with the fist
    const t = gs.time || 0;

    // --- Shaft: dark wood cylinder shading, slight taper, gold inlays
    const shaftGrad = ctx.createLinearGradient(cx - 6, 0, cx + 6, 0);
    shaftGrad.addColorStop(0, '#2e1d10');
    shaftGrad.addColorStop(0.35, '#6b4a2a');
    shaftGrad.addColorStop(0.5, '#7d5a36');
    shaftGrad.addColorStop(0.65, '#5c3f24');
    shaftGrad.addColorStop(1, '#241508');
    ctx.fillStyle = shaftGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 4.5, y + 38);
    ctx.lineTo(cx + 4.5, y + 38);
    ctx.lineTo(cx + 6, y + 195);
    ctx.lineTo(cx - 6, y + 195);
    ctx.closePath();
    ctx.fill();
    // Specular streak down the shaft
    ctx.strokeStyle = 'rgba(255,220,160,0.18)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 1.5, y + 40);
    ctx.lineTo(cx - 2.5, y + 193);
    ctx.stroke();
    // Gold inlay bands
    for (let i = 0; i < 3; i++) {
      const bandY = y + 66 + i * 34;
      ctx.fillStyle = '#8a6a1a';
      ctx.fillRect(cx - 5.5, bandY, 11, 4);
      ctx.fillStyle = '#e8c445';
      ctx.fillRect(cx - 5, bandY + 1, 10, 1.6);
    }

    // --- Gold collar (ferrule) where the head meets the shaft
    const collarY = y + 24;
    const cg = ctx.createLinearGradient(0, collarY, 0, collarY + 16);
    cg.addColorStop(0, '#f4d060');
    cg.addColorStop(0.5, '#b8902c');
    cg.addColorStop(1, '#6e5312');
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(cx - 7, collarY);
    ctx.lineTo(cx + 7, collarY);
    ctx.lineTo(cx + 5, collarY + 15);
    ctx.lineTo(cx - 5, collarY + 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f8e090';
    ctx.fillRect(cx - 7, collarY + 2, 14, 1.6);

    // --- Red prayer cloth tied at the collar, tail swaying
    const swayC = Math.sin(t * 2.2) * 4;
    ctx.fillStyle = '#a31414';
    ctx.beginPath();
    ctx.moveTo(cx - 6, collarY + 9);
    ctx.quadraticCurveTo(cx - 14 + swayC, collarY + 26, cx - 9 + swayC * 1.6, collarY + 46);
    ctx.quadraticCurveTo(cx - 4 + swayC, collarY + 30, cx - 1, collarY + 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7d0e0e';
    ctx.beginPath();
    ctx.moveTo(cx - 3, collarY + 12);
    ctx.quadraticCurveTo(cx - 8 + swayC, collarY + 24, cx - 6 + swayC * 1.4, collarY + 38);
    ctx.quadraticCurveTo(cx - 2, collarY + 24, cx, collarY + 13);
    ctx.closePath();
    ctx.fill();

    // --- Steel: shared gradient for yoke and prongs
    const steel = ctx.createLinearGradient(cx - 26, 0, cx + 26, 0);
    steel.addColorStop(0, '#5a6878');
    steel.addColorStop(0.5, '#d6e2f0');
    steel.addColorStop(1, '#6b7a90');

    // Crescent yoke joining the three prongs
    ctx.strokeStyle = steel;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, y + 2, 21, Math.PI * 0.08, Math.PI * 0.92, false);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, y + 1, 23, Math.PI * 0.15, Math.PI * 0.85, false);
    ctx.stroke();

    // Leaf-shaped blade helper
    const blade = (bx, byTip, byBase, wHalf, curve) => {
      ctx.beginPath();
      ctx.moveTo(bx, byTip);
      ctx.quadraticCurveTo(bx + wHalf + curve, (byTip + byBase) / 2, bx, byBase);
      ctx.quadraticCurveTo(bx - wHalf + curve, (byTip + byBase) / 2, bx, byTip);
      ctx.closePath();
      ctx.fill();
      // Center ridge
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, byTip + 4);
      ctx.lineTo(bx + curve * 0.4, byBase - 4);
      ctx.stroke();
    };

    ctx.fillStyle = steel;
    // Side prongs: rise from the crescent tips, curving gently inward
    blade(cx - 21, y - 34, y + 6, 6.5, 2);
    blade(cx + 21, y - 34, y + 6, 6.5, -2);
    // Center prong: taller and broader
    blade(cx, y - 52, y + 12, 8.5, 0);

    // Small gold beads where prongs meet the crescent
    ctx.fillStyle = '#e8c445';
    for (const bx of [cx - 21, cx, cx + 21]) {
      ctx.beginPath();
      ctx.arc(bx, y + 9, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Sacred glow at the tips (brightens as you fire)
    const glowA = 0.2 + Math.sin(t * 3) * 0.05 + (gs.fireAnim || 0) * 0.5;
    for (const [gx, gy, gr] of [[cx, y - 50, 7], [cx - 21, y - 32, 5], [cx + 21, y - 32, 5]]) {
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 1.7);
      g.addColorStop(0, `rgba(200,230,255,${glowA})`);
      g.addColorStop(1, 'rgba(150,195,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, gr * 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawAgni(ctx, x, y, gs) {
    const bodyGrad = ctx.createLinearGradient(x + 25, y + 55, x + 95, y + 55);
    bodyGrad.addColorStop(0, '#882200');
    bodyGrad.addColorStop(0.3, '#cc4400');
    bodyGrad.addColorStop(0.5, '#dd5510');
    bodyGrad.addColorStop(0.7, '#cc4400');
    bodyGrad.addColorStop(1, '#882200');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x + 25, y + 52, 70, 28);

    ctx.strokeStyle = '#ff8833';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 28, y + 55, 64, 22);
    ctx.fillStyle = '#ffaa44';
    ctx.fillRect(x + 50, y + 58, 20, 3);
    ctx.fillRect(x + 50, y + 70, 20, 3);

    const bGrad = ctx.createLinearGradient(x + 32, y + 20, x + 50, y + 20);
    bGrad.addColorStop(0, '#772200');
    bGrad.addColorStop(0.4, '#aa4422');
    bGrad.addColorStop(0.6, '#993311');
    bGrad.addColorStop(1, '#661800');
    ctx.fillStyle = bGrad;
    ctx.fillRect(x + 33, y + 18, 16, 50);
    ctx.fillStyle = '#331100';
    ctx.fillRect(x + 35, y + 18, 12, 4);
    for (let v = 0; v < 3; v++) {
      ctx.fillStyle = '#551100';
      ctx.fillRect(x + 33, y + 28 + v * 10, 16, 2);
    }

    ctx.fillStyle = bGrad;
    ctx.fillRect(x + 68, y + 18, 16, 50);
    ctx.fillStyle = '#331100';
    ctx.fillRect(x + 70, y + 18, 12, 4);
    for (let v = 0; v < 3; v++) {
      ctx.fillStyle = '#551100';
      ctx.fillRect(x + 68, y + 28 + v * 10, 16, 2);
    }

    if (gs.fireAnim > 0) {
      const intensity = gs.fireAnim;
      ctx.fillStyle = `rgba(255, 180, 50, ${intensity * 0.6})`;
      ctx.beginPath();
      ctx.arc(x + 41, y + 14, 14 * intensity, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 80, 0, ${intensity * 0.4})`;
      ctx.beginPath();
      ctx.arc(x + 41, y + 8, 20 * intensity, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 180, 50, ${intensity * 0.6})`;
      ctx.beginPath();
      ctx.arc(x + 76, y + 14, 14 * intensity, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 80, 0, ${intensity * 0.4})`;
      ctx.beginPath();
      ctx.arc(x + 76, y + 8, 20 * intensity, 0, Math.PI * 2);
      ctx.fill();
    }

    const ember = Math.sin(gs.time * 3) * 0.15 + 0.25;
    ctx.fillStyle = `rgba(255, 100, 20, ${ember})`;
    ctx.beginPath();
    ctx.arc(x + 58, y + 40, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 38, y + 80, 16, 28);
    ctx.fillStyle = '#9B7924';
    ctx.fillRect(x + 40, y + 83, 12, 22);
    ctx.fillStyle = '#7B5904';
    for (let f = 0; f < 4; f++) {
      ctx.fillRect(x + 52, y + 82 + f * 6, 12, 3);
    }
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 62, y + 80, 8, 18);
  }

  drawChakra(ctx, x, y, gs) {
    const cx = x + 58;
    const spin = gs.time * 5;

    const bodyGrad = ctx.createLinearGradient(x + 22, y + 45, x + 95, y + 45);
    bodyGrad.addColorStop(0, '#8B6B00');
    bodyGrad.addColorStop(0.3, '#C8A000');
    bodyGrad.addColorStop(0.5, '#E8C830');
    bodyGrad.addColorStop(0.7, '#C8A000');
    bodyGrad.addColorStop(1, '#8B6B00');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x + 22, y + 45, 72, 30);

    ctx.fillStyle = '#aa8800';
    ctx.fillRect(x + 30, y + 38, 56, 10);
    ctx.fillStyle = '#776600';
    ctx.fillRect(x + 32, y + 40, 52, 2);
    ctx.fillRect(x + 32, y + 44, 52, 2);

    ctx.fillStyle = '#ddbb30';
    ctx.fillRect(x + 24, y + 50, 3, 20);
    ctx.fillRect(x + 91, y + 50, 3, 20);

    ctx.save();
    ctx.translate(cx, y + 22);
    ctx.rotate(spin);

    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 2 === 0 ? 22 : 18;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,50,0.15)';
    ctx.fill();

    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#ffbb00';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
      ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    const glowPulse = Math.sin(gs.time * 6) * 0.1 + 0.2;
    ctx.fillStyle = `rgba(255,220,50,${glowPulse})`;
    ctx.beginPath();
    ctx.arc(cx, y + 22, 26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 35, y + 75, 16, 28);
    ctx.fillStyle = '#9B7924';
    ctx.fillRect(x + 37, y + 78, 12, 22);
    ctx.fillStyle = '#7B5904';
    for (let f = 0; f < 4; f++) {
      ctx.fillRect(x + 49, y + 77 + f * 6, 14, 3);
    }
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 61, y + 75, 8, 18);
  }

  drawBrahmastra(ctx, x, y, gs) {
    const cx = x + 60;
    const pulse = Math.sin(gs.time * 4) * 0.3 + 0.7;

    const bodyGrad = ctx.createLinearGradient(x + 10, y + 38, x + 110, y + 38);
    bodyGrad.addColorStop(0, '#330055');
    bodyGrad.addColorStop(0.2, '#550077');
    bodyGrad.addColorStop(0.5, '#660088');
    bodyGrad.addColorStop(0.8, '#550077');
    bodyGrad.addColorStop(1, '#330055');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x + 12, y + 38, 96, 38);

    ctx.fillStyle = '#c8a000';
    ctx.fillRect(x + 14, y + 40, 92, 2);
    ctx.fillRect(x + 14, y + 73, 92, 2);
    ctx.fillRect(x + 14, y + 56, 92, 1);

    for (let v = 0; v < 3; v++) {
      ctx.fillStyle = `rgba(200,0,255,${pulse * 0.3})`;
      ctx.fillRect(x + 14, y + 45 + v * 9, 6, 4);
      ctx.fillRect(x + 100, y + 45 + v * 9, 6, 4);
    }

    const barrelGrad = ctx.createLinearGradient(x + 30, y + 12, x + 90, y + 12);
    barrelGrad.addColorStop(0, '#440066');
    barrelGrad.addColorStop(0.5, '#770099');
    barrelGrad.addColorStop(1, '#440066');
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(x + 32, y + 15, 56, 28);

    ctx.fillStyle = '#550077';
    ctx.beginPath();
    ctx.moveTo(x + 28, y + 12);
    ctx.lineTo(x + 92, y + 12);
    ctx.lineTo(x + 88, y + 18);
    ctx.lineTo(x + 32, y + 18);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#110022';
    ctx.fillRect(x + 38, y + 12, 44, 5);

    ctx.fillStyle = `rgba(150,0,255,${pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(cx, y + 35, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(200,50,255,${pulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(cx, y + 35, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,150,255,${pulse * 0.8})`;
    ctx.beginPath();
    ctx.arc(cx, y + 35, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255,220,255,${pulse})`;
    ctx.beginPath();
    ctx.arc(cx, y + 35, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, y + 35);
    ctx.rotate(gs.time * 3);
    ctx.strokeStyle = `rgba(200,100,255,${pulse * 0.5})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.lineTo(Math.cos(a + 0.3) * 22, Math.sin(a + 0.3) * 22);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = `rgba(200,150,255,${0.2 + pulse * 0.15})`;
    for (let r = 0; r < 4; r++) {
      ctx.fillRect(x + 22 + r * 22, y + 62, 12, 3);
    }

    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 25, y + 76, 16, 28);
    ctx.fillStyle = '#9B7924';
    ctx.fillRect(x + 27, y + 79, 12, 22);
    ctx.fillStyle = '#7B5904';
    for (let f = 0; f < 4; f++) {
      ctx.fillRect(x + 39, y + 78 + f * 6, 10, 3);
    }
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 72, y + 76, 16, 28);
    ctx.fillStyle = '#9B7924';
    ctx.fillRect(x + 74, y + 79, 12, 22);
    ctx.fillStyle = '#7B5904';
    for (let f = 0; f < 4; f++) {
      ctx.fillRect(x + 66, y + 78 + f * 6, 8, 3);
    }
  }

  renderHUD(ctx, player, gameState, w, h) {
    const compact = w < 700;
    const hudHeight = compact ? 48 : 60;
    const hudY = h - hudHeight;

    const bg = ctx.createLinearGradient(0, hudY, 0, h);
    bg.addColorStop(0, 'rgba(16, 9, 5, 0.78)');
    bg.addColorStop(1, 'rgba(6, 3, 2, 0.92)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, hudY, w, hudHeight);
    ctx.fillStyle = 'rgba(200, 160, 0, 0.55)';
    ctx.fillRect(0, hudY, w, 1.5);

    const fLabel = compact ? 9 : 13;
    const fBig = compact ? 20 : 27;
    const yLabel = hudY + (compact ? 13 : 18);
    const yBig = hudY + (compact ? 36 : 46);

    // --- Left: health number + bar, armor beside
    ctx.fillStyle = '#c25050';
    ctx.font = `bold ${fLabel}px monospace`;
    ctx.fillText('UYIR', 12, yLabel);
    ctx.font = `bold ${fBig}px monospace`;
    ctx.fillStyle = player.health > 25 ? '#ff5a4a' : '#ff1500';
    const hpText = `${Math.ceil(player.health)}`;
    ctx.fillText(hpText, 12, yBig);
    const hpW = ctx.measureText(hpText).width;

    const barX = 12 + hpW + 10;
    const barW = compact ? Math.min(72, w * 0.18) : 110;
    ctx.fillStyle = '#330000';
    ctx.fillRect(barX, yBig - (compact ? 13 : 16), barW, compact ? 8 : 11);
    ctx.fillStyle = player.health > 50 ? '#3fbf5a' : player.health > 25 ? '#ccaa00' : '#cc2000';
    ctx.fillRect(barX, yBig - (compact ? 13 : 16), (Math.max(0, player.health) / 100) * barW, compact ? 8 : 11);
    // Armor as a thin blue bar under health
    ctx.fillStyle = '#101c33';
    ctx.fillRect(barX, yBig - (compact ? 2 : 2), barW, compact ? 4 : 5);
    ctx.fillStyle = '#4488ff';
    ctx.fillRect(barX, yBig - (compact ? 2 : 2), (Math.max(0, player.armor) / 100) * barW, compact ? 4 : 5);
    ctx.fillStyle = 'rgba(120,160,255,0.85)';
    ctx.font = `bold ${fLabel}px monospace`;
    ctx.fillText('KAVACHAM', barX, yLabel);

    // --- Right: weapon + ammo, kills beneath
    const weaponNames = {
      trishul: 'TRISHUL', agni: 'AGNI', chakra: 'CHAKRA', brahmastra: 'BRAHMASTRA',
    };
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffaa00';
    ctx.font = `bold ${fLabel}px monospace`;
    ctx.fillText(weaponNames[gameState.currentWeapon] || 'TRISHUL', w - 12, yLabel);
    ctx.font = `bold ${fBig}px monospace`;
    const ammo = gameState.ammo[gameState.currentWeapon];
    const ammoText = ammo === Infinity ? '∞' : `${Math.floor(ammo)}`;
    ctx.fillText(ammoText, w - 12, yBig);
    const ammoW = ctx.measureText(ammoText).width;
    ctx.fillStyle = '#999';
    ctx.font = `${fLabel}px monospace`;
    ctx.fillText(`KOLAI ${gameState.kills}/${gameState.totalEnemies}`, w - 22 - ammoW, yBig);
    ctx.textAlign = 'left';

    // --- Center: key gems + level name
    const keyDefs = [
      ['red', '#ff2a55'], ['blue', '#3d8bff'], ['gold', '#ffcc22'],
    ];
    let kx = w / 2 - 24;
    for (const [key, color] of keyDefs) {
      if (gameState.keys[key]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(kx, yLabel - 9);
        ctx.lineTo(kx + 6, yLabel - 3);
        ctx.lineTo(kx, yLabel + 3);
        ctx.lineTo(kx - 6, yLabel - 3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(150,150,150,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(kx - 4, yLabel - 8, 8, 8);
      }
      kx += 24;
    }

    ctx.fillStyle = '#c8a000';
    ctx.font = `bold ${compact ? 10 : 12}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`NILAI ${gameState.level} · ${gameState.levelName}`, w / 2, hudY + hudHeight - 7);
    ctx.textAlign = 'left';

    // Compass arrow pointing to the level exit
    if (gameState.exit) {
      const ex = (gameState.exit.x + 0.5) * TILE_SIZE;
      const ey = (gameState.exit.y + 0.5) * TILE_SIZE;
      const dx = ex - player.x;
      const dy = ey - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let rel = Math.atan2(dy, dx) - player.angle;
      while (rel > Math.PI) rel -= 2 * Math.PI;
      while (rel < -Math.PI) rel += 2 * Math.PI;

      const cx = w / 2;
      const cy = 60;
      const r = 22;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c8a000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(200, 160, 0, 0.7)';
      ctx.fillRect(cx - 1, cy - r - 2, 2, 4);

      const aligned = Math.abs(rel) < 0.22;
      const a = -Math.PI / 2 + rel;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = aligned ? '#44ff77' : '#ffcc00';
      ctx.beginPath();
      ctx.moveTo(r - 4, 0);
      ctx.lineTo(-r + 10, -8);
      ctx.lineTo(-r + 14, 0);
      ctx.lineTo(-r + 10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#c8a000';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist / TILE_SIZE)}`, cx, cy + r + 14);
      ctx.fillStyle = 'rgba(200,160,0,0.6)';
      ctx.font = '9px monospace';
      ctx.fillText('VAZHI', cx, cy + r + 25);
      ctx.textAlign = 'left';
    }
  }

  renderMinimap(ctx, player, map, sprites, gameState, w, h) {
    if (gameState.mapExpanded) {
      this.renderFullMap(ctx, player, map, sprites, gameState, w, h);
      return;
    }

    // Compact player-centered radar pinned to a corner; the full map is on M.
    const size = Math.round(Math.min(150, Math.max(92, Math.min(w, h) * 0.22)));
    const mx = 12;
    const my = this.touch ? 82 : 12; // below the MAP button on phones
    const cx = mx + size / 2;
    const cy = my + size / 2;
    const r = size / 2;
    const viewTiles = 8.5;          // world radius shown, in tiles
    const ts = r / viewTiles;       // px per tile
    const ptx = player.x / TILE_SIZE;
    const pty = player.y / TILE_SIZE;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4, 3, 2, 0.78)';
    ctx.fill();
    ctx.clip();

    const x0 = Math.max(0, Math.floor(ptx - viewTiles) - 1);
    const x1 = Math.min(map.width - 1, Math.ceil(ptx + viewTiles) + 1);
    const y0 = Math.max(0, Math.floor(pty - viewTiles) - 1);
    const y1 = Math.min(map.height - 1, Math.ceil(pty + viewTiles) + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const tile = map.getTile(x, y);
        if (tile <= 0) continue;
        ctx.fillStyle = MAP_COLORS[tile] || '#888';
        ctx.fillRect(cx + (x - ptx) * ts, cy + (y - pty) * ts, ts + 0.5, ts + 0.5);
      }
    }

    if (gameState.exit) {
      const ex = cx + (gameState.exit.x + 0.5 - ptx) * ts;
      const ey = cy + (gameState.exit.y + 0.5 - pty) * ts;
      const pulse = 0.5 + 0.5 * Math.sin((gameState.time || 0) * 5);
      ctx.strokeStyle = `rgba(255,240,120,${0.6 + 0.4 * pulse})`;
      ctx.lineWidth = 2;
      const er = ts * 0.8;
      ctx.beginPath();
      ctx.moveTo(ex - er, ey - er); ctx.lineTo(ex + er, ey + er);
      ctx.moveTo(ex + er, ey - er); ctx.lineTo(ex - er, ey + er);
      ctx.stroke();
    }

    for (const s of sprites) {
      if (!s.active || !['asura', 'rakshasa', 'naga'].includes(s.type)) continue;
      const dx = s.x / TILE_SIZE - ptx;
      const dy = s.y / TILE_SIZE - pty;
      if (dx * dx + dy * dy > viewTiles * viewTiles) continue;
      ctx.fillStyle = s.boss ? '#ffcc00' : '#ff2a2a';
      ctx.beginPath();
      ctx.arc(cx + dx * ts, cy + dy * ts, s.boss ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player arrow at the center (map stays north-up; arrow shows facing)
    ctx.translate(cx, cy);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#33ff77';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4.5);
    ctx.lineTo(-2.5, 0);
    ctx.lineTo(-5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(200, 160, 0, 0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  renderFullMap(ctx, player, map, sprites, gameState, w, h) {
    const scale = Math.min(
      (w * 0.85) / (map.width * TILE_SIZE),
      (h * 0.78) / (map.height * TILE_SIZE),
    );
    const size = TILE_SIZE * scale;
    const mapW = map.width * size;
    const mapH = map.height * size;
    const offsetX = Math.floor((w - mapW) / 2);
    const offsetY = Math.floor((h - mapH) / 2);

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(4,3,2,0.92)';
    ctx.fillRect(offsetX - 3, offsetY - 3, mapW + 6, mapH + 6);
    ctx.strokeStyle = '#c8a000';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX - 3, offsetY - 3, mapW + 6, mapH + 6);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.getTile(x, y);
        if (tile <= 0) continue;
        ctx.fillStyle = MAP_COLORS[tile] || '#888';
        ctx.fillRect(offsetX + x * size, offsetY + y * size, size + 0.5, size + 0.5);
      }
    }

    if (gameState.exit) {
      const ex = offsetX + (gameState.exit.x + 0.5) * size;
      const ey = offsetY + (gameState.exit.y + 0.5) * size;
      const pulse = 0.5 + 0.5 * Math.sin((gameState.time || 0) * 5);
      const rr = size * (1.0 + pulse * 0.5);
      const halo = ctx.createRadialGradient(ex, ey, 0, ex, ey, rr * 2.5);
      halo.addColorStop(0, `rgba(255, 230, 60, ${0.6 + 0.3 * pulse})`);
      halo.addColorStop(1, 'rgba(255, 230, 60, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(ex - rr * 2.5, ey - rr * 2.5, rr * 5, rr * 5);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ex - rr, ey - rr); ctx.lineTo(ex + rr, ey + rr);
      ctx.moveTo(ex + rr, ey - rr); ctx.lineTo(ex - rr, ey + rr);
      ctx.stroke();
    }

    for (const s of sprites) {
      if (!s.active || !['asura', 'rakshasa', 'naga'].includes(s.type)) continue;
      ctx.fillStyle = s.boss ? '#ffcc00' : '#ff2a2a';
      const er = s.boss ? 4 : 2.5;
      ctx.beginPath();
      ctx.arc(offsetX + (s.x / TILE_SIZE) * size, offsetY + (s.y / TILE_SIZE) * size, er, 0, Math.PI * 2);
      ctx.fill();
    }

    const px = offsetX + (player.x / TILE_SIZE) * size;
    const py = offsetY + (player.y / TILE_SIZE) * size;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#33ff77';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -5.5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-6, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#c8a000';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.touch ? 'PADAM (MAP button to close)' : 'PADAM (M to close)', w / 2, Math.max(20, offsetY - 10));
    ctx.textAlign = 'left';
    ctx.restore();
  }
}
