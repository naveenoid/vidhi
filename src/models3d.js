// Vidhi - Procedural 3D monster models
//
// Enemies used to be flat canvas billboards. They are now real geometry:
// each monster is a rigged tree of THREE.Groups built from swept tubes and
// primitives, lit by the same torches as the level and posed every frame from
// the 2D simulation's state (walk cycle, windup, death).
//
// Authoring space: 100 units ~= one tile of height, +Y up, +Z forward (the
// direction the monster faces). Models are scaled to their world height by
// createMonster(), so the numbers below read like the sprite art they replace.

import * as THREE from 'three';

const PI2 = Math.PI * 2;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

// Swept tube along a Catmull-Rom spline with a per-length radius profile.
// radius(t) returns a number (circular) or [across, thickness] (elliptical,
// measured along the frame's normal and binormal). This one builder covers
// limbs, ribcages, necks, horns, snouts, tails and serpent coils.
function tube(points, opts = {}) {
  const {
    segs = 20,
    radial = 10,
    radius = () => 4,
    capStart = true,
    capEnd = true,
    vScale = 1,
  } = opts;

  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    'catmullrom',
    0.4,
  );
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [];
  const uv = [];
  const idx = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const P = curve.getPointAt(t);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    const r = radius(t);
    const ra = Array.isArray(r) ? r[0] : r;
    const rb = Array.isArray(r) ? r[1] : r;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * PI2;
      const c = Math.cos(a) * ra;
      const s = Math.sin(a) * rb;
      pos.push(
        P.x + N.x * c + B.x * s,
        P.y + N.y * c + B.y * s,
        P.z + N.z * c + B.z * s,
      );
      uv.push(j / radial, t * vScale);
    }
  }
  const ring = radial + 1;
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      const b = a + ring;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  // Flat caps: a fan to the curve's endpoint on the axis.
  const fan = (i, flip) => {
    const t = i / segs;
    const P = curve.getPointAt(t);
    const center = pos.length / 3;
    pos.push(P.x, P.y, P.z);
    uv.push(0.5, t * vScale);
    for (let j = 0; j < radial; j++) {
      const a = i * ring + j;
      if (flip) idx.push(center, a + 1, a);
      else idx.push(center, a, a + 1);
    }
  };
  if (capStart) fan(0, true);
  if (capEnd) fan(segs, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Parametric sheet, u across and v up, used for the naga's cobra hood.
function sheet(fn, nu, nv) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let iv = 0; iv <= nv; iv++) {
    for (let iu = 0; iu <= nu; iu++) {
      const u = (iu / nu) * 2 - 1;
      const v = iv / nv;
      const p = fn(u, v);
      pos.push(p[0], p[1], p[2]);
      uv.push(iu / nu, v);
    }
  }
  for (let iv = 0; iv < nv; iv++) {
    for (let iu = 0; iu < nu; iu++) {
      const a = iv * (nu + 1) + iu;
      const b = a + nu + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Transform matrix from a terse { p, r, s } description.
function M({ p = [0, 0, 0], r = [0, 0, 0], s = 1 } = {}) {
  const sc = Array.isArray(s) ? s : [s, s, s];
  return new THREE.Matrix4().compose(
    new THREE.Vector3(p[0], p[1], p[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])),
    new THREE.Vector3(sc[0], sc[1], sc[2]),
  );
}

// Accumulates many transformed geometries into one buffer, so a rigid body
// part costs a single draw call per material instead of one per shape.
class Part {
  constructor() {
    this.pos = [];
    this.norm = [];
    this.uv = [];
    this.idx = [];
  }

  add(geo, xform) {
    const g = xform ? geo.clone().applyMatrix4(xform instanceof THREE.Matrix4 ? xform : M(xform)) : geo;
    if (!g.attributes.normal) g.computeVertexNormals();
    const base = this.pos.length / 3;
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const u = g.attributes.uv ? g.attributes.uv.array : null;
    for (let i = 0; i < p.length; i++) this.pos.push(p[i]);
    for (let i = 0; i < n.length; i++) this.norm.push(n[i]);
    for (let i = 0; i < p.length / 3; i++) {
      this.uv.push(u ? u[i * 2] : 0, u ? u[i * 2 + 1] : 0);
    }
    const index = g.index;
    if (index) {
      for (let i = 0; i < index.count; i++) this.idx.push(base + index.array[i]);
    } else {
      for (let i = 0; i < p.length / 3; i++) this.idx.push(base + i);
    }
    if (g !== geo) g.dispose();
    return this;
  }

  get empty() {
    return this.idx.length === 0;
  }

  build() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    return geo;
  }
}

// A body part under construction: one Part per material slot.
class Node {
  constructor(name, parent, at, scale) {
    this.name = name;
    this.parent = parent;
    this.at = at || [0, 0, 0];
    this.scale = scale || 1;
    this.slots = new Map();
  }

  // mat: material key ('skin', 'bone', 'gold', 'cloth', 'eye', 'ember')
  put(mat, geo, xform) {
    if (!this.slots.has(mat)) this.slots.set(mat, new Part());
    this.slots.get(mat).add(geo, xform);
    return this;
  }
}

class Rig {
  constructor(authoredHeight) {
    this.authoredHeight = authoredHeight;
    this.nodes = [];
  }

  node(name, parent, at, scale) {
    const n = new Node(name, parent, at, scale);
    this.nodes.push(n);
    return n;
  }
}

// Common shapes -------------------------------------------------------------

const SPHERE = new THREE.SphereGeometry(1, 14, 10);
const SPHERE_LO = new THREE.SphereGeometry(1, 9, 7);
const CONE = new THREE.ConeGeometry(1, 1, 8);
const BOX = new THREE.BoxGeometry(1, 1, 1);

// Bands (armlets, anklets, crowns) are generated at their true size rather
// than scaled from a unit torus, so the band stays round instead of smearing
// into an ellipse when the ring radius changes.
function ring(radius, thick, arc = PI2) {
  return new THREE.TorusGeometry(radius, thick, 8, 22, arc);
}

// A tapering claw / fang / tusk / quill. It grows along `axis` and curls
// toward `bend` — a talon points down and hooks forward, a tusk points up and
// hooks back. Length is measured along the axis, before the curl.
function claw(len, thick, curl = 0.4, axis = [0, -1, 0], bend = [0, 0, 1]) {
  const n = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  const a = [axis[0] / n, axis[1] / n, axis[2] / n];
  const bn = Math.hypot(bend[0], bend[1], bend[2]) || 1;
  const b = [bend[0] / bn, bend[1] / bn, bend[2] / bn];
  const at = (k, c) => [
    a[0] * len * k + b[0] * curl * len * c,
    a[1] * len * k + b[1] * curl * len * c,
    a[2] * len * k + b[2] * curl * len * c,
  ];
  return tube(
    [[0, 0, 0], at(0.34, 0.04), at(0.68, 0.26), at(1, 0.7)],
    {
      segs: 9,
      radial: 6,
      radius: (t) => thick * (1 - t) ** 0.72 + 0.1,
      capEnd: false,
    },
  );
}

// ---------------------------------------------------------------------------
// Procedural skin textures
// ---------------------------------------------------------------------------

function canvasTex(paint, { size = 256, repeat = [1, 1] } = {}) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  paint(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

// Value noise blotches, the base layer under every hide below.
function mottle(ctx, size, colors, count, rMin, rMax, alpha) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = rMin + Math.random() * (rMax - rMin);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colors[(Math.random() * colors.length) | 0]);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * (0.4 + Math.random() * 0.6);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Charred, ember-cracked hide for the asura.
function paintAsuraSkin(ctx, size) {
  ctx.fillStyle = '#2c150f';
  ctx.fillRect(0, 0, size, size);
  // Ash-grey scorching over dried blood, so the hide reads as burnt meat
  // rather than red plastic once the torches hit it.
  mottle(ctx, size, ['#4a2418', '#5a2a18', '#1a0b07', '#3e3730', '#544a42'], 110, 8, 46, 0.6);
  // Dry scab flaking
  ctx.strokeStyle = 'rgba(18,4,2,0.5)';
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.lineWidth = 0.6 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 20);
    ctx.stroke();
  }
  // Ember fissures glowing through the crust
  for (let i = 0; i < 16; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.strokeStyle = `rgba(255,${90 + Math.random() * 70 | 0},20,${0.35 + Math.random() * 0.4})`;
    ctx.lineWidth = 1 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (Math.random() - 0.5) * 30;
      y += (Math.random() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Overlapping cobra scales for the naga.
function paintNagaScale(ctx, size) {
  ctx.fillStyle = '#1b4a2b';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#2f7345', '#123522', '#3f8a52'], 60, 10, 50, 0.5);
  const rows = 16;
  const cols = 16;
  const w = size / cols;
  const h = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols + 1; c++) {
      const x = c * w + (r % 2 ? w / 2 : 0);
      const y = r * h;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(120,190,120,0.30)');
      g.addColorStop(0.55, 'rgba(30,90,45,0.10)');
      g.addColorStop(1, 'rgba(4,20,10,0.55)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y);
      ctx.quadraticCurveTo(x, y + h * 1.5, x + w * 0.5, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(3,16,8,0.45)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }
}

// Slate-purple demon hide, scarred, for the rakshasa.
function paintRakshasaHide(ctx, size) {
  ctx.fillStyle = '#241a33';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#3a2b52', '#160f21', '#4a3663'], 80, 12, 55, 0.6);
  // Pores
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(10,6,16,${0.15 + Math.random() * 0.35})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 0.6 + Math.random() * 1.4, 0, PI2);
    ctx.fill();
  }
  // Old scars
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * PI2;
    const l = 20 + Math.random() * 70;
    ctx.strokeStyle = 'rgba(150,120,150,0.22)';
    ctx.lineWidth = 1.5 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

function paintBone(ctx, size) {
  ctx.fillStyle = '#cec2a6';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#e6dcc4', '#a8967a', '#8f8163'], 40, 10, 60, 0.45);
  ctx.strokeStyle = 'rgba(80,66,40,0.35)';
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 8);
    ctx.stroke();
  }
}

function paintGold(ctx, size) {
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#8a5f14');
  g.addColorStop(0.35, '#e8bf52');
  g.addColorStop(0.55, '#c8952f');
  g.addColorStop(0.8, '#f2d47a');
  g.addColorStop(1, '#7a5210');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 200; i++) {
    ctx.strokeStyle = `rgba(60,38,4,${0.1 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 26);
    ctx.stroke();
  }
}

function paintCloth(ctx, size) {
  ctx.fillStyle = '#5a1414';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#75201c', '#3a0c0c'], 40, 10, 50, 0.6);
  ctx.strokeStyle = 'rgba(20,4,4,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  // Grime along the hem
  mottle(ctx, size, ['#1a0505'], 25, 20, 70, 0.5);
}

function paintHorn(ctx, size) {
  ctx.fillStyle = '#3f3627';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#584b34', '#241d13', '#6b5c40'], 50, 12, 50, 0.6);
  // Growth rings run across the horn (u wraps, v runs along it)
  for (let y = 0; y < size; y += 7) {
    ctx.strokeStyle = `rgba(20,15,8,${0.25 + Math.random() * 0.35})`;
    ctx.lineWidth = 1 + Math.random() * 2.5;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 2);
    ctx.lineTo(size, y + Math.random() * 2);
    ctx.stroke();
  }
}

let TEXTURES = null;
function textures() {
  if (TEXTURES) return TEXTURES;
  TEXTURES = {
    asura: canvasTex(paintAsuraSkin, { repeat: [2, 2] }),
    naga: canvasTex(paintNagaScale, { repeat: [3, 3] }),
    rakshasa: canvasTex(paintRakshasaHide, { repeat: [2, 2] }),
    bone: canvasTex(paintBone, { size: 128, repeat: [1, 1] }),
    gold: canvasTex(paintGold, { size: 128 }),
    cloth: canvasTex(paintCloth, { size: 128, repeat: [2, 2] }),
    horn: canvasTex(paintHorn, { size: 128, repeat: [1, 2] }),
    glow: (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.25, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })(),
  };
  return TEXTURES;
}

// Material prototypes. Instances clone these so a single monster can flash red
// or fade out without touching the rest of its kind.
function materialProtos(type) {
  const T = textures();
  const skinMap = type === 'naga' ? T.naga : type === 'asura' ? T.asura : T.rakshasa;
  const skinSpec = type === 'naga' ? 0x4a6a3a : 0x2a1a18;
  return {
    skin: new THREE.MeshPhongMaterial({
      map: skinMap,
      bumpMap: skinMap,
      bumpScale: 0.9,
      specular: skinSpec,
      shininess: type === 'naga' ? 34 : 12,
    }),
    bone: new THREE.MeshPhongMaterial({
      map: T.bone, bumpMap: T.bone, bumpScale: 0.4, specular: 0x554a34, shininess: 26,
      color: 0x9a8f78, // knocked back so claws and teeth do not glare in torchlight
    }),
    horn: new THREE.MeshPhongMaterial({
      map: T.horn, bumpMap: T.horn, bumpScale: 0.7, specular: 0x3a3020, shininess: 18,
    }),
    gold: new THREE.MeshPhongMaterial({
      map: T.gold, color: 0xc09040, specular: 0xffe0a0, shininess: 80, emissive: 0x0c0700,
    }),
    cloth: new THREE.MeshPhongMaterial({
      map: T.cloth, bumpMap: T.cloth, bumpScale: 0.5, specular: 0x201010, shininess: 6,
      side: THREE.DoubleSide, // the dhoti is an open wrap, seen from inside too
    }),
    // Pale ventral scutes: keeps the naga's belly from picking up the same
    // warm cast as its bone claws.
    belly: new THREE.MeshPhongMaterial({
      map: T.naga, color: 0x8c9a58, specular: 0x50583a, shininess: 22,
    }),
    // Open sheets (the naga's hood) are seen from both faces.
    membrane: new THREE.MeshPhongMaterial({
      map: skinMap,
      bumpMap: skinMap,
      bumpScale: 0.7,
      specular: skinSpec,
      shininess: 30,
      side: THREE.DoubleSide,
    }),
    eye: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    // Emissive rather than unlit, so flames and hot cracks still catch a
    // little shading instead of reading as flat orange cardboard.
    ember: new THREE.MeshPhongMaterial({
      color: 0x501004, emissive: 0xff5210, emissiveIntensity: 1, specular: 0xffc060, shininess: 40,
    }),
  };
}

// ---------------------------------------------------------------------------
// Asura - gaunt ember-cracked ghoul: hunched, long-armed, digitigrade.
// Authored in a neutral stance (feet flat on y=0, arms hanging) so every rest
// rotation in the poser is zero.
// ---------------------------------------------------------------------------

function buildAsura() {
  const rig = new Rig(112);

  // --- hips: narrow pelvis under a shredded loincloth
  const hips = rig.node('hips', null, [0, 52, 0]);
  hips.put('skin', tube(
    [[0, -9, 0], [0, -2, 0.5], [0, 7, -1]],
    { segs: 8, radial: 12, radius: (t) => [8.5 - t * 1.6, 6.6 - t * 1.2] },
  ));
  // Torn loincloth: a few ragged strips of uneven length, hanging slack
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * PI2 + 0.3;
    const len = 11 + ((i * 5) % 4) * 5;
    const r = 7.2;
    const drift = Math.sin(i * 2.3) * 2;
    hips.put('cloth', tube(
      [
        [Math.cos(a) * r, 1, Math.sin(a) * r * 0.85],
        [Math.cos(a) * (r + 0.6) + drift * 0.4, -len * 0.5, Math.sin(a) * (r + 0.6) * 0.85],
        [Math.cos(a) * (r + 1) + drift, -len, Math.sin(a) * (r + 1) * 0.85],
      ],
      { segs: 6, radial: 5, radius: (t) => [2.4 - t * 1.5, 0.6], capStart: false, capEnd: false },
    ));
  }

  // --- torso: pinched waist under a flared ribcage, arching forward
  const torso = rig.node('torso', 'hips', [0, 7, -1]);
  const spine = [[0, 0, 0], [0, 10, 2], [0, 20, 4.6], [0, 29, 5], [0, 36, 3]];
  const chestR = (t) => {
    const bell = Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.86);
    return [7 + bell * 7, 5.4 + bell * 3.4];
  };
  torso.put('skin', tube(spine, { segs: 16, radial: 14, radius: chestR, vScale: 2 }));
  // Ribs pressing through the hide: fine arcs across the front only
  for (let i = 0; i < 4; i++) {
    const t = 0.3 + i * 0.15;
    const y = t * 36 + 1;
    const [w, d] = chestR(t);
    torso.put('skin', tube(
      [
        [-w * 0.82, y + 1.4, d * 0.3],
        [-w * 0.6, y + 0.2, d * 0.82],
        [0, y - 1.4, d * 1.02],
        [w * 0.6, y + 0.2, d * 0.82],
        [w * 0.82, y + 1.4, d * 0.3],
      ],
      { segs: 14, radial: 6, radius: () => 0.72, capStart: false, capEnd: false },
    ));
  }
  // The fire in the chest cavity, showing only as a seam between the ribs
  torso.put('ember', tube(
    [[0, 11, 4.4], [0, 17, 5.4], [0, 23, 5.2]],
    { segs: 8, radial: 6, radius: (t) => [0.5 + Math.sin(t * Math.PI) * 0.35, 1.4] },
  ));
  // Vertebral spikes marching up the spine
  for (let i = 0; i < 9; i++) {
    const t = i / 9;
    const y = 3 + t * 32;
    const [, d] = chestR(t);
    torso.put('bone', claw(3.5 + Math.sin(t * Math.PI) * 5, 1.4, 0.5, [0, 1, -0.55], [0, 0, -1]), M({
      p: [0, y, -d * 0.92],
    }));
  }
  // Clavicles bracketing the neck pit
  for (const side of [-1, 1]) {
    torso.put('bone', tube(
      [[side * 1.5, 33.5, 3.6], [side * 6, 33, 4.6], [side * 10.5, 31.4, 3.4]],
      { segs: 6, radial: 6, radius: () => 1.2, capStart: false, capEnd: false },
    ));
  }

  // --- head: long low skull craned forward on a thin neck
  const head = rig.node('head', 'torso', [0, 37, 4], 1.18);
  head.put('skin', tube(
    [[0, -2, -3], [0, 2, 1], [0, 4, 6]],
    { segs: 6, radial: 10, radius: (t) => [4.2 + t * 2.4, 4 + t * 2.2] },
  ));
  // Cranium tapering into a long snout
  head.put('skin', tube(
    [[0, 3.5, 2], [0, 5, 8], [0, 3.6, 14], [0, 1.4, 20]],
    { segs: 10, radial: 12, radius: (t) => [7.6 - t * 4.6, 7.2 - t * 4.8] },
  ));
  // Brow shelf overhanging the sockets
  head.put('skin', SPHERE, M({ p: [0, 6.4, 7.5], r: [-0.3, 0, 0], s: [8.2, 2.6, 5] }));
  // Sockets: dark pits with a burning coal set deep inside
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE_LO, M({ p: [side * 4.2, 3.4, 8.4], s: [3.4, 3.2, 2.4] }));
    head.put('eye', SPHERE_LO, M({ p: [side * 4.3, 3.4, 10.6], s: [2, 1.7, 1.4] }));
  }
  // Nasal slits
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE_LO, M({ p: [side * 1.5, 2.2, 17], s: [1.2, 1, 1.6] }));
  }
  // Upper fangs hanging past the jaw line
  for (let i = -2; i <= 2; i++) {
    const big = Math.abs(i) === 2;
    head.put('bone', claw(big ? 5.5 : 3, 0.95, 0.3, [0, -1, 0.1], [0, 0, -1]), M({
      p: [i * 2, -1.4, 18.6 - Math.abs(i) * 2.4],
    }));
  }
  // Horns: heavy ridged pair sweeping up and back over the shoulders
  for (const side of [-1, 1]) {
    head.put('horn', tube(
      [
        [side * 4, 7.5, 2],
        [side * 7.5, 14, -2],
        [side * 9, 20, -10],
        [side * 7, 22, -19],
        [side * 4.5, 20, -25],
      ],
      { segs: 18, radial: 9, radius: (t) => 3.1 * (1 - t) ** 0.55 + 0.15, capEnd: false, vScale: 3 },
    ));
    // Cheek quills raked back along the jaw
    for (let i = 0; i < 3; i++) {
      head.put('bone', claw(5.5 + i, 0.6, 0.25, [side * 0.8, 0.15, -0.6], [0, 1, 0]), M({
        p: [side * 5.6, 1.5 - i * 1.4, 6 - i * 2.2],
      }));
    }
  }

  // --- jaw: hinged at the skull base, drops wide on the wind-up
  const jaw = rig.node('jaw', 'head', [0, 1, 3]);
  jaw.put('skin', tube(
    [[0, -1.5, -2], [0, -3.2, 5], [0, -3.6, 12], [0, -3, 17]],
    { segs: 7, radial: 10, radius: (t) => [5 - t * 2.6, 2.8 - t * 1.2] },
  ));
  for (let i = -2; i <= 2; i++) {
    const big = Math.abs(i) === 2;
    jaw.put('bone', claw(big ? 4.6 : 2.6, 0.9, 0.3, [0, 1, 0.1], [0, 0, -1]), M({
      p: [i * 1.9, -2.2, 15.4 - Math.abs(i) * 2.4],
    }));
  }

  // --- arms: far too long, elbow spurs, hands of curling talons
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'L' : 'R';
    const upper = rig.node(`arm${s}`, 'torso', [side * 11.5, 29.5, 2]);
    upper.put('skin', SPHERE, M({ p: [side * 1.5, 1.5, 0], s: [5.4, 5.6, 5.4] }));
    upper.put('skin', tube(
      [[0, 0, 0], [side * 1.5, -13, 0.5], [side * 1, -26, 0]],
      { segs: 5, radial: 8, radius: (t) => 4.3 - t * 1.3 },
    ));

    const fore = rig.node(`fore${s}`, `arm${s}`, [side * 1, -26, 0]);
    fore.put('skin', tube(
      [[0, 0, 0], [0, -13, -1], [0, -26, 0]],
      { segs: 5, radial: 8, radius: (t) => 3.1 - t * 1.1 },
    ));
    // Elbow spur, raked back like a blade
    fore.put('bone', claw(8, 1.5, 0.35, [side * 0.25, 0.45, -0.85], [0, 1, 0]), M({
      p: [side * 1.2, 0.5, -2],
    }));

    fore.put('skin', SPHERE_LO, M({ p: [0, -27.5, 0.6], s: [3, 3.6, 2.2] }));
    for (let i = 0; i < 4; i++) {
      const spread = (i - 1.5) * 2;
      const len = 9 + (i === 1 || i === 2 ? 2.5 : 0);
      fore.put('bone', claw(len, 1.05, 0.6, [spread * 0.1, -1, 0.15]), M({ p: [spread, -29.4, 1] }));
    }
    fore.put('bone', claw(6.5, 1, 0.55, [side * -0.45, -0.9, 0.1]), M({ p: [side * -2.4, -28.4, -0.6] }));
  }

  // --- legs: digitigrade, baked into the stance so rest rotations are zero
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'L' : 'R';
    const thigh = rig.node(`leg${s}`, 'hips', [side * 6.5, -4, 0]);
    thigh.put('skin', tube(
      [[0, 0, 2], [side * 1.2, -11, -2], [side * 1.6, -22, -6]],
      { segs: 5, radial: 8, radius: (t) => 6.6 - t * 2.6 },
    ));

    // Knee driven forward, shin raking back down to a raised heel
    const shin = rig.node(`shin${s}`, `leg${s}`, [side * 1.6, -22, -6]);
    shin.put('skin', tube(
      [[0, 0, 0], [0, -11, 4], [0, -22, 8]],
      { segs: 5, radial: 8, radius: (t) => 4.4 - t * 2.4 },
    ));
    shin.put('bone', claw(6.5, 1.4, 0.3, [0, 0.35, 0.9], [0, 1, 0]), M({ p: [0, 0.5, 2.6] }));

    const foot = rig.node(`foot${s}`, `shin${s}`, [0, -22, 8]);
    foot.put('skin', tube(
      [[0, 0, -1], [0, -4, 3], [0, -6.5, 8]],
      { segs: 4, radial: 8, radius: (t) => 3.2 - t * 1.1 },
    ));
    for (let i = -1; i <= 1; i++) {
      foot.put('skin', claw(6.5, 1.15, 0.3, [i * 0.32, -0.42, 0.85], [0, -1, 0]), M({
        p: [i * 2.4, -6.5, 7.6],
      }));
    }
    // Dew claw off the heel
    foot.put('skin', claw(4.5, 0.9, 0.3, [0, -0.6, -0.8], [0, -1, 0]), M({ p: [0, -1, -1.5] }));
  }

  return rig;
}

// ---------------------------------------------------------------------------
// Naga - hooded serpent warrior rising from its coils
// ---------------------------------------------------------------------------

function buildNaga() {
  const rig = new Rig(108);

  // --- coils: a real spiral of body stacked on the floor
  const hips = rig.node('hips', null, [0, 0, 0]);
  const coilPts = [];
  for (let i = 0; i <= 44; i++) {
    const t = i / 44;
    const a = t * PI2 * 2.4;
    const r = 24 - t * 15;
    coilPts.push([Math.cos(a) * r, 4 + t * 18, Math.sin(a) * r * 0.92]);
  }
  hips.put('skin', tube(coilPts, {
    segs: 52,
    radial: 10,
    radius: (t) => 8 - t * 2.6,
    vScale: 8,
  }));
  // Tail slipping out of the coil and flicking up
  hips.put('skin', tube(
    [[22, 4, 4], [28, 5, 13], [30, 8.5, 22], [26, 14, 28]],
    { segs: 14, radial: 8, radius: (t) => 4.6 * (1 - t) ** 0.8 + 0.15, capEnd: false },
  ));

  // --- trunk: serpentine body rising in an S out of the coil
  const trunk = rig.node('trunk', 'hips', [0, 21, 0]);
  trunk.put('skin', tube(
    [[0, 0, -3], [0, 11, 1], [0, 23, 3.5], [0, 35, 1], [0, 45, -3]],
    { segs: 16, radial: 12, radius: (t) => [7.6 - t * 2.6, 7 - t * 2.4], vScale: 5 },
  ));
  // Pale belly plates: shallow overlapping bands up the front only
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const y = 1 + t * 42;
    const z = 4.6 + Math.sin(t * Math.PI) * 2.6 - t * 5;
    const w = 5 - t * 1.6;
    trunk.put('belly', tube(
      [[-w, y + 0.7, z * 0.62], [0, y, z], [w, y + 0.7, z * 0.62]],
      { segs: 7, radial: 5, radius: () => [0.9, 0.3], capStart: false, capEnd: false },
    ));
  }
  // Gold shoulder yoke
  trunk.put('gold', ring(6.6, 1.1), M({ p: [0, 34, 0], r: [Math.PI / 2, 0, 0] }));

  // --- hood: broad cobra shell flaring behind and around the head
  const hood = rig.node('hood', 'trunk', [0, 40, -2]);
  const hoodAt = (u, v) => {
    // Width swells then tucks back in at the crown; the sheet wraps forward at
    // the rim so it cups the head instead of standing flat. Taller than it is
    // wide, or it reads as a mushroom cap rather than a cobra.
    const w = Math.sin(Math.min(1, v * 1.06) * Math.PI) ** 0.5;
    const x = u * 26 * w;
    const y = v * 46 - 6 + Math.abs(u) * 6 * (1 - v) ** 2;
    const z = -(Math.abs(u) ** 1.8) * 11 * w + Math.sin(v * Math.PI) * 3 - 2 - v * 5;
    return [x, y, z];
  };
  hood.put('membrane', sheet(hoodAt, 26, 16));
  // Thick rim so the hood does not read as paper
  hood.put('membrane', tube(
    Array.from({ length: 15 }, (_, i) => hoodAt((i / 14) * 2 - 1, 0.045)),
    { segs: 22, radial: 6, radius: () => 1.7 },
  ));
  // Ribs fanning through the hood from the neck
  for (const u of [-0.72, -0.4, 0.4, 0.72]) {
    hood.put('membrane', tube(
      [hoodAt(u * 0.25, 0.12), hoodAt(u * 0.7, 0.45), hoodAt(u, 0.8)],
      { segs: 10, radial: 5, radius: (t) => 1.5 - t * 0.7, capStart: false, capEnd: false },
    ));
  }
  // Spectacle mark, inlaid in gold high on the back of the hood
  for (const side of [-1, 1]) {
    hood.put('gold', ring(4.6, 0.9), M({ p: [side * 7, 30, -9], r: [0.2, 0, 0] }));
  }
  hood.put('gold', tube(
    [[-6, 33.5, -8.6], [0, 35.5, -9.2], [6, 33.5, -8.6]],
    { segs: 8, radial: 5, radius: () => 0.9, capStart: false, capEnd: false },
  ));

  // --- head: broad viper skull under a gold crown
  const head = rig.node('head', 'trunk', [0, 43, 0], 1.18);
  head.put('skin', tube(
    [[0, 0, -5], [0, 3, 2], [0, 2.6, 10], [0, 0.5, 18]],
    { segs: 10, radial: 12, radius: (t) => [8.4 - t * 4, 6.6 - t * 3.6] },
  ));
  // Brow scutes with the eye set into the outer edge
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE, M({ p: [side * 5, 4.4, 4], r: [0, 0, side * -0.25], s: [3.8, 2.4, 5] }));
    head.put('skin', SPHERE_LO, M({ p: [side * 6, 2.4, 5.6], s: [3.3, 3.3, 2.8] }));
    head.put('eye', SPHERE_LO, M({ p: [side * 6.6, 2.6, 8], s: [2.3, 2.3, 1.8] }));
  }
  // Crown: a gold band with five flame-shaped points
  head.put('gold', ring(6.4, 1.2, Math.PI * 1.35), M({ p: [0, 6.5, 0.5], r: [-1.35, 0, Math.PI * 0.83] }));
  for (let i = -2; i <= 2; i++) {
    head.put('gold', claw(9 - Math.abs(i) * 2, 1.5, 0.25, [i * 0.22, 1, 0.1], [0, 0, -1]), M({
      p: [i * 4.4, 8.2, 1.6 - Math.abs(i) * 0.6],
    }));
  }

  // --- jaw, fangs and a flicking forked tongue
  const jaw = rig.node('jaw', 'head', [0, -0.5, -1]);
  jaw.put('skin', tube(
    [[0, -1.5, -3], [0, -3.4, 5], [0, -3.6, 12], [0, -3, 18]],
    { segs: 7, radial: 10, radius: (t) => [6.6 - t * 3.2, 2.6 - t * 1.1] },
  ));
  for (const side of [-1, 1]) {
    jaw.put('bone', claw(10, 1.5, 0.4, [side * 0.12, 1, -0.2], [0, 0, 1]), M({ p: [side * 4, -3.4, 9] }));
  }
  for (const side of [-1, 1]) {
    jaw.put('ember', tube(
      [[0, -2.8, 15], [side * 1.2, -2, 20], [side * 3.2, -0.8, 24]],
      { segs: 6, radial: 4, radius: (t) => 0.85 * (1 - t) + 0.08, capEnd: false },
    ));
  }

  // --- arms: lean scaled arms with gold bands and venom claws
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'L' : 'R';
    const upper = rig.node(`arm${s}`, 'trunk', [side * 6.6, 32, 1]);
    upper.put('skin', SPHERE, M({ p: [side * 1.6, 0.5, 0], s: [4.2, 4.4, 4.2] }));
    upper.put('skin', tube(
      [[0, 0, 0], [side * 2.5, -12, 1.5], [side * 3, -24, 1]],
      { segs: 5, radial: 8, radius: (t) => 3.4 - t * 0.9 },
    ));
    upper.put('gold', ring(3.1, 0.8), M({ p: [side * 2.8, -15, 1.2], r: [Math.PI / 2, 0, 0] }));

    const fore = rig.node(`fore${s}`, `arm${s}`, [side * 3, -24, 1]);
    fore.put('skin', tube(
      [[0, 0, 0], [0, -12, 1], [0, -24, 0.5]],
      { segs: 5, radial: 8, radius: (t) => 2.6 - t * 0.8 },
    ));

    fore.put('skin', SPHERE_LO, M({ p: [0, -25.4, 0.6], s: [2.7, 3, 2] }));
    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * 2.1;
      fore.put('bone', claw(6.5, 0.9, 0.55, [spread * 0.12, -1, 0.2]), M({ p: [spread, -26.8, 1] }));
    }
  }

  return rig;
}

// ---------------------------------------------------------------------------
// Rakshasa - hulking tusked demon. boss = Mahishasura: taller, buffalo-horned,
// crowned, and wearing a mane of fire.
// ---------------------------------------------------------------------------

function buildRakshasa(boss) {
  const rig = new Rig(boss ? 128 : 120);
  const K = boss ? 1.1 : 1; // the boss is thicker as well as taller

  // --- hips and dhoti. Legs carry the lower half of the body: hips at 58 of
  // ~120 keeps him a heavy six-heads-tall brute rather than a squat barrel.
  const hips = rig.node('hips', null, [0, 58, 0]);
  hips.put('skin', tube(
    [[0, -10, 0], [0, -2, 0], [0, 8, 0]],
    { segs: 8, radial: 12, radius: (t) => [(13 - t * 1.5) * K, (10 - t) * K] },
  ));
  // Dhoti: a wrapped skirt, scalloped at the hem so it hangs like cloth
  // instead of sitting on him like a barrel.
  hips.put('cloth', sheet((u, v) => {
    const a = u * Math.PI;
    // Vertical folds deepen toward the hem so the wrap hangs in pleats
    const fold = 1 + Math.sin(u * Math.PI * 9) * 0.06 * v;
    const drape = (1 + v * 0.42) * fold;
    const hem = v ** 3 * (3 + Math.sin(u * Math.PI * 9 + 1) * 4);
    return [
      Math.sin(a) * 13.5 * K * drape,
      5 - v * 27 - hem,
      Math.cos(a) * 10.8 * K * drape,
    ];
  }, 40, 10));
  hips.put('gold', ring(13.6 * K, 1.4), M({ p: [0, 4, 0], r: [Math.PI / 2, 0, 0] }));
  // Knotted sash ends hanging down the front
  for (const off of [-4, 4]) {
    hips.put('cloth', tube(
      [[off, 3, 11 * K], [off * 1.3, -9, 12.5 * K], [off * 1.6, -23, 11.5 * K]],
      { segs: 5, radial: 8, radius: (t) => [4.5 - t * 1.2, 1.2], capStart: false, capEnd: false },
    ));
  }

  // --- torso: barrel chest over a heavy gut
  const torso = rig.node('torso', 'hips', [0, 7, 0]);
  const spine = [[0, 0, 0], [0, 11, 1.5], [0, 23, 1], [0, 34, -0.5], [0, 42, -1]];
  const bodyR = (t) => {
    const chest = Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.8);
    return [(13 + chest * 9) * K, (10.5 + chest * 5) * K];
  };
  torso.put('skin', tube(spine, { segs: 16, radial: 14, radius: bodyR, vScale: 2 }));
  // Pectoral slabs and gut fold
  for (const side of [-1, 1]) {
    torso.put('skin', SPHERE, M({ p: [side * 8 * K, 30, 9 * K], s: [9 * K, 6, 5.5 * K] }));
  }
  torso.put('skin', SPHERE, M({ p: [0, 13, 11 * K], s: [14 * K, 7, 4 * K] }));
  // Trapezius wedges sloping from the neck out to the shoulder caps. Kept low
  // and narrow so they never swallow the head.
  for (const side of [-1, 1]) {
    torso.put('skin', SPHERE, M({ p: [side * 11 * K, 34, -2], r: [0, 0, side * 0.6], s: [10 * K, 5, 8 * K] }));
  }
  // Skull garland swinging across the chest
  for (let i = -3; i <= 3; i++) {
    const t = (i + 3) / 6;
    const x = (-17 + t * 34) * K;
    const y = 33 - Math.sin(t * Math.PI) * 13;
    const z = (10 + Math.sin(t * Math.PI) * 3) * K;
    const tilt = 0.35 - t * 0.7;
    torso.put('bone', SPHERE_LO, M({ p: [x, y, z], r: [0.25, tilt, 0], s: [3, 3.4, 2.9] }));
    torso.put('bone', SPHERE_LO, M({ p: [x, y - 3.2, z + 0.8], r: [0.25, tilt, 0], s: [2.3, 1.8, 2.6] }));
  }
  torso.put('bone', tube(
    [[-17 * K, 33, 10 * K], [0, 20, 13 * K], [17 * K, 33, 10 * K]],
    { segs: 14, radial: 5, radius: () => 0.6, capStart: false, capEnd: false },
  ));

  // --- head, set on a thick neck that clears the shoulders
  const neck = rig.node('neck', 'torso', [0, 40, 0]);
  neck.put('skin', tube(
    [[0, -5, -1], [0, 3, 0], [0, 11, 1]],
    { segs: 6, radial: 10, radius: (t) => [(8.5 - t * 1.4) * K, (9 - t * 1.6) * K] },
  ));

  // Scaled up as a whole: a brute this wide needs a big head to read at all
  const head = rig.node('head', 'neck', [0, 10, 1], boss ? 1.3 : 1.28);
  head.put('skin', tube(
    boss
      ? [[0, 0, -8], [0, 4, 0], [0, 2, 9], [0, -2, 18]]
      : [[0, 0, -7], [0, 4, 0], [0, 2.5, 8], [0, 0, 15]],
    { segs: 10, radial: 12, radius: (t) => [(11 - t * 4.4) * K, (10.5 - t * 4.6) * K] },
  ));
  // Heavy brow shelf
  head.put('skin', SPHERE, M({ p: [0, 5.2, 6], r: [-0.25, 0, 0], s: [11.5 * K, 3.2, 5] }));
  // Two burning slits plus the third eye above the brow
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE_LO, M({ p: [side * 5 * K, 2, 7.6], s: [3.8, 3.2, 2.6] }));
    head.put('eye', SPHERE_LO, M({ p: [side * 5.1 * K, 2.2, 10], s: [2.6, 1.8, 1.5] }));
  }
  head.put('eye', SPHERE_LO, M({ p: [0, 8.6, 8], r: [0, 0, 0], s: [1.5, 3, 1.4] }));
  // Flat bovine nose pad and nostrils
  head.put('skin', SPHERE, M({ p: [0, -1.5, boss ? 17 : 14], s: [6.5, 4.6, 3.4] }));
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE_LO, M({ p: [side * 2.6, -1, boss ? 19.4 : 16.4], s: [1.5, 1.2, 1.2] }));
  }
  // Ears and gold discs
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE, M({ p: [side * 10.5 * K, 1, -1], r: [0, 0, side * 0.4], s: [3, 5, 2.4] }));
    head.put('gold', ring(3, 0.8), M({ p: [side * 11 * K, -4.5, -1], r: [0, Math.PI / 2, 0] }));
  }
  // Horns: ram-curled for the rakshasa, a wide buffalo sweep for the boss
  for (const side of [-1, 1]) {
    const pts = boss
      ? [
        [side * 7, 8, -1],
        [side * 18, 12, -3],
        [side * 29, 13, -5],
        [side * 37, 18, -2],
        [side * 36, 27, 6],
      ]
      : [
        [side * 8, 7, -1],
        [side * 16, 12, -4],
        [side * 20, 10, -12],
        [side * 15, 3, -16],
        [side * 10, 0, -11],
      ];
    head.put('horn', tube(pts, {
      segs: 12,
      radial: 8,
      radius: (t) => (boss ? 5.4 : 4.4) * (1 - t) ** 0.55 + 0.2,
      capEnd: false,
      vScale: 3,
    }));
  }

  const jaw = rig.node('jaw', 'head', [0, -1, -1]);
  jaw.put('skin', tube(
    [[0, -2, -4], [0, -5, 4], [0, -5.5, 12], [0, -4.5, boss ? 18 : 15]],
    { segs: 7, radial: 10, radius: (t) => [(9 - t * 3.6) * K, 4.2 - t * 1.5] },
  ));
  for (let i = -2; i <= 2; i++) {
    jaw.put('bone', BOX, M({
      p: [i * 3.2, -3.4, (boss ? 15 : 12.5) - Math.abs(i) * 1.6],
      r: [0.1, 0, 0],
      s: [2.4, 3.6, 2.2],
    }));
  }
  // Tusks sweeping up the outside of the snout, clear of the eyeline
  for (const side of [-1, 1]) {
    jaw.put('bone', claw(boss ? 17 : 13, boss ? 2.6 : 2.2, 0.55, [side * 0.42, 0.72, 0.55], [0, 0.4, -1]), M({
      p: [side * 7.5 * K, -4.5, 7],
    }));
  }

  if (boss) {
    // Crown of gold spikes across the brow
    head.put('gold', ring(9.5, 1.8, Math.PI * 1.25), M({ p: [0, 9, 1], r: [-1.3, 0, Math.PI * 0.87] }));
    for (let i = -2; i <= 2; i++) {
      head.put('gold', claw(11 - Math.abs(i) * 2.4, 2, 0.2, [i * 0.2, 1, 0.05], [0, 0, -1]), M({
        p: [i * 5.4, 11.5, 2 - Math.abs(i) * 0.7],
      }));
    }
    // Mane of fire flaring off the back of the skull
    for (let i = 0; i < 15; i++) {
      const a = Math.PI * (0.05 + (i / 14) * 0.9);
      const len = 15 + Math.sin(a) * 13;
      head.put('ember', claw(len, 2.6, 0.4, [-Math.cos(a) * 0.7, Math.sin(a) * 0.85, -0.35], [0, 0, -1]), M({
        p: [-Math.cos(a) * 10, 2 + Math.sin(a) * 5, -13],
      }));
    }
  }

  // --- arms: boulder shoulders, gold bands, taloned fists
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'L' : 'R';
    const upper = rig.node(`arm${s}`, 'torso', [side * 20 * K, 34, 0]);
    upper.put('skin', SPHERE, M({ p: [side * 2, 2, 0], s: [10.5 * K, 10 * K, 10.5 * K] }));
    upper.put('skin', tube(
      [[0, 0, 0], [side * 2.5, -12, 1], [side * 2.5, -24, 0]],
      { segs: 5, radial: 8, radius: (t) => (7.6 - t * 1.9) * K },
    ));
    upper.put('gold', ring(6.4 * K, 1.5), M({ p: [side * 2.5, -11, 0.5], r: [Math.PI / 2, 0, 0] }));
    // Shoulder spurs
    for (let i = 0; i < 3; i++) {
      upper.put('bone', claw(8, 1.7, 0.3, [side * 0.75, 0.6, (i - 1) * 0.35], [0, 1, 0]), M({
        p: [side * 6 * K, 6, (i - 1) * 5.5],
      }));
    }

    const fore = rig.node(`fore${s}`, `arm${s}`, [side * 2.5, -24, 0]);
    fore.put('skin', tube(
      [[0, 0, 0], [0, -12, 1.5], [0, -24, 0]],
      { segs: 5, radial: 8, radius: (t) => (6 - t * 1.7) * K },
    ));

    fore.put('skin', SPHERE_LO, M({ p: [0, -26.5, 1], s: [5.2 * K, 5.6, 4.2] }));
    for (let i = 0; i < 3; i++) {
      const spread = (i - 1) * 3.6;
      fore.put('bone', claw(9.5, 1.5, 0.55, [spread * 0.1, -1, 0.2]), M({ p: [spread, -29.5, 2] }));
    }
    fore.put('bone', claw(7.5, 1.4, 0.5, [side * -0.55, -0.85, 0.15]), M({ p: [side * -4, -28, 0] }));
  }

  // --- legs: tree-trunk thighs, anklets, clawed toes
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'L' : 'R';
    const thigh = rig.node(`leg${s}`, 'hips', [side * 8.5 * K, -8, 0]);
    thigh.put('skin', tube(
      [[0, 0, 1], [side * 1.5, -12, 0], [side * 2, -24, -1]],
      { segs: 5, radial: 8, radius: (t) => (9.8 - t * 2.8) * K },
    ));

    const shin = rig.node(`shin${s}`, `leg${s}`, [side * 2, -24, -1]);
    shin.put('skin', tube(
      [[0, 0, 0], [0, -9, 0.5], [0, -18, 2]],
      { segs: 5, radial: 8, radius: (t) => (7 - t * 2.6) * K },
    ));
    shin.put('gold', ring(4.8 * K, 1.2), M({ p: [0, -16, 1.6], r: [Math.PI / 2, 0, 0] }));

    const foot = rig.node(`foot${s}`, `shin${s}`, [0, -18, 2]);
    foot.put('skin', tube(
      [[0, 0, -4], [0, -2.5, 2], [0, -3.6, 9]],
      { segs: 5, radial: 8, radius: (t) => (5.4 - t * 1.4) * K },
    ));
    for (let i = -1; i <= 1; i++) {
      foot.put('skin', claw(6.5, 1.4, 0.3, [i * 0.28, -0.4, 0.87], [0, -1, 0]), M({
        p: [i * 3.6, -3.6, 8.6],
      }));
    }
  }

  return rig;
}

// ---------------------------------------------------------------------------
// Rig -> scene graph
// ---------------------------------------------------------------------------

const RIG_CACHE = new Map();

function rigFor(type, boss) {
  const key = boss ? 'boss' : type;
  if (!RIG_CACHE.has(key)) {
    const rig = type === 'asura' ? buildAsura()
      : type === 'naga' ? buildNaga()
        : buildRakshasa(!!boss);
    // Bake each node's material slots into finished geometries once.
    for (const node of rig.nodes) {
      node.geos = new Map();
      for (const [mat, part] of node.slots) {
        if (!part.empty) node.geos.set(mat, part.build());
      }
      node.slots = null;
    }
    RIG_CACHE.set(key, rig);
  }
  return RIG_CACHE.get(key);
}

// Where the eye-glow billboard rides on each head, in that head's local units.
const GLOW_PLACEMENT = {
  asura: { y: 3.4, z: 10, s: 20 },
  naga: { y: 2.6, z: 7, s: 20 },
  rakshasa: { y: 2.2, z: 10, s: 22 },
  boss: { y: 2.5, z: 11, s: 28 },
};

const EYE_COLORS = {
  asura: 0xffb040,
  naga: 0xd8ff50,
  rakshasa: 0xff7a20,
  boss: 0xff4010,
};

/**
 * Build one monster instance.
 *
 * @param {string} type   'asura' | 'naga' | 'rakshasa'
 * @param {boolean} boss  Mahishasura variant
 * @param {number} height World height in tiles (models are authored at 100/tile)
 * @returns a handle with { root, height, pose(state), setHurt(t), setFade(a), dispose() }
 */
export function createMonster(type, boss, height) {
  const rig = rigFor(type, boss);
  const protos = materialProtos(type);
  const eyeColor = EYE_COLORS[boss ? 'boss' : type];

  // Per-instance materials so one monster can flash or fade alone.
  const mats = {};
  const skinLike = [];
  for (const key of Object.keys(protos)) {
    const m = protos[key].clone();
    if (key === 'eye') m.color.setHex(eyeColor);
    if (key === 'ember') m.color.setHex(boss ? 0xff5a10 : type === 'naga' ? 0xc0ff40 : 0xff5a12);
    mats[key] = m;
    if (key !== 'eye' && key !== 'ember') skinLike.push(m);
  }

  const root = new THREE.Group();
  const groups = new Map();
  for (const node of rig.nodes) {
    const g = new THREE.Group();
    g.position.set(node.at[0], node.at[1], node.at[2]);
    if (node.scale !== 1) g.scale.setScalar(node.scale);
    g.userData.rest = g.position.clone();
    for (const [matKey, geo] of node.geos) {
      const mesh = new THREE.Mesh(geo, mats[matKey]);
      mesh.matrixAutoUpdate = false;
      g.add(mesh);
    }
    groups.set(node.name, g);
    (node.parent ? groups.get(node.parent) : root).add(g);
  }

  // Eye glow: one additive billboard riding the head, so the monster's stare
  // carries through the fog before the geometry resolves.
  const glowMat = new THREE.SpriteMaterial({
    map: textures().glow,
    color: eyeColor,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  // Sits at the eyeline, small enough to look like light leaking out of the
  // sockets rather than a lamp bolted to the face.
  const glow = new THREE.Sprite(glowMat);
  const g = GLOW_PLACEMENT[boss ? 'boss' : type];
  glow.scale.set(g.s, g.s * 0.55, 1);
  glow.position.set(0, g.y, g.z);
  const headGroup = groups.get('head');
  headGroup.add(glow);

  const scale = height / rig.authoredHeight;
  root.scale.setScalar(scale);

  const P = (name) => groups.get(name);
  const parts = {
    hips: P('hips') || P('trunk'),
    trunk: P('trunk'),
    torso: P('torso'),
    neck: P('neck') || P('torso'),
    head: headGroup,
    jaw: P('jaw'),
    hood: P('hood'),
    armL: P('armL'), armR: P('armR'),
    foreL: P('foreL'), foreR: P('foreR'),
    legL: P('legL'), legR: P('legR'),
    shinL: P('shinL'), shinR: P('shinR'),
    footL: P('footL'), footR: P('footR'),
  };

  const poser = type === 'naga' ? poseNaga : type === 'asura' ? poseAsura : poseRakshasa;

  let transparent = false;
  const handle = {
    root,
    type,
    boss: !!boss,
    height,
    parts,
    materials: skinLike,
    glow: glowMat,
    baseGlow: boss ? 1.25 : 0.75,

    pose(s) {
      poser(parts, s, handle);
    },

    // Red hit flash on every lit material.
    setHurt(k) {
      for (const m of skinLike) {
        m.emissive.setRGB(k * 0.75, k * 0.06, k * 0.05);
      }
    },

    // Corpse dissolve. Turning transparency on costs sorting, so it only
    // switches on once the monster actually starts to fade.
    setFade(alpha) {
      const on = alpha < 0.999;
      if (on !== transparent) {
        transparent = on;
        for (const key of Object.keys(mats)) {
          mats[key].transparent = on;
          mats[key].depthWrite = !on;
          mats[key].needsUpdate = true;
        }
      }
      if (on) for (const key of Object.keys(mats)) mats[key].opacity = alpha;
      glowMat.opacity = alpha;
    },

    dispose() {
      for (const key of Object.keys(mats)) mats[key].dispose();
      glowMat.dispose();
    },
  };
  return handle;
}

// ---------------------------------------------------------------------------
// Posing. state = { t, walk, moving, windup, dead, dist }
//   walk    monotonically increasing stride phase (radians)
//   moving  0..1 blend into the walk cycle
//   windup  0..1 blend into the attack rear-back
//   dead    0..1 death progress
// ---------------------------------------------------------------------------

const lerp = (a, b, k) => a + (b - a) * k;

// Shared spine/limb slackening as a corpse goes down.
function applyDeath(parts, d, drop) {
  if (d <= 0) return;
  const k = Math.min(1, d * 1.6);
  if (parts.torso) parts.torso.rotation.x = lerp(parts.torso.rotation.x, 0.7, k);
  if (parts.trunk) parts.trunk.rotation.x = lerp(parts.trunk.rotation.x, 1.0, k);
  if (parts.head) parts.head.rotation.x = lerp(parts.head.rotation.x, -0.9, k);
  if (parts.jaw) parts.jaw.rotation.x = lerp(parts.jaw.rotation.x, 0.75, k);
  for (const n of ['armL', 'armR']) {
    if (parts[n]) {
      parts[n].rotation.x = lerp(parts[n].rotation.x, -0.9, k);
      parts[n].rotation.z = lerp(parts[n].rotation.z, (n === 'armL' ? -1 : 1) * 0.5, k);
    }
  }
  for (const n of ['foreL', 'foreR']) {
    if (parts[n]) parts[n].rotation.x = lerp(parts[n].rotation.x, -0.4, k);
  }
  for (const n of ['legL', 'legR']) {
    if (parts[n]) parts[n].rotation.x = lerp(parts[n].rotation.x, 0.5, k);
  }
  for (const n of ['shinL', 'shinR']) {
    if (parts[n]) parts[n].rotation.x = lerp(parts[n].rotation.x, -1.5, k);
  }
  drop.pitch = d * 1.45;
  drop.sink = -d * 8;
}

function poseAsura(p, s, h) {
  const { t = 0, walk = 0, moving = 0, windup = 0, dead = 0 } = s;
  const stride = Math.sin(walk);
  const stride2 = Math.sin(walk * 2);
  const breathe = Math.sin(t * 2.2) * 0.04;

  // Legs: loping digitigrade cycle, knees snapping through under the body
  p.legL.rotation.x = stride * 0.8 * moving;
  p.legR.rotation.x = -stride * 0.8 * moving;
  p.shinL.rotation.x = -Math.max(0, -stride) * 0.9 * moving;
  p.shinR.rotation.x = -Math.max(0, stride) * 0.9 * moving;
  p.footL.rotation.x = Math.max(0, -stride) * 0.6 * moving;
  p.footR.rotation.x = Math.max(0, stride) * 0.6 * moving;

  // Spine: already hunched in the sculpt, so this only adds the stalk and bob
  p.torso.rotation.x = 0.08 + moving * 0.16 - windup * 0.42 + breathe;
  p.torso.rotation.y = stride * 0.12 * moving;
  p.hips.position.y = p.hips.userData.rest.y - Math.abs(stride2) * 2.4 * moving;
  p.hips.rotation.y = -stride * 0.1 * moving;

  // Head leads the lunge; jaw unhinges as the strike winds up
  p.head.rotation.x = 0.1 + moving * 0.1 + windup * 0.35 + Math.sin(t * 1.7) * 0.05;
  p.head.rotation.z = Math.sin(t * 0.9) * 0.07 * (1 - moving);
  p.head.rotation.y = Math.sin(t * 0.6) * 0.12 * (1 - moving) * (1 - windup);
  p.jaw.rotation.x = 0.06 + windup * 0.75 + Math.sin(t * 3.1) * 0.03;

  // Arms: long counter-swing, both hooked overhead on the wind-up
  const swing = -stride * 0.62 * moving;
  p.armL.rotation.x = lerp(-0.14 + swing, -0.5, windup);
  p.armR.rotation.x = lerp(-0.14 - swing, -0.5, windup);
  p.armL.rotation.z = lerp(-0.16, -2.45, windup);
  p.armR.rotation.z = lerp(0.16, 2.45, windup);
  p.foreL.rotation.x = lerp(-0.32 - Math.max(0, swing) * 0.7, -1.5, windup);
  p.foreR.rotation.x = lerp(-0.32 - Math.max(0, -swing) * 0.7, -1.5, windup);

  const drop = { pitch: 0, sink: 0 };
  applyDeath(p, dead, drop);
  h.root.rotation.x = drop.pitch;
  h.root.rotation.z = dead * 0.35;
  h.root.position.y = drop.sink * h.root.scale.y;
  h.glow.opacity = (1 - dead) * h.baseGlow * (0.7 + windup * 0.6 + Math.sin(t * 5) * 0.08);
}

function poseNaga(p, s, h) {
  const { t = 0, walk = 0, moving = 0, windup = 0, dead = 0 } = s;
  const slither = Math.sin(walk * 0.6);
  const idle = Math.sin(t * 1.3);

  // The coil rocks and the trunk sways; the whole body rears on the wind-up
  p.hips.rotation.y = slither * 0.22 * moving + idle * 0.04;
  p.trunk.rotation.z = slither * 0.12 * moving + idle * 0.05;
  p.trunk.rotation.x = lerp(0.02 + Math.sin(t * 1.1) * 0.04, -0.34, windup);
  p.trunk.position.y = p.trunk.userData.rest.y + windup * 4 + Math.sin(t * 1.6) * 0.7;

  // Hood flares wide as the strike builds
  const flare = windup;
  p.hood.scale.set(0.82 + flare * 0.42, 0.94 + flare * 0.12, 0.86 + flare * 0.3);
  p.hood.rotation.x = -0.06 - flare * 0.22;

  // Head tracks the target, jaw gapes and the fangs drop
  p.head.rotation.x = lerp(0.04 + idle * 0.05, 0.5, windup);
  p.head.rotation.y = idle * 0.1 * (1 - windup);
  p.jaw.rotation.x = 0.06 + windup * 1.0;

  // Arms spread as the hood opens
  const swing = slither * 0.3 * moving;
  p.armL.rotation.x = lerp(-0.12 + swing, -0.55, windup);
  p.armR.rotation.x = lerp(-0.12 - swing, -0.55, windup);
  p.armL.rotation.z = lerp(-0.14, -1.5, windup);
  p.armR.rotation.z = lerp(0.14, 1.5, windup);
  p.foreL.rotation.x = -0.45 - windup * 0.45;
  p.foreR.rotation.x = -0.45 - windup * 0.45;

  const drop = { pitch: 0, sink: 0 };
  applyDeath(p, dead, drop);
  // A dead naga slumps sideways off its coil rather than toppling like a biped
  h.root.rotation.z = dead * 1.1;
  h.root.rotation.x = dead * 0.2;
  h.root.position.y = -dead * 4 * h.root.scale.y;
  h.glow.opacity = (1 - dead) * h.baseGlow * (0.7 + windup * 0.7 + Math.sin(t * 4) * 0.08);
}

function poseRakshasa(p, s, h) {
  const { t = 0, walk = 0, moving = 0, windup = 0, dead = 0 } = s;
  const stride = Math.sin(walk);
  const stride2 = Math.sin(walk * 2);
  const breathe = Math.sin(t * 1.5) * 0.05;

  // Slow, heavy gait with a pronounced weight shift
  p.legL.rotation.x = stride * 0.55 * moving;
  p.legR.rotation.x = -stride * 0.55 * moving;
  p.shinL.rotation.x = -Math.max(0, -stride) * 0.8 * moving;
  p.shinR.rotation.x = -Math.max(0, stride) * 0.8 * moving;
  p.footL.rotation.x = Math.max(0, -stride) * 0.4 * moving;
  p.footR.rotation.x = Math.max(0, stride) * 0.4 * moving;

  p.hips.position.y = p.hips.userData.rest.y - Math.abs(stride2) * 2.8 * moving;
  p.hips.rotation.z = stride * 0.07 * moving;
  p.hips.rotation.y = -stride * 0.11 * moving;

  p.torso.rotation.x = 0.04 + moving * 0.12 - windup * 0.36 + breathe;
  p.torso.rotation.y = stride * 0.14 * moving;

  // Rears back and roars on the wind-up, then swings both fists down
  p.neck.rotation.x = lerp(0.02, -0.16, windup);
  p.head.rotation.x = lerp(-0.02 + Math.sin(t * 1.1) * 0.04, -0.1, windup);
  p.head.rotation.y = Math.sin(t * 0.7) * 0.12 * (1 - moving) * (1 - windup);
  p.jaw.rotation.x = 0.06 + windup * 0.85 + Math.abs(breathe);

  const swing = -stride * 0.5 * moving;
  p.armL.rotation.x = lerp(-0.06 + swing, -0.45, windup);
  p.armR.rotation.x = lerp(-0.06 - swing, -0.45, windup);
  p.armL.rotation.z = lerp(-0.14, -2.3, windup);
  p.armR.rotation.z = lerp(0.14, 2.3, windup);
  p.foreL.rotation.x = lerp(-0.3, -1.35, windup);
  p.foreR.rotation.x = lerp(-0.3, -1.35, windup);

  const drop = { pitch: 0, sink: 0 };
  applyDeath(p, dead, drop);
  h.root.rotation.x = drop.pitch * 0.85;
  h.root.rotation.z = -dead * 0.3;
  h.root.position.y = drop.sink * h.root.scale.y;
  h.glow.opacity = (1 - dead) * h.baseGlow * (0.7 + windup * 0.8 + Math.sin(t * 6) * 0.1);
}
