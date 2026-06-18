// Vidhi - Three.js renderer
// Pure view layer: the simulation in game.js stays 2D/tile-based and
// authoritative; this maps game (x, y) onto scene (x, height, z) with
// 1 scene unit = 1 tile.

import * as THREE from 'three';
import {
  TILE_SIZE, WORLD_SCALE, EYE_HEIGHT, WALL_HEIGHT, DOOR_TILES, T_SECRET,
} from './constants.js';
import { createTextures } from './textures.js';
import { createSpriteFrames } from './sprites3d.js';

const TORCH_LIGHT_POOL = 6;
const MAX_PARTICLES = 512;

const ENEMY_TYPES = new Set(['asura', 'naga', 'rakshasa']);

// Faint self-lit tint so doors read as interactive against plain stone.
// Keyed by tile id: 5 wood, 6 red key, 7 blue key, 8 gold key.
const DOOR_GLOW = { 5: 0x3a2008, 6: 0x550010, 7: 0x001a48, 8: 0x3c2c00 };

function cellHash(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(68, canvas.clientWidth / canvas.clientHeight, 0.05, 60);
    this.camera.rotation.order = 'YXZ';

    this.textures = createTextures();
    this.frames = createSpriteFrames();

    // Persistent lights
    this.ambient = new THREE.AmbientLight(0x9090b0, 0.22);
    this.scene.add(this.ambient);
    this.lantern = new THREE.PointLight(0xffc080, 14, 10, 2);
    this.scene.add(this.lantern);
    this.muzzleLight = new THREE.PointLight(0xffaa40, 0, 8, 2);
    this.scene.add(this.muzzleLight);
    this.projLight = new THREE.PointLight(0xffdd60, 0, 6, 2);
    this.scene.add(this.projLight);

    this.torchLights = [];
    for (let i = 0; i < TORCH_LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xff7726, 0, 7, 2);
      this.scene.add(l);
      this.torchLights.push(l);
    }

    this.levelGroup = null;
    this.spriteGroup = new THREE.Group();
    this.scene.add(this.spriteGroup);
    this.doorMeshes = new Map(); // "x,y" -> mesh
    this.torches = [];
    this.portal = null;
    this.portalLight = null;
    this.muzzleT = 0;
    this.lightningT = 0;
    this.torchOutage = { idx: -1, t: 0 };

    this._projVec = new THREE.Vector3();

    this._initParticles();
    this._initProjectilePools();
  }

  // Project a point just above a sprite's head to HUD pixel coords using the
  // real camera. Returns null when the sprite has no mesh yet or the point is
  // behind / well outside the frustum. Valid after render() for this frame.
  projectSpriteTop(sprite, w, h) {
    const mesh = this._spriteMeshes && this._spriteMeshes.get(sprite);
    if (!mesh) return null;
    const size = mesh.userData.size || 1;
    const v = this._projVec.set(mesh.position.x, mesh.position.y + size * 0.6, mesh.position.z);
    v.project(this.camera);
    if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.5) return null;
    return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
  }

  onResize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------- Level geometry ----------

  loadLevel(map, levelDef, doors) {
    if (this.levelGroup) {
      this.scene.remove(this.levelGroup);
      this.levelGroup.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.levelGroup = new THREE.Group();
    this.doorMeshes.clear();
    this.torches = [];
    this._clearSprites();

    const fogColor = new THREE.Color(levelDef.fogColor || 0x0a0806);
    this.scene.fog = new THREE.FogExp2(fogColor, levelDef.fogDensity || 0.08);
    this.scene.background = fogColor;
    this.ambient.intensity = levelDef.ambient !== undefined ? levelDef.ambient : 0.22;

    this._buildWalls(map);
    this._buildFloorCeiling(map);
    this._buildDoors(map, doors);
    this._buildTorches(levelDef.torches || []);
    this._buildPortal(levelDef.exit);

    this.scene.add(this.levelGroup);
  }

  _buildWalls(map) {
    // One merged geometry per wall texture; faces only where a wall cell
    // borders a walkable (floor or door) cell.
    const buckets = new Map(); // tile -> {pos, norm, uv, col, idx}
    const getBucket = (tile) => {
      if (!buckets.has(tile)) {
        buckets.set(tile, { pos: [], norm: [], uv: [], col: [], idx: [] });
      }
      return buckets.get(tile);
    };

    const open = (x, y) => {
      const t = map.getTile(x, y);
      return t === 0 || DOOR_TILES.has(t);
    };

    // Emit a vertical quad. (x0,z0)-(x1,z1) is the bottom edge, normal (nx,nz).
    const quad = (b, x0, z0, x1, z1, nx, nz, tint) => {
      const base = b.pos.length / 3;
      b.pos.push(
        x0, 0, z0,
        x1, 0, z1,
        x1, WALL_HEIGHT, z1,
        x0, WALL_HEIGHT, z0,
      );
      for (let i = 0; i < 4; i++) {
        b.norm.push(nx, 0, nz);
        b.col.push(tint, tint, tint);
      }
      b.uv.push(0, 0, 1, 0, 1, WALL_HEIGHT, 0, WALL_HEIGHT);
      b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const t = map.getTile(x, y);
        if (t === 0 || DOOR_TILES.has(t)) continue;
        const tile = t === T_SECRET ? 1 : t;
        const b = getBucket(tile);
        const tint = 0.8 + cellHash(x, y) * 0.25;
        // Neighbor open => emit face on that side (wound to face the open cell)
        if (open(x, y - 1)) quad(b, x + 1, y, x, y, 0, -1, tint);       // north face
        if (open(x, y + 1)) quad(b, x, y + 1, x + 1, y + 1, 0, 1, tint); // south face
        if (open(x - 1, y)) quad(b, x, y, x, y + 1, -1, 0, tint);        // west face
        if (open(x + 1, y)) quad(b, x + 1, y + 1, x + 1, y, 1, 0, tint); // east face
      }
    }

    for (const [tile, b] of buckets) {
      if (!b.idx.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
      geo.setIndex(b.idx);
      const mat = new THREE.MeshLambertMaterial({ map: this.textures[tile], vertexColors: true });
      this.levelGroup.add(new THREE.Mesh(geo, mat));
    }
  }

  _buildFloorCeiling(map) {
    const w = map.width, h = map.height;

    const floorGeo = new THREE.PlaneGeometry(w, h);
    floorGeo.rotateX(-Math.PI / 2);
    const floorTex = this.textures.floor.clone();
    floorTex.repeat.set(w, h);
    floorTex.needsUpdate = true;
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshLambertMaterial({ map: floorTex }));
    floor.position.set(w / 2, 0, h / 2);
    this.levelGroup.add(floor);

    const ceilGeo = new THREE.PlaneGeometry(w, h);
    ceilGeo.rotateX(Math.PI / 2);
    const ceilTex = this.textures.ceiling.clone();
    ceilTex.repeat.set(w, h);
    ceilTex.needsUpdate = true;
    const ceil = new THREE.Mesh(ceilGeo, new THREE.MeshLambertMaterial({ map: ceilTex }));
    ceil.position.set(w / 2, WALL_HEIGHT, h / 2);
    this.levelGroup.add(ceil);
  }

  _buildDoors(map, doors) {
    for (const door of doors) {
      const { x, y, tile } = door;
      let mesh;
      if (tile === T_SECRET) {
        // Secret walls are full blocks, indistinguishable from walls
        const geo = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
        mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: this.textures[1] }));
      } else {
        // Thin slab blocking the corridor: if walls flank east/west the
        // passage runs north-south, so the slab spans x and is thin in z.
        const flankedEW = map.getTile(x - 1, y) > 0 && map.getTile(x + 1, y) > 0;
        const geo = flankedEW
          ? new THREE.BoxGeometry(1, WALL_HEIGHT, 0.14)
          : new THREE.BoxGeometry(0.14, WALL_HEIGHT, 1);
        mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
          map: this.textures[tile],
          emissive: new THREE.Color(DOOR_GLOW[tile] || 0x2a1606),
          emissiveIntensity: 0.75,
        }));
      }
      mesh.position.set(x + 0.5, WALL_HEIGHT / 2, y + 0.5);
      this.levelGroup.add(mesh);
      this.doorMeshes.set(`${x},${y}`, { mesh, baseY: WALL_HEIGHT / 2 });
    }
  }

  _buildTorches(torchDefs) {
    const sconceGeo = new THREE.BoxGeometry(0.1, 0.22, 0.1);
    const sconceMat = new THREE.MeshLambertMaterial({ color: 0x2a2118 });
    for (let i = 0; i < torchDefs.length; i++) {
      const t = torchDefs[i];
      const sconce = new THREE.Mesh(sconceGeo, sconceMat);
      sconce.position.set(t.x, 0.52, t.y);
      this.levelGroup.add(sconce);

      const mat = new THREE.SpriteMaterial({
        map: this.frames.flames[i % 3],
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flame = new THREE.Sprite(mat);
      flame.scale.set(0.34, 0.34, 1);
      flame.position.set(t.x, 0.72, t.y);
      this.levelGroup.add(flame);
      this.torches.push({ x: t.x, y: t.y, flame, phase: Math.random() * 10 });
    }
  }

  _buildPortal(exit) {
    if (this.portal) {
      this.scene.remove(this.portal);
      this.portal = null;
    }
    if (this.portalLight) {
      this.scene.remove(this.portalLight);
      this.portalLight = null;
    }
    if (!exit) return;
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      map: this.frames.portal,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const rot of [0, Math.PI / 2]) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.8, WALL_HEIGHT), mat);
      plane.rotation.y = rot;
      plane.position.y = WALL_HEIGHT / 2;
      group.add(plane);
    }
    group.position.set(exit.x + 0.5, 0, exit.y + 0.5);
    this.portal = group;
    this.scene.add(group);

    this.portalLight = new THREE.PointLight(0xffc040, 0, 6, 2);
    this.portalLight.position.set(exit.x + 0.5, 0.5, exit.y + 0.5);
    this.scene.add(this.portalLight);
  }

  setPortalActive(active) {
    if (this.portal) this.portal.visible = active;
    if (this.portalLight) this.portalLight.visible = active;
    this._portalActive = active;
  }

  // ---------- Billboards ----------

  _clearSprites() {
    for (const child of [...this.spriteGroup.children]) {
      this.spriteGroup.remove(child);
    }
    this._spriteMeshes = new Map(); // game sprite object -> mesh
  }

  _enemyMesh(sprite) {
    const size = sprite.boss ? 1.35 : 1.0;
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshLambertMaterial({
      map: this.frames.enemies[sprite.boss ? 'boss' : sprite.type].idle[0],
      transparent: true,
      alphaTest: 0.06,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.size = size;
    return mesh;
  }

  _pickupSprite(sprite) {
    let tex;
    if (sprite.type === 'key') tex = this.frames.pickups[`key_${sprite.color || 'red'}`];
    else tex = this.frames.pickups[sprite.type];
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(0.42, 0.42, 1);
    return s;
  }

  _pillarMesh() {
    const geo = new THREE.PlaneGeometry(0.5, WALL_HEIGHT);
    const mat = new THREE.MeshLambertMaterial({
      map: this.frames.pillar,
      transparent: true,
      alphaTest: 0.4,
      side: THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
  }

  _updateSprites(sprites, gameState, camX, camZ) {
    const time = gameState.time;
    let idx = 0;
    for (const sprite of sprites) {
      idx++;
      const visible = sprite.active || sprite.state === 'dying';
      let mesh = this._spriteMeshes.get(sprite);
      if (!visible) {
        if (mesh) {
          this.spriteGroup.remove(mesh);
          this._spriteMeshes.delete(sprite);
        }
        continue;
      }
      if (!mesh) {
        if (ENEMY_TYPES.has(sprite.type)) mesh = this._enemyMesh(sprite);
        else if (sprite.type === 'pillar') mesh = this._pillarMesh();
        else mesh = this._pickupSprite(sprite);
        this.spriteGroup.add(mesh);
        this._spriteMeshes.set(sprite, mesh);
      }

      const sx = sprite.x * WORLD_SCALE;
      const sz = sprite.y * WORLD_SCALE;

      if (ENEMY_TYPES.has(sprite.type)) {
        const frames = this.frames.enemies[sprite.boss ? 'boss' : sprite.type];
        let tex;
        let opacity = 1;
        let yOff = 0;
        if (sprite.state === 'dying') {
          const t = sprite.deathT || 0;
          tex = frames.dead[t < 0.45 ? 0 : 1];
          opacity = 1 - Math.max(0, (t - 0.55) / 0.45);
        } else if (sprite.windupTimer > 0) {
          tex = frames.windup[0];
        } else if (sprite.state === 'chase') {
          tex = frames.walk[Math.floor(time * 5 + idx) % 2];
        } else {
          tex = frames.idle[Math.floor(time * 1.6 + idx) % 2];
          yOff = Math.sin(time * 1.5 + idx) * 0.008;
        }
        if (mesh.material.map !== tex) {
          mesh.material.map = tex;
          mesh.material.needsUpdate = true;
        }
        mesh.material.opacity = opacity;
        mesh.material.color.setRGB(1, sprite.hurt ? 0.35 : 1, sprite.hurt ? 0.35 : 1);
        const size = mesh.userData.size;
        mesh.position.set(sx, size / 2 + yOff, sz);
        mesh.rotation.y = Math.atan2(camX - sx, camZ - sz);
      } else if (sprite.type === 'pillar') {
        mesh.position.set(sx, WALL_HEIGHT / 2, sz);
        mesh.rotation.y = Math.atan2(camX - sx, camZ - sz);
      } else {
        // Pickup: bob and pulse
        mesh.position.set(sx, 0.32 + Math.sin(time * 2.2 + idx) * 0.05, sz);
        if (sprite.type === 'ammo') mesh.material.rotation = time * 1.5;
      }
    }
  }

  // ---------- Projectiles ----------

  _initProjectilePools() {
    this._projSprites = [];
    this._projPoolSize = 24;
    for (let i = 0; i < this._projPoolSize; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.frames.projectiles.chakra,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const s = new THREE.Sprite(mat);
      s.visible = false;
      this.scene.add(s);
      this._projSprites.push(s);
    }
  }

  _updateProjectiles(projectiles, enemyProjectiles, time) {
    let i = 0;
    let nearest = null;
    let nearestD = Infinity;
    const all = [];
    for (const p of projectiles) all.push({ p, kind: p.type });
    for (const p of enemyProjectiles) all.push({ p, kind: 'venom' });

    for (const { p, kind } of all) {
      if (i >= this._projPoolSize) break;
      const s = this._projSprites[i++];
      s.visible = true;
      const tex = this.frames.projectiles[kind] || this.frames.projectiles.chakra;
      if (s.material.map !== tex) {
        s.material.map = tex;
        s.material.needsUpdate = true;
      }
      const scale = kind === 'brahmastra' ? 0.55 : kind === 'venom' ? 0.3 : 0.4;
      s.scale.set(scale, scale, 1);
      s.material.rotation = kind === 'chakra' ? time * 14 : 0;
      s.position.set(p.x * WORLD_SCALE, 0.5, p.y * WORLD_SCALE);

      const dx = s.position.x - this.camera.position.x;
      const dz = s.position.z - this.camera.position.z;
      const d = dx * dx + dz * dz;
      if (d < nearestD) {
        nearestD = d;
        nearest = s.position;
      }
    }
    for (; i < this._projPoolSize; i++) this._projSprites[i].visible = false;

    if (nearest) {
      this.projLight.position.copy(nearest);
      this.projLight.intensity = 4;
    } else {
      this.projLight.intensity = 0;
    }
  }

  // ---------- Particles ----------

  _initParticles() {
    const geo = new THREE.BufferGeometry();
    this._partPos = new Float32Array(MAX_PARTICLES * 3);
    this._partCol = new Float32Array(MAX_PARTICLES * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this._partPos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this._partCol, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.PointsMaterial({
      map: this.frames.particle,
      size: 0.05,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this._points = new THREE.Points(geo, mat);
    this._points.frustumCulled = false;
    this.scene.add(this._points);
    this._colorCache = new Map();
  }

  _updateParticles(particles) {
    const n = Math.min(particles.length, MAX_PARTICLES);
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      this._partPos[i * 3] = p.x * WORLD_SCALE;
      this._partPos[i * 3 + 1] = Math.max(0.02, p.z);
      this._partPos[i * 3 + 2] = p.y * WORLD_SCALE;
      let c = this._colorCache.get(p.color);
      if (!c) {
        c = new THREE.Color(p.color || '#aa0000');
        this._colorCache.set(p.color, c);
      }
      const a = Math.max(0, Math.min(1, p.life / p.maxLife));
      this._partCol[i * 3] = c.r * a;
      this._partCol[i * 3 + 1] = c.g * a;
      this._partCol[i * 3 + 2] = c.b * a;
    }
    this._points.geometry.setDrawRange(0, n);
    this._points.geometry.attributes.position.needsUpdate = true;
    this._points.geometry.attributes.color.needsUpdate = true;
  }

  // ---------- Atmosphere ----------

  _updateTorches(time, dt, camX, camZ) {
    // Random single-torch outage: a torch sputters out for a moment
    this.torchOutage.t -= dt;
    if (this.torchOutage.t <= 0) {
      if (this.torchOutage.idx >= 0) {
        this.torchOutage.idx = -1;
        this.torchOutage.t = 6 + Math.random() * 14;
      } else if (this.torches.length && Math.random() < 0.5) {
        this.torchOutage.idx = Math.floor(Math.random() * this.torches.length);
        this.torchOutage.t = 1.2 + Math.random() * 1.5;
      } else {
        this.torchOutage.t = 5;
      }
    }

    // Sort torches by distance to camera; nearest N get pooled lights
    const sorted = this.torches
      .map((t, i) => ({ t, i, d: (t.x - camX) ** 2 + (t.y - camZ) ** 2 }))
      .sort((a, b) => a.d - b.d);

    for (let li = 0; li < this.torchLights.length; li++) {
      const light = this.torchLights[li];
      if (li < sorted.length) {
        const { t, i } = sorted[li];
        const out = i === this.torchOutage.idx;
        const flick = 0.75 + 0.25 * Math.sin(time * 11 + t.phase) * Math.sin(time * 5.3 + t.phase * 2);
        light.position.set(t.x + Math.sin(time * 9 + t.phase) * 0.02, 0.72, t.y);
        light.intensity = out ? 0 : 5.5 * flick;
      } else {
        light.intensity = 0;
      }
    }

    // Animate every flame sprite (cheap)
    for (let i = 0; i < this.torches.length; i++) {
      const t = this.torches[i];
      const out = i === this.torchOutage.idx;
      t.flame.visible = !out;
      if (!out) {
        t.flame.material.map = this.frames.flames[Math.floor(time * 9 + t.phase) % 3];
        const fs = 0.3 + 0.06 * Math.sin(time * 13 + t.phase);
        t.flame.scale.set(fs, fs * 1.15, 1);
      }
    }
  }

  flashMuzzle(weapon) {
    const colors = { trishul: 0x88ccff, agni: 0xff6620, chakra: 0xffdd30, brahmastra: 0xcc40ff };
    this.muzzleLight.color.setHex(colors[weapon] || 0xffaa40);
    this.muzzleT = 0.09;
  }

  // ---------- Main render ----------

  render(player, map, sprites, projectiles, enemyProjectiles, gameState, dt) {
    const time = gameState.time;
    const camX = player.x * WORLD_SCALE;
    const camZ = player.y * WORLD_SCALE;

    // Camera: view bob + breathing + screen shake
    const bob = Math.sin(gameState.walkCycle * 2) * 0.028;
    const breathe = Math.sin(time * 1.3) * 0.006;
    const shake = gameState.screenShakeMag * 0.004;
    this.camera.position.set(
      camX + (Math.random() - 0.5) * shake,
      EYE_HEIGHT + bob + breathe + (Math.random() - 0.5) * shake,
      camZ + (Math.random() - 0.5) * shake,
    );
    this.camera.rotation.y = -(player.angle + Math.PI / 2);
    this.camera.rotation.x = player.pitch || 0;

    // Lantern follows player
    this.lantern.position.set(camX, EYE_HEIGHT + 0.1, camZ);
    const lowHealth = player.health < 30 ? 0.85 : 1;
    this.lantern.intensity = (13 + Math.sin(time * 7) * 0.8) * lowHealth;

    // Muzzle flash light
    if (this.muzzleT > 0) {
      this.muzzleT -= dt;
      this.muzzleLight.position.set(camX, EYE_HEIGHT, camZ);
      this.muzzleLight.intensity = this.muzzleT > 0 ? 22 : 0;
    } else {
      this.muzzleLight.intensity = 0;
    }

    // Doors animate via openT set by game logic
    for (const [, entry] of this.doorMeshes) entry.mesh.updateMatrix?.();

    this._updateTorches(time, dt, camX, camZ);
    this._updateSprites(sprites, gameState, camX, camZ);
    this._updateProjectiles(projectiles, enemyProjectiles, time);
    this._updateParticles(gameState.particles);

    // Exit portal pulse
    if (this.portal && this.portal.visible) {
      const pulse = 0.6 + 0.4 * Math.sin(time * 3.5);
      this.portal.children.forEach((p) => {
        p.material.opacity = 0.5 + 0.5 * pulse;
      });
      this.portal.rotation.y = time * 0.8;
      if (this.portalLight) this.portalLight.intensity = 3 + pulse * 3;
    }

    this.renderer.render(this.scene, this.camera);
  }

  // Door slide: called by game each frame with current openT per door
  setDoorOpenT(x, y, openT) {
    const entry = this.doorMeshes.get(`${x},${y}`);
    if (entry) {
      entry.mesh.position.y = entry.baseY - openT * (WALL_HEIGHT * 0.96);
      entry.mesh.visible = openT < 0.99;
    }
  }
}
