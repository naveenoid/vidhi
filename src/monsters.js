// Vidhi - monster factory
//
// One entry point for the renderer, with two backends behind it:
//
//   1. the procedural rigs in models3d.js (always available, zero assets)
//   2. sculpted glTF models, when any are configured in monsterAssets.js
//
// Both return the same handle shape - { root, pose, setHurt, setFade, dispose }
// - so renderer3d.js never has to know which one it got. Sculpts load in the
// background; until one arrives its monster is procedural, and onSculptsReady
// lets the renderer rebuild the ones that have been upgraded.

import * as THREE from 'three';
import { createMonster as createProcedural } from './models3d.js';
import { MONSTER_MODELS, HAS_SCULPTS } from './monsterAssets.js';

const loaded = new Map();   // key -> { scene, clips, cfg }
// Populated by preloadSculpts before any sculpt can be instanced.
const skeletonUtils = {};
let readyCallbacks = [];
let loadStarted = false;

const keyFor = (type, boss) => (boss && loaded.has('boss') ? 'boss' : type);

/**
 * Kick off loading of any configured sculpts. Safe to call repeatedly, and a
 * no-op when nothing is configured, which is the default. The GLTFLoader
 * module is only imported if it is actually needed, so a stock checkout never
 * pays for it.
 */
export async function preloadSculpts() {
  if (!HAS_SCULPTS || loadStarted) return;
  loadStarted = true;
  let GLTFLoader;
  try {
    ({ GLTFLoader } = await import('../lib/GLTFLoader.js'));
  } catch (err) {
    console.warn('[vidhi] GLTFLoader unavailable, staying procedural:', err.message);
    return;
  }
  // Must be ready before any sculpt is instanced: a shallow clone would give
  // every copy one shared skeleton, so they would all animate in lockstep.
  try {
    ({ clone: skeletonUtils.clone } = await import('../lib/SkeletonUtils.js'));
  } catch (err) {
    console.warn('[vidhi] SkeletonUtils unavailable; sculpts stay procedural:', err.message);
    return;
  }
  const loader = new GLTFLoader();
  const jobs = Object.entries(MONSTER_MODELS).map(([key, cfg]) => new Promise((resolve) => {
    loader.load(
      cfg.url,
      (gltf) => {
        loaded.set(key, { scene: gltf.scene, clips: gltf.animations || [], cfg });
        resolve();
      },
      undefined,
      (err) => {
        // A missing or broken model must never take the game down with it.
        console.warn(`[vidhi] could not load ${key} sculpt (${cfg.url}):`, err.message || err);
        resolve();
      },
    );
  }));
  await Promise.all(jobs);
  const cbs = readyCallbacks;
  readyCallbacks = [];
  for (const cb of cbs) cb();
}

// Renderer hook: fires once the sculpt load settles, so already-spawned
// procedural monsters can be swapped for their upgraded versions.
export function onSculptsReady(cb) {
  if (!HAS_SCULPTS) return;
  if (loadStarted && readyCallbacks.length === 0 && loaded.size > 0) cb();
  else readyCallbacks.push(cb);
}

export function hasSculpt(type, boss) {
  return loaded.has(keyFor(type, boss));
}

/**
 * Build a monster. Uses a sculpt when one is loaded for this type, otherwise
 * the procedural rig.
 */
export function createMonster(type, boss, height) {
  const entry = loaded.get(keyFor(type, boss));
  if (entry) {
    try {
      return createSculpted(entry, type, boss, height);
    } catch (err) {
      console.warn('[vidhi] sculpt instancing failed, falling back:', err.message);
    }
  }
  return createProcedural(type, boss, height);
}

// ---------------------------------------------------------------------------
// glTF-backed monsters
// ---------------------------------------------------------------------------

// Pick a clip by configured name, then by a loose name match, then give up.
function findClip(clips, wanted, fallbackWords) {
  if (wanted) {
    const exact = clips.find((c) => c.name === wanted);
    if (exact) return exact;
  }
  for (const word of fallbackWords) {
    const hit = clips.find((c) => c.name.toLowerCase().includes(word));
    if (hit) return hit;
  }
  return null;
}

function createSculpted(entry, type, boss, height) {
  // Skinned meshes cannot be cloned with Object3D.clone - the copies would
  // share one skeleton and animate in lockstep.
  const { clone } = skeletonUtils;
  if (!clone) throw new Error('SkeletonUtils not loaded');
  const root = new THREE.Group();
  const model = clone(entry.scene);
  const cfg = entry.cfg;

  // Fit to the gameplay height and stand it on the floor, so a sculpt authored
  // at any scale drops in without hand-tuning.
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const fit = size.y > 1e-4 ? (height / size.y) * (cfg.scale || 1) : (cfg.scale || 1);
  model.scale.setScalar(fit);
  model.position.y = -box.min.y * fit + (cfg.offsetY || 0);
  model.rotation.y = cfg.yaw || 0;

  // One pass: shadow flags, culling, and per-instance material clones so this
  // monster can flash red or fade out without dragging its species with it.
  const clonedFor = new Map();
  model.traverse((o) => {
    if (!o.isMesh && !o.isSkinnedMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false; // skinned bounds go stale as the pose changes
    const swap = (m) => {
      if (!m) return m;
      if (!clonedFor.has(m)) clonedFor.set(m, m.clone());
      return clonedFor.get(m);
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  const instMats = [...clonedFor.values()];
  const baseEmissive = instMats.map((m) => (m.emissive ? m.emissive.clone() : null));

  root.add(model);

  const clips = entry.clips;
  const names = cfg.clips || {};
  const mixer = clips.length ? new THREE.AnimationMixer(model) : null;
  const actions = {};
  if (mixer) {
    const want = {
      idle: findClip(clips, names.idle, ['idle', 'stand']),
      walk: findClip(clips, names.walk, ['walk', 'run', 'move']),
      attack: findClip(clips, names.attack, ['attack', 'strike', 'hit', 'punch']),
      death: findClip(clips, names.death, ['death', 'die', 'fall']),
    };
    for (const [k, clip] of Object.entries(want)) {
      if (!clip) continue;
      const a = mixer.clipAction(clip);
      if (k === 'death') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      actions[k] = a;
    }
    if (actions.idle) actions.idle.play();
  }

  let current = 'idle';
  let lastT = 0;
  let transparent = false;

  const play = (name) => {
    if (name === current) return;
    const next = actions[name] || actions.idle;
    const prev = actions[current];
    if (!next || next === prev) { current = name; return; }
    next.reset().fadeIn(0.18).play();
    if (prev) prev.fadeOut(0.18);
    current = name;
  };

  return {
    root,
    type,
    boss: !!boss,
    height,
    sculpted: true,

    // Same contract as the procedural handle: state in, pose out. Here it
    // selects and advances animation clips instead of rotating joints.
    pose(s) {
      const t = s.t || 0;
      const dt = lastT ? Math.max(0, Math.min(0.1, t - lastT)) : 0;
      lastT = t;
      if (s.dead > 0) play('death');
      else if (s.windup > 0.05) play('attack');
      else if (s.moving > 0.25) play('walk');
      else play('idle');
      if (mixer) mixer.update(dt);
      // Death still topples and sinks even when the file has no death clip.
      if (s.dead > 0 && !actions.death) {
        root.rotation.x = s.dead * 1.4;
        root.position.y = -s.dead * 0.1;
      }
    },

    setHurt(k) {
      for (let i = 0; i < instMats.length; i++) {
        const m = instMats[i];
        if (!m.emissive) continue;
        if (k > 0) m.emissive.setRGB(k * 0.75, k * 0.06, k * 0.05);
        else if (baseEmissive[i]) m.emissive.copy(baseEmissive[i]);
        else m.emissive.setRGB(0, 0, 0);
      }
    },

    setFade(alpha) {
      const on = alpha < 0.999;
      if (on !== transparent) {
        transparent = on;
        for (const m of instMats) {
          m.transparent = on;
          m.depthWrite = !on;
          m.needsUpdate = true;
        }
      }
      if (on) for (const m of instMats) m.opacity = alpha;
    },

    dispose() {
      if (mixer) mixer.stopAllAction();
      for (const m of instMats) m.dispose();
    },
  };
}

