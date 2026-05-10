// Vidhi - Tamil-themed Doom Clone
// Raycasting Engine

const TILE_SIZE = 64;
const FOV = Math.PI / 3; // 60 degrees
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 20;
const MINIMAP_SCALE = 0.22;
const MINIMAP_SCALE_EXPANDED = 0.55;

class RaycastEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.numRays = this.width;
    this.textures = {};
    this.spriteSheet = null;
  }

  castRay(player, angle, map) {
    let sin = Math.sin(angle);
    let cos = Math.cos(angle);
    if (sin === 0) sin = 0.0001;
    if (cos === 0) cos = 0.0001;

    // Horizontal intersections
    let hDist = Infinity, hTex = 0, hTexX = 0;
    {
      const up = sin < 0;
      const firstY = up ? Math.floor(player.y / TILE_SIZE) * TILE_SIZE - 0.001
                        : Math.floor(player.y / TILE_SIZE) * TILE_SIZE + TILE_SIZE;
      const firstX = player.x + (firstY - player.y) / Math.tan(angle);
      const stepY = up ? -TILE_SIZE : TILE_SIZE;
      const stepX = stepY / Math.tan(angle);

      let rx = firstX, ry = firstY;
      for (let i = 0; i < MAX_DEPTH * TILE_SIZE / Math.abs(stepY); i++) {
        const mapX = Math.floor(rx / TILE_SIZE);
        const mapY = Math.floor(ry / TILE_SIZE);
        if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) break;
        const tile = map.getTile(mapX, mapY);
        if (tile > 0) {
          hDist = Math.sqrt((rx - player.x) ** 2 + (ry - player.y) ** 2);
          hTex = tile;
          hTexX = (rx % TILE_SIZE) / TILE_SIZE;
          break;
        }
        rx += stepX;
        ry += stepY;
      }
    }

    // Vertical intersections
    let vDist = Infinity, vTex = 0, vTexX = 0;
    {
      const left = cos < 0;
      const firstX = left ? Math.floor(player.x / TILE_SIZE) * TILE_SIZE - 0.001
                          : Math.floor(player.x / TILE_SIZE) * TILE_SIZE + TILE_SIZE;
      const firstY = player.y + (firstX - player.x) * Math.tan(angle);
      const stepX = left ? -TILE_SIZE : TILE_SIZE;
      const stepY = stepX * Math.tan(angle);

      let rx = firstX, ry = firstY;
      for (let i = 0; i < MAX_DEPTH * TILE_SIZE / Math.abs(stepX); i++) {
        const mapX = Math.floor(rx / TILE_SIZE);
        const mapY = Math.floor(ry / TILE_SIZE);
        if (mapX < 0 || mapX >= map.width || mapY < 0 || mapY >= map.height) break;
        const tile = map.getTile(mapX, mapY);
        if (tile > 0) {
          vDist = Math.sqrt((rx - player.x) ** 2 + (ry - player.y) ** 2);
          vTex = tile;
          vTexX = (ry % TILE_SIZE) / TILE_SIZE;
          break;
        }
        rx += stepX;
        ry += stepY;
      }
    }

    const isHorizontal = hDist < vDist;
    return {
      distance: isHorizontal ? hDist : vDist,
      texture: isHorizontal ? hTex : vTex,
      texX: isHorizontal ? hTexX : vTexX,
      isHorizontal,
      angle
    };
  }

  render(player, map, sprites, gameState) {
    const ctx = this.ctx;
    // Read current canvas size each frame so resize works
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.numRays = this.width;
    const w = this.width;
    const h = this.height;

    // Sky gradient (dusk/temple atmosphere)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h / 2);
    skyGrad.addColorStop(0, '#1a0a2e');
    skyGrad.addColorStop(0.5, '#3d1a6e');
    skyGrad.addColorStop(1, '#c2185b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h / 2);

    // Floor gradient
    const floorGrad = ctx.createLinearGradient(0, h / 2, 0, h);
    floorGrad.addColorStop(0, '#2d1b0e');
    floorGrad.addColorStop(1, '#1a0f06');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, h / 2, w, h / 2);

    // --- Screen shake offset (applied to the world layer only) ---
    const shakeMag = (gameState && gameState.screenShakeMag) || 0;
    const shakeX = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag * 2 : 0;
    const shakeY = shakeMag > 0 ? (Math.random() - 0.5) * shakeMag * 2 : 0;
    ctx.save();
    if (shakeMag > 0) ctx.translate(shakeX, shakeY);

    // Raycasting
    const zBuffer = [];
    const rayStep = FOV / this.numRays;

    for (let i = 0; i < this.numRays; i++) {
      const rayAngle = player.angle - HALF_FOV + i * rayStep;
      const ray = this.castRay(player, rayAngle, map);

      // Fix fisheye
      const correctedDist = ray.distance * Math.cos(rayAngle - player.angle);
      zBuffer[i] = correctedDist;

      const wallHeight = (TILE_SIZE * h) / correctedDist;
      const wallTop = (h - wallHeight) / 2;

      // Wall colors based on texture type
      const shade = Math.min(1, 3 / (correctedDist / TILE_SIZE));
      const colors = this.getWallColor(ray.texture, ray.isHorizontal, shade, ray.texX);

      ctx.fillStyle = colors.main;
      ctx.fillRect(i, wallTop, 1, wallHeight);

      // Add texture detail lines
      if (wallHeight > 10) {
        ctx.fillStyle = colors.detail;
        // Brick/stone pattern
        const brickRows = Math.floor(wallHeight / 16);
        for (let b = 0; b < brickRows; b++) {
          const by = wallTop + b * (wallHeight / brickRows);
          ctx.fillRect(i, by, 1, 1);
        }
      }
    }

    // Exit portal (drawn after walls, occluded by zBuffer)
    if (gameState && gameState.exit) {
      this.renderExitPortal(ctx, player, gameState, zBuffer, w, h);
    }

    // Render sprites
    this.renderSprites(ctx, player, sprites, zBuffer, w, h);

    // Blood / FX particles in world space
    if (gameState && gameState.particles && gameState.particles.length) {
      this.renderParticles(ctx, player, gameState.particles, zBuffer, w, h);
    }

    // Wind-up "telegraph" indicators above enemies preparing to attack
    this.renderWindupIndicators(ctx, player, sprites, zBuffer, w, h, gameState);

    // Render weapon (also affected by shake)
    this.renderWeapon(ctx, player, gameState, w, h);

    ctx.restore();

    // HUD (no shake)
    this.renderHUD(ctx, player, gameState, w, h);

    // Minimap (no shake)
    this.renderMinimap(ctx, player, map, sprites, gameState, w, h);
  }

  getWallColor(texture, isHorizontal, shade, texX) {
    const darkFactor = isHorizontal ? 0.7 : 1;
    const s = shade * darkFactor;
    // Add subtle texture variation based on texX position
    const tv = Math.sin(texX * 37.7) * 0.08; // pseudo-random variation per column

    switch (texture) {
      case 1: // Temple stone walls - warm sandstone with mortar lines
        return {
          main: `rgb(${Math.floor((175 + tv * 40) * s)}, ${Math.floor((138 + tv * 30) * s)}, ${Math.floor((95 + tv * 20) * s)})`,
          detail: `rgb(${Math.floor(110 * s)}, ${Math.floor(85 * s)}, ${Math.floor(55 * s)})`,
          accent: `rgb(${Math.floor(200 * s)}, ${Math.floor(160 * s)}, ${Math.floor(110 * s)})`
        };
      case 2: // Red/terracotta walls (Dravidian temple) - rich red clay with carved details
        return {
          main: `rgb(${Math.floor((195 + tv * 30) * s)}, ${Math.floor((75 + tv * 20) * s)}, ${Math.floor((55 + tv * 15) * s)})`,
          detail: `rgb(${Math.floor(130 * s)}, ${Math.floor(45 * s)}, ${Math.floor(30 * s)})`,
          accent: `rgb(${Math.floor(220 * s)}, ${Math.floor(100 * s)}, ${Math.floor(70 * s)})`
        };
      case 3: // Dark stone / dungeon - cold, mossy stone blocks
        return {
          main: `rgb(${Math.floor((85 + tv * 20) * s)}, ${Math.floor((88 + tv * 25) * s)}, ${Math.floor((95 + tv * 15) * s)})`,
          detail: `rgb(${Math.floor(50 * s)}, ${Math.floor(55 * s)}, ${Math.floor(60 * s)})`,
          accent: `rgb(${Math.floor(70 * s)}, ${Math.floor(90 * s)}, ${Math.floor(75 * s)})`
        };
      case 4: // Gold/ornate walls - polished gold with engraved patterns
        return {
          main: `rgb(${Math.floor((215 + tv * 25) * s)}, ${Math.floor((178 + tv * 20) * s)}, ${Math.floor((48 + tv * 15) * s)})`,
          detail: `rgb(${Math.floor(160 * s)}, ${Math.floor(120 * s)}, ${Math.floor(20 * s)})`,
          accent: `rgb(${Math.floor(245 * s)}, ${Math.floor(210 * s)}, ${Math.floor(80 * s)})`
        };
      case 5: // Door - heavy carved wood with metal bands
        return {
          main: `rgb(${Math.floor((115 + tv * 20) * s)}, ${Math.floor((58 + tv * 15) * s)}, ${Math.floor((28 + tv * 10) * s)})`,
          detail: `rgb(${Math.floor(70 * s)}, ${Math.floor(35 * s)}, ${Math.floor(15 * s)})`,
          accent: `rgb(${Math.floor(160 * s)}, ${Math.floor(130 * s)}, ${Math.floor(40 * s)})`
        };
      default:
        return {
          main: `rgb(${Math.floor(150 * s)}, ${Math.floor(150 * s)}, ${Math.floor(150 * s)})`,
          detail: `rgb(${Math.floor(120 * s)}, ${Math.floor(120 * s)}, ${Math.floor(120 * s)})`,
          accent: `rgb(${Math.floor(170 * s)}, ${Math.floor(170 * s)}, ${Math.floor(170 * s)})`
        };
    }
  }

  renderSprites(ctx, player, sprites, zBuffer, w, h) {
    // Sort sprites by distance (far to near)
    const sortedSprites = sprites
      .filter(s => s.active)
      .map(s => ({
        ...s,
        dist: Math.sqrt((s.x - player.x) ** 2 + (s.y - player.y) ** 2)
      }))
      .sort((a, b) => b.dist - a.dist);

    for (const sprite of sortedSprites) {
      const dx = sprite.x - player.x;
      const dy = sprite.y - player.y;
      const angle = Math.atan2(dy, dx) - player.angle;

      // Normalize angle
      let normalizedAngle = angle;
      while (normalizedAngle > Math.PI) normalizedAngle -= 2 * Math.PI;
      while (normalizedAngle < -Math.PI) normalizedAngle += 2 * Math.PI;

      if (Math.abs(normalizedAngle) > HALF_FOV + 0.2) continue;

      const screenX = (0.5 + normalizedAngle / FOV) * w;
      const spriteHeight = (TILE_SIZE * h) / sprite.dist;
      const spriteWidth = spriteHeight * (sprite.widthRatio || 1);
      const spriteTop = (h - spriteHeight) / 2 + (sprite.verticalOffset || 0);

      // Check z-buffer for visibility
      const startX = Math.max(0, Math.floor(screenX - spriteWidth / 2));
      const endX = Math.min(w, Math.floor(screenX + spriteWidth / 2));

      for (let x = startX; x < endX; x++) {
        if (sprite.dist < zBuffer[x]) {
          const shade = Math.min(1, 3 / (sprite.dist / TILE_SIZE));
          this.drawSpriteColumn(ctx, sprite, x, spriteTop, spriteHeight, spriteWidth, screenX, shade);
        }
      }
    }
  }

  renderExitPortal(ctx, player, gameState, zBuffer, w, h) {
    const exit = gameState.exit;
    const ex = (exit.x + 0.5) * TILE_SIZE;
    const ey = (exit.y + 0.5) * TILE_SIZE;
    const dx = ex - player.x;
    const dy = ey - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4) return;

    let angle = Math.atan2(dy, dx) - player.angle;
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    if (Math.abs(angle) > HALF_FOV + 0.3) return;

    const screenX = (0.5 + angle / FOV) * w;
    const portalH = (TILE_SIZE * h) / dist;
    const portalW = portalH * 0.55;
    const top = (h - portalH) / 2;
    const startX = Math.max(0, Math.floor(screenX - portalW / 2));
    const endX = Math.min(w, Math.ceil(screenX + portalW / 2));

    const t = gameState.time || 0;
    const pulse = 0.55 + 0.35 * Math.sin(t * 4);

    const grad = ctx.createLinearGradient(0, top, 0, top + portalH);
    grad.addColorStop(0,    `rgba(255, 255, 200, ${0.05 * pulse})`);
    grad.addColorStop(0.4,  `rgba(255, 220, 60, ${0.55 * pulse})`);
    grad.addColorStop(0.55, `rgba(255, 200, 30, ${0.85 * pulse})`);
    grad.addColorStop(0.7,  `rgba(255, 170, 20, ${0.55 * pulse})`);
    grad.addColorStop(1,    `rgba(255, 130, 0, ${0.15 * pulse})`);

    for (let x = startX; x < endX; x++) {
      if (zBuffer[x] !== undefined && dist >= zBuffer[x]) continue;
      const relX = (x - (screenX - portalW / 2)) / portalW;
      const edgeFade = Math.max(0, 1 - Math.abs(relX - 0.5) * 2);
      if (edgeFade <= 0) continue;
      const shimmer = 0.85 + 0.15 * Math.sin(relX * 14 + t * 7);
      ctx.globalAlpha = edgeFade * shimmer;
      ctx.fillStyle = grad;
      ctx.fillRect(x, top, 1, portalH);
    }
    ctx.globalAlpha = 1;

    // Bright vertical core spire
    const coreA = 0.35 + 0.35 * pulse;
    const coreW = Math.max(1, portalW * 0.05);
    if (zBuffer[Math.floor(screenX)] === undefined || dist < zBuffer[Math.floor(screenX)]) {
      ctx.fillStyle = `rgba(255, 255, 220, ${coreA})`;
      ctx.fillRect(screenX - coreW / 2, top, coreW, portalH);
    }
  }

  renderParticles(ctx, player, particles, zBuffer, w, h) {
    for (const p of particles) {
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;
      let angle = Math.atan2(dy, dx) - player.angle;
      while (angle > Math.PI) angle -= 2 * Math.PI;
      while (angle < -Math.PI) angle += 2 * Math.PI;
      if (Math.abs(angle) > HALF_FOV + 0.1) continue;

      const screenX = (0.5 + angle / FOV) * w;
      const sxi = Math.floor(screenX);
      if (sxi < 0 || sxi >= w) continue;
      if (zBuffer[sxi] !== undefined && dist >= zBuffer[sxi]) continue;

      const projH = (TILE_SIZE * h) / dist;
      const spriteTop = (h - projH) / 2;
      const screenY = spriteTop + projH * (1 - p.z);
      const size = Math.max(1, p.size * (projH / TILE_SIZE) * 0.6);
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color || '#aa0000';
      ctx.fillRect(screenX - size / 2, screenY - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  }

  renderWindupIndicators(ctx, player, sprites, zBuffer, w, h, gameState) {
    for (const sprite of sprites) {
      if (!sprite.active || !sprite.health) continue;
      if (!sprite.windupTimer || sprite.windupTimer <= 0) continue;

      const dx = sprite.x - player.x;
      const dy = sprite.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;
      let angle = Math.atan2(dy, dx) - player.angle;
      while (angle > Math.PI) angle -= 2 * Math.PI;
      while (angle < -Math.PI) angle += 2 * Math.PI;
      if (Math.abs(angle) > HALF_FOV + 0.1) continue;

      const screenX = (0.5 + angle / FOV) * w;
      const sxi = Math.floor(screenX);
      if (sxi < 0 || sxi >= w) continue;
      if (zBuffer[sxi] !== undefined && dist >= zBuffer[sxi]) continue;

      const projH = (TILE_SIZE * h) / dist * (sprite.boss ? 1.7 : 1);
      const spriteTop = (h - projH) / 2 + (sprite.verticalOffset || 0);

      const charge = 1 - sprite.windupTimer / (sprite.windupMax || 0.3);
      const r = Math.max(4, projH * 0.06);
      const cy = spriteTop - r * 1.4;

      const glow = ctx.createRadialGradient(screenX, cy, 0, screenX, cy, r * 3);
      glow.addColorStop(0, `rgba(255, 60, 30, ${0.7 * (0.5 + 0.5 * charge)})`);
      glow.addColorStop(1, 'rgba(255, 60, 30, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(screenX, cy, r * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(255, 200, 80, ${0.6 + 0.4 * charge})`;
      ctx.beginPath();
      ctx.arc(screenX, cy, r * (0.6 + 0.4 * charge), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSpriteColumn(ctx, sprite, x, top, height, width, centerX, shade) {
    const relX = (x - (centerX - width / 2)) / width;
    if (relX < 0 || relX > 1) return;

    switch (sprite.type) {
      case 'asura':
        this.drawAsuraColumn(ctx, x, top, height, relX, shade, sprite);
        break;
      case 'rakshasa':
        this.drawRakshasaColumn(ctx, x, top, height, relX, shade, sprite);
        break;
      case 'naga':
        this.drawNagaColumn(ctx, x, top, height, relX, shade, sprite);
        break;
      case 'health':
        this.drawPickupColumn(ctx, x, top, height, relX, shade, '#00ff88', 'lotus');
        break;
      case 'ammo':
        this.drawPickupColumn(ctx, x, top, height, relX, shade, '#ffaa00', 'chakra');
        break;
      case 'key':
        this.drawPickupColumn(ctx, x, top, height, relX, shade, '#ff0066', 'key');
        break;
      case 'pillar':
        this.drawPillarColumn(ctx, x, top, height, relX, shade);
        break;
    }
  }

  drawAsuraColumn(ctx, x, top, height, relX, shade, sprite) {
    // Asura demon - muscular red demon with horns, fangs, and glowing eyes
    const hurtFlash = sprite.hurt ? 0.6 : 0;
    const s = shade;

    // Legs (two separate legs with gap)
    if (relX > 0.25 && relX < 0.42) {
      // Left leg
      const legTop = top + height * 0.65;
      const r = Math.floor((140 + hurtFlash * 115) * s);
      const g = Math.floor(30 * s);
      const b = Math.floor(25 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, legTop, 1, height * 0.35);
      // Knee highlight
      if (relX > 0.30 && relX < 0.37) {
        ctx.fillStyle = `rgba(255,100,60,${0.15 * s})`;
        ctx.fillRect(x, legTop + height * 0.12, 1, height * 0.06);
      }
    }
    if (relX > 0.58 && relX < 0.75) {
      // Right leg
      const legTop = top + height * 0.65;
      const r = Math.floor((140 + hurtFlash * 115) * s);
      const g = Math.floor(30 * s);
      const b = Math.floor(25 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, legTop, 1, height * 0.35);
    }

    // Torso (muscular, wider at shoulders tapering to waist)
    if (relX > (0.5 - 0.18) && relX < (0.5 + 0.18)) {
      const torsoTop = top + height * 0.22;
      const torsoBot = top + height * 0.65;
      const r = Math.floor((170 + hurtFlash * 85) * s);
      const g = Math.floor(35 * s);
      const b = Math.floor(30 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, torsoTop, 1, torsoBot - torsoTop);

      // Chest muscle highlights
      if (relX > 0.38 && relX < 0.48) {
        ctx.fillStyle = `rgba(220,70,50,${0.25 * s})`;
        ctx.fillRect(x, torsoTop + height * 0.05, 1, height * 0.1);
      }
      if (relX > 0.52 && relX < 0.62) {
        ctx.fillStyle = `rgba(220,70,50,${0.25 * s})`;
        ctx.fillRect(x, torsoTop + height * 0.05, 1, height * 0.1);
      }
      // Belt/waist band
      ctx.fillStyle = `rgb(${Math.floor(80*s)},${Math.floor(50*s)},${Math.floor(20*s)})`;
      ctx.fillRect(x, top + height * 0.6, 1, height * 0.04);
    }

    // Arms (extending out from shoulders)
    if ((relX > 0.12 && relX < 0.28) || (relX > 0.72 && relX < 0.88)) {
      const armTop = top + height * 0.25;
      const armLen = height * 0.35;
      const r = Math.floor((155 + hurtFlash * 100) * s);
      const g = Math.floor(30 * s);
      const b = Math.floor(28 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, armTop, 1, armLen);
      // Clawed hands
      if (relX < 0.18 || relX > 0.82) {
        ctx.fillStyle = `rgb(${Math.floor(100*s)},${Math.floor(20*s)},${Math.floor(15*s)})`;
        ctx.fillRect(x, armTop + armLen, 1, height * 0.06);
      }
    }

    // Shoulders (broad shoulder pads)
    if (relX > 0.18 && relX < 0.82) {
      const shStart = top + height * 0.2;
      const shH = height * 0.06;
      if ((relX > 0.18 && relX < 0.35) || (relX > 0.65 && relX < 0.82)) {
        const r = Math.floor((190 + hurtFlash * 65) * s);
        const g = Math.floor(45 * s);
        const b = Math.floor(35 * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
        ctx.fillRect(x, shStart, 1, shH);
      }
    }

    // Head (rounded, with strong jawline)
    if (relX > 0.32 && relX < 0.68) {
      const headTop = top + height * 0.06;
      const headBot = top + height * 0.22;
      // Widen in middle of head
      const headDist = Math.abs(relX - 0.5) / 0.18;
      if (headDist < 1) {
        const r = Math.floor((200 + hurtFlash * 55) * s);
        const g = Math.floor(55 * s);
        const b = Math.floor(45 * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
        ctx.fillRect(x, headTop, 1, headBot - headTop);
      }
    }

    // Horns (curved upward from head)
    if ((relX > 0.26 && relX < 0.35) || (relX > 0.65 && relX < 0.74)) {
      const hornTop = top;
      const hornBot = top + height * 0.1;
      const r = Math.floor(60 * s);
      const g = Math.floor(50 * s);
      const b = Math.floor(30 * s);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, hornTop, 1, hornBot - hornTop);
      // Horn tip glow
      ctx.fillStyle = `rgba(255,120,40,${0.4 * s})`;
      ctx.fillRect(x, hornTop, 1, height * 0.02);
    }

    // Eyes (glowing orange-yellow, menacing)
    if ((relX > 0.37 && relX < 0.44) || (relX > 0.56 && relX < 0.63)) {
      const eyeY = top + height * 0.1;
      const eyeH = height * 0.04;
      // Eye glow aura
      ctx.fillStyle = `rgba(255,200,0,${0.3 * s})`;
      ctx.fillRect(x, eyeY - height * 0.01, 1, eyeH + height * 0.02);
      // Eye core
      ctx.fillStyle = `rgb(255,${Math.floor(180 * s)},0)`;
      ctx.fillRect(x, eyeY, 1, eyeH);
      // Pupil
      if ((relX > 0.39 && relX < 0.42) || (relX > 0.58 && relX < 0.61)) {
        ctx.fillStyle = `rgb(${Math.floor(200*s)},0,0)`;
        ctx.fillRect(x, eyeY + height * 0.01, 1, eyeH * 0.5);
      }
    }

    // Mouth/fangs
    if (relX > 0.40 && relX < 0.60) {
      const mouthY = top + height * 0.16;
      ctx.fillStyle = `rgb(${Math.floor(40*s)},0,0)`;
      ctx.fillRect(x, mouthY, 1, height * 0.03);
      // Fangs
      if ((relX > 0.42 && relX < 0.45) || (relX > 0.55 && relX < 0.58)) {
        ctx.fillStyle = `rgb(${Math.floor(230*s)},${Math.floor(220*s)},${Math.floor(200*s)})`;
        ctx.fillRect(x, mouthY + height * 0.02, 1, height * 0.025);
      }
    }
  }

  drawRakshasaColumn(ctx, x, top, height, relX, shade, sprite) {
    // Rakshasa - massive hulking purple-black demon with three eyes, heavy armor, and huge horns
    const s = shade;
    const hf = sprite.hurt ? 0.7 : 0;

    // --- Boss treatment (Mahishasura): golden halo, crown, infernal aura ---
    if (sprite.boss) {
      // Golden halo radiating from the head
      if (relX > 0.18 && relX < 0.82) {
        const headDist = Math.abs(relX - 0.5) / 0.32;
        const haloA = Math.max(0, 1 - headDist * headDist);
        if (haloA > 0) {
          ctx.fillStyle = `rgba(255, 200, 30, ${0.55 * haloA * s})`;
          ctx.fillRect(x, top - height * 0.04, 1, height * 0.32);
        }
      }
      // Body-wide infernal red aura (subtle, behind torso)
      if (relX > 0.05 && relX < 0.95) {
        const bodyDist = Math.abs(relX - 0.5) / 0.45;
        const auraA = Math.max(0, 1 - bodyDist) * 0.18;
        ctx.fillStyle = `rgba(255, 60, 20, ${auraA * s})`;
        ctx.fillRect(x, top + height * 0.1, 1, height * 0.85);
      }
      // Gold crown across the top of the head, between the horns
      if (relX > 0.34 && relX < 0.66) {
        const crownY = top - height * 0.01;
        ctx.fillStyle = `rgb(${Math.floor(220*s)},${Math.floor(180*s)},${Math.floor(40*s)})`;
        ctx.fillRect(x, crownY, 1, height * 0.07);
        // Crown spike points (alternating)
        const spikePhase = Math.floor((relX - 0.34) * 18) % 2;
        if (spikePhase === 0) {
          ctx.fillStyle = `rgb(${Math.min(255,Math.floor(255*s))},${Math.floor(220*s)},${Math.floor(80*s)})`;
          ctx.fillRect(x, crownY - height * 0.04, 1, height * 0.05);
        }
        // Center jewel
        if (relX > 0.48 && relX < 0.52) {
          ctx.fillStyle = `rgb(${Math.min(255,Math.floor(255*s))},${Math.floor(60*s)},${Math.floor(60*s)})`;
          ctx.fillRect(x, crownY + height * 0.02, 1, height * 0.04);
        }
      }
    }

    // Legs (thick, trunk-like)
    if ((relX > 0.18 && relX < 0.38) || (relX > 0.62 && relX < 0.82)) {
      const legTop = top + height * 0.62;
      const r = Math.floor((80 + hf * 120) * s);
      const g = Math.floor(40 * s);
      const b = Math.floor(65 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, legTop, 1, height * 0.38);
      // Armored shin guards
      if ((relX > 0.22 && relX < 0.34) || (relX > 0.66 && relX < 0.78)) {
        ctx.fillStyle = `rgb(${Math.floor(50*s)},${Math.floor(45*s)},${Math.floor(55*s)})`;
        ctx.fillRect(x, legTop + height * 0.18, 1, height * 0.15);
        // Metal highlight
        ctx.fillStyle = `rgba(140,130,160,${0.2*s})`;
        ctx.fillRect(x, legTop + height * 0.22, 1, height * 0.03);
      }
    }

    // Massive torso with armor plates
    if (relX > 0.15 && relX < 0.85) {
      const torsoTop = top + height * 0.2;
      const torsoBot = top + height * 0.64;
      // Torso tapers: widest at chest
      const distFromCenter = Math.abs(relX - 0.5);
      const maxW = (relX > 0.15 && relX < 0.85) ? 0.35 : 0;
      if (distFromCenter < maxW) {
        const r = Math.floor((90 + hf * 110) * s);
        const g = Math.floor(45 * s);
        const b = Math.floor(75 * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
        ctx.fillRect(x, torsoTop, 1, torsoBot - torsoTop);
      }
    }

    // Chest armor plate (dark metal)
    if (relX > 0.25 && relX < 0.75) {
      const plateTop = top + height * 0.25;
      ctx.fillStyle = `rgb(${Math.floor(45*s)},${Math.floor(40*s)},${Math.floor(55*s)})`;
      ctx.fillRect(x, plateTop, 1, height * 0.2);
      // Armor rivets/detail
      if (relX > 0.35 && relX < 0.65) {
        ctx.fillStyle = `rgba(180,160,200,${0.15*s})`;
        ctx.fillRect(x, plateTop + height * 0.05, 1, height * 0.02);
        ctx.fillRect(x, plateTop + height * 0.12, 1, height * 0.02);
      }
      // Skull emblem on chest
      if (relX > 0.42 && relX < 0.58) {
        ctx.fillStyle = `rgba(200,180,220,${0.25*s})`;
        ctx.fillRect(x, plateTop + height * 0.07, 1, height * 0.06);
      }
    }

    // Arms (massive, with spiked bracers)
    if ((relX > 0.05 && relX < 0.2) || (relX > 0.8 && relX < 0.95)) {
      const armTop = top + height * 0.22;
      const armLen = height * 0.4;
      const r = Math.floor((85 + hf * 120) * s);
      const g = Math.floor(42 * s);
      const b = Math.floor(70 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, armTop, 1, armLen);
      // Spiked bracers
      ctx.fillStyle = `rgb(${Math.floor(50*s)},${Math.floor(50*s)},${Math.floor(50*s)})`;
      ctx.fillRect(x, armTop + height * 0.15, 1, height * 0.08);
      // Clawed fists
      ctx.fillStyle = `rgb(${Math.floor(60*s)},${Math.floor(30*s)},${Math.floor(45*s)})`;
      ctx.fillRect(x, armTop + armLen, 1, height * 0.08);
      // Claw tips
      if (relX < 0.12 || relX > 0.88) {
        ctx.fillStyle = `rgb(${Math.floor(200*s)},${Math.floor(190*s)},${Math.floor(170*s)})`;
        ctx.fillRect(x, armTop + armLen + height * 0.06, 1, height * 0.04);
      }
    }

    // Head (wide, brutish)
    if (relX > 0.28 && relX < 0.72) {
      const headTop = top + height * 0.08;
      const headBot = top + height * 0.22;
      const r = Math.floor((110 + hf * 90) * s);
      const g = Math.floor(40 * s);
      const b = Math.floor(70 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, headTop, 1, headBot - headTop);
      // Brow ridge (darker strip)
      ctx.fillStyle = `rgb(${Math.floor(70*s)},${Math.floor(25*s)},${Math.floor(50*s)})`;
      ctx.fillRect(x, headTop + height * 0.06, 1, height * 0.02);
    }

    // Huge curved horns
    if ((relX > 0.15 && relX < 0.32) || (relX > 0.68 && relX < 0.85)) {
      const hornBot = top + height * 0.12;
      const hornH = height * 0.12;
      // Outer horn base (dark bone)
      ctx.fillStyle = `rgb(${Math.floor(70*s)},${Math.floor(60*s)},${Math.floor(40*s)})`;
      ctx.fillRect(x, hornBot - hornH, 1, hornH);
      // Horn ridges
      ctx.fillStyle = `rgb(${Math.floor(90*s)},${Math.floor(80*s)},${Math.floor(55*s)})`;
      ctx.fillRect(x, hornBot - hornH + height * 0.03, 1, height * 0.015);
      // Horn tip (sharp, lighter)
      if ((relX > 0.15 && relX < 0.22) || (relX > 0.78 && relX < 0.85)) {
        ctx.fillStyle = `rgb(${Math.floor(120*s)},${Math.floor(110*s)},${Math.floor(80*s)})`;
        ctx.fillRect(x, top, 1, height * 0.04);
      }
    }

    // Three eyes (glowing red, the middle one on forehead)
    // Left eye
    if (relX > 0.33 && relX < 0.41) {
      ctx.fillStyle = `rgba(255,50,0,${0.3*s})`;
      ctx.fillRect(x, top + height * 0.12, 1, height * 0.05);
      ctx.fillStyle = `rgb(255,${Math.floor(30*s)},0)`;
      ctx.fillRect(x, top + height * 0.13, 1, height * 0.03);
    }
    // Right eye
    if (relX > 0.59 && relX < 0.67) {
      ctx.fillStyle = `rgba(255,50,0,${0.3*s})`;
      ctx.fillRect(x, top + height * 0.12, 1, height * 0.05);
      ctx.fillStyle = `rgb(255,${Math.floor(30*s)},0)`;
      ctx.fillRect(x, top + height * 0.13, 1, height * 0.03);
    }
    // Third eye (forehead, larger, brighter)
    if (relX > 0.45 && relX < 0.55) {
      ctx.fillStyle = `rgba(255,80,0,${0.4*s})`;
      ctx.fillRect(x, top + height * 0.085, 1, height * 0.05);
      ctx.fillStyle = `rgb(255,${Math.floor(100*s)},0)`;
      ctx.fillRect(x, top + height * 0.095, 1, height * 0.03);
    }

    // Mouth/jaw (wide gaping maw with tusks)
    if (relX > 0.35 && relX < 0.65) {
      ctx.fillStyle = `rgb(${Math.floor(30*s)},0,${Math.floor(10*s)})`;
      ctx.fillRect(x, top + height * 0.17, 1, height * 0.04);
      // Tusks (upward curving from lower jaw)
      if ((relX > 0.36 && relX < 0.40) || (relX > 0.60 && relX < 0.64)) {
        ctx.fillStyle = `rgb(${Math.floor(220*s)},${Math.floor(210*s)},${Math.floor(180*s)})`;
        ctx.fillRect(x, top + height * 0.15, 1, height * 0.04);
      }
    }
  }

  drawNagaColumn(ctx, x, top, height, relX, shade, sprite) {
    // Naga - majestic cobra serpent with expanded hood, scales, and hypnotic eyes
    const s = shade;
    const hf = sprite.hurt ? 0.6 : 0;

    // Serpentine body (sinuous, narrowing downward with scale pattern)
    const bodyCenter = 0.5;
    const bodyHalfW = 0.12 + 0.04 * Math.sin(relX * Math.PI * 3);
    if (relX > (bodyCenter - bodyHalfW) && relX < (bodyCenter + bodyHalfW)) {
      const bodyTop = top + height * 0.35;
      const bodyBot = top + height;
      const r = Math.floor((25 + hf * 130) * s);
      const g = Math.floor(110 * s);
      const b = Math.floor(70 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, bodyTop, 1, bodyBot - bodyTop);

      // Scale pattern (diamond-shaped highlights)
      const scalePhase = Math.floor(relX * 20) % 2;
      if (scalePhase === 0) {
        ctx.fillStyle = `rgba(60,150,100,${0.3*s})`;
        for (let sy = bodyTop; sy < bodyBot; sy += height * 0.08) {
          ctx.fillRect(x, sy, 1, height * 0.03);
        }
      }

      // Belly (lighter center stripe)
      if (Math.abs(relX - 0.5) < 0.05) {
        ctx.fillStyle = `rgba(120,200,140,${0.2*s})`;
        ctx.fillRect(x, bodyTop, 1, bodyBot - bodyTop);
      }
    }

    // Tail coil at bottom (wider base suggesting coiled body)
    if (relX > 0.3 && relX < 0.7) {
      const coilTop = top + height * 0.85;
      const coilDist = Math.abs(relX - 0.5) / 0.2;
      if (coilDist < 1) {
        const r = Math.floor((20 + hf * 100) * s);
        const g = Math.floor(90 * s);
        const b = Math.floor(55 * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
        ctx.fillRect(x, coilTop, 1, height * 0.15);
      }
    }

    // Expanded cobra hood (wide, flattened, with markings)
    if (relX > 0.12 && relX < 0.88) {
      const hoodTop = top + height * 0.05;
      const hoodBot = top + height * 0.38;
      // Hood shape: wider in middle, narrow at edges
      const hoodDist = Math.abs(relX - 0.5) / 0.38;
      const hoodCurve = 1 - hoodDist * hoodDist;
      if (hoodCurve > 0) {
        const hoodH = (hoodBot - hoodTop) * hoodCurve;
        const r = Math.floor((35 + hf * 100) * s);
        const g = Math.floor(135 * s);
        const b = Math.floor(95 * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
        ctx.fillRect(x, hoodBot - hoodH, 1, hoodH);

        // Hood inner pattern (lighter V-shape / spectacle marking)
        if (relX > 0.25 && relX < 0.75) {
          const innerDist = Math.abs(relX - 0.5) / 0.25;
          if (innerDist < 1) {
            ctx.fillStyle = `rgba(80,180,120,${(1-innerDist)*0.3*s})`;
            ctx.fillRect(x, hoodBot - hoodH * 0.7, 1, hoodH * 0.4);
          }
        }

        // Hood edge highlight (golden rim)
        if (hoodDist > 0.7 && hoodDist < 1) {
          ctx.fillStyle = `rgba(200,180,60,${0.3*s})`;
          ctx.fillRect(x, hoodBot - hoodH, 1, hoodH * 0.5);
        }
      }
    }

    // Face/head (center of hood)
    if (relX > 0.35 && relX < 0.65) {
      const faceTop = top + height * 0.12;
      const faceBot = top + height * 0.28;
      const r = Math.floor((30 + hf * 100) * s);
      const g = Math.floor(100 * s);
      const b = Math.floor(65 * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
      ctx.fillRect(x, faceTop, 1, faceBot - faceTop);

      // Snout/nose
      if (relX > 0.45 && relX < 0.55) {
        ctx.fillStyle = `rgb(${Math.floor(25*s)},${Math.floor(80*s)},${Math.floor(50*s)})`;
        ctx.fillRect(x, faceBot - height * 0.03, 1, height * 0.04);
        // Nostrils
        if (relX > 0.47 && relX < 0.49 || relX > 0.51 && relX < 0.53) {
          ctx.fillStyle = `rgb(${Math.floor(15*s)},${Math.floor(50*s)},${Math.floor(30*s)})`;
          ctx.fillRect(x, faceBot - height * 0.01, 1, height * 0.02);
        }
      }
    }

    // Eyes (hypnotic, slit-pupil, glowing yellow-green)
    if ((relX > 0.36 && relX < 0.44) || (relX > 0.56 && relX < 0.64)) {
      const eyeY = top + height * 0.15;
      const eyeH = height * 0.05;
      // Eye glow
      ctx.fillStyle = `rgba(200,255,50,${0.3*s})`;
      ctx.fillRect(x, eyeY - height*0.01, 1, eyeH + height*0.02);
      // Eye body (bright yellow-green)
      ctx.fillStyle = `rgb(${Math.floor(220*s)},${Math.floor(255*s)},${Math.floor(30*s)})`;
      ctx.fillRect(x, eyeY, 1, eyeH);
      // Slit pupil
      if ((relX > 0.39 && relX < 0.41) || (relX > 0.59 && relX < 0.61)) {
        ctx.fillStyle = `rgb(0,0,0)`;
        ctx.fillRect(x, eyeY + height * 0.005, 1, eyeH * 0.8);
      }
    }

    // Forked tongue (flickering)
    if (relX > 0.48 && relX < 0.52) {
      const tongueY = top + height * 0.28;
      ctx.fillStyle = `rgb(${Math.floor(200*s)},${Math.floor(40*s)},${Math.floor(50*s)})`;
      ctx.fillRect(x, tongueY, 1, height * 0.05);
    }

    // Crown jewel on hood (glowing gem between eyes)
    if (relX > 0.46 && relX < 0.54) {
      const gemY = top + height * 0.09;
      ctx.fillStyle = `rgba(255,50,50,${0.5*s})`;
      ctx.fillRect(x, gemY, 1, height * 0.035);
      ctx.fillStyle = `rgba(255,150,150,${0.7*s})`;
      ctx.fillRect(x, gemY + height * 0.01, 1, height * 0.015);
    }
  }

  drawPickupColumn(ctx, x, top, height, relX, shade, color, type) {
    const size = height * 0.4;
    const pickupTop = top + height * 0.3;
    const cx = 0.5;
    const dist = Math.abs(relX - cx);

    if (dist < 0.3) {
      const alpha = (1 - dist / 0.3) * shade;
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(x, pickupTop, 1, size);
      ctx.globalAlpha = 1;
    }
  }

  drawPillarColumn(ctx, x, top, height, relX, shade) {
    if (relX > 0.3 && relX < 0.7) {
      const r = Math.floor(160 * shade);
      const g = Math.floor(140 * shade);
      const b = Math.floor(100 * shade);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, top, 1, height);
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
      case 'trishul':
        this.drawTrishul(ctx, weaponX, weaponY, gameState);
        break;
      case 'agni':
        this.drawAgni(ctx, weaponX, weaponY, gameState);
        break;
      case 'chakra':
        this.drawChakra(ctx, weaponX, weaponY, gameState);
        break;
      case 'brahmastra':
        this.drawBrahmastra(ctx, weaponX, weaponY, gameState);
        break;
    }

    ctx.restore();

    // Muzzle flash
    if (gameState.fireAnim > 0.5) {
      ctx.save();
      ctx.globalAlpha = gameState.fireAnim - 0.5;
      const flashColors = {
        trishul: '#88ccff',
        agni: '#ff6600',
        chakra: '#ffdd00',
        brahmastra: '#ff00ff'
      };
      ctx.fillStyle = flashColors[weapon] || '#ffaa00';
      ctx.beginPath();
      ctx.arc(w / 2, h - 200 + fireOffset, 30 * gameState.fireAnim, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawTrishul(ctx, x, y, gs) {
    // Trishul (Shiva's trident) - ornate divine weapon
    const cx = x + 58;

    // Shaft - wooden with metallic wrap
    const shaftGrad = ctx.createLinearGradient(cx - 5, y + 50, cx + 5, y + 50);
    shaftGrad.addColorStop(0, '#665544');
    shaftGrad.addColorStop(0.3, '#998877');
    shaftGrad.addColorStop(0.5, '#aa9988');
    shaftGrad.addColorStop(0.7, '#998877');
    shaftGrad.addColorStop(1, '#554433');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(cx - 4, y + 35, 8, 145);

    // Metal bands on shaft
    for (let i = 0; i < 4; i++) {
      const bandY = y + 55 + i * 28;
      ctx.fillStyle = '#c0a030';
      ctx.fillRect(cx - 5, bandY, 10, 3);
      ctx.fillStyle = '#e8c840';
      ctx.fillRect(cx - 4, bandY + 1, 8, 1);
    }

    // Central prong (tallest, with blade shape)
    ctx.fillStyle = '#b0c0d8';
    ctx.beginPath();
    ctx.moveTo(cx - 3, y + 35);
    ctx.lineTo(cx + 3, y + 35);
    ctx.lineTo(cx + 4, y + 5);
    ctx.lineTo(cx, y - 20);
    ctx.lineTo(cx - 4, y + 5);
    ctx.closePath();
    ctx.fill();
    // Center highlight
    ctx.fillStyle = '#d0e0f0';
    ctx.beginPath();
    ctx.moveTo(cx - 1, y + 30);
    ctx.lineTo(cx + 1, y + 30);
    ctx.lineTo(cx + 1, y + 5);
    ctx.lineTo(cx, y - 15);
    ctx.lineTo(cx - 1, y + 5);
    ctx.closePath();
    ctx.fill();

    // Left prong (curved outward)
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

    // Right prong (curved outward)
    ctx.fillStyle = '#a0b0c8';
    ctx.beginPath();
    ctx.moveTo(cx + 5, y + 38);
    ctx.lineTo(cx + 8, y + 38);
    ctx.lineTo(cx + 16, y + 10);
    ctx.lineTo(cx + 22, y - 5);
    ctx.lineTo(cx + 20, y - 8);
    ctx.lineTo(cx + 14, y + 8);
    ctx.closePath();
    ctx.fill();

    // Prong tips glow
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

    // Cross guard / trident base
    ctx.fillStyle = '#c0a030';
    ctx.fillRect(cx - 18, y + 33, 36, 6);
    ctx.fillStyle = '#e8c840';
    ctx.fillRect(cx - 16, y + 35, 32, 2);

    // Hand/grip
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(cx - 16, y + 145, 14, 30);
    ctx.fillStyle = '#9B7924';
    ctx.fillRect(cx - 14, y + 148, 10, 24);
    // Fingers wrapping shaft
    ctx.fillStyle = '#7B5904';
    for (let f = 0; f < 4; f++) {
      ctx.fillRect(cx - 6, y + 148 + f * 6, 10, 3);
    }
    // Thumb
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(cx + 2, y + 145, 8, 20);
  }

  drawAgni(ctx, x, y, gs) {
    // Agni - divine fire cannon (double-barreled flamethrower)

    // Main body (ornate, temple-shaped receiver)
    const bodyGrad = ctx.createLinearGradient(x + 25, y + 55, x + 95, y + 55);
    bodyGrad.addColorStop(0, '#882200');
    bodyGrad.addColorStop(0.3, '#cc4400');
    bodyGrad.addColorStop(0.5, '#dd5510');
    bodyGrad.addColorStop(0.7, '#cc4400');
    bodyGrad.addColorStop(1, '#882200');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x + 25, y + 52, 70, 28);

    // Body detail - ornate lines
    ctx.strokeStyle = '#ff8833';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 28, y + 55, 64, 22);
    ctx.fillStyle = '#ffaa44';
    ctx.fillRect(x + 50, y + 58, 20, 3);
    ctx.fillRect(x + 50, y + 70, 20, 3);

    // Left barrel (with rifling details)
    const bGrad = ctx.createLinearGradient(x + 32, y + 20, x + 50, y + 20);
    bGrad.addColorStop(0, '#772200');
    bGrad.addColorStop(0.4, '#aa4422');
    bGrad.addColorStop(0.6, '#993311');
    bGrad.addColorStop(1, '#661800');
    ctx.fillStyle = bGrad;
    ctx.fillRect(x + 33, y + 18, 16, 50);
    // Barrel opening
    ctx.fillStyle = '#331100';
    ctx.fillRect(x + 35, y + 18, 12, 4);
    // Heat vents
    for (let v = 0; v < 3; v++) {
      ctx.fillStyle = '#551100';
      ctx.fillRect(x + 33, y + 28 + v * 10, 16, 2);
    }

    // Right barrel
    ctx.fillStyle = bGrad;
    ctx.fillRect(x + 68, y + 18, 16, 50);
    ctx.fillStyle = '#331100';
    ctx.fillRect(x + 70, y + 18, 12, 4);
    for (let v = 0; v < 3; v++) {
      ctx.fillStyle = '#551100';
      ctx.fillRect(x + 68, y + 28 + v * 10, 16, 2);
    }

    // Fire glow from barrels
    if (gs.fireAnim > 0) {
      const intensity = gs.fireAnim;
      // Left barrel fire
      ctx.fillStyle = `rgba(255, 180, 50, ${intensity * 0.6})`;
      ctx.beginPath();
      ctx.arc(x + 41, y + 14, 14 * intensity, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 80, 0, ${intensity * 0.4})`;
      ctx.beginPath();
      ctx.arc(x + 41, y + 8, 20 * intensity, 0, Math.PI * 2);
      ctx.fill();
      // Right barrel fire
      ctx.fillStyle = `rgba(255, 180, 50, ${intensity * 0.6})`;
      ctx.beginPath();
      ctx.arc(x + 76, y + 14, 14 * intensity, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 80, 0, ${intensity * 0.4})`;
      ctx.beginPath();
      ctx.arc(x + 76, y + 8, 20 * intensity, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ember glow between barrels (always subtly glowing)
    const ember = Math.sin(gs.time * 3) * 0.15 + 0.25;
    ctx.fillStyle = `rgba(255, 100, 20, ${ember})`;
    ctx.beginPath();
    ctx.arc(x + 58, y + 40, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hand/grip
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 38, y + 80, 16, 28);
    ctx.fillStyle = '#9B7924';
    ctx.fillRect(x + 40, y + 83, 12, 22);
    // Fingers
    ctx.fillStyle = '#7B5904';
    for (let f = 0; f < 4; f++) {
      ctx.fillRect(x + 52, y + 82 + f * 6, 12, 3);
    }
    // Thumb
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 62, y + 80, 8, 18);
  }

  drawChakra(ctx, x, y, gs) {
    // Sudarshana Chakra launcher - Vishnu's divine disc weapon
    const cx = x + 58;
    const spin = gs.time * 5;

    // Launcher body (golden, angular, sci-fi temple tech)
    const bodyGrad = ctx.createLinearGradient(x + 22, y + 45, x + 95, y + 45);
    bodyGrad.addColorStop(0, '#8B6B00');
    bodyGrad.addColorStop(0.3, '#C8A000');
    bodyGrad.addColorStop(0.5, '#E8C830');
    bodyGrad.addColorStop(0.7, '#C8A000');
    bodyGrad.addColorStop(1, '#8B6B00');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x + 22, y + 45, 72, 30);

    // Upper housing for disc
    ctx.fillStyle = '#aa8800';
    ctx.fillRect(x + 30, y + 38, 56, 10);
    // Rail grooves
    ctx.fillStyle = '#776600';
    ctx.fillRect(x + 32, y + 40, 52, 2);
    ctx.fillRect(x + 32, y + 44, 52, 2);

    // Ornate side panels
    ctx.fillStyle = '#ddbb30';
    ctx.fillRect(x + 24, y + 50, 3, 20);
    ctx.fillRect(x + 91, y + 50, 3, 20);

    // Spinning Sudarshana Chakra disc (detailed with serrated edges)
    ctx.save();
    ctx.translate(cx, y + 22);
    ctx.rotate(spin);

    // Outer serrated ring
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

    // Inner ring
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes (8 ornate spokes)
    ctx.strokeStyle = '#ffbb00';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 5, Math.sin(a) * 5);
      ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.stroke();
    }

    // Center hub (glowing)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,200,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Disc glow effect
    const glowPulse = Math.sin(gs.time * 6) * 0.1 + 0.2;
    ctx.fillStyle = `rgba(255,220,50,${glowPulse})`;
    ctx.beginPath();
    ctx.arc(cx, y + 22, 26, 0, Math.PI * 2);
    ctx.fill();

    // Hand/grip
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
    // Brahmastra - divine superweapon (BFG equivalent), massive energy cannon
    const cx = x + 60;
    const pulse = Math.sin(gs.time * 4) * 0.3 + 0.7;

    // Main body (large, imposing, purple-black with gold trim)
    const bodyGrad = ctx.createLinearGradient(x + 10, y + 38, x + 110, y + 38);
    bodyGrad.addColorStop(0, '#330055');
    bodyGrad.addColorStop(0.2, '#550077');
    bodyGrad.addColorStop(0.5, '#660088');
    bodyGrad.addColorStop(0.8, '#550077');
    bodyGrad.addColorStop(1, '#330055');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x + 12, y + 38, 96, 38);

    // Gold trim lines
    ctx.fillStyle = '#c8a000';
    ctx.fillRect(x + 14, y + 40, 92, 2);
    ctx.fillRect(x + 14, y + 73, 92, 2);
    ctx.fillRect(x + 14, y + 56, 92, 1);

    // Side vents (energy exhaust)
    for (let v = 0; v < 3; v++) {
      ctx.fillStyle = `rgba(200,0,255,${pulse * 0.3})`;
      ctx.fillRect(x + 14, y + 45 + v * 9, 6, 4);
      ctx.fillRect(x + 100, y + 45 + v * 9, 6, 4);
    }

    // Barrel (wide, flared muzzle)
    const barrelGrad = ctx.createLinearGradient(x + 30, y + 12, x + 90, y + 12);
    barrelGrad.addColorStop(0, '#440066');
    barrelGrad.addColorStop(0.5, '#770099');
    barrelGrad.addColorStop(1, '#440066');
    ctx.fillStyle = barrelGrad;
    ctx.fillRect(x + 32, y + 15, 56, 28);

    // Barrel flare (widens at muzzle)
    ctx.fillStyle = '#550077';
    ctx.beginPath();
    ctx.moveTo(x + 28, y + 12);
    ctx.lineTo(x + 92, y + 12);
    ctx.lineTo(x + 88, y + 18);
    ctx.lineTo(x + 32, y + 18);
    ctx.closePath();
    ctx.fill();

    // Barrel opening (dark void)
    ctx.fillStyle = '#110022';
    ctx.fillRect(x + 38, y + 12, 44, 5);

    // Energy core (central glowing orb)
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

    // Core center (white-hot)
    ctx.fillStyle = `rgba(255,220,255,${pulse})`;
    ctx.beginPath();
    ctx.arc(cx, y + 35, 5, 0, Math.PI * 2);
    ctx.fill();

    // Energy tendrils (rotating around core)
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

    // Sanskrit-like rune markings on body
    ctx.fillStyle = `rgba(200,150,255,${0.2 + pulse * 0.15})`;
    for (let r = 0; r < 4; r++) {
      ctx.fillRect(x + 22 + r * 22, y + 62, 12, 3);
    }

    // Hand/grip (both hands for big weapon)
    // Left hand
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 25, y + 76, 16, 28);
    ctx.fillStyle = '#9B7924';
    ctx.fillRect(x + 27, y + 79, 12, 22);
    ctx.fillStyle = '#7B5904';
    for (let f = 0; f < 4; f++) {
      ctx.fillRect(x + 39, y + 78 + f * 6, 10, 3);
    }
    // Right hand
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

    // HUD background
    ctx.fillStyle = 'rgba(20, 10, 5, 0.85)';
    ctx.fillRect(0, hudY, w, hudHeight);

    // Ornate border
    ctx.strokeStyle = '#c8a000';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, hudY + 1, w - 2, hudHeight - 2);

    // Health
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('UYIR', 20, hudY + 20);
    ctx.font = 'bold 28px monospace';
    ctx.fillStyle = player.health > 25 ? '#ff4444' : '#ff0000';
    ctx.fillText(`${Math.ceil(player.health)}%`, 20, hudY + 48);

    // Health bar
    ctx.fillStyle = '#330000';
    ctx.fillRect(110, hudY + 10, 120, 16);
    ctx.fillStyle = player.health > 50 ? '#00cc44' : player.health > 25 ? '#ccaa00' : '#cc0000';
    ctx.fillRect(110, hudY + 10, (player.health / 100) * 120, 16);
    ctx.strokeStyle = '#666';
    ctx.strokeRect(110, hudY + 10, 120, 16);

    // Armor
    ctx.fillStyle = '#4488ff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('KAVACHAM', 110, hudY + 48);
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${Math.ceil(player.armor)}%`, 200, hudY + 48);

    // Ammo
    const weaponNames = {
      trishul: 'TRISHUL',
      agni: 'AGNI',
      chakra: 'CHAKRA',
      brahmastra: 'BRAHMASTRA'
    };
    ctx.fillStyle = '#ffaa00';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(weaponNames[gameState.currentWeapon] || 'TRISHUL', w - 200, hudY + 20);
    ctx.font = 'bold 28px monospace';
    const ammo = gameState.ammo[gameState.currentWeapon];
    ctx.fillText(ammo === Infinity ? 'INF' : `${ammo}`, w - 200, hudY + 48);

    // Keys
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

    // Level name
    ctx.fillStyle = '#c8a000';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`NILAI ${gameState.level} - ${gameState.levelName}`, w / 2, hudY + 55);
    ctx.textAlign = 'left';

    // Kill count
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(`KOLAI: ${gameState.kills}/${gameState.totalEnemies}`, w - 120, hudY + 48);

    // --- Compass arrow pointing to the level exit ---
    if (gameState && gameState.exit) {
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

      // Background ring
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c8a000';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tiny "N" / forward marker at top of ring (your facing)
      ctx.fillStyle = 'rgba(200, 160, 0, 0.7)';
      ctx.fillRect(cx - 1, cy - r - 2, 2, 4);

      // Arrow rotated to point at exit (up = forward)
      const aligned = Math.abs(rel) < 0.22;
      const a = -Math.PI / 2 + rel;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      // Arrow color: green when on-target, gold otherwise
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

      // Distance label
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
    const expanded = !!(gameState && gameState.mapExpanded);
    let scale = expanded ? MINIMAP_SCALE_EXPANDED : MINIMAP_SCALE;

    // If expanded map would overflow the screen, shrink it to fit
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
      // Dim everything else when full map is open
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.globalAlpha = expanded ? 0.96 : 0.78;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(offsetX - 2, offsetY - 2, mapW + 4, mapH + 4);

    // Border
    ctx.strokeStyle = '#c8a000';
    ctx.lineWidth = expanded ? 2 : 1;
    ctx.strokeRect(offsetX - 2, offsetY - 2, mapW + 4, mapH + 4);

    // Tiles
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.getTile(x, y);
        if (tile > 0) {
          const colors = ['', '#8B7355', '#AA4444', '#555566', '#C8A000', '#664422'];
          ctx.fillStyle = colors[tile] || '#888';
          ctx.fillRect(offsetX + x * size, offsetY + y * size, size, size);
        }
      }
    }

    // Exit marker (pulsing yellow X with halo)
    if (gameState && gameState.exit) {
      const ex = offsetX + (gameState.exit.x + 0.5) * size;
      const ey = offsetY + (gameState.exit.y + 0.5) * size;
      const t = (gameState.time || 0);
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

    // Enemy dots
    for (const s of sprites) {
      if (!s.active || !['asura', 'rakshasa', 'naga'].includes(s.type)) continue;
      ctx.fillStyle = s.boss ? '#ffcc00' : '#ff0000';
      const r = (s.boss ? 4 : 2) * (expanded ? 1.4 : 1);
      ctx.fillRect(
        offsetX + (s.x / TILE_SIZE) * size - r / 2,
        offsetY + (s.y / TILE_SIZE) * size - r / 2,
        r, r
      );
    }

    // Player
    ctx.fillStyle = '#00ff00';
    const px = offsetX + (player.x / TILE_SIZE) * size;
    const py = offsetY + (player.y / TILE_SIZE) * size;
    const pr = expanded ? 4 : 2;
    ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);

    // Direction
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
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(200, 160, 0, 0.7)';
      ctx.font = '10px monospace';
      ctx.fillText('M = padam', offsetX, offsetY + mapH + 12);
    }

    ctx.restore();
  }
}

export { RaycastEngine, TILE_SIZE, FOV, HALF_FOV };
