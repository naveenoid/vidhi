// Vidhi - 2D HUD overlay
// Drawn on a transparent canvas stacked above the WebGL view: weapon
// sprite, status bar, minimap, crosshair, vignette and damage feedback.

import { TILE_SIZE } from './constants.js';

const MINIMAP_SCALE = 0.18;
const MINIMAP_SCALE_EXPANDED = 0.55;

export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hitMarkerT = 0;
  }

  showHitMarker() {
    this.hitMarkerT = 0.12;
  }

  render(player, map, sprites, gameState, dt) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    this.renderWeapon(ctx, player, gameState, w, h);
    this.renderVignette(ctx, gameState, w, h);
    this.renderCrosshair(ctx, gameState, w, h, dt);
    this.renderHUD(ctx, player, gameState, w, h);
    this.renderMinimap(ctx, player, map, sprites, gameState, w, h);
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
    const bobX = Math.sin(gameState.walkCycle * 2) * 8;
    const bobY = Math.abs(Math.cos(gameState.walkCycle * 2)) * 5;
    const fireOffset = gameState.fireAnim > 0 ? -20 * gameState.fireAnim : 0;

    const weaponX = w / 2 - 60 + bobX;
    const weaponY = h - 180 + bobY + fireOffset;

    ctx.save();
    switch (weapon) {
      case 'trishul': this.drawTrishul(ctx, weaponX, weaponY, gameState); break;
      case 'agni': this.drawAgni(ctx, weaponX, weaponY, gameState); break;
      case 'chakra': this.drawChakra(ctx, weaponX, weaponY, gameState); break;
      case 'brahmastra': this.drawBrahmastra(ctx, weaponX, weaponY, gameState); break;
    }
    ctx.restore();

    // Muzzle flash
    if (gameState.fireAnim > 0.5) {
      ctx.save();
      ctx.globalAlpha = gameState.fireAnim - 0.5;
      const flashColors = {
        trishul: '#88ccff', agni: '#ff6600', chakra: '#ffdd00', brahmastra: '#ff00ff',
      };
      const g = ctx.createRadialGradient(w / 2, h - 200 + fireOffset, 0, w / 2, h - 200 + fireOffset, 46 * gameState.fireAnim);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.4, flashColors[weapon] || '#ffaa00');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(w / 2, h - 200 + fireOffset, 46 * gameState.fireAnim, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawTrishul(ctx, x, y, gs) {
    const cx = x + 58;
    const shaftGrad = ctx.createLinearGradient(cx - 5, y + 50, cx + 5, y + 50);
    shaftGrad.addColorStop(0, '#665544');
    shaftGrad.addColorStop(0.3, '#998877');
    shaftGrad.addColorStop(0.5, '#aa9988');
    shaftGrad.addColorStop(0.7, '#998877');
    shaftGrad.addColorStop(1, '#554433');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(cx - 4, y + 35, 8, 145);

    for (let i = 0; i < 4; i++) {
      const bandY = y + 55 + i * 28;
      ctx.fillStyle = '#c0a030';
      ctx.fillRect(cx - 5, bandY, 10, 3);
      ctx.fillStyle = '#e8c840';
      ctx.fillRect(cx - 4, bandY + 1, 8, 1);
    }

    ctx.fillStyle = '#b0c0d8';
    ctx.beginPath();
    ctx.moveTo(cx - 3, y + 35);
    ctx.lineTo(cx + 3, y + 35);
    ctx.lineTo(cx + 4, y + 5);
    ctx.lineTo(cx, y - 20);
    ctx.lineTo(cx - 4, y + 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d0e0f0';
    ctx.beginPath();
    ctx.moveTo(cx - 1, y + 30);
    ctx.lineTo(cx + 1, y + 30);
    ctx.lineTo(cx + 1, y + 5);
    ctx.lineTo(cx, y - 15);
    ctx.lineTo(cx - 1, y + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#a0b0c8';
    ctx.beginPath();
    ctx.moveTo(cx - 8, y + 38);
    ctx.lineTo(cx - 5, y + 38);
    ctx.lineTo(cx - 14, y + 8);
    ctx.lineTo(cx - 20, y - 8);
    ctx.lineTo(cx - 22, y - 5);
    ctx.lineTo(cx - 16, y + 10);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(cx + 5, y + 38);
    ctx.lineTo(cx + 8, y + 38);
    ctx.lineTo(cx + 16, y + 10);
    ctx.lineTo(cx + 22, y - 5);
    ctx.lineTo(cx + 20, y - 8);
    ctx.lineTo(cx + 14, y + 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(150,200,255,0.6)';
    ctx.beginPath();
    ctx.arc(cx, y - 18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - 21, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 21, y - 6, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#c0a030';
    ctx.fillRect(cx - 18, y + 33, 36, 6);
    ctx.fillStyle = '#e8c840';
    ctx.fillRect(cx - 16, y + 35, 32, 2);

    ctx.fillStyle = '#8B6914';
    ctx.fillRect(cx - 16, y + 145, 14, 30);
    ctx.fillStyle = '#9B7924';
    ctx.fillRect(cx - 14, y + 148, 10, 24);
    ctx.fillStyle = '#7B5904';
    for (let f = 0; f < 4; f++) {
      ctx.fillRect(cx - 6, y + 148 + f * 6, 10, 3);
    }
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(cx + 2, y + 145, 8, 20);
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
    const hudHeight = 60;
    const hudY = h - hudHeight;

    ctx.fillStyle = 'rgba(12, 6, 4, 0.82)';
    ctx.fillRect(0, hudY, w, hudHeight);

    ctx.strokeStyle = '#7a6200';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, hudY + 1, w - 2, hudHeight - 2);

    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('UYIR', 20, hudY + 20);
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = player.health > 25 ? '#ff4444' : '#ff0000';
    ctx.fillText(`${Math.ceil(player.health)}%`, 20, hudY + 48);

    ctx.fillStyle = '#330000';
    ctx.fillRect(110, hudY + 10, 120, 16);
    ctx.fillStyle = player.health > 50 ? '#00cc44' : player.health > 25 ? '#ccaa00' : '#cc0000';
    ctx.fillRect(110, hudY + 10, (player.health / 100) * 120, 16);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(110, hudY + 10, 120, 16);

    ctx.fillStyle = '#4488ff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('KAVACHAM', 110, hudY + 48);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${Math.ceil(player.armor)}%`, 200, hudY + 48);

    const weaponNames = {
      trishul: 'TRISHUL', agni: 'AGNI', chakra: 'CHAKRA', brahmastra: 'BRAHMASTRA',
    };
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(weaponNames[gameState.currentWeapon] || 'TRISHUL', w - 200, hudY + 20);
    ctx.font = 'bold 28px monospace';
    const ammo = gameState.ammo[gameState.currentWeapon];
    ctx.fillText(ammo === Infinity ? 'INF' : `${Math.floor(ammo)}`, w - 200, hudY + 48);

    let keyX = w / 2 - 40;
    ctx.font = 'bold 12px monospace';
    if (gameState.keys.red) {
      ctx.fillStyle = '#ff0044';
      ctx.fillText('SEVI', keyX, hudY + 20);
    }
    if (gameState.keys.blue) {
      ctx.fillStyle = '#0088ff';
      ctx.fillText('NEELAM', keyX, hudY + 40);
    }
    if (gameState.keys.gold) {
      ctx.fillStyle = '#ffcc00';
      ctx.fillText('THANGAM', keyX + 55, hudY + 20);
    }

    ctx.fillStyle = '#c8a000';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`NILAI ${gameState.level} - ${gameState.levelName}`, w / 2, hudY + 55);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(`KOLAI: ${gameState.kills}/${gameState.totalEnemies}`, w - 120, hudY + 48);

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
    const expanded = !!gameState.mapExpanded;
    let scale = expanded ? MINIMAP_SCALE_EXPANDED : MINIMAP_SCALE;

    if (expanded) {
      const maxByW = (w * 0.85) / (map.width * TILE_SIZE);
      const maxByH = (h * 0.85) / (map.height * TILE_SIZE);
      scale = Math.min(scale, maxByW, maxByH);
    }

    const size = TILE_SIZE * scale;
    const mapW = map.width * size;
    const mapH = map.height * size;
    const offsetX = expanded ? Math.floor((w - mapW) / 2) : 10;
    const offsetY = expanded ? Math.floor((h - mapH) / 2) : 10;

    ctx.save();

    if (expanded) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.globalAlpha = expanded ? 0.96 : 0.72;

    ctx.fillStyle = '#000';
    ctx.fillRect(offsetX - 2, offsetY - 2, mapW + 4, mapH + 4);

    ctx.strokeStyle = '#c8a000';
    ctx.lineWidth = expanded ? 2 : 1;
    ctx.strokeRect(offsetX - 2, offsetY - 2, mapW + 4, mapH + 4);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.getTile(x, y);
        if (tile > 0) {
          const colors = ['', '#8B7355', '#AA4444', '#555566', '#C8A000',
            '#664422', '#aa2244', '#2266aa', '#aa8822', '#8B7355'];
          ctx.fillStyle = colors[tile] || '#888';
          ctx.fillRect(offsetX + x * size, offsetY + y * size, size, size);
        }
      }
    }

    if (gameState.exit && gameState.exitOpen !== false) {
      const ex = offsetX + (gameState.exit.x + 0.5) * size;
      const ey = offsetY + (gameState.exit.y + 0.5) * size;
      const t = gameState.time || 0;
      const pulse = 0.5 + 0.5 * Math.sin(t * 5);
      const r = size * (1.0 + pulse * 0.5);
      const halo = ctx.createRadialGradient(ex, ey, 0, ex, ey, r * 2.5);
      halo.addColorStop(0, `rgba(255, 230, 60, ${0.6 + 0.3 * pulse})`);
      halo.addColorStop(1, 'rgba(255, 230, 60, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(ex - r * 2.5, ey - r * 2.5, r * 5, r * 5);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = expanded ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(ex - r, ey - r); ctx.lineTo(ex + r, ey + r);
      ctx.moveTo(ex + r, ey - r); ctx.lineTo(ex - r, ey + r);
      ctx.stroke();
    }

    for (const s of sprites) {
      if (!s.active || !['asura', 'rakshasa', 'naga'].includes(s.type)) continue;
      ctx.fillStyle = s.boss ? '#ffcc00' : '#ff0000';
      const r = (s.boss ? 4 : 2) * (expanded ? 1.4 : 1);
      ctx.fillRect(
        offsetX + (s.x / TILE_SIZE) * size - r / 2,
        offsetY + (s.y / TILE_SIZE) * size - r / 2,
        r, r,
      );
    }

    ctx.fillStyle = '#00ff00';
    const px = offsetX + (player.x / TILE_SIZE) * size;
    const py = offsetY + (player.y / TILE_SIZE) * size;
    const pr = expanded ? 4 : 2;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = expanded ? 2 : 1;
    const dirLen = expanded ? 18 : 10;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(player.angle) * dirLen, py + Math.sin(player.angle) * dirLen);
    ctx.stroke();

    if (expanded) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c8a000';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PADAM (M to close)', w / 2, Math.max(20, offsetY - 10));
      ctx.textAlign = 'left';
    }

    ctx.restore();
  }
}
