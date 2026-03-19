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
    const time = gameState.time || 0;

    // Dark dungeon ceiling - stone ceiling with faint cracks of dim light
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h / 2);
    skyGrad.addColorStop(0, '#0a0608');
    skyGrad.addColorStop(0.4, '#120a0e');
    skyGrad.addColorStop(0.7, '#1a0e14');
    skyGrad.addColorStop(1, '#251518');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h / 2);

    // Dungeon floor - worn stone slabs
    const floorGrad = ctx.createLinearGradient(0, h / 2, 0, h);
    floorGrad.addColorStop(0, '#1a1210');
    floorGrad.addColorStop(0.3, '#15100c');
    floorGrad.addColorStop(0.7, '#100b08');
    floorGrad.addColorStop(1, '#0a0705');
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

      // Distance-based fog and torchlight
      const tileDist = correctedDist / TILE_SIZE;
      const baseFog = Math.min(1, 2.5 / tileDist);
      // Flickering torch effect
      const torchFlicker = 1 + Math.sin(time * 8 + i * 0.1) * 0.04 + Math.sin(time * 13 + i * 0.07) * 0.03;
      const shade = Math.min(1, baseFog * torchFlicker);
      const colors = this.getWallColor(ray.texture, ray.isHorizontal, shade, ray.texX);

      // Draw wall column
      ctx.fillStyle = colors.main;
      ctx.fillRect(i, wallTop, 1, wallHeight);

      // Stone block pattern with mortar lines
      if (wallHeight > 8) {
        const isDoor = ray.texture === 5;
        const blockH = isDoor ? wallHeight / 6 : wallHeight / 8;
        const blockOffset = (Math.floor(ray.texX * 4) % 2 === 0) ? 0 : blockH * 0.5;

        // Mortar/grout lines between blocks
        ctx.fillStyle = colors.detail;
        for (let b = 0; b < 10; b++) {
          const by = wallTop + b * blockH + blockOffset;
          if (by > wallTop && by < wallTop + wallHeight) {
            ctx.fillRect(i, by, 1, Math.max(1, wallHeight * 0.008));
          }
        }

        // Vertical mortar lines (column seams)
        const vertSeam = ray.texX % 0.25;
        if (vertSeam < 0.02 || vertSeam > 0.23) {
          ctx.fillStyle = colors.detail;
          ctx.fillRect(i, wallTop, 1, wallHeight);
        }

        // Moss/lichen patches on dark stone (texture 3)
        if (ray.texture === 3 && wallHeight > 20) {
          const mossChance = Math.sin(ray.texX * 47.3 + 13.7);
          if (mossChance > 0.3) {
            ctx.fillStyle = `rgba(30,${Math.floor(60 * shade)},25,${0.3 * shade})`;
            ctx.fillRect(i, wallTop + wallHeight * 0.7, 1, wallHeight * 0.2);
          }
          // Water stain dripping down
          const drip = Math.sin(ray.texX * 71.1);
          if (drip > 0.6) {
            ctx.fillStyle = `rgba(20,25,30,${0.2 * shade})`;
            ctx.fillRect(i, wallTop + wallHeight * 0.3, 1, wallHeight * 0.5);
          }
        }

        // Carved relief patterns on red/terracotta walls (texture 2)
        if (ray.texture === 2 && wallHeight > 15) {
          const carveX = ray.texX * Math.PI * 6;
          const carveIntensity = (Math.sin(carveX) * 0.5 + 0.5) * 0.15;
          ctx.fillStyle = `rgba(0,0,0,${carveIntensity * shade})`;
          ctx.fillRect(i, wallTop + wallHeight * 0.2, 1, wallHeight * 0.6);
        }

        // Gold walls shimmer (texture 4)
        if (ray.texture === 4 && wallHeight > 12) {
          const shimmer = Math.sin(time * 2 + ray.texX * 20) * 0.1 + 0.05;
          ctx.fillStyle = `rgba(255,220,100,${shimmer * shade})`;
          ctx.fillRect(i, wallTop, 1, wallHeight);
        }

        // DOOR GLOW - make doors very visible (texture 5)
        if (isDoor) {
          // Warm glowing border on left/right edges
          const edgeDist = Math.min(ray.texX, 1 - ray.texX);
          if (edgeDist < 0.08) {
            const edgeGlow = (1 - edgeDist / 0.08) * 0.7;
            ctx.fillStyle = `rgba(255,180,60,${edgeGlow * shade})`;
            ctx.fillRect(i, wallTop, 1, wallHeight);
          }
          // Pulsing warm glow on entire door
          const doorPulse = Math.sin(time * 3) * 0.08 + 0.12;
          ctx.fillStyle = `rgba(255,160,40,${doorPulse * shade})`;
          ctx.fillRect(i, wallTop, 1, wallHeight);
          // Iron band details across door
          const bandPos = ray.texX;
          if (wallHeight > 20) {
            ctx.fillStyle = `rgba(80,70,50,${0.5 * shade})`;
            // Horizontal bands
            ctx.fillRect(i, wallTop + wallHeight * 0.15, 1, Math.max(2, wallHeight * 0.02));
            ctx.fillRect(i, wallTop + wallHeight * 0.5, 1, Math.max(2, wallHeight * 0.02));
            ctx.fillRect(i, wallTop + wallHeight * 0.85, 1, Math.max(2, wallHeight * 0.02));
            // Iron studs
            if (bandPos > 0.1 && bandPos < 0.15 || bandPos > 0.85 && bandPos < 0.9) {
              ctx.fillStyle = `rgba(180,160,100,${0.4 * shade})`;
              ctx.fillRect(i, wallTop + wallHeight * 0.14, 1, Math.max(3, wallHeight * 0.035));
              ctx.fillRect(i, wallTop + wallHeight * 0.49, 1, Math.max(3, wallHeight * 0.035));
              ctx.fillRect(i, wallTop + wallHeight * 0.84, 1, Math.max(3, wallHeight * 0.035));
            }
            // Door ring/handle
            if (bandPos > 0.44 && bandPos < 0.56) {
              ctx.fillStyle = `rgba(200,170,80,${0.6 * shade})`;
              ctx.fillRect(i, wallTop + wallHeight * 0.45, 1, wallHeight * 0.1);
            }
          }
          // Top and bottom glow lines
          ctx.fillStyle = `rgba(255,200,80,${0.5 * shade})`;
          ctx.fillRect(i, wallTop, 1, Math.max(2, wallHeight * 0.015));
          ctx.fillRect(i, wallTop + wallHeight - Math.max(2, wallHeight * 0.015), 1, Math.max(2, wallHeight * 0.015));
        }
      }

      // Distance fog overlay
      if (tileDist > 3) {
        const fogAlpha = Math.min(0.7, (tileDist - 3) * 0.06);
        ctx.fillStyle = `rgba(8,5,12,${fogAlpha})`;
        ctx.fillRect(i, wallTop, 1, wallHeight);
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
    const darkFactor = isHorizontal ? 0.65 : 1;
    const s = shade * darkFactor;
    // Pseudo-random variation per column for natural stone look
    const tv = Math.sin(texX * 37.7) * 0.12;
    const tv2 = Math.sin(texX * 73.1) * 0.06;

    switch (texture) {
      case 1: // Granite fortress walls - weathered grey-brown stone blocks
        return {
          main: `rgb(${Math.floor((120 + tv * 40 + tv2 * 20) * s)}, ${Math.floor((105 + tv * 30 + tv2 * 15) * s)}, ${Math.floor((85 + tv * 20) * s)})`,
          detail: `rgb(${Math.floor(55 * s)}, ${Math.floor(48 * s)}, ${Math.floor(38 * s)})`,
          accent: `rgb(${Math.floor(140 * s)}, ${Math.floor(120 * s)}, ${Math.floor(95 * s)})`
        };
      case 2: // Laterite/red stone walls (Dravidian temple) - deep red-brown with carved reliefs
        return {
          main: `rgb(${Math.floor((145 + tv * 30) * s)}, ${Math.floor((60 + tv * 15) * s)}, ${Math.floor((45 + tv * 10) * s)})`,
          detail: `rgb(${Math.floor(70 * s)}, ${Math.floor(28 * s)}, ${Math.floor(20 * s)})`,
          accent: `rgb(${Math.floor(170 * s)}, ${Math.floor(80 * s)}, ${Math.floor(55 * s)})`
        };
      case 3: // Dungeon stone - dark, damp, cold blocks with moss and water stains
        return {
          main: `rgb(${Math.floor((55 + tv * 18) * s)}, ${Math.floor((58 + tv * 20) * s)}, ${Math.floor((62 + tv * 12) * s)})`,
          detail: `rgb(${Math.floor(28 * s)}, ${Math.floor(30 * s)}, ${Math.floor(32 * s)})`,
          accent: `rgb(${Math.floor(45 * s)}, ${Math.floor(55 * s)}, ${Math.floor(48 * s)})`
        };
      case 4: // Gold/ornate shrine walls - temple gold with engravings
        return {
          main: `rgb(${Math.floor((180 + tv * 25) * s)}, ${Math.floor((148 + tv * 20) * s)}, ${Math.floor((45 + tv * 15) * s)})`,
          detail: `rgb(${Math.floor(100 * s)}, ${Math.floor(78 * s)}, ${Math.floor(18 * s)})`,
          accent: `rgb(${Math.floor(220 * s)}, ${Math.floor(185 * s)}, ${Math.floor(70 * s)})`
        };
      case 5: // Heavy wooden door - dark teak with iron fittings
        return {
          main: `rgb(${Math.floor((90 + tv * 20) * s)}, ${Math.floor((52 + tv * 12) * s)}, ${Math.floor((28 + tv * 8) * s)})`,
          detail: `rgb(${Math.floor(45 * s)}, ${Math.floor(25 * s)}, ${Math.floor(12 * s)})`,
          accent: `rgb(${Math.floor(140 * s)}, ${Math.floor(110 * s)}, ${Math.floor(40 * s)})`
        };
      default:
        return {
          main: `rgb(${Math.floor(90 * s)}, ${Math.floor(85 * s)}, ${Math.floor(80 * s)})`,
          detail: `rgb(${Math.floor(50 * s)}, ${Math.floor(48 * s)}, ${Math.floor(45 * s)})`,
          accent: `rgb(${Math.floor(110 * s)}, ${Math.floor(105 * s)}, ${Math.floor(100 * s)})`
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
    // Asura warrior - muscular red demon with horns, curved sword, and digitigrade legs
    const hf = sprite.hurt ? 0.6 : 0;
    const s = shade;
    const anim = sprite.walkAnim || 0;
    const attacking = sprite.attackAnim > 0;
    const atkPhase = sprite.attackAnim || 0;

    // --- FEET (pointed, clawed) ---
    const footY = top + height * 0.92;
    if (relX > 0.24 && relX < 0.34) {
      ctx.fillStyle = `rgb(${Math.floor(80*s)},${Math.floor(20*s)},${Math.floor(15*s)})`;
      ctx.fillRect(x, footY, 1, height * 0.08);
      // Claw tips
      if (relX < 0.27) {
        ctx.fillStyle = `rgb(${Math.floor(200*s)},${Math.floor(190*s)},${Math.floor(170*s)})`;
        ctx.fillRect(x, footY + height * 0.06, 1, height * 0.02);
      }
    }
    if (relX > 0.60 && relX < 0.70) {
      ctx.fillStyle = `rgb(${Math.floor(80*s)},${Math.floor(20*s)},${Math.floor(15*s)})`;
      ctx.fillRect(x, footY, 1, height * 0.08);
      if (relX > 0.67) {
        ctx.fillStyle = `rgb(${Math.floor(200*s)},${Math.floor(190*s)},${Math.floor(170*s)})`;
        ctx.fillRect(x, footY + height * 0.06, 1, height * 0.02);
      }
    }

    // --- LOWER LEGS (digitigrade, bent backward at ankle) ---
    if (relX > 0.26 && relX < 0.36) {
      const lowerLegTop = top + height * 0.78;
      const r = Math.floor((130 + hf * 125) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(28*s)},${Math.floor(22*s)})`;
      ctx.fillRect(x, lowerLegTop, 1, height * 0.14);
      // Shin guard armor
      if (relX > 0.28 && relX < 0.34) {
        ctx.fillStyle = `rgb(${Math.floor(50*s)},${Math.floor(40*s)},${Math.floor(30*s)})`;
        ctx.fillRect(x, lowerLegTop + height * 0.02, 1, height * 0.08);
      }
    }
    if (relX > 0.58 && relX < 0.68) {
      const lowerLegTop = top + height * 0.78;
      const r = Math.floor((130 + hf * 125) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(28*s)},${Math.floor(22*s)})`;
      ctx.fillRect(x, lowerLegTop, 1, height * 0.14);
      if (relX > 0.60 && relX < 0.66) {
        ctx.fillStyle = `rgb(${Math.floor(50*s)},${Math.floor(40*s)},${Math.floor(30*s)})`;
        ctx.fillRect(x, lowerLegTop + height * 0.02, 1, height * 0.08);
      }
    }

    // --- KNEE JOINT (bulge) ---
    if (relX > 0.24 && relX < 0.38) {
      ctx.fillStyle = `rgb(${Math.floor((150+hf*105)*s)},${Math.floor(35*s)},${Math.floor(28*s)})`;
      ctx.fillRect(x, top + height * 0.75, 1, height * 0.04);
    }
    if (relX > 0.56 && relX < 0.70) {
      ctx.fillStyle = `rgb(${Math.floor((150+hf*105)*s)},${Math.floor(35*s)},${Math.floor(28*s)})`;
      ctx.fillRect(x, top + height * 0.75, 1, height * 0.04);
    }

    // --- UPPER LEGS / THIGHS (thicker, muscular) ---
    if (relX > 0.27 && relX < 0.42) {
      const thighTop = top + height * 0.6;
      const r = Math.floor((155 + hf * 100) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(32*s)},${Math.floor(26*s)})`;
      ctx.fillRect(x, thighTop, 1, height * 0.16);
      // Muscle definition
      if (relX > 0.32 && relX < 0.38) {
        ctx.fillStyle = `rgba(200,60,40,${0.15*s})`;
        ctx.fillRect(x, thighTop + height * 0.03, 1, height * 0.08);
      }
    }
    if (relX > 0.55 && relX < 0.70) {
      const thighTop = top + height * 0.6;
      const r = Math.floor((155 + hf * 100) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(32*s)},${Math.floor(26*s)})`;
      ctx.fillRect(x, thighTop, 1, height * 0.16);
    }

    // --- LOINCLOTH / WAIST WRAP ---
    if (relX > 0.25 && relX < 0.72) {
      ctx.fillStyle = `rgb(${Math.floor(65*s)},${Math.floor(40*s)},${Math.floor(15*s)})`;
      ctx.fillRect(x, top + height * 0.56, 1, height * 0.06);
      // Gold trim on belt
      ctx.fillStyle = `rgba(200,160,40,${0.4*s})`;
      ctx.fillRect(x, top + height * 0.56, 1, height * 0.01);
    }

    // --- TORSO (V-shape, wide shoulders to narrow waist) ---
    const torsoWidthAt = (y_pct) => {
      // Wider at top (0.25), narrow at bottom (0.55)
      const t = (y_pct - 0.25) / 0.30;
      return 0.22 - t * 0.06; // half-width from center
    };
    const yStart = 0.25, yEnd = 0.57;
    const yPct = (relX > 0.5) ? 0 : 0; // just for scoping
    if (relX > 0.28 && relX < 0.72) {
      for (let rowPct = yStart; rowPct < yEnd; rowPct += 0.01) {
        const hw = torsoWidthAt(rowPct);
        if (relX > (0.5 - hw) && relX < (0.5 + hw)) {
          const r = Math.floor((160 + hf * 95) * s);
          const g = Math.floor(35 * s);
          const b = Math.floor(30 * s);
          ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
          ctx.fillRect(x, top + height * rowPct, 1, height * 0.01);
        }
      }
    }

    // Chest details - pectoral shadows and abs
    if (relX > 0.36 && relX < 0.48) {
      ctx.fillStyle = `rgba(200,60,40,${0.2*s})`;
      ctx.fillRect(x, top + height * 0.28, 1, height * 0.08);
    }
    if (relX > 0.52 && relX < 0.64) {
      ctx.fillStyle = `rgba(200,60,40,${0.2*s})`;
      ctx.fillRect(x, top + height * 0.28, 1, height * 0.08);
    }
    // Center chest line
    if (relX > 0.49 && relX < 0.51) {
      ctx.fillStyle = `rgba(100,20,15,${0.3*s})`;
      ctx.fillRect(x, top + height * 0.28, 1, height * 0.25);
    }

    // --- ARMS ---
    // Left arm (holds a curved sword - khanda/vel)
    if (relX > 0.08 && relX < 0.22) {
      const armTop = top + height * 0.27;
      const armLen = height * 0.30;
      const r = Math.floor((150 + hf * 105) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(30*s)},${Math.floor(25*s)})`;
      ctx.fillRect(x, armTop, 1, armLen);
      // Bracer/wrist guard
      ctx.fillStyle = `rgb(${Math.floor(55*s)},${Math.floor(45*s)},${Math.floor(30*s)})`;
      ctx.fillRect(x, armTop + armLen - height * 0.05, 1, height * 0.05);
      // SWORD (curved khanda) held in left hand
      if (relX > 0.08 && relX < 0.16) {
        const swordTop = attacking ? armTop - height * 0.15 : armTop + height * 0.1;
        const swordLen = height * 0.35;
        // Blade
        ctx.fillStyle = `rgb(${Math.floor(180*s)},${Math.floor(185*s)},${Math.floor(195*s)})`;
        ctx.fillRect(x, swordTop, 1, swordLen);
        // Edge highlight
        if (relX < 0.12) {
          ctx.fillStyle = `rgba(220,230,255,${0.4*s})`;
          ctx.fillRect(x, swordTop, 1, swordLen);
        }
        // Hilt/guard
        ctx.fillStyle = `rgb(${Math.floor(160*s)},${Math.floor(130*s)},${Math.floor(40*s)})`;
        ctx.fillRect(x, swordTop + swordLen, 1, height * 0.03);
      }
    }
    // Right arm
    if (relX > 0.75 && relX < 0.88) {
      const armTop = top + height * 0.27;
      const armLen = height * 0.30;
      const r = Math.floor((150 + hf * 105) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(30*s)},${Math.floor(25*s)})`;
      ctx.fillRect(x, armTop, 1, armLen);
      ctx.fillStyle = `rgb(${Math.floor(55*s)},${Math.floor(45*s)},${Math.floor(30*s)})`;
      ctx.fillRect(x, armTop + armLen - height * 0.05, 1, height * 0.05);
      // Fist/claw
      ctx.fillStyle = `rgb(${Math.floor(120*s)},${Math.floor(25*s)},${Math.floor(18*s)})`;
      ctx.fillRect(x, armTop + armLen, 1, height * 0.05);
    }

    // --- SHOULDERS (armored pauldrons) ---
    if ((relX > 0.15 && relX < 0.32) || (relX > 0.68 && relX < 0.85)) {
      const shY = top + height * 0.22;
      ctx.fillStyle = `rgb(${Math.floor(60*s)},${Math.floor(50*s)},${Math.floor(35*s)})`;
      ctx.fillRect(x, shY, 1, height * 0.06);
      // Pauldron highlight
      ctx.fillStyle = `rgba(180,150,80,${0.2*s})`;
      ctx.fillRect(x, shY, 1, height * 0.02);
    }

    // --- NECK ---
    if (relX > 0.40 && relX < 0.60) {
      ctx.fillStyle = `rgb(${Math.floor((145+hf*110)*s)},${Math.floor(30*s)},${Math.floor(25*s)})`;
      ctx.fillRect(x, top + height * 0.18, 1, height * 0.06);
    }

    // --- HEAD ---
    if (relX > 0.32 && relX < 0.68) {
      const headTop = top + height * 0.06;
      const headBot = top + height * 0.19;
      const headDist = Math.abs(relX - 0.5) / 0.18;
      if (headDist < 1) {
        const r = Math.floor((185 + hf * 70) * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(50*s)},${Math.floor(40*s)})`;
        ctx.fillRect(x, headTop, 1, headBot - headTop);
      }
      // Jaw line (stronger/wider at bottom of head)
      if (relX > 0.34 && relX < 0.66 && headDist < 1) {
        ctx.fillStyle = `rgb(${Math.floor((170+hf*85)*s)},${Math.floor(42*s)},${Math.floor(35*s)})`;
        ctx.fillRect(x, top + height * 0.16, 1, height * 0.03);
      }
    }

    // --- HORNS (curved, ridged) ---
    if ((relX > 0.22 && relX < 0.34) || (relX > 0.66 && relX < 0.78)) {
      const hornBase = top + height * 0.08;
      const hornTip = top;
      // Thicker at base
      const hornRelX = relX < 0.5 ? (relX - 0.22) / 0.12 : (0.78 - relX) / 0.12;
      if (hornRelX > 0.2 && hornRelX < 0.8) {
        ctx.fillStyle = `rgb(${Math.floor(70*s)},${Math.floor(55*s)},${Math.floor(30*s)})`;
        ctx.fillRect(x, hornTip, 1, hornBase - hornTip);
        // Horn ridges
        ctx.fillStyle = `rgb(${Math.floor(90*s)},${Math.floor(75*s)},${Math.floor(45*s)})`;
        ctx.fillRect(x, hornTip + height * 0.02, 1, height * 0.01);
        ctx.fillRect(x, hornTip + height * 0.05, 1, height * 0.01);
        // Glowing tip
        ctx.fillStyle = `rgba(255,120,40,${0.5*s})`;
        ctx.fillRect(x, hornTip, 1, height * 0.015);
      }
    }

    // --- EYES (glowing orange, menacing slits) ---
    if ((relX > 0.37 && relX < 0.44) || (relX > 0.56 && relX < 0.63)) {
      const eyeY = top + height * 0.10;
      const eyeH = height * 0.03;
      ctx.fillStyle = `rgba(255,200,0,${0.4*s})`;
      ctx.fillRect(x, eyeY - height * 0.01, 1, eyeH + height * 0.02);
      ctx.fillStyle = `rgb(255,${Math.floor(180*s)},0)`;
      ctx.fillRect(x, eyeY, 1, eyeH);
      if ((relX > 0.39 && relX < 0.42) || (relX > 0.58 && relX < 0.61)) {
        ctx.fillStyle = `rgb(${Math.floor(200*s)},0,0)`;
        ctx.fillRect(x, eyeY + height * 0.005, 1, eyeH * 0.6);
      }
    }

    // --- MOUTH / FANGS ---
    if (relX > 0.40 && relX < 0.60) {
      const mouthY = top + height * 0.14;
      ctx.fillStyle = `rgb(${Math.floor(40*s)},0,0)`;
      ctx.fillRect(x, mouthY, 1, height * 0.025);
      if ((relX > 0.42 && relX < 0.46) || (relX > 0.54 && relX < 0.58)) {
        ctx.fillStyle = `rgb(${Math.floor(230*s)},${Math.floor(220*s)},${Math.floor(200*s)})`;
        ctx.fillRect(x, mouthY + height * 0.015, 1, height * 0.02);
      }
    }
  }

  drawRakshasaColumn(ctx, x, top, height, relX, shade, sprite) {
    // Rakshasa - massive hulking purple-black demon with three eyes, heavy armor, war mace, thick legs
    const s = shade;
    const hf = sprite.hurt ? 0.7 : 0;
    const attacking = sprite.attackAnim > 0;

    // --- FEET (armored boots) ---
    if (relX > 0.20 && relX < 0.36) {
      ctx.fillStyle = `rgb(${Math.floor(40*s)},${Math.floor(35*s)},${Math.floor(45*s)})`;
      ctx.fillRect(x, top + height * 0.92, 1, height * 0.08);
    }
    if (relX > 0.60 && relX < 0.76) {
      ctx.fillStyle = `rgb(${Math.floor(40*s)},${Math.floor(35*s)},${Math.floor(45*s)})`;
      ctx.fillRect(x, top + height * 0.92, 1, height * 0.08);
    }

    // --- LOWER LEGS (thick, armored) ---
    if (relX > 0.22 && relX < 0.38) {
      const legTop = top + height * 0.76;
      const r = Math.floor((75 + hf * 130) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(38*s)},${Math.floor(60*s)})`;
      ctx.fillRect(x, legTop, 1, height * 0.16);
      // Greaves (armor)
      if (relX > 0.25 && relX < 0.35) {
        ctx.fillStyle = `rgb(${Math.floor(45*s)},${Math.floor(42*s)},${Math.floor(52*s)})`;
        ctx.fillRect(x, legTop + height * 0.03, 1, height * 0.10);
        ctx.fillStyle = `rgba(130,120,150,${0.2*s})`;
        ctx.fillRect(x, legTop + height * 0.06, 1, height * 0.02);
      }
    }
    if (relX > 0.58 && relX < 0.74) {
      const legTop = top + height * 0.76;
      const r = Math.floor((75 + hf * 130) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(38*s)},${Math.floor(60*s)})`;
      ctx.fillRect(x, legTop, 1, height * 0.16);
      if (relX > 0.61 && relX < 0.71) {
        ctx.fillStyle = `rgb(${Math.floor(45*s)},${Math.floor(42*s)},${Math.floor(52*s)})`;
        ctx.fillRect(x, legTop + height * 0.03, 1, height * 0.10);
      }
    }

    // --- KNEE GUARDS ---
    if (relX > 0.20 && relX < 0.40) {
      ctx.fillStyle = `rgb(${Math.floor(50*s)},${Math.floor(48*s)},${Math.floor(58*s)})`;
      ctx.fillRect(x, top + height * 0.73, 1, height * 0.04);
      ctx.fillStyle = `rgba(160,150,180,${0.15*s})`;
      ctx.fillRect(x, top + height * 0.74, 1, height * 0.01);
    }
    if (relX > 0.56 && relX < 0.76) {
      ctx.fillStyle = `rgb(${Math.floor(50*s)},${Math.floor(48*s)},${Math.floor(58*s)})`;
      ctx.fillRect(x, top + height * 0.73, 1, height * 0.04);
    }

    // --- UPPER LEGS / THIGHS ---
    if (relX > 0.22 && relX < 0.42) {
      const r = Math.floor((85 + hf * 120) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(42*s)},${Math.floor(68*s)})`;
      ctx.fillRect(x, top + height * 0.58, 1, height * 0.16);
    }
    if (relX > 0.55 && relX < 0.75) {
      const r = Math.floor((85 + hf * 120) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(42*s)},${Math.floor(68*s)})`;
      ctx.fillRect(x, top + height * 0.58, 1, height * 0.16);
    }

    // --- ARMORED SKIRT / WAIST ---
    if (relX > 0.18 && relX < 0.78) {
      ctx.fillStyle = `rgb(${Math.floor(42*s)},${Math.floor(38*s)},${Math.floor(50*s)})`;
      ctx.fillRect(x, top + height * 0.54, 1, height * 0.06);
      // Metal studs
      const studX = Math.floor(relX * 12) % 2;
      if (studX === 0) {
        ctx.fillStyle = `rgba(150,140,170,${0.25*s})`;
        ctx.fillRect(x, top + height * 0.555, 1, height * 0.015);
      }
    }

    // --- MASSIVE TORSO with armor plates ---
    if (relX > 0.15 && relX < 0.85) {
      const distC = Math.abs(relX - 0.5);
      if (distC < 0.35) {
        const r = Math.floor((88 + hf * 115) * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(44*s)},${Math.floor(72*s)})`;
        ctx.fillRect(x, top + height * 0.22, 1, height * 0.33);
      }
    }

    // Chest armor plate
    if (relX > 0.24 && relX < 0.76) {
      const plateTop = top + height * 0.25;
      ctx.fillStyle = `rgb(${Math.floor(42*s)},${Math.floor(38*s)},${Math.floor(52*s)})`;
      ctx.fillRect(x, plateTop, 1, height * 0.18);
      // Armor rivets
      if (relX > 0.34 && relX < 0.66) {
        ctx.fillStyle = `rgba(170,155,195,${0.15*s})`;
        ctx.fillRect(x, plateTop + height * 0.04, 1, height * 0.015);
        ctx.fillRect(x, plateTop + height * 0.10, 1, height * 0.015);
      }
      // Skull/demon emblem
      if (relX > 0.42 && relX < 0.58) {
        ctx.fillStyle = `rgba(200,170,220,${0.2*s})`;
        ctx.fillRect(x, plateTop + height * 0.06, 1, height * 0.05);
      }
    }

    // --- LEFT ARM with WAR MACE ---
    if (relX > 0.02 && relX < 0.18) {
      const armTop = top + height * 0.24;
      const armLen = height * 0.35;
      const r = Math.floor((82 + hf * 125) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(40*s)},${Math.floor(65*s)})`;
      ctx.fillRect(x, armTop, 1, armLen);
      // Spiked bracer
      ctx.fillStyle = `rgb(${Math.floor(48*s)},${Math.floor(48*s)},${Math.floor(55*s)})`;
      ctx.fillRect(x, armTop + height * 0.12, 1, height * 0.07);
      // WAR MACE
      if (relX > 0.02 && relX < 0.12) {
        const maceTop = attacking ? armTop - height * 0.1 : armTop + armLen - height * 0.05;
        // Shaft
        ctx.fillStyle = `rgb(${Math.floor(60*s)},${Math.floor(50*s)},${Math.floor(35*s)})`;
        ctx.fillRect(x, maceTop, 1, height * 0.30);
        // Mace head (spiked ball)
        if (relX > 0.03 && relX < 0.11) {
          ctx.fillStyle = `rgb(${Math.floor(55*s)},${Math.floor(55*s)},${Math.floor(60*s)})`;
          ctx.fillRect(x, maceTop - height * 0.06, 1, height * 0.08);
          // Spikes
          ctx.fillStyle = `rgb(${Math.floor(120*s)},${Math.floor(115*s)},${Math.floor(130*s)})`;
          ctx.fillRect(x, maceTop - height * 0.07, 1, height * 0.02);
          ctx.fillRect(x, maceTop + height * 0.01, 1, height * 0.02);
        }
      }
    }
    // Right arm (fist)
    if (relX > 0.82 && relX < 0.98) {
      const armTop = top + height * 0.24;
      const armLen = height * 0.35;
      const r = Math.floor((82 + hf * 125) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(40*s)},${Math.floor(65*s)})`;
      ctx.fillRect(x, armTop, 1, armLen);
      ctx.fillStyle = `rgb(${Math.floor(55*s)},${Math.floor(28*s)},${Math.floor(42*s)})`;
      ctx.fillRect(x, armTop + armLen, 1, height * 0.06);
    }

    // --- SHOULDERS (massive spiked pauldrons) ---
    if ((relX > 0.10 && relX < 0.30) || (relX > 0.70 && relX < 0.90)) {
      const shY = top + height * 0.18;
      ctx.fillStyle = `rgb(${Math.floor(48*s)},${Math.floor(45*s)},${Math.floor(55*s)})`;
      ctx.fillRect(x, shY, 1, height * 0.07);
      // Spike on top
      if ((relX > 0.14 && relX < 0.18) || (relX > 0.82 && relX < 0.86)) {
        ctx.fillStyle = `rgb(${Math.floor(70*s)},${Math.floor(65*s)},${Math.floor(75*s)})`;
        ctx.fillRect(x, shY - height * 0.03, 1, height * 0.04);
      }
    }

    // --- NECK (thick) ---
    if (relX > 0.35 && relX < 0.65) {
      ctx.fillStyle = `rgb(${Math.floor((95+hf*110)*s)},${Math.floor(38*s)},${Math.floor(62*s)})`;
      ctx.fillRect(x, top + height * 0.17, 1, height * 0.06);
    }

    // --- HEAD (wide, brutish) ---
    if (relX > 0.28 && relX < 0.72) {
      const headTop = top + height * 0.07;
      const headBot = top + height * 0.18;
      const r = Math.floor((105 + hf * 95) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(38*s)},${Math.floor(65*s)})`;
      ctx.fillRect(x, headTop, 1, headBot - headTop);
      // Heavy brow ridge
      ctx.fillStyle = `rgb(${Math.floor(65*s)},${Math.floor(22*s)},${Math.floor(45*s)})`;
      ctx.fillRect(x, headTop + height * 0.05, 1, height * 0.02);
    }

    // --- HUGE CURVED HORNS ---
    if ((relX > 0.12 && relX < 0.30) || (relX > 0.70 && relX < 0.88)) {
      const hornBot = top + height * 0.10;
      const hornH = height * 0.10;
      ctx.fillStyle = `rgb(${Math.floor(65*s)},${Math.floor(55*s)},${Math.floor(38*s)})`;
      ctx.fillRect(x, hornBot - hornH, 1, hornH);
      ctx.fillStyle = `rgb(${Math.floor(85*s)},${Math.floor(75*s)},${Math.floor(50*s)})`;
      ctx.fillRect(x, hornBot - hornH + height * 0.025, 1, height * 0.012);
      if ((relX > 0.12 && relX < 0.20) || (relX > 0.80 && relX < 0.88)) {
        ctx.fillStyle = `rgb(${Math.floor(110*s)},${Math.floor(100*s)},${Math.floor(72*s)})`;
        ctx.fillRect(x, top, 1, height * 0.035);
      }
    }

    // --- THREE EYES ---
    if (relX > 0.33 && relX < 0.41) {
      ctx.fillStyle = `rgba(255,50,0,${0.35*s})`;
      ctx.fillRect(x, top + height * 0.11, 1, height * 0.04);
      ctx.fillStyle = `rgb(255,${Math.floor(30*s)},0)`;
      ctx.fillRect(x, top + height * 0.12, 1, height * 0.025);
    }
    if (relX > 0.59 && relX < 0.67) {
      ctx.fillStyle = `rgba(255,50,0,${0.35*s})`;
      ctx.fillRect(x, top + height * 0.11, 1, height * 0.04);
      ctx.fillStyle = `rgb(255,${Math.floor(30*s)},0)`;
      ctx.fillRect(x, top + height * 0.12, 1, height * 0.025);
    }
    // Third eye (forehead)
    if (relX > 0.45 && relX < 0.55) {
      ctx.fillStyle = `rgba(255,80,0,${0.45*s})`;
      ctx.fillRect(x, top + height * 0.08, 1, height * 0.04);
      ctx.fillStyle = `rgb(255,${Math.floor(100*s)},0)`;
      ctx.fillRect(x, top + height * 0.088, 1, height * 0.025);
    }

    // --- MOUTH with TUSKS ---
    if (relX > 0.35 && relX < 0.65) {
      ctx.fillStyle = `rgb(${Math.floor(28*s)},0,${Math.floor(10*s)})`;
      ctx.fillRect(x, top + height * 0.155, 1, height * 0.03);
      if ((relX > 0.36 && relX < 0.41) || (relX > 0.59 && relX < 0.64)) {
        ctx.fillStyle = `rgb(${Math.floor(215*s)},${Math.floor(205*s)},${Math.floor(175*s)})`;
        ctx.fillRect(x, top + height * 0.14, 1, height * 0.035);
      }
    }
  }

  drawNagaColumn(ctx, x, top, height, relX, shade, sprite) {
    // Naga - cobra serpent with expanded hood, visible scales, hypnotic eyes, and energy staff
    const s = shade;
    const hf = sprite.hurt ? 0.6 : 0;
    const attacking = sprite.attackAnim > 0;

    // --- TAIL COILS at base (multiple overlapping coils for ground contact) ---
    // Bottom coil
    if (relX > 0.20 && relX < 0.80) {
      const coilDist = Math.abs(relX - 0.5) / 0.30;
      if (coilDist < 1) {
        const intensity = (1 - coilDist * coilDist);
        const r = Math.floor((18 + hf * 100) * s * intensity);
        const g = Math.floor(80 * s * intensity);
        const b = Math.floor(50 * s * intensity);
        ctx.fillStyle = `rgb(${Math.min(255,Math.max(0,r))},${Math.max(0,g)},${Math.max(0,b)})`;
        ctx.fillRect(x, top + height * 0.88, 1, height * 0.12);
        // Scale pattern on coil
        if (Math.floor(relX * 16) % 2 === 0) {
          ctx.fillStyle = `rgba(50,120,80,${0.25*s*intensity})`;
          ctx.fillRect(x, top + height * 0.90, 1, height * 0.04);
        }
      }
    }
    // Middle coil (slightly offset)
    if (relX > 0.25 && relX < 0.75) {
      const coilDist = Math.abs(relX - 0.48) / 0.25;
      if (coilDist < 1) {
        const intensity = (1 - coilDist * coilDist);
        const r = Math.floor((22 + hf * 110) * s * intensity);
        const g = Math.floor(95 * s * intensity);
        const b = Math.floor(58 * s * intensity);
        ctx.fillStyle = `rgb(${Math.min(255,Math.max(0,r))},${Math.max(0,g)},${Math.max(0,b)})`;
        ctx.fillRect(x, top + height * 0.82, 1, height * 0.08);
      }
    }

    // --- SERPENTINE BODY (S-curve upward) ---
    const bodyCenter = 0.5;
    const bodyHalfW = 0.10;
    if (relX > (bodyCenter - bodyHalfW - 0.03) && relX < (bodyCenter + bodyHalfW + 0.03)) {
      const bodyTop = top + height * 0.35;
      const bodyBot = top + height * 0.84;
      const bDist = Math.abs(relX - bodyCenter) / (bodyHalfW + 0.03);
      if (bDist < 1) {
        const r = Math.floor((25 + hf * 130) * s);
        const g = Math.floor(105 * s);
        const b = Math.floor(65 * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
        ctx.fillRect(x, bodyTop, 1, bodyBot - bodyTop);

        // Detailed scale pattern (alternating diamond-shapes)
        const scaleCol = Math.floor(relX * 24);
        const scalePhase = scaleCol % 2;
        for (let sy = bodyTop; sy < bodyBot; sy += height * 0.06) {
          const scaleOff = scalePhase * height * 0.03;
          ctx.fillStyle = `rgba(50,140,90,${0.25*s})`;
          ctx.fillRect(x, sy + scaleOff, 1, height * 0.025);
        }

        // Belly (lighter center stripe with cross-hatched belly scales)
        if (Math.abs(relX - 0.5) < 0.04) {
          ctx.fillStyle = `rgba(130,210,150,${0.2*s})`;
          ctx.fillRect(x, bodyTop, 1, bodyBot - bodyTop);
          // Belly scale lines
          for (let sy = bodyTop; sy < bodyBot; sy += height * 0.04) {
            ctx.fillStyle = `rgba(80,160,100,${0.15*s})`;
            ctx.fillRect(x, sy, 1, height * 0.01);
          }
        }
      }
    }

    // --- ARMS (humanoid upper body - Naga warriors have arms) ---
    // Left arm holding energy staff
    if (relX > 0.08 && relX < 0.22) {
      const armTop = top + height * 0.22;
      const armLen = height * 0.25;
      const r = Math.floor((28 + hf * 120) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(90*s)},${Math.floor(55*s)})`;
      ctx.fillRect(x, armTop, 1, armLen);
      // Scale pattern on arm
      if (Math.floor(relX * 20) % 2 === 0) {
        ctx.fillStyle = `rgba(45,130,85,${0.25*s})`;
        ctx.fillRect(x, armTop + height * 0.05, 1, height * 0.1);
      }
      // ENERGY STAFF
      if (relX > 0.08 && relX < 0.14) {
        const staffTop = top - height * 0.05;
        const staffLen = height * 0.55;
        // Staff shaft (dark wood/bone)
        ctx.fillStyle = `rgb(${Math.floor(50*s)},${Math.floor(40*s)},${Math.floor(25*s)})`;
        ctx.fillRect(x, staffTop, 1, staffLen);
        // Glowing orb at top of staff
        ctx.fillStyle = `rgba(100,255,120,${0.6*s})`;
        ctx.fillRect(x, staffTop - height * 0.03, 1, height * 0.05);
        // Orb glow
        ctx.fillStyle = `rgba(150,255,170,${0.3*s})`;
        ctx.fillRect(x, staffTop - height * 0.05, 1, height * 0.04);
      }
    }
    // Right arm
    if (relX > 0.78 && relX < 0.90) {
      const armTop = top + height * 0.22;
      const armLen = height * 0.25;
      const r = Math.floor((28 + hf * 120) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(90*s)},${Math.floor(55*s)})`;
      ctx.fillRect(x, armTop, 1, armLen);
      // Clawed hand
      ctx.fillStyle = `rgb(${Math.floor(20*s)},${Math.floor(70*s)},${Math.floor(40*s)})`;
      ctx.fillRect(x, armTop + armLen, 1, height * 0.04);
    }

    // --- EXPANDED COBRA HOOD ---
    if (relX > 0.10 && relX < 0.90) {
      const hoodTop = top + height * 0.04;
      const hoodBot = top + height * 0.35;
      const hoodDist = Math.abs(relX - 0.5) / 0.40;
      const hoodCurve = 1 - hoodDist * hoodDist;
      if (hoodCurve > 0) {
        const hoodH = (hoodBot - hoodTop) * hoodCurve;
        const r = Math.floor((32 + hf * 100) * s);
        const g = Math.floor(128 * s);
        const b = Math.floor(88 * s);
        ctx.fillStyle = `rgb(${Math.min(255,r)},${g},${b})`;
        ctx.fillRect(x, hoodBot - hoodH, 1, hoodH);

        // Hood inner spectacle pattern
        if (relX > 0.22 && relX < 0.78) {
          const innerDist = Math.abs(relX - 0.5) / 0.28;
          if (innerDist < 1) {
            ctx.fillStyle = `rgba(70,170,110,${(1-innerDist)*0.3*s})`;
            ctx.fillRect(x, hoodBot - hoodH * 0.7, 1, hoodH * 0.4);
          }
        }

        // Hood edge (golden trim with scale detail)
        if (hoodDist > 0.65 && hoodDist < 1) {
          ctx.fillStyle = `rgba(190,170,55,${0.35*s})`;
          ctx.fillRect(x, hoodBot - hoodH, 1, hoodH * 0.5);
          // Edge scales
          const edgeScale = Math.floor(relX * 20) % 2;
          if (edgeScale === 0) {
            ctx.fillStyle = `rgba(160,145,45,${0.2*s})`;
            ctx.fillRect(x, hoodBot - hoodH * 0.3, 1, hoodH * 0.2);
          }
        }
      }
    }

    // --- FACE/HEAD ---
    if (relX > 0.34 && relX < 0.66) {
      const faceTop = top + height * 0.11;
      const faceBot = top + height * 0.26;
      const r = Math.floor((28 + hf * 100) * s);
      ctx.fillStyle = `rgb(${Math.min(255,r)},${Math.floor(95*s)},${Math.floor(60*s)})`;
      ctx.fillRect(x, faceTop, 1, faceBot - faceTop);

      // Snout
      if (relX > 0.44 && relX < 0.56) {
        ctx.fillStyle = `rgb(${Math.floor(22*s)},${Math.floor(75*s)},${Math.floor(45*s)})`;
        ctx.fillRect(x, faceBot - height * 0.03, 1, height * 0.04);
        if ((relX > 0.46 && relX < 0.48) || (relX > 0.52 && relX < 0.54)) {
          ctx.fillStyle = `rgb(${Math.floor(12*s)},${Math.floor(45*s)},${Math.floor(28*s)})`;
          ctx.fillRect(x, faceBot - height * 0.01, 1, height * 0.02);
        }
      }
    }

    // --- EYES (hypnotic, glowing yellow-green with slit pupils) ---
    if ((relX > 0.36 && relX < 0.44) || (relX > 0.56 && relX < 0.64)) {
      const eyeY = top + height * 0.14;
      const eyeH = height * 0.04;
      ctx.fillStyle = `rgba(200,255,50,${0.35*s})`;
      ctx.fillRect(x, eyeY - height * 0.01, 1, eyeH + height * 0.02);
      ctx.fillStyle = `rgb(${Math.floor(220*s)},${Math.floor(255*s)},${Math.floor(30*s)})`;
      ctx.fillRect(x, eyeY, 1, eyeH);
      if ((relX > 0.39 && relX < 0.41) || (relX > 0.59 && relX < 0.61)) {
        ctx.fillStyle = 'rgb(0,0,0)';
        ctx.fillRect(x, eyeY + height * 0.005, 1, eyeH * 0.8);
      }
    }

    // --- FORKED TONGUE ---
    if (relX > 0.47 && relX < 0.53) {
      const tongueY = top + height * 0.26;
      ctx.fillStyle = `rgb(${Math.floor(200*s)},${Math.floor(40*s)},${Math.floor(50*s)})`;
      ctx.fillRect(x, tongueY, 1, height * 0.04);
      // Fork
      if (relX < 0.49 || relX > 0.51) {
        ctx.fillRect(x, tongueY + height * 0.035, 1, height * 0.02);
      }
    }

    // --- CROWN JEWEL (Nagamani - glowing gem) ---
    if (relX > 0.45 && relX < 0.55) {
      const gemY = top + height * 0.08;
      ctx.fillStyle = `rgba(255,50,50,${0.55*s})`;
      ctx.fillRect(x, gemY, 1, height * 0.03);
      ctx.fillStyle = `rgba(255,150,150,${0.75*s})`;
      ctx.fillRect(x, gemY + height * 0.008, 1, height * 0.014);
      // Gem glow aura
      ctx.fillStyle = `rgba(255,80,80,${0.2*s})`;
      ctx.fillRect(x, gemY - height * 0.01, 1, height * 0.05);
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
