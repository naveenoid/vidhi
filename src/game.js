// Vidhi - Main Game Logic
// The simulation is 2D and tile-based (positions in TILE_SIZE units);
// Renderer3D draws the world, Hud draws the overlay.

import {
  TILE_SIZE, MOVE_SPEED, ROT_SPEED, MOUSE_SENSITIVITY, PLAYER_RADIUS,
  MAX_PITCH, KEY_FOR_DOOR, T_SECRET, isTouchDevice,
} from './constants.js';
import { Renderer3D } from './renderer3d.js';
import { Hud } from './hud.js';
import { loadLevel } from './maps.js';
import { SoundManager } from './sound.js';
import { STORY } from './story.js';

const WEAPON_ORDER = ['trishul', 'agni', 'chakra', 'brahmastra'];

class Game {
  constructor(glCanvas, hudCanvas, story) {
    this.glCanvas = glCanvas;
    this.hudCanvas = hudCanvas;
    this.renderer = new Renderer3D(glCanvas);
    this.hud = new Hud(hudCanvas);
    this.sound = new SoundManager();
    this.story = story || null;
    this.touch = isTouchDevice();

    this.player = {
      x: 0, y: 0, angle: 0, pitch: 0,
      health: 100, armor: 0,
    };

    this.gameState = {
      currentWeapon: 'trishul',
      weapons: ['trishul'],
      ammo: { trishul: Infinity, agni: 0, chakra: 0, brahmastra: 0 },
      fireAnim: 0,
      walkCycle: 0,
      time: 0,
      level: 1,
      levelName: '',
      kills: 0,
      totalEnemies: 0,
      secretsFound: 0,
      totalSecrets: 0,
      keys: { red: false, blue: false, gold: false },
      paused: false,
      gameOver: false,
      victory: false,
      showMessage: null,
      messageTimer: 0,
      screenFlash: 0,
      screenFlashColor: 'red',
      damageRel: 0,
      exit: null,
      mapExpanded: false,
      screenShakeMag: 0,
      particles: [],
    };

    this.sprites = [];
    this.map = null;
    this.doors = [];
    this.levelExit = null;

    this.keys = {};
    this.mouse = { dx: 0, dy: 0, locked: false };
    this.moveInput = { x: 0, y: 0 }; // analog (touch joystick)
    this.lookInput = { yaw: 0, pitch: 0 }; // analog (touch swipe)
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
      if (e.code === 'Digit1') this.switchWeapon('trishul');
      if (e.code === 'Digit2') this.switchWeapon('agni');
      if (e.code === 'Digit3') this.switchWeapon('chakra');
      if (e.code === 'Digit4') this.switchWeapon('brahmastra');
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'KeyM') this.gameState.mapExpanded = !this.gameState.mapExpanded;
      if (e.code === 'Escape') {
        if (this.story && this.story.active) return; // story handles its own keys
        if (this.gameState.gameOver || this.gameState.victory) {
          this.restart();
        } else {
          this.gameState.paused = !this.gameState.paused;
        }
      }
      if (e.code === 'Enter' && (this.gameState.gameOver || this.gameState.victory)) {
        if (this.story && this.story.active) return;
        this.restart();
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    if (!this.touch) {
      this.glCanvas.addEventListener('click', () => {
        if (!this.mouse.locked) {
          this.glCanvas.requestPointerLock();
        }
      });

      document.addEventListener('pointerlockchange', () => {
        this.mouse.locked = document.pointerLockElement === this.glCanvas;
      });

      document.addEventListener('mousemove', (e) => {
        if (this.mouse.locked) {
          this.mouse.dx += e.movementX;
          this.mouse.dy += e.movementY;
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
  }

  onResize(w, h) {
    this.renderer.onResize(w, h);
    // HUD canvas gets a DPR-scaled backing store for crisp text on phones;
    // all HUD drawing happens in CSS px via the transform set each frame.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.hudCanvas.width = Math.round(w * dpr);
    this.hudCanvas.height = Math.round(h * dpr);
    this.hud.dpr = dpr;
    this.viewW = w;
    this.viewH = h;
  }

  switchWeapon(weapon) {
    if (this.gameState.weapons.includes(weapon)) {
      this.gameState.currentWeapon = weapon;
      this.sound.play('switch');
    }
  }

  cycleWeapon() {
    const owned = WEAPON_ORDER.filter((w) => this.gameState.weapons.includes(w));
    const i = owned.indexOf(this.gameState.currentWeapon);
    this.switchWeapon(owned[(i + 1) % owned.length]);
  }

  // Door (or secret wall) the player is facing within reach, else null.
  doorInFront(maxReach = 2.2) {
    for (const reach of [0.55, 0.9, 1.3, 1.7, maxReach]) {
      const checkX = this.player.x + Math.cos(this.player.angle) * reach * TILE_SIZE;
      const checkY = this.player.y + Math.sin(this.player.angle) * reach * TILE_SIZE;
      const mapX = Math.floor(checkX / TILE_SIZE);
      const mapY = Math.floor(checkY / TILE_SIZE);
      const door = this.doors.find((d) => d.x === mapX && d.y === mapY && !d.opening);
      if (door) return door;
    }
    return null;
  }

  openDoor(door) {
    if (door.opening) return;
    const needed = KEY_FOR_DOOR[door.tile];
    if (needed && !this.gameState.keys[needed]) {
      this.sound.play('locked');
      const keyNames = { red: 'SEVI', blue: 'NEELA', gold: 'THANGA' };
      this.showMessage(`POOTTAPPATTADHU - ${keyNames[needed]} SAAVI THEVAI!`, 2.5);
      return;
    }

    door.opening = true;
    if (door.tile === T_SECRET) {
      this.gameState.secretsFound++;
      this.sound.play('secret');
      this.showMessage('RAGASIYAM KANDUPIDIKKAPPATTADHU!', 2.5);
    } else {
      this.sound.play('door');
      this.showMessage('KATHAVU THIRANDHADHU', 2);
    }
  }

  interact() {
    const door = this.doorInFront();
    if (door) this.openDoor(door);
  }

  showMessage(text, duration) {
    this.gameState.showMessage = text;
    this.gameState.messageTimer = duration;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.sound.init();
    this.sound.startAmbient();
    const begin = () => {
      this.loadLevel(0);
      this.gameLoop(this.lastTime);
    };
    if (this.story) {
      this.sound.duck(0.25, 0.3);
      this.loadLevel(0); // build the world behind the story screen
      this.gameLoop(this.lastTime);
      this.story.show(STORY.intro, () => {
        this.sound.duck(1, 0.8);
        if (!this.touch) this.glCanvas.requestPointerLock?.();
      });
    } else {
      begin();
    }
  }

  restart() {
    this.player.health = 100;
    this.player.armor = 0;
    this.player.pitch = 0;
    this.gameState.currentWeapon = 'trishul';
    this.gameState.weapons = ['trishul'];
    this.gameState.ammo = { trishul: Infinity, agni: 0, chakra: 0, brahmastra: 0 };
    this.gameState.kills = 0;
    this.gameState.secretsFound = 0;
    this.gameState.keys = { red: false, blue: false, gold: false };
    this.gameState.gameOver = false;
    this.gameState.victory = false;
    this.gameState.paused = false;
    this.gameState.level = 1;
    this.gameState.particles = [];
    this.gameState.screenShakeMag = 0;
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.sound.setHeartbeat(false);
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
    this.doors = level.doors;
    this.player.x = level.playerStart.x;
    this.player.y = level.playerStart.y;
    this.player.angle = level.playerStart.angle;
    this.player.pitch = 0;
    this.gameState.levelName = level.levelName;
    this.gameState.level = index + 1;
    this.gameState.totalEnemies = level.totalEnemies;
    this.gameState.totalSecrets = level.totalSecrets;
    this.gameState.kills = 0;
    this.levelExit = level.exit;
    this.gameState.exit = level.exit;
    this.gameState.particles = [];
    this.gameState.screenShakeMag = 0;
    this.projectiles = [];
    this.enemyProjectiles = [];

    this.renderer.loadLevel(this.map, level.levelDef, this.doors);

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

    const storyActive = this.story && this.story.active;
    if (!storyActive && !this.gameState.paused && !this.gameState.gameOver && !this.gameState.victory) {
      this.update(dt);
    }

    this.render(dt);
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(dt) {
    this.gameState.time += dt;

    // Look: mouse (pointer lock) + touch swipe + keyboard turn
    this.player.angle += this.mouse.dx * MOUSE_SENSITIVITY + this.lookInput.yaw;
    this.player.pitch -= this.mouse.dy * MOUSE_SENSITIVITY;
    this.player.pitch += this.lookInput.pitch;
    this.player.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.player.pitch));
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.lookInput.yaw = 0;
    this.lookInput.pitch = 0;

    if (this.keys['ArrowLeft'] || this.keys['KeyQ']) this.player.angle -= ROT_SPEED * dt;
    if (this.keys['ArrowRight'] || this.keys['KeyR']) this.player.angle += ROT_SPEED * dt;

    // Movement: keyboard digital + joystick analog
    let fwd = this.moveInput.y;
    let strafe = this.moveInput.x;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) fwd += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) fwd -= 1;
    if (this.keys['KeyA']) strafe -= 1;
    if (this.keys['KeyD']) strafe += 1;
    const mag = Math.hypot(fwd, strafe);
    if (mag > 1) {
      fwd /= mag;
      strafe /= mag;
    }

    // forward = (cos a, sin a); right = (cos(a+90deg), sin(a+90deg))
    const speed = MOVE_SPEED * TILE_SIZE * dt;
    const cos = Math.cos(this.player.angle);
    const sin = Math.sin(this.player.angle);
    const stepX = (cos * fwd - sin * strafe) * speed;
    const stepY = (sin * fwd + cos * strafe) * speed;

    if (mag > 0.1) {
      this.gameState.walkCycle += dt * 8 * Math.min(1, mag);
    }

    this.moveWithCollision(stepX, stepY);

    // Doors animate open
    for (const door of this.doors) {
      if (!door.opening || door.openT >= 1) {
        if (door.openT > 0) this.renderer.setDoorOpenT(door.x, door.y, door.openT);
        continue;
      }
      door.openT = Math.min(1, door.openT + dt / 0.8);
      if (door.openT >= 0.5 && this.map.getTile(door.x, door.y) !== 0) {
        this.map.setTile(door.x, door.y, 0);
      }
      this.renderer.setDoorOpenT(door.x, door.y, door.openT);
    }

    // Doors swing open as you walk up — including locked ones once you carry
    // the right key. Only secret walls still need a deliberate E press.
    for (const door of this.doors) {
      if (door.opening || door.tile === T_SECRET) continue;
      const needed = KEY_FOR_DOOR[door.tile];
      if (needed && !this.gameState.keys[needed]) continue;
      const ddx = (door.x + 0.5) * TILE_SIZE - this.player.x;
      const ddy = (door.y + 0.5) * TILE_SIZE - this.player.y;
      if (ddx * ddx + ddy * ddy < (1.6 * TILE_SIZE) ** 2) this.openDoor(door);
    }

    // Hint for the door / locked gate the player is looking at.
    const front = this.doorInFront();
    if (front && front.tile !== T_SECRET) {
      const needed = KEY_FOR_DOOR[front.tile];
      const keyNames = { red: 'SEVI', blue: 'NEELA', gold: 'THANGA' };
      this.gameState.doorPrompt = (needed && !this.gameState.keys[needed])
        ? { text: `${keyNames[needed]} SAAVI THEVAI / KEY NEEDED`, locked: true }
        : { text: 'KATHAVU · WALK IN', locked: false };
    } else {
      this.gameState.doorPrompt = null;
    }

    // Shooting
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.shooting && this.fireCooldown <= 0) {
      this.fire();
    }

    if (this.gameState.fireAnim > 0) {
      this.gameState.fireAnim = Math.max(0, this.gameState.fireAnim - dt * 5);
    }

    this.updateProjectiles(dt);
    this.updateEnemyProjectiles(dt);
    this.updateEnemies(dt);
    this.checkPickups();
    this.checkExit();

    if (this.gameState.messageTimer > 0) {
      this.gameState.messageTimer -= dt;
      if (this.gameState.messageTimer <= 0) {
        this.gameState.showMessage = null;
      }
    }

    if (this.gameState.screenFlash > 0) {
      this.gameState.screenFlash = Math.max(0, this.gameState.screenFlash - dt * 3);
    }

    if (this.gameState.screenShakeMag > 0) {
      this.gameState.screenShakeMag = Math.max(0, this.gameState.screenShakeMag - dt * 18);
    }

    // Particles: z is height in tiles (0 = floor)
    const particles = this.gameState.particles;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 2.6 * dt; // gravity
      if (p.z < 0.02) {
        p.z = 0.02;
        p.vz = 0;
      }
      p.vx *= 0.92;
      p.vy *= 0.92;
    }

    // Low-health heartbeat
    this.sound.setHeartbeat(this.player.health > 0 && this.player.health < 30);

    if (this.player.health <= 0) {
      this.player.health = 0;
      this.gameState.gameOver = true;
      this.sound.setHeartbeat(false);
      this.sound.play('death');
    }
  }

  moveWithCollision(dx, dy) {
    const r = PLAYER_RADIUS;

    const newX = this.player.x + dx;
    if (!this.isWall(newX + r, this.player.y) &&
        !this.isWall(newX - r, this.player.y) &&
        !this.isWall(newX + r, this.player.y + r) &&
        !this.isWall(newX - r, this.player.y - r) &&
        !this.isWall(newX + r, this.player.y - r) &&
        !this.isWall(newX - r, this.player.y + r)) {
      this.player.x = newX;
    }

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
    return this.map.getTile(mapX, mapY) > 0;
  }

  // Grid-stepped line of sight between two points
  hasLOS(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    // At least 2 steps so the midpoint is always checked, even at point-blank
    // range (e.g. across a wall corner between diagonal tiles).
    const steps = Math.max(2, Math.ceil(dist / (TILE_SIZE / 2)));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
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
    this.renderer.flashMuzzle(weapon);

    const weaponDefs = {
      trishul: { damage: 18, range: 3, spread: 0, cooldown: 0.35, hitscan: true },
      agni: { damage: 45, range: 7, spread: 0.1, cooldown: 0.8, hitscan: true, pellets: 5 },
      chakra: { damage: 30, range: 14, spread: 0, cooldown: 0.3, hitscan: false, speed: 11 },
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
    this.gameState.screenFlash = 0.15;
    this.gameState.screenFlashColor = weapon === 'agni' ? 'orange' : weapon === 'brahmastra' ? 'purple' : 'yellow';
  }

  hitscanAttack(angle, damage, range) {
    const step = 2;
    const maxSteps = (range * TILE_SIZE) / step;

    for (let i = 0; i < maxSteps; i++) {
      const x = this.player.x + Math.cos(angle) * i * step;
      const y = this.player.y + Math.sin(angle) * i * step;

      if (this.isWall(x, y)) break;

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

      if (this.isWall(proj.x, proj.y)) {
        if (proj.explosive) {
          this.explode(proj.x, proj.y, proj.damage);
        }
        this.projectiles.splice(i, 1);
        continue;
      }

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

  updateEnemyProjectiles(dt) {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const proj = this.enemyProjectiles[i];
      const moveAmount = proj.speed * dt;
      proj.x += Math.cos(proj.angle) * moveAmount;
      proj.y += Math.sin(proj.angle) * moveAmount;
      proj.traveled += moveAmount;

      if (this.isWall(proj.x, proj.y) || proj.traveled > proj.range) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      const dx = proj.x - this.player.x;
      const dy = proj.y - this.player.y;
      if (dx * dx + dy * dy < 18 * 18) {
        this.takeDamage(proj.damage, Math.atan2(-dy, -dx));
        this.enemyProjectiles.splice(i, 1);
      }
    }
  }

  explode(x, y, damage) {
    const radius = TILE_SIZE * 3;
    this.sound.play('explode');
    this.gameState.screenFlash = 0.5;
    this.gameState.screenFlashColor = 'white';
    this.gameState.screenShakeMag = Math.max(this.gameState.screenShakeMag, 10);

    // Spark burst
    for (let p = 0; p < 18; p++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 160;
      this.gameState.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        z: 0.3 + Math.random() * 0.4,
        vz: 0.8 + Math.random() * 1.4,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        size: 3,
        color: p % 2 ? '#ffaa33' : '#ff5511',
      });
    }

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
    sprite.hurtTimer = 0.25;
    if (sprite.state === 'idle') sprite.state = 'chase';
    this.sound.play('hit');
    this.hud.showHitMarker();

    const kdx = sprite.x - this.player.x;
    const kdy = sprite.y - this.player.y;
    const klen = Math.sqrt(kdx * kdx + kdy * kdy) || 1;
    const knockMag = sprite.boss ? 4 : (12 + damage * 0.3);
    sprite.knockX = (kdx / klen) * knockMag;
    sprite.knockY = (kdy / klen) * knockMag;

    const burstCount = 6 + Math.floor(damage / 10);
    for (let p = 0; p < burstCount; p++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 70;
      this.gameState.particles.push({
        x: sprite.x,
        y: sprite.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        z: 0.35 + Math.random() * 0.35,
        vz: 0.4 + Math.random() * 1.0,
        life: 0.45 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 2 + Math.random() * 3,
        color: sprite.boss ? '#ff3300' : '#aa0000',
      });
    }

    this.gameState.screenShakeMag = Math.max(
      this.gameState.screenShakeMag,
      sprite.boss ? 4 : 2,
    );

    if (sprite.health <= 0) {
      sprite.active = false;
      sprite.health = 0;
      sprite.state = 'dying';
      sprite.deathT = 0;
      this.gameState.kills++;
      this.sound.play('enemyDeath');

      if (sprite.boss) {
        this.gameState.screenShakeMag = Math.max(this.gameState.screenShakeMag, 14);
        this.showMessage('MAHISHASURA VEEZHNDHAAN!', 5);
        // The boss carries the gold key to the sanctum
        this.sprites.push({
          type: 'key',
          x: sprite.x,
          y: sprite.y,
          active: true,
          color: 'gold',
        });
        if (!this.gameState.weapons.includes('brahmastra')) {
          this.gameState.weapons.push('brahmastra');
          this.gameState.ammo.brahmastra = 10;
        }
      }
    }
  }

  takeDamage(damage, direction) {
    if (this.player.armor > 0) {
      const absorbed = Math.min(this.player.armor, damage * 0.5);
      this.player.armor -= absorbed;
      damage -= absorbed;
    }

    this.player.health -= damage;
    this.gameState.screenFlash = 0.4;
    this.gameState.screenFlashColor = 'red';
    // Direction the hit came FROM, relative to facing (for the vignette)
    let rel = direction - Math.PI - this.player.angle;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    this.gameState.damageRel = rel;
    this.gameState.screenShakeMag = Math.max(this.gameState.screenShakeMag, 5);
    this.sound.play('hurt');
  }

  updateEnemies(dt) {
    const enemyTypes = { asura: true, naga: true, rakshasa: true };

    for (const sprite of this.sprites) {
      // Death animation plays out, then the corpse fades away
      if (sprite.state === 'dying') {
        sprite.deathT = (sprite.deathT || 0) + dt / 1.0;
        if (sprite.deathT >= 1) sprite.state = 'dead';
        continue;
      }
      if (!sprite.active || !sprite.health || !enemyTypes[sprite.type]) continue;

      if (sprite.hurtTimer > 0) {
        sprite.hurtTimer -= dt;
        if (sprite.hurtTimer <= 0) sprite.hurt = false;
      }

      if (sprite.attackCooldown > 0) {
        sprite.attackCooldown -= dt;
      }

      const dx = this.player.x - sprite.x;
      const dy = this.player.y - sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const tileDist = dist / TILE_SIZE;

      // Lingering knockback
      if (sprite.knockX || sprite.knockY) {
        const kx = sprite.knockX || 0;
        const ky = sprite.knockY || 0;
        if (!this.isWall(sprite.x + kx, sprite.y)) sprite.x += kx;
        if (!this.isWall(sprite.x, sprite.y + ky)) sprite.y += ky;
        sprite.knockX = kx * 0.55;
        sprite.knockY = ky * 0.55;
        if (Math.abs(sprite.knockX) < 0.4 && Math.abs(sprite.knockY) < 0.4) {
          sprite.knockX = 0;
          sprite.knockY = 0;
        }
      }

      // Alerting: enemies wake when they SEE you (boss senses you anywhere)
      if (sprite.state === 'idle') {
        const sees = tileDist < sprite.alertRange
          && (sprite.boss || this.hasLOS(sprite.x, sprite.y, this.player.x, this.player.y));
        if (sees) {
          sprite.state = 'chase';
          this.sound.play('stinger');
        } else {
          continue;
        }
      }

      // --- chase state ---
      const windupDur = sprite.boss ? 0.5 : sprite.ranged ? 0.45 : 0.3;

      if (sprite.windupTimer > 0) {
        sprite.windupTimer -= dt;
        if (sprite.windupTimer <= 0) {
          if (sprite.pendingShot) {
            sprite.pendingShot = false;
            this.sound.play('enemyShoot');
            this.enemyProjectiles.push({
              x: sprite.x,
              y: sprite.y,
              angle: Math.atan2(this.player.y - sprite.y, this.player.x - sprite.x),
              speed: 5.5 * TILE_SIZE,
              damage: sprite.damage,
              range: 12 * TILE_SIZE,
              traveled: 0,
            });
            sprite.attackCooldown = 2.2;
          } else {
            if (tileDist < sprite.attackRange + 0.3) {
              this.takeDamage(sprite.damage, Math.atan2(-dy, -dx));
              this.sound.play('enemyAttack');
            }
            sprite.attackCooldown = sprite.boss ? 1.0 : 1.5;
          }
        }
        continue; // locked in place while winding up
      }

      const canShoot = sprite.ranged
        && tileDist > 2.2 && tileDist < 7.5
        && sprite.attackCooldown <= 0
        && this.hasLOS(sprite.x, sprite.y, this.player.x, this.player.y);

      if (canShoot) {
        sprite.windupTimer = windupDur;
        sprite.windupMax = windupDur;
        sprite.pendingShot = true;
        continue;
      }

      if (tileDist < sprite.attackRange && sprite.attackCooldown <= 0) {
        sprite.windupTimer = windupDur;
        sprite.windupMax = windupDur;
        sprite.pendingShot = false;
        continue;
      }

      // Ranged enemies keep their distance once in shooting range
      const holdDistance = sprite.ranged ? 3.2 : sprite.attackRange;
      if (tileDist <= holdDistance) continue;

      // Movement with separation from other enemies
      const angle = Math.atan2(dy, dx);
      const moveSpeed = sprite.speed * TILE_SIZE * dt;

      let mx = Math.cos(angle) * moveSpeed;
      let my = Math.sin(angle) * moveSpeed;

      const sepRadius = TILE_SIZE * 0.85;
      let sepX = 0, sepY = 0;
      for (const other of this.sprites) {
        if (other === sprite || !other.active || !other.health) continue;
        if (!enemyTypes[other.type]) continue;
        const odx = sprite.x - other.x;
        const ody = sprite.y - other.y;
        const od = Math.sqrt(odx * odx + ody * ody);
        if (od > 0 && od < sepRadius) {
          const push = (sepRadius - od) / sepRadius;
          sepX += (odx / od) * push;
          sepY += (ody / od) * push;
        }
      }
      mx += sepX * moveSpeed * 0.9;
      my += sepY * moveSpeed * 0.9;

      const newX = sprite.x + mx;
      const newY = sprite.y + my;
      if (!this.isWall(newX, newY)) {
        sprite.x = newX;
        sprite.y = newY;
      } else {
        if (!this.isWall(newX, sprite.y)) sprite.x = newX;
        if (!this.isWall(sprite.x, newY)) sprite.y = newY;
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
        case 'armor':
          if (this.player.armor < 100) {
            this.player.armor = Math.min(100, this.player.armor + 50);
            sprite.active = false;
            this.sound.play('pickup');
            this.showMessage('KAVACHAM +50', 1.5);
          }
          break;
        case 'ammo':
          this.gameState.ammo.agni = Math.min(50, this.gameState.ammo.agni + 10);
          this.gameState.ammo.chakra = Math.min(100, this.gameState.ammo.chakra + 15);
          this.gameState.ammo.brahmastra = Math.min(20, this.gameState.ammo.brahmastra + 3);
          sprite.active = false;
          this.sound.play('pickup');
          this.showMessage('AAYUDHAM KIDAITHHADHU', 1.5);

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
    if (!this.levelExit || this._transitioning) return;

    const px = Math.floor(this.player.x / TILE_SIZE);
    const py = Math.floor(this.player.y / TILE_SIZE);

    if (px === this.levelExit.x && py === this.levelExit.y) {
      this.sound.play('levelComplete');
      const nextIndex = this.gameState.level; // level is 1-indexed
      const interlude = STORY.interludes[nextIndex - 1];
      const isLast = nextIndex >= 3;

      this._transitioning = true;
      const proceed = () => {
        this._transitioning = false;
        if (isLast) {
          this.gameState.victory = true;
          this.sound.setHeartbeat(false);
        } else {
          this.loadLevel(nextIndex);
        }
      };

      if (this.story) {
        this.sound.duck(0.25, 0.3);
        const part = isLast ? STORY.ending : interlude;
        this.story.show(part, () => {
          this.sound.duck(1, 0.8);
          proceed();
        });
      } else {
        proceed();
      }
    }
  }

  render(dt) {
    this.renderer.render(
      this.player, this.map, this.sprites,
      this.projectiles, this.enemyProjectiles,
      this.gameState, dt,
    );

    const ctx = this.hud.ctx;
    const w = this.viewW || this.hudCanvas.width;
    const h = this.viewH || this.hudCanvas.height;

    this.hud.render(this.player, this.map, this.sprites, this.gameState, dt);

    // Screen flash (damage handled by vignette; weapon/explosion flashes here)
    if (this.gameState.screenFlash > 0 && this.gameState.screenFlashColor !== 'red') {
      const colors = {
        orange: `rgba(255, 120, 0, ${this.gameState.screenFlash * 0.2})`,
        yellow: `rgba(255, 255, 0, ${this.gameState.screenFlash * 0.12})`,
        purple: `rgba(180, 0, 255, ${this.gameState.screenFlash * 0.25})`,
        white: `rgba(255, 255, 255, ${this.gameState.screenFlash * 0.4})`,
      };
      ctx.fillStyle = colors[this.gameState.screenFlashColor] || colors.yellow;
      ctx.fillRect(0, 0, w, h);
    }

    // Wind-up telegraphs above enemies about to strike
    this.renderWindupIndicators(ctx, w, h);

    if (this.gameState.showMessage) {
      ctx.save();
      let size = w < 480 ? 14 : 18;
      ctx.font = `bold ${size}px monospace`;
      let tw = ctx.measureText(this.gameState.showMessage).width;
      if (tw > w - 40) { // shrink to fit narrow phones
        size = Math.max(10, Math.floor(size * (w - 40) / tw));
        ctx.font = `bold ${size}px monospace`;
        tw = ctx.measureText(this.gameState.showMessage).width;
      }
      const bw = tw + 36;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(w / 2 - bw / 2, h / 2 - 80, bw, 40);
      ctx.strokeStyle = '#c8a000';
      ctx.strokeRect(w / 2 - bw / 2, h / 2 - 80, bw, 40);
      ctx.fillStyle = '#ffcc00';
      ctx.textAlign = 'center';
      ctx.fillText(this.gameState.showMessage, w / 2, h / 2 - 54);
      ctx.textAlign = 'left';
      ctx.restore();
    }

    // Boss health bar
    const boss = this.sprites.find((s) => s.boss && s.active);
    if (boss && boss.state !== 'idle') {
      const bw = Math.min(300, Math.floor(w * 0.72));
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

    if (this.gameState.gameOver) {
      ctx.fillStyle = 'rgba(80, 0, 0, 0.85)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 64px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('MARANAM', w / 2, h / 2 - 40);
      ctx.fillStyle = '#cc0000';
      ctx.font = '24px monospace';
      ctx.fillText('Vidhi unnai vizhungiyadhu...', w / 2, h / 2 + 10);
      ctx.fillStyle = '#888';
      ctx.font = '18px monospace';
      ctx.fillText('ENTER / ESC - Meendum Thodanga', w / 2, h / 2 + 50);
      ctx.textAlign = 'left';
    }

    if (this.gameState.victory) {
      ctx.fillStyle = 'rgba(0, 10, 30, 0.9)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 56px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('VETRI!', w / 2, h / 2 - 60);
      ctx.fillStyle = '#c8a000';
      ctx.font = '24px monospace';
      ctx.fillText('Vidhi ethirkollappattadhu.', w / 2, h / 2 - 15);
      ctx.fillStyle = '#aaa';
      ctx.font = '18px monospace';
      ctx.fillText(`Kolai: ${this.gameState.kills}  |  Ragasiyam: ${this.gameState.secretsFound}/${this.gameState.totalSecrets}`, w / 2, h / 2 + 25);
      ctx.fillStyle = '#888';
      ctx.fillText('ENTER / ESC - Meendum Thodanga', w / 2, h / 2 + 65);
      ctx.textAlign = 'left';
    }

    // Pointer lock hint (desktop only)
    if (!this.touch && !this.mouse.locked && !(this.story && this.story.active)
        && !this.gameState.paused && !this.gameState.gameOver && !this.gameState.victory) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(w / 2 - 180, h / 2 + 60, 360, 30);
      ctx.fillStyle = '#ffcc00';
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Click to capture mouse | WASD to move', w / 2, h / 2 + 80);
      ctx.textAlign = 'left';
    }
  }

  renderWindupIndicators(ctx, w, h) {
    for (const sprite of this.sprites) {
      if (!sprite.active || !sprite.health) continue;
      if (!sprite.windupTimer || sprite.windupTimer <= 0) continue;

      const dist = Math.hypot(sprite.x - this.player.x, sprite.y - this.player.y);
      if (dist < 1) continue;
      if (!this.hasLOS(this.player.x, this.player.y, sprite.x, sprite.y)) continue;

      // Camera-accurate point above the enemy's head
      const pt = this.renderer.projectSpriteTop(sprite, w, h);
      if (!pt) continue;
      const screenX = pt.x;
      const cy = pt.y;

      const projH = (TILE_SIZE * h) / dist * (sprite.boss ? 1.7 : 1);
      const charge = 1 - sprite.windupTimer / (sprite.windupMax || 0.3);
      const r = Math.max(4, projH * 0.06);

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
}

export { Game };
