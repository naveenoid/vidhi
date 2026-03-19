// Vidhi - Main Game Logic
import { RaycastEngine, TILE_SIZE, FOV, HALF_FOV } from './engine.js';
import { loadLevel } from './maps.js';
import { SoundManager } from './sound.js';

const MOVE_SPEED = 3;
const ROT_SPEED = 0.04;
const MOUSE_SENSITIVITY = 0.002;
const PLAYER_RADIUS = 10;

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.engine = new RaycastEngine(canvas);
    this.sound = new SoundManager();

    this.player = {
      x: 0, y: 0, angle: 0,
      health: 100, armor: 0,
      vx: 0, vy: 0,
    };

    this.gameState = {
      currentWeapon: 'trishul',
      weapons: ['trishul'],
      ammo: {
        trishul: Infinity,
        agni: 0,
        chakra: 0,
        brahmastra: 0,
      },
      fireAnim: 0,
      walkCycle: 0,
      time: 0,
      level: 1,
      levelName: '',
      kills: 0,
      totalEnemies: 0,
      keys: { red: false, blue: false, gold: false },
      paused: false,
      gameOver: false,
      victory: false,
      showMessage: null,
      messageTimer: 0,
      screenFlash: 0,
      screenFlashColor: 'red',
      damageDir: 0,
    };

    this.sprites = [];
    this.map = null;
    this.levelExit = null;

    this.keys = {};
    this.mouse = { dx: 0, locked: false };
    this.shooting = false;
    this.fireCooldown = 0;
    this.projectiles = [];
    this.enemyProjectiles = [];

    this.lastTime = 0;
    this.running = false;

    this.setupInput();
  }

  setupInput() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      // Weapon switching
      if (e.code === 'Digit1') this.switchWeapon('trishul');
      if (e.code === 'Digit2') this.switchWeapon('agni');
      if (e.code === 'Digit3') this.switchWeapon('chakra');
      if (e.code === 'Digit4') this.switchWeapon('brahmastra');
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'Escape') {
        if (this.gameState.gameOver || this.gameState.victory) {
          this.restart();
        } else {
          this.gameState.paused = !this.gameState.paused;
        }
      }
      if (e.code === 'Enter' && (this.gameState.gameOver || this.gameState.victory)) {
        this.restart();
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.canvas.addEventListener('click', () => {
      if (!this.mouse.locked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.mouse.locked) {
        this.mouse.dx += e.movementX;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (this.mouse.locked && e.button === 0) {
        this.shooting = true;
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.shooting = false;
      }
    });
  }

  switchWeapon(weapon) {
    if (this.gameState.weapons.includes(weapon)) {
      this.gameState.currentWeapon = weapon;
      this.sound.play('switch');
    }
  }

  interact() {
    // Check for nearby doors or interactive objects
    const checkDist = TILE_SIZE * 1.5;
    const checkX = this.player.x + Math.cos(this.player.angle) * checkDist;
    const checkY = this.player.y + Math.sin(this.player.angle) * checkDist;
    const mapX = Math.floor(checkX / TILE_SIZE);
    const mapY = Math.floor(checkY / TILE_SIZE);

    if (this.map && this.map.getTile(mapX, mapY) === 5) {
      // Door
      this.map.setTile(mapX, mapY, 0);
      this.sound.play('door');
      this.showMessage('KATHAVU THIRANDHADHU', 2);
    }
  }

  showMessage(text, duration) {
    this.gameState.showMessage = text;
    this.gameState.messageTimer = duration;
  }

  start() {
    this.loadLevel(0);
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop(this.lastTime);
  }

  restart() {
    this.player.health = 100;
    this.player.armor = 0;
    this.gameState.currentWeapon = 'trishul';
    this.gameState.weapons = ['trishul'];
    this.gameState.ammo = { trishul: Infinity, agni: 0, chakra: 0, brahmastra: 0 };
    this.gameState.kills = 0;
    this.gameState.keys = { red: false, blue: false, gold: false };
    this.gameState.gameOver = false;
    this.gameState.victory = false;
    this.gameState.paused = false;
    this.gameState.level = 1;
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.loadLevel(0);
  }

  loadLevel(index) {
    const level = loadLevel(index);
    if (!level) {
      this.gameState.victory = true;
      return;
    }

    this.map = level.map;
    this.sprites = level.sprites;
    this.player.x = level.playerStart.x;
    this.player.y = level.playerStart.y;
    this.player.angle = level.playerStart.angle;
    this.gameState.levelName = level.levelName;
    this.gameState.level = index + 1;
    this.gameState.totalEnemies = level.totalEnemies;
    this.gameState.kills = 0;
    this.levelExit = level.exit;
    this.projectiles = [];
    this.enemyProjectiles = [];

    // Give weapons on later levels
    if (index >= 1 && !this.gameState.weapons.includes('agni')) {
      this.gameState.weapons.push('agni');
      this.gameState.ammo.agni = 20;
      this.showMessage('AGNI KIDAITHHADHU!', 3);
    }
    if (index >= 2 && !this.gameState.weapons.includes('chakra')) {
      this.gameState.weapons.push('chakra');
      this.gameState.ammo.chakra = 30;
      this.showMessage('SUDARSHANA CHAKRA KIDAITHHADHU!', 3);
    }

    this.sound.play('levelStart');
  }

  gameLoop(timestamp) {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    if (!this.gameState.paused && !this.gameState.gameOver && !this.gameState.victory) {
      this.update(dt);
    }

    this.render();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    this.gameState.time += dt;

    // Mouse rotation
    this.player.angle += this.mouse.dx * MOUSE_SENSITIVITY;
    this.mouse.dx = 0;

    // Keyboard rotation
    if (this.keys['ArrowLeft'] || this.keys['KeyQ']) {
      this.player.angle -= ROT_SPEED;
    }
    if (this.keys['ArrowRight'] || this.keys['KeyR']) {
      this.player.angle += ROT_SPEED;
    }

    // Movement
    let moveX = 0, moveY = 0;
    const speed = MOVE_SPEED * TILE_SIZE * dt;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      moveX += Math.cos(this.player.angle) * speed;
      moveY += Math.sin(this.player.angle) * speed;
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      moveX -= Math.cos(this.player.angle) * speed;
      moveY -= Math.sin(this.player.angle) * speed;
    }
    if (this.keys['KeyA']) {
      moveX += Math.cos(this.player.angle - Math.PI / 2) * speed;
      moveY += Math.sin(this.player.angle - Math.PI / 2) * speed;
    }
    if (this.keys['KeyD']) {
      moveX += Math.cos(this.player.angle + Math.PI / 2) * speed;
      moveY += Math.sin(this.player.angle + Math.PI / 2) * speed;
    }

    // Walk cycle for weapon bobbing
    if (moveX !== 0 || moveY !== 0) {
      this.gameState.walkCycle += dt * 8;
    }

    // Collision detection
    this.moveWithCollision(moveX, moveY);

    // Shooting
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.shooting && this.fireCooldown <= 0) {
      this.fire();
    }

    // Update fire animation
    if (this.gameState.fireAnim > 0) {
      this.gameState.fireAnim = Math.max(0, this.gameState.fireAnim - dt * 5);
    }

    // Update projectiles
    this.updateProjectiles(dt);

    // Update enemies
    this.updateEnemies(dt);

    // Check pickups
    this.checkPickups();

    // Check exit
    this.checkExit();

    // Update messages
    if (this.gameState.messageTimer > 0) {
      this.gameState.messageTimer -= dt;
      if (this.gameState.messageTimer <= 0) {
        this.gameState.showMessage = null;
      }
    }

    // Screen flash
    if (this.gameState.screenFlash > 0) {
      this.gameState.screenFlash = Math.max(0, this.gameState.screenFlash - dt * 3);
    }

    // Death check
    if (this.player.health <= 0) {
      this.player.health = 0;
      this.gameState.gameOver = true;
      this.sound.play('death');
    }
  }

  moveWithCollision(dx, dy) {
    const r = PLAYER_RADIUS;

    // Try X movement
    const newX = this.player.x + dx;
    if (!this.isWall(newX + r, this.player.y) &&
        !this.isWall(newX - r, this.player.y) &&
        !this.isWall(newX + r, this.player.y + r) &&
        !this.isWall(newX - r, this.player.y - r) &&
        !this.isWall(newX + r, this.player.y - r) &&
        !this.isWall(newX - r, this.player.y + r)) {
      this.player.x = newX;
    }

    // Try Y movement
    const newY = this.player.y + dy;
    if (!this.isWall(this.player.x, newY + r) &&
        !this.isWall(this.player.x, newY - r) &&
        !this.isWall(this.player.x + r, newY + r) &&
        !this.isWall(this.player.x - r, newY - r) &&
        !this.isWall(this.player.x + r, newY - r) &&
        !this.isWall(this.player.x - r, newY + r)) {
      this.player.y = newY;
    }
  }

  isWall(x, y) {
    const mapX = Math.floor(x / TILE_SIZE);
    const mapY = Math.floor(y / TILE_SIZE);
    const tile = this.map.getTile(mapX, mapY);
    return tile > 0;
  }

  fire() {
    const weapon = this.gameState.currentWeapon;
    const ammo = this.gameState.ammo[weapon];

    if (ammo <= 0) {
      this.sound.play('empty');
      this.fireCooldown = 0.3;
      return;
    }

    if (ammo !== Infinity) {
      this.gameState.ammo[weapon]--;
    }

    this.gameState.fireAnim = 1;
    this.sound.play('fire_' + weapon);

    const weaponDefs = {
      trishul: { damage: 15, range: 3, spread: 0, cooldown: 0.4, hitscan: true },
      agni: { damage: 40, range: 6, spread: 0.1, cooldown: 0.8, hitscan: true, pellets: 5 },
      chakra: { damage: 30, range: 12, spread: 0, cooldown: 0.3, hitscan: false, speed: 10 },
      brahmastra: { damage: 100, range: 20, spread: 0, cooldown: 1.5, hitscan: false, speed: 6, explosive: true },
    };

    const def = weaponDefs[weapon];

    if (def.hitscan) {
      const pellets = def.pellets || 1;
      for (let p = 0; p < pellets; p++) {
        const spread = (Math.random() - 0.5) * (def.spread || 0) * 2;
        const angle = this.player.angle + spread;
        this.hitscanAttack(angle, def.damage / (def.pellets || 1), def.range);
      }
    } else {
      this.projectiles.push({
        x: this.player.x,
        y: this.player.y,
        angle: this.player.angle,
        speed: def.speed * TILE_SIZE,
        damage: def.damage,
        range: def.range * TILE_SIZE,
        traveled: 0,
        explosive: def.explosive || false,
        type: weapon,
      });
    }

    this.fireCooldown = def.cooldown;
    this.gameState.screenFlash = 0.2;
    this.gameState.screenFlashColor = weapon === 'agni' ? 'orange' : weapon === 'brahmastra' ? 'purple' : 'yellow';
  }

  hitscanAttack(angle, damage, range) {
    const step = 2;
    const maxSteps = (range * TILE_SIZE) / step;

    for (let i = 0; i < maxSteps; i++) {
      const x = this.player.x + Math.cos(angle) * i * step;
      const y = this.player.y + Math.sin(angle) * i * step;

      // Check wall hit
      if (this.isWall(x, y)) break;

      // Check enemy hit
      for (const sprite of this.sprites) {
        if (!sprite.active || !sprite.health) continue;
        const dx = x - sprite.x;
        const dy = y - sprite.y;
        const hitRadius = sprite.boss ? 30 : 20;
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          this.damageEnemy(sprite, damage);
          return;
        }
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const moveAmount = proj.speed * dt;
      proj.x += Math.cos(proj.angle) * moveAmount;
      proj.y += Math.sin(proj.angle) * moveAmount;
      proj.traveled += moveAmount;

      // Check wall hit
      if (this.isWall(proj.x, proj.y)) {
        if (proj.explosive) {
          this.explode(proj.x, proj.y, proj.damage);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

      // Check enemy hit
      let hit = false;
      for (const sprite of this.sprites) {
        if (!sprite.active || !sprite.health) continue;
        const dx = proj.x - sprite.x;
        const dy = proj.y - sprite.y;
        const hitRadius = sprite.boss ? 35 : 25;
        if (dx * dx + dy * dy < hitRadius * hitRadius) {
          if (proj.explosive) {
            this.explode(proj.x, proj.y, proj.damage);
          } else {
            this.damageEnemy(sprite, proj.damage);
          }
          hit = true;
          break;
        }
      }

      if (hit || proj.traveled > proj.range) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  explode(x, y, damage) {
    const radius = TILE_SIZE * 3;
    this.sound.play('explode');
    this.gameState.screenFlash = 0.5;
    this.gameState.screenFlashColor = 'white';

    for (const sprite of this.sprites) {
      if (!sprite.active || !sprite.health) continue;
      const dx = x - sprite.x;
      const dy = y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        const falloff = 1 - dist / radius;
        this.damageEnemy(sprite, damage * falloff);
      }
    }

    // Self damage
    const pdx = x - this.player.x;
    const pdy = y - this.player.y;
    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
    if (pdist < radius) {
      const falloff = 1 - pdist / radius;
      this.takeDamage(damage * falloff * 0.5, Math.atan2(pdy, pdx));
    }
  }

  damageEnemy(sprite, damage) {
    sprite.health -= damage;
    sprite.hurt = true;
    sprite.hurtTimer = 0.15;
    sprite.state = 'chase';
    this.sound.play('hit');

    if (sprite.health <= 0) {
      sprite.active = false;
      sprite.health = 0;
      this.gameState.kills++;
      this.sound.play('enemyDeath');

      if (sprite.boss) {
        this.showMessage('MAHISHASURA VEEZHNDHAAN!', 5);
        // Drop brahmastra on boss kill
        if (!this.gameState.weapons.includes('brahmastra')) {
          this.gameState.weapons.push('brahmastra');
          this.gameState.ammo.brahmastra = 10;
          this.showMessage('BRAHMASTRA KIDAITHHADHU!', 5);
        }
      }
    }
  }

  takeDamage(damage, direction) {
    // Armor absorbs some damage
    if (this.player.armor > 0) {
      const absorbed = Math.min(this.player.armor, damage * 0.5);
      this.player.armor -= absorbed;
      damage -= absorbed;
    }

    this.player.health -= damage;
    this.gameState.screenFlash = 0.4;
    this.gameState.screenFlashColor = 'red';
    this.gameState.damageDir = direction;
    this.sound.play('hurt');
  }

  updateEnemies(dt) {
    // Initialize enemy projectiles array if needed
    if (!this.enemyProjectiles) this.enemyProjectiles = [];

    for (const sprite of this.sprites) {
      if (!sprite.active || !sprite.health) continue;

      // Update hurt flash
      if (sprite.hurtTimer > 0) {
        sprite.hurtTimer -= dt;
        if (sprite.hurtTimer <= 0) sprite.hurt = false;
      }

      // Attack cooldown
      if (sprite.attackCooldown > 0) {
        sprite.attackCooldown -= dt;
      }

      // Attack animation
      if (sprite.attackAnim > 0) {
        sprite.attackAnim -= dt * 3;
        if (sprite.attackAnim < 0) sprite.attackAnim = 0;
      }

      // Walk animation
      if (!sprite.walkAnim) sprite.walkAnim = 0;

      const dx = this.player.x - sprite.x;
      const dy = this.player.y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const tileDist = dist / TILE_SIZE;

      // Alert range
      if (tileDist < sprite.alertRange || sprite.state === 'chase') {
        sprite.state = 'chase';

        // Ranged attack for naga (shoots energy bolts) and boss
        const isRanged = sprite.type === 'naga' || sprite.boss;
        const attackRange = isRanged ? Math.min(sprite.alertRange, 10) : sprite.attackRange;

        if (tileDist < attackRange) {
          if (sprite.attackCooldown <= 0) {
            sprite.attackAnim = 1;
            const angle = Math.atan2(dy, dx);

            if (isRanged && tileDist > 1.5) {
              // Shoot a visible projectile
              this.enemyProjectiles.push({
                x: sprite.x,
                y: sprite.y,
                angle: angle,
                speed: (sprite.boss ? 5 : 4) * TILE_SIZE,
                damage: sprite.damage * (sprite.boss ? 0.6 : 0.5),
                traveled: 0,
                maxRange: attackRange * TILE_SIZE,
                type: sprite.type === 'naga' ? 'venom' : 'fire',
                owner: sprite,
              });
              sprite.attackCooldown = sprite.boss ? 0.8 : 1.8;
              this.sound.play('enemyAttack');
            } else if (tileDist < sprite.attackRange) {
              // Melee attack (asura sword slash, rakshasa mace smash)
              this.takeDamage(sprite.damage, Math.atan2(-dy, -dx));
              sprite.attackCooldown = sprite.boss ? 1.0 : 1.5;
              this.sound.play('enemyAttack');
            } else {
              // Not in melee range and not ranged, just keep chasing
              sprite.attackAnim = 0;
            }
          }
        }

        if (tileDist > sprite.attackRange * 0.8) {
          // Move toward player
          const angle = Math.atan2(dy, dx);
          const moveSpeed = sprite.speed * TILE_SIZE * dt;
          const newX = sprite.x + Math.cos(angle) * moveSpeed;
          const newY = sprite.y + Math.sin(angle) * moveSpeed;

          // Simple collision check for enemies
          if (!this.isWall(newX, sprite.y)) sprite.x = newX;
          if (!this.isWall(sprite.x, newY)) sprite.y = newY;

          // Update walk animation
          sprite.walkAnim += dt * 6;
        }
      }
    }

    // Update enemy projectiles
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      const moveAmount = proj.speed * dt;
      proj.x += Math.cos(proj.angle) * moveAmount;
      proj.y += Math.sin(proj.angle) * moveAmount;
      proj.traveled += moveAmount;

      // Hit wall
      if (this.isWall(proj.x, proj.y)) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Hit player
      const pdx = proj.x - this.player.x;
      const pdy = proj.y - this.player.y;
      if (pdx * pdx + pdy * pdy < 20 * 20) {
        this.takeDamage(proj.damage, Math.atan2(-pdy, -pdx));
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      // Max range
      if (proj.traveled > proj.maxRange) {
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  checkPickups() {
    const pickupRadius = TILE_SIZE * 0.8;

    for (const sprite of this.sprites) {
      if (!sprite.active) continue;

      const dx = this.player.x - sprite.x;
      const dy = this.player.y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > pickupRadius) continue;

      switch (sprite.type) {
        case 'health':
          if (this.player.health < 100) {
            this.player.health = Math.min(100, this.player.health + 25);
            sprite.active = false;
            this.sound.play('pickup');
            this.showMessage('UYIR +25', 1.5);
          }
          break;
        case 'ammo':
          this.gameState.ammo.agni = Math.min(50, this.gameState.ammo.agni + 10);
          this.gameState.ammo.chakra = Math.min(100, this.gameState.ammo.chakra + 15);
          this.gameState.ammo.brahmastra = Math.min(20, this.gameState.ammo.brahmastra + 3);
          sprite.active = false;
          this.sound.play('pickup');
          this.showMessage('AAYUDHAM KIDAITHHADHU', 1.5);

          // Give weapons if not owned
          if (!this.gameState.weapons.includes('agni')) {
            this.gameState.weapons.push('agni');
            this.showMessage('AGNI KIDAITHHADHU!', 2);
          }
          break;
        case 'key':
          if (sprite.color) {
            this.gameState.keys[sprite.color] = true;
            sprite.active = false;
            this.sound.play('key');
            const keyNames = { red: 'SEVI SAAVI', blue: 'NEELA SAAVI', gold: 'THANGA SAAVI' };
            this.showMessage(`${keyNames[sprite.color]} KIDAITHHADHU!`, 2);
          }
          break;
      }
    }
  }

  checkExit() {
    if (!this.levelExit) return;

    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);

    if (px === this.levelExit.x && py === this.levelExit.y) {
      // Check if all enemies are dead (optional, like doom you can skip)
      this.sound.play('levelComplete');
      this.showMessage('NILAI MUDINTHADHU!', 3);
      this.loadLevel(this.gameState.level); // level is 1-indexed, loadLevel is 0-indexed so this loads next
    }
  }

  renderProjectile3D(ctx, proj, w, h, colorMap, defaultColor, isEnemy) {
    const dx = proj.x - this.player.x;
    const dy = proj.y - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) - this.player.angle;
    let norm = angle;
    while (norm > Math.PI) norm -= 2 * Math.PI;
    while (norm < -Math.PI) norm += 2 * Math.PI;

    if (Math.abs(norm) < HALF_FOV && dist < TILE_SIZE * 15) {
      const screenX = (0.5 + norm / FOV) * w;
      const size = Math.max(4, (isEnemy ? 25 : 20) - dist / TILE_SIZE * 2);
      const color = colorMap[proj.type] || defaultColor;

      // Main projectile body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(screenX, h / 2, size, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(screenX, h / 2, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Outer glow
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(screenX, h / 2, size * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Trail effect (for enemy projectiles, draw a fading trail)
      if (isEnemy) {
        const trailAngle = proj.angle + Math.PI;
        for (let t = 1; t <= 3; t++) {
          const tx = screenX + Math.cos(norm) * t * size * 0.8;
          const trailSize = size * (1 - t * 0.25);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.15 / t;
          ctx.beginPath();
          ctx.arc(tx, h / 2, trailSize, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  render() {
    const ctx = this.engine.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Main 3D view
    this.engine.render(this.player, this.map, this.sprites, this.gameState);

    // Render player projectiles
    for (const proj of this.projectiles) {
      this.renderProjectile3D(ctx, proj, w, h, {
        chakra: '#ffdd00',
        brahmastra: '#cc00ff',
      }, '#ff8800');
    }

    // Render enemy projectiles (visible fireballs/venom bolts!)
    if (this.enemyProjectiles) {
      for (const proj of this.enemyProjectiles) {
        this.renderProjectile3D(ctx, proj, w, h, {
          venom: '#44ff66',
          fire: '#ff4400',
        }, '#ff6600', true);
      }
    }

    // Damage direction indicator (shows where enemy shots come from)
    if (this.enemyProjectiles && this.enemyProjectiles.length > 0) {
      for (const proj of this.enemyProjectiles) {
        const pdx = proj.x - this.player.x;
        const pdy = proj.y - this.player.y;
        const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
        if (pdist < TILE_SIZE * 4) {
          // Close projectile warning flash on edges of screen
          const projAngle = Math.atan2(pdy, pdx) - this.player.angle;
          let normA = projAngle;
          while (normA > Math.PI) normA -= 2 * Math.PI;
          while (normA < -Math.PI) normA += 2 * Math.PI;
          const warnAlpha = Math.max(0, 0.15 * (1 - pdist / (TILE_SIZE * 4)));
          const warnColor = proj.type === 'venom' ? `rgba(0,255,80,${warnAlpha})` : `rgba(255,80,0,${warnAlpha})`;
          if (normA < -0.3) {
            ctx.fillStyle = warnColor;
            ctx.fillRect(0, 0, 20, h);
          } else if (normA > 0.3) {
            ctx.fillStyle = warnColor;
            ctx.fillRect(w - 20, 0, 20, h);
          }
        }
      }
    }

    // Screen flash (damage/fire)
    if (this.gameState.screenFlash > 0) {
      const colors = {
        red: `rgba(255, 0, 0, ${this.gameState.screenFlash * 0.3})`,
        orange: `rgba(255, 120, 0, ${this.gameState.screenFlash * 0.2})`,
        yellow: `rgba(255, 255, 0, ${this.gameState.screenFlash * 0.15})`,
        purple: `rgba(180, 0, 255, ${this.gameState.screenFlash * 0.25})`,
        white: `rgba(255, 255, 255, ${this.gameState.screenFlash * 0.4})`,
      };
      ctx.fillStyle = colors[this.gameState.screenFlashColor] || colors.red;
      ctx.fillRect(0, 0, w, h);
    }

    // Message display
    if (this.gameState.showMessage) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(w / 2 - 200, h / 2 - 60, 400, 40);
      ctx.strokeStyle = '#c8a000';
      ctx.strokeRect(w / 2 - 200, h / 2 - 60, 400, 40);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.gameState.showMessage, w / 2, h / 2 - 35);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // Crosshair
    if (this.mouse.locked) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      const cx = w / 2, cy = h / 2 - 30;
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy); ctx.lineTo(cx - 4, cy);
      ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 10, cy);
      ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy - 4);
      ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 10);
      ctx.stroke();
    }

    // Boss health bar
    const boss = this.sprites.find(s => s.boss && s.active);
    if (boss) {
      const bw = 300;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(w / 2 - bw / 2 - 5, 15, bw + 10, 35);
      ctx.fillStyle = '#330000';
      ctx.fillRect(w / 2 - bw / 2, 20, bw, 20);
      ctx.fillStyle = '#cc0000';
      ctx.fillRect(w / 2 - bw / 2, 20, bw * (boss.health / boss.maxHealth), 20);
      ctx.strokeStyle = '#880000';
      ctx.strokeRect(w / 2 - bw / 2, 20, bw, 20);
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(boss.name, w / 2, 50);
      ctx.textAlign = 'left';
    }

    // Pause screen
    if (this.gameState.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c8a000';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NIRUTHTHU', w / 2, h / 2 - 20);
      ctx.fillStyle = '#888';
      ctx.font = '20px monospace';
      ctx.fillText('ESC - Thodara / Continue', w / 2, h / 2 + 30);
      ctx.textAlign = 'left';
    }

    // Game Over screen
    if (this.gameState.gameOver) {
      ctx.fillStyle = 'rgba(80, 0, 0, 0.85)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 64px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MARANAM', w / 2, h / 2 - 40);
      ctx.fillStyle = '#cc0000';
      ctx.font = '24px monospace';
      ctx.fillText('Nee veezhndhaal... Aadhma vizhippurai!', w / 2, h / 2 + 10);
      ctx.fillStyle = '#888';
      ctx.font = '18px monospace';
      ctx.fillText('ENTER / ESC - Mendum Thodanga', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }

    // Victory screen
    if (this.gameState.victory) {
      ctx.fillStyle = 'rgba(0, 20, 60, 0.9)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 56px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VETRI!', w / 2, h / 2 - 60);
      ctx.fillStyle = '#c8a000';
      ctx.font = '28px monospace';
      ctx.fillText('Dharmam Vென்றது!', w / 2, h / 2 - 10);
      ctx.fillStyle = '#aaa';
      ctx.font = '18px monospace';
      ctx.fillText(`Kolai: ${this.gameState.kills}`, w / 2, h / 2 + 30);
      ctx.fillStyle = '#888';
      ctx.fillText('ENTER / ESC - Mendum Thodanga', w / 2, h / 2 + 70);
      ctx.textAlign = 'left';
    }

    // Pointer lock hint
    if (!this.mouse.locked && !this.gameState.paused && !this.gameState.gameOver && !this.gameState.victory) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(w / 2 - 180, h / 2 + 60, 360, 30);
      ctx.fillStyle = '#ffcc00';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Click to capture mouse | WASD to move', w / 2, h / 2 + 80);
      ctx.textAlign = 'left';
    }
  }
}

export { Game };
