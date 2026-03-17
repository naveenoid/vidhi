// Vidhi - Tamil-themed Doom Clone
// Raycasting Engine

const TILE_SIZE = 64;
const FOV = Math.PI / 3; // 60 degrees
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 20;
const MINIMAP_SCALE = 0.15;

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

    // Render sprites
    this.renderSprites(ctx, player, sprites, zBuffer, w, h);

    // Render weapon
    this.renderWeapon(ctx, player, gameState, w, h);

    // Render HUD
    this.renderHUD(ctx, player, gameState, w, h);

    // Render minimap
    this.renderMinimap(ctx, player, map, sprites, w, h);
  }

  getWallColor(texture, isHorizontal, shade, texX) {
    const darkFactor = isHorizontal ? 0.7 : 1;
    const s = shade * darkFactor;

    switch (texture) {
      case 1: // Temple stone walls
        return {
          main: `rgb(${Math.floor(180 * s)}, ${Math.floor(140 * s)}, ${Math.floor(100 * s)})`,
          detail: `rgb(${Math.floor(140 * s)}, ${Math.floor(100 * s)}, ${Math.floor(70 * s)})`
        };
      case 2: // Red/terracotta walls (Dravidian temple)
        return {
          main: `rgb(${Math.floor(200 * s)}, ${Math.floor(80 * s)}, ${Math.floor(60 * s)})`,
          detail: `rgb(${Math.floor(160 * s)}, ${Math.floor(60 * s)}, ${Math.floor(40 * s)})`
        };
      case 3: // Dark stone / dungeon
        return {
          main: `rgb(${Math.floor(90 * s)}, ${Math.floor(90 * s)}, ${Math.floor(100 * s)})`,
          detail: `rgb(${Math.floor(60 * s)}, ${Math.floor(60 * s)}, ${Math.floor(70 * s)})`
        };
      case 4: // Gold/ornate walls
        return {
          main: `rgb(${Math.floor(220 * s)}, ${Math.floor(180 * s)}, ${Math.floor(50 * s)})`,
          detail: `rgb(${Math.floor(180 * s)}, ${Math.floor(140 * s)}, ${Math.floor(30 * s)})`
        };
      case 5: // Door
        return {
          main: `rgb(${Math.floor(120 * s)}, ${Math.floor(60 * s)}, ${Math.floor(30 * s)})`,
          detail: `rgb(${Math.floor(90 * s)}, ${Math.floor(40 * s)}, ${Math.floor(20 * s)})`
        };
      default:
        return {
          main: `rgb(${Math.floor(150 * s)}, ${Math.floor(150 * s)}, ${Math.floor(150 * s)})`,
          detail: `rgb(${Math.floor(120 * s)}, ${Math.floor(120 * s)}, ${Math.floor(120 * s)})`
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
    // Asura demon - red/dark body
    const bodyStart = top + height * 0.15;
    const bodyEnd = top + height;
    const headEnd = top + height * 0.15;

    // Body
    if (relX > 0.2 && relX < 0.8) {
      const r = Math.floor((180 + (sprite.hurt ? 75 : 0)) * shade);
      const g = Math.floor(40 * shade);
      const b = Math.floor(40 * shade);
      ctx.fillStyle = `rgb(${Math.min(255, r)},${g},${b})`;
      ctx.fillRect(x, bodyStart, 1, bodyEnd - bodyStart);
    }

    // Head
    if (relX > 0.3 && relX < 0.7) {
      ctx.fillStyle = `rgb(${Math.floor(200 * shade)},${Math.floor(60 * shade)},${Math.floor(60 * shade)})`;
      ctx.fillRect(x, top, 1, headEnd - top);
    }

    // Eyes
    if (relX > 0.35 && relX < 0.42 || relX > 0.58 && relX < 0.65) {
      ctx.fillStyle = `rgb(255,${Math.floor(200 * shade)},0)`;
      ctx.fillRect(x, top + height * 0.06, 1, height * 0.04);
    }
  }

  drawRakshasaColumn(ctx, x, top, height, relX, shade, sprite) {
    // Rakshasa - larger, darker, more menacing
    const bodyStart = top + height * 0.2;
    const bodyEnd = top + height;

    if (relX > 0.15 && relX < 0.85) {
      const r = Math.floor((100 + (sprite.hurt ? 100 : 0)) * shade);
      const g = Math.floor(50 * shade);
      const b = Math.floor(80 * shade);
      ctx.fillStyle = `rgb(${Math.min(255, r)},${g},${b})`;
      ctx.fillRect(x, bodyStart, 1, bodyEnd - bodyStart);
    }

    // Horns
    if ((relX > 0.25 && relX < 0.35) || (relX > 0.65 && relX < 0.75)) {
      ctx.fillStyle = `rgb(${Math.floor(60 * shade)},${Math.floor(60 * shade)},${Math.floor(40 * shade)})`;
      ctx.fillRect(x, top, 1, height * 0.2);
    }

    // Head
    if (relX > 0.3 && relX < 0.7) {
      ctx.fillStyle = `rgb(${Math.floor(120 * shade)},${Math.floor(40 * shade)},${Math.floor(70 * shade)})`;
      ctx.fillRect(x, top + height * 0.1, 1, height * 0.12);
    }

    // Eyes (three eyes)
    if ((relX > 0.35 && relX < 0.40) || (relX > 0.48 && relX < 0.52) || (relX > 0.60 && relX < 0.65)) {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(x, top + height * 0.14, 1, height * 0.03);
    }
  }

  drawNagaColumn(ctx, x, top, height, relX, shade, sprite) {
    // Naga serpent - green/blue body
    const bodyWidth = 0.3 + 0.2 * Math.sin(relX * Math.PI);

    if (relX > (0.5 - bodyWidth / 2) && relX < (0.5 + bodyWidth / 2)) {
      const r = Math.floor((30 + (sprite.hurt ? 100 : 0)) * shade);
      const g = Math.floor(120 * shade);
      const b = Math.floor(80 * shade);
      ctx.fillStyle = `rgb(${Math.min(255, r)},${g},${b})`;
      ctx.fillRect(x, top + height * 0.1, 1, height * 0.9);
    }

    // Hood
    if (relX > 0.2 && relX < 0.8 && relX > 0.2) {
      const hoodY = top;
      const hoodH = height * 0.25;
      ctx.fillStyle = `rgb(${Math.floor(40 * shade)},${Math.floor(140 * shade)},${Math.floor(100 * shade)})`;
      ctx.fillRect(x, hoodY, 1, hoodH);
    }

    // Eyes
    if ((relX > 0.35 && relX < 0.42) || (relX > 0.58 && relX < 0.65)) {
      ctx.fillStyle = `rgb(${Math.floor(255 * shade)},${Math.floor(255 * shade)},0)`;
      ctx.fillRect(x, top + height * 0.08, 1, height * 0.04);
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
    // Trishul (trident) - starting weapon
    ctx.fillStyle = '#888899';
    ctx.fillRect(x + 55, y + 40, 6, 140); // shaft

    // Three prongs
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(x + 56, y, 4, 50); // center
    ctx.fillRect(x + 40, y + 10, 4, 40); // left
    ctx.fillRect(x + 72, y + 10, 4, 40); // right

    // Prong tips
    ctx.fillStyle = '#ccddff';
    for (const px of [40, 56, 72]) {
      ctx.beginPath();
      ctx.moveTo(x + px, y + (px === 56 ? -10 : 0));
      ctx.lineTo(x + px + 6, y + (px === 56 ? -10 : 0));
      ctx.lineTo(x + px + 3, y + (px === 56 ? -20 : -10));
      ctx.fill();
    }

    // Hand
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 45, y + 140, 30, 25);
  }

  drawAgni(ctx, x, y, gs) {
    // Agni - fire weapon (like shotgun)
    ctx.fillStyle = '#cc4400';
    ctx.fillRect(x + 30, y + 60, 60, 20); // body
    ctx.fillStyle = '#aa3300';
    ctx.fillRect(x + 35, y + 30, 12, 50); // barrel left
    ctx.fillRect(x + 70, y + 30, 12, 50); // barrel right

    // Fire glow
    if (gs.fireAnim > 0) {
      ctx.fillStyle = `rgba(255, 100, 0, ${gs.fireAnim * 0.5})`;
      ctx.beginPath();
      ctx.arc(x + 58, y + 25, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hand
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 40, y + 80, 40, 20);
  }

  drawChakra(ctx, x, y, gs) {
    // Sudarshana Chakra launcher (like plasma gun)
    ctx.fillStyle = '#ddaa00';
    ctx.fillRect(x + 30, y + 50, 60, 25); // body

    // Spinning disc
    const spin = gs.time * 5;
    ctx.save();
    ctx.translate(x + 58, y + 30);
    ctx.rotate(spin);
    ctx.strokeStyle = '#ffdd00';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    // Spokes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
      ctx.stroke();
    }
    ctx.restore();

    // Hand
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 40, y + 75, 40, 20);
  }

  drawBrahmastra(ctx, x, y, gs) {
    // Brahmastra - BFG equivalent
    ctx.fillStyle = '#660088';
    ctx.fillRect(x + 20, y + 40, 80, 35); // body
    ctx.fillStyle = '#880088';
    ctx.fillRect(x + 40, y + 20, 40, 30); // barrel

    // Energy glow
    const pulse = Math.sin(gs.time * 4) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(200, 0, 255, ${pulse * 0.6})`;
    ctx.beginPath();
    ctx.arc(x + 60, y + 35, 25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `rgba(255, 100, 255, ${pulse * 0.8})`;
    ctx.beginPath();
    ctx.arc(x + 60, y + 35, 12, 0, Math.PI * 2);
    ctx.fill();

    // Hand
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x + 35, y + 75, 50, 20);
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
  }

  renderMinimap(ctx, player, map, sprites, w, h) {
    const size = TILE_SIZE * MINIMAP_SCALE;
    const mapW = map.width * size;
    const mapH = map.height * size;
    const offsetX = 10;
    const offsetY = 10;

    ctx.save();
    ctx.globalAlpha = 0.7;

    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(offsetX - 2, offsetY - 2, mapW + 4, mapH + 4);

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

    // Enemy dots
    for (const s of sprites) {
      if (!s.active || !['asura', 'rakshasa', 'naga'].includes(s.type)) continue;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(
        offsetX + (s.x / TILE_SIZE) * size - 1,
        offsetY + (s.y / TILE_SIZE) * size - 1,
        3, 3
      );
    }

    // Player
    ctx.fillStyle = '#00ff00';
    const px = offsetX + (player.x / TILE_SIZE) * size;
    const py = offsetY + (player.y / TILE_SIZE) * size;
    ctx.fillRect(px - 2, py - 2, 4, 4);

    // Direction
    ctx.strokeStyle = '#00ff00';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(player.angle) * 10, py + Math.sin(player.angle) * 10);
    ctx.stroke();

    ctx.restore();
  }
}

export { RaycastEngine, TILE_SIZE, FOV, HALF_FOV };
