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

  // amp: how far the surface is pushed along its normal by the flesh noise.
  // Zero leaves the shape as authored (teeth, eyes, metal).
  build(amp, seed) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setIndex(this.idx);
    if (amp > 0) displace(geo, amp, seed);
    bakeCavityAO(geo, amp);
    geo.computeBoundingSphere();
    return geo;
  }
}

// ---------------------------------------------------------------------------
// Surface detail
//
// Swept tubes are smooth, and smooth reads as inflatable rather than alive.
// Every skin surface is pushed around by layered value noise before it is
// frozen, so the silhouette itself breaks up: knotted muscle, slack hide,
// bone pressing through. The same noise then drives a baked cavity term so
// the pits stay dark no matter which way the torches are pointing.
// ---------------------------------------------------------------------------

// Cheap 3D value noise. Deterministic, so a monster looks the same every load.
function hash3(x, y, z, seed) {
  let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 45.3) * 43758.5453;
  h -= Math.floor(h);
  return h;
}

function vnoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const sx = xf * xf * (3 - 2 * xf);
  const sy = yf * yf * (3 - 2 * yf);
  const sz = zf * zf * (3 - 2 * zf);
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k, seed);
  const lx = (a, b) => a + (b - a) * sx;
  const y0 = lx(c(0, 0, 0), c(1, 0, 0)) + (lx(c(0, 1, 0), c(1, 1, 0)) - lx(c(0, 0, 0), c(1, 0, 0))) * sy;
  const y1 = lx(c(0, 0, 1), c(1, 0, 1)) + (lx(c(0, 1, 1), c(1, 1, 1)) - lx(c(0, 0, 1), c(1, 0, 1))) * sy;
  return y0 + (y1 - y0) * sz;
}

// Layered noise in [-1, 1], biased so troughs are deeper than peaks: flesh
// sags and creases more readily than it bulges.
function fleshNoise(x, y, z, seed) {
  let n = 0;
  let f = 0.055;
  let a = 1;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    n += (vnoise(x * f, y * f, z * f, seed + o * 17) - 0.5) * 2 * a;
    norm += a;
    f *= 2.15;
    a *= 0.52;
  }
  n /= norm;
  return n < 0 ? n * 1.35 : n;
}

// Push every vertex along its normal, then rebuild normals so the lighting
// follows the new surface. Shared vertices are displaced identically because
// the noise is sampled in position space, so seams stay welded.
function displace(geo, amp, seed = 1) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const n = pos.count;
  const detail = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const d = fleshNoise(x, y, z, seed);
    detail[i] = d;
    pos.setXYZ(i, x + nrm.getX(i) * d * amp, y + nrm.getY(i) * d * amp, z + nrm.getZ(i) * d * amp);
  }
  geo.userData.detail = detail;
  geo.computeVertexNormals();
  pos.needsUpdate = true;
  return geo;
}

// Bake the cavity term into vertex colours: creases go dark, ridges stay lit,
// and downward-facing surfaces pick up a little extra occlusion. Costs nothing
// at runtime and is what stops the models reading as smooth plastic.
function bakeCavityAO(geo, amp) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const n = pos.count;
  const detail = geo.userData.detail;
  const col = new Float32Array(n * 3);
  // Undisplaced surfaces (metal, teeth, eyes) have no cavities to bake and
  // should not be darkened; they still need the attribute because the
  // materials all declare vertexColors.
  if (amp === 0) {
    col.fill(1);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    delete geo.userData.detail;
    return geo;
  }
  for (let i = 0; i < n; i++) {
    const d = detail ? detail[i] : 0;
    // Pits (negative displacement) darken hard; bumps brighten slightly.
    let ao = 1 + (d < 0 ? d * 0.85 : d * 0.18);
    // Undersides sit in their own shadow.
    ao *= 0.78 + 0.22 * (nrm.getY(i) * 0.5 + 0.5);
    ao = Math.max(0.46, Math.min(1.1, ao));
    col[i * 3] = ao;
    col[i * 3 + 1] = ao;
    col[i * 3 + 2] = ao;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  delete geo.userData.detail;
  return geo;
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

const SPHERE = new THREE.SphereGeometry(1, 22, 16);
const SPHERE_LO = new THREE.SphereGeometry(1, 14, 10);
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
      segs: 11,
      radial: 9,
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

// Splits, fissures and weeping cracks. Used on every hide: unbroken skin is
// what made these read as inflatable.
function fissures(ctx, size, count, color, width, len) {
  for (let i = 0; i < count; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    let a = Math.random() * PI2;
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (0.5 + Math.random());
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    const segs = 3 + ((Math.random() * 4) | 0);
    for (let s = 0; s < segs; s++) {
      a += (Math.random() - 0.5) * 1.4;
      x += Math.cos(a) * len;
      y += Math.sin(a) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Dried and half-dried blood, pooled where it would actually run.
function gore(ctx, size, amount) {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 6 + Math.random() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${58 + Math.random() * 40 | 0},8,6,0.72)`);
    g.addColorStop(0.55, 'rgba(38,6,5,0.4)');
    g.addColorStop(1, 'rgba(24,4,4,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
    // Runs trailing downward from the pool
    if (Math.random() < 0.6) {
      ctx.strokeStyle = 'rgba(46,7,6,0.5)';
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 8, y + r * (0.8 + Math.random() * 1.6));
      ctx.stroke();
    }
  }
}

// Asura: burnt-out flesh. Ash grey over dried blood, blistered and split,
// with heat still showing deep in the fissures.
function paintAsuraSkin(ctx, size) {
  ctx.fillStyle = '#4a423c';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#5d554d', '#332c28', '#6b6058', '#3e2f28', '#241c19'], 130, 8, 52, 0.7);
  // Blistering
  for (let i = 0; i < 340; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1 + Math.random() * 4;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, 'rgba(150,138,126,0.5)');
    g.addColorStop(1, 'rgba(26,20,17,0.42)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
  }
  fissures(ctx, size, 46, 'rgba(14,9,7,0.75)', 1.7, 9);
  gore(ctx, size, 14);
  // Heat still alive at the bottom of the deepest splits
  for (let i = 0; i < 9; i++) {
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.strokeStyle = `rgba(198,${64 + Math.random() * 40 | 0},14,${0.3 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.9 + Math.random() * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (Math.random() - 0.5) * 26;
      y += (Math.random() - 0.5) * 26;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

// Naga: cold olive-grey scale, dull and sick rather than jewel-green, with
// patches of shed skin lifting off it.
function paintNagaScale(ctx, size) {
  ctx.fillStyle = '#4c5340';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#5c6349', '#333829', '#6a6d52', '#252a20'], 80, 10, 54, 0.65);
  const rows = 18;
  const cols = 18;
  const w = size / cols;
  const h = size / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols + 1; c++) {
      const x = c * w + (r % 2 ? w / 2 : 0);
      const y = r * h;
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(126,132,102,0.30)');
      g.addColorStop(0.55, 'rgba(52,58,42,0.12)');
      g.addColorStop(1, 'rgba(8,10,7,0.62)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y);
      ctx.quadraticCurveTo(x, y + h * 1.5, x + w * 0.5, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(6,9,6,0.5)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  }
  // Shed skin peeling away in ragged sheets
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(186,182,158,${0.10 + Math.random() * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 8 + Math.random() * 26, 5 + Math.random() * 14, Math.random() * PI2, 0, PI2);
    ctx.fill();
  }
  fissures(ctx, size, 22, 'rgba(8,12,8,0.6)', 1.3, 11);
  gore(ctx, size, 6);
}

// Rakshasa: grey-violet corpse flesh, bruised and stitched with old scar
// tissue, blood dried into the creases.
function paintRakshasaHide(ctx, size) {
  ctx.fillStyle = '#4a4048';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#5a4e5c', '#302932', '#655a64', '#3b2f38', '#221c26'], 110, 12, 58, 0.72);
  // Bruising under the skin
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 14 + Math.random() * 40;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(58,32,64,0.4)');
    g.addColorStop(0.6, 'rgba(40,26,34,0.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, PI2);
    ctx.fill();
  }
  // Pores and stubble
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(14,10,16,${0.14 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 0.5 + Math.random() * 1.5, 0, PI2);
    ctx.fill();
  }
  // Old wounds, raised and pale
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const a = Math.random() * PI2;
    const l = 24 + Math.random() * 80;
    ctx.strokeStyle = 'rgba(168,146,158,0.28)';
    ctx.lineWidth = 1.6 + Math.random() * 2.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
    // Stitch marks across the worst of them
    if (Math.random() < 0.45) {
      ctx.strokeStyle = 'rgba(20,14,18,0.5)';
      ctx.lineWidth = 1;
      for (let s = 0; s < l / 9; s++) {
        const px = x + Math.cos(a) * s * 9;
        const py = y + Math.sin(a) * s * 9;
        ctx.beginPath();
        ctx.moveTo(px - Math.sin(a) * 4, py + Math.cos(a) * 4);
        ctx.lineTo(px + Math.sin(a) * 4, py - Math.cos(a) * 4);
        ctx.stroke();
      }
    }
  }
  fissures(ctx, size, 26, 'rgba(12,8,14,0.6)', 1.5, 10);
  gore(ctx, size, 10);
}

// Bone: stained and greasy, never white.
function paintBone(ctx, size) {
  ctx.fillStyle = '#b3a892';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#cabfa6', '#8e8168', '#6d6047', '#a08a63'], 55, 10, 62, 0.6);
  ctx.strokeStyle = 'rgba(58,46,26,0.4)';
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.lineWidth = 0.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 44, y + (Math.random() - 0.5) * 9);
    ctx.stroke();
  }
  // Grime settling into the porous end and dried blood at the root
  mottle(ctx, size, ['#4a3a22', '#2d2415'], 30, 14, 58, 0.5);
  gore(ctx, size, 5);
}

// Tarnished metal. Whatever gold these things wore stopped shining a long
// time ago.
function paintGold(ctx, size) {
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#3f3218');
  g.addColorStop(0.35, '#9a8244');
  g.addColorStop(0.55, '#6d5a2a');
  g.addColorStop(0.8, '#a89055');
  g.addColorStop(1, '#332811');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Verdigris and soot in the low spots
  mottle(ctx, size, ['#3c4a32', '#1e1a10', '#54452a'], 45, 8, 42, 0.55);
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = `rgba(30,22,6,${0.14 + Math.random() * 0.36})`;
    ctx.lineWidth = 0.5 + Math.random() * 1.6;
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 26, y + (Math.random() - 0.5) * 26);
    ctx.stroke();
  }
}

// Filthy rag, not cloth: soaked dark at the hem, worn through elsewhere.
function paintCloth(ctx, size) {
  ctx.fillStyle = '#4e4038';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#5e4d42', '#312722', '#6a5445'], 50, 10, 52, 0.7);
  ctx.strokeStyle = 'rgba(18,12,9,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  // Threadbare patches
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = `rgba(12,8,6,${0.2 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(Math.random() * size, Math.random() * size,
      3 + Math.random() * 12, 2 + Math.random() * 8, Math.random() * PI2, 0, PI2);
    ctx.fill();
  }
  gore(ctx, size, 12);
}

// Horn and claw: dark keratin with growth rings and chipped tips.
function paintHorn(ctx, size) {
  ctx.fillStyle = '#4b4335';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#645741', '#2a231a', '#7b6d51'], 55, 12, 52, 0.65);
  // Growth rings run across the horn (u wraps, v runs along it)
  for (let y = 0; y < size; y += 6) {
    ctx.strokeStyle = `rgba(18,13,7,${0.24 + Math.random() * 0.4})`;
    ctx.lineWidth = 1 + Math.random() * 2.8;
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random() * 2);
    ctx.lineTo(size, y + Math.random() * 2);
    ctx.stroke();
  }
  // Splits along the grain
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * size;
    ctx.strokeStyle = 'rgba(10,7,4,0.55)';
    ctx.lineWidth = 0.8 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, Math.random() * size);
    ctx.lineTo(x + (Math.random() - 0.5) * 6, Math.random() * size);
    ctx.stroke();
  }
  gore(ctx, size, 4);
}

// Fresh blood, for the surfaces that are actually wet.
function paintBlood(ctx, size) {
  ctx.fillStyle = '#42090a';
  ctx.fillRect(0, 0, size, size);
  mottle(ctx, size, ['#6d1210', '#280505', '#8a1c14'], 60, 8, 44, 0.8);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(${90 + Math.random() * 50 | 0},16,12,${0.3 + Math.random() * 0.4})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 10, y + 10 + Math.random() * 40);
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
    blood: canvasTex(paintBlood, { size: 128, repeat: [1, 1] }),
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

  // Wet flesh, not painted plastic. A broad low-shininess sheen is what makes
  // a surface read as a toy; live tissue gives a small, hard, off-white
  // highlight over a dark desaturated base. Every lit material also carries
  // vertexColors so the baked cavity term multiplies in.
  const flesh = (map, color, opts = {}) => rimLit(new THREE.MeshPhongMaterial({
    map,
    bumpMap: map,
    bumpScale: 1.6,
    color,
    // A tight, dim highlight reads as damp. A broad bright one reads as
    // varnished plastic, which is exactly what we are getting away from.
    specular: 0x241f1b,
    shininess: 64,
    vertexColors: true,
    ...opts,
  }), opts.rim);

  return {
    skin: flesh(skinMap, type === 'naga' ? 0xb9c4a6 : type === 'asura' ? 0xcabbae : 0xbcb0c6),
    // Bone stays matte and dirty - clean white teeth look comical.
    bone: flesh(T.bone, 0xcabfa8, { specular: 0x1e1a16, shininess: 26, bumpScale: 0.8 }),
    horn: flesh(T.horn, 0xc8bfa8, { specular: 0x241f18, shininess: 30, bumpScale: 1.2 }),
    // What little metal survives is tarnished, not jewellery-bright.
    gold: flesh(T.gold, 0xa89468, { specular: 0x6e6244, shininess: 52, bumpScale: 0.5 }),
    cloth: flesh(T.cloth, 0xb4a89c, {
      specular: 0x100d0b, shininess: 8, bumpScale: 1.1,
      side: THREE.DoubleSide, // wraps and rags are open sheets, seen from inside
    }),
    // Pale ventral scutes, cold against the warm torchlight.
    belly: flesh(T.naga, 0xd6d2a8, { specular: 0x2c2c24, shininess: 40 }),
    // Open sheets (the naga's hood) are seen from both faces.
    membrane: flesh(skinMap, type === 'naga' ? 0xafbb9e : 0xbcb0c6, {
      side: THREE.DoubleSide, shininess: 54,
    }),
    // Wet blood: darker than the hide, and glossier than anything else on it.
    blood: rimLit(new THREE.MeshPhongMaterial({
      map: T.blood, bumpMap: T.blood, bumpScale: 0.7,
      color: 0x561512, specular: 0x4a231e, shininess: 86,
      vertexColors: true, transparent: true, opacity: 0.95, side: THREE.DoubleSide,
    })),
    eye: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    // Emissive rather than unlit, so flames and hot cracks still catch a
    // little shading instead of reading as flat orange cardboard.
    ember: new THREE.MeshPhongMaterial({
      color: 0x3a0c03, emissive: 0xd83c08, emissiveIntensity: 1, specular: 0xffc060, shininess: 40,
    }),
  };
}

// Adds a view-angle rim term to a Phong material. In a level this dark a
// creature's edge would otherwise dissolve into the fog; a cold rim separates
// it from the background and reads as damp skin catching stray light.
function rimLit(mat, rim) {
  mat.userData.rim = rim || 0x5a6a86;
  return applyRim(mat);
}

// Installs the rim patch on a material. Must be re-run after clone(): three's
// Material.copy() carries neither onBeforeCompile nor customProgramCacheKey,
// so a cloned material silently renders without the effect. The setting lives
// in userData, which clone() does preserve.
export function applyRim(mat) {
  const color = new THREE.Color(mat.userData.rim);
  const strength = 0.32;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: color };
    shader.uniforms.rimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 rimColor;
        uniform float rimStrength;`)
      // After <opaque_fragment> so the rim is still tone-mapped and, more
      // importantly, still fogged - it must fade with distance like everything
      // else or it draws an outline around monsters you should not yet see.
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float rimF = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
        gl_FragColor.rgb += rimColor * pow(rimF, 3.0) * rimStrength;`);
  };
  // Materials with different shader patches must not share a program.
  mat.customProgramCacheKey = () => `rim${color.getHex()}`;
  return mat;
}

// ---------------------------------------------------------------------------
// Asura - gaunt ember-cracked ghoul: hunched, long-armed, digitigrade.
// Authored in a neutral stance (feet flat on y=0, arms hanging) so every rest
// rotation in the poser is zero.
// ---------------------------------------------------------------------------

function buildAsura(seed = 1) {
  const rig = new Rig(112);
  rig.dispScale = 1;
  const r = rng(seed);

  // --- hips: narrow pelvis under a shredded loincloth
  const hips = rig.node('hips', null, [0, 52, 0]);
  hips.put('skin', tube(
    [[0, -9, 0], [0, -2, 0.5], [0, 7, -1]],
    { segs: 16, radial: 20, radius: (t) => [8.5 - t * 1.6, 6.6 - t * 1.2] },
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
  torso.put('skin', tube(spine, { segs: 30, radial: 24, radius: chestR, vScale: 2 }));
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
    [[0, 12, 3.2], [0, 17, 4.1], [0, 22, 3.9]],
    { segs: 12, radial: 10, radius: (t) => [0.22 + Math.sin(t * Math.PI) * 0.22, 1.1] },
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
    { segs: 14, radial: 16, radius: (t) => [4.2 + t * 2.4, 4 + t * 2.2] },
  ));
  // Cranium tapering into a long snout
  head.put('skin', tube(
    [[0, 3.5, 2], [0, 5, 8], [0, 3.6, 14], [0, 1.4, 20]],
    { segs: 20, radial: 20, radius: (t) => [7.6 - t * 4.6, 7.2 - t * 4.8] },
  ));
  // Brow shelf overhanging the sockets
  head.put('skin', SPHERE, M({ p: [0, 6.4, 7.5], r: [-0.3, 0, 0], s: [8.2, 2.6, 5] }));
  // Sockets: dark pits with a burning coal set deep inside
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE_LO, M({ p: [side * 4.2, 3.4, 8.4], s: [3.4, 3.2, 2.4] }));
    head.put('eye', SPHERE_LO, M({ p: [side * 4.3, 3.4, 10.3], s: [1.25, 1, 0.9] }));
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
    // Horns differ per variant and per side: length, sweep, and the odd
    // stunted or broken one.
    const hl = 0.72 + r() * 0.62;
    const hs = 0.8 + r() * 0.5;
    head.put('horn', tube(
      [
        [side * 4, 7.5, 2],
        [side * 7.5, 14, -2 * hs],
        [side * 9, 12 + 8 * hl, -10 * hs],
        [side * 7, 13 + 9 * hl, -19 * hs],
        [side * 4.5, 12 + 8 * hl, -25 * hs],
      ],
      { segs: 22, radial: 14, radius: (t) => 3.1 * (1 - t) ** 0.55 + 0.15, capEnd: false, vScale: 3 },
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
    { segs: 16, radial: 16, radius: (t) => [5 - t * 2.6, 2.8 - t * 1.2] },
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
      { segs: 14, radial: 16, radius: (t) => 4.3 - t * 1.3 },
    ));

    const fore = rig.node(`fore${s}`, `arm${s}`, [side * 1, -26, 0]);
    fore.put('skin', tube(
      [[0, 0, 0], [0, -13, -1], [0, -26, 0]],
      { segs: 14, radial: 16, radius: (t) => 3.1 - t * 1.1 },
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
      { segs: 14, radial: 16, radius: (t) => 6.6 - t * 2.6 },
    ));

    // Knee driven forward, shin raking back down to a raised heel
    const shin = rig.node(`shin${s}`, `leg${s}`, [side * 1.6, -22, -6]);
    shin.put('skin', tube(
      [[0, 0, 0], [0, -11, 4], [0, -22, 8]],
      { segs: 14, radial: 16, radius: (t) => 4.4 - t * 2.4 },
    ));
    shin.put('bone', claw(6.5, 1.4, 0.3, [0, 0.35, 0.9], [0, 1, 0]), M({ p: [0, 0.5, 2.6] }));

    const foot = rig.node(`foot${s}`, `shin${s}`, [0, -22, 8]);
    foot.put('skin', tube(
      [[0, 0, -1], [0, -4, 3], [0, -6.5, 8]],
      { segs: 10, radial: 14, radius: (t) => 3.2 - t * 1.1 },
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

function buildNaga(seed = 1) {
  const rig = new Rig(108);
  rig.dispScale = 0.85;
  const r = rng(seed);

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
    segs: 88,
    radial: 18,
    radius: (t) => 8 - t * 2.6,
    vScale: 8,
  }));
  // Tail slipping out of the coil and flicking up
  hips.put('skin', tube(
    [[22, 4, 4], [28, 5, 13], [30, 8.5, 22], [26, 14, 28]],
    { segs: 20, radial: 14, radius: (t) => 4.6 * (1 - t) ** 0.8 + 0.15, capEnd: false },
  ));

  // --- trunk: serpentine body rising in an S out of the coil
  const trunk = rig.node('trunk', 'hips', [0, 21, 0]);
  trunk.put('skin', tube(
    [[0, 0, -3], [0, 11, 1], [0, 23, 3.5], [0, 35, 1], [0, 45, -3]],
    { segs: 30, radial: 22, radius: (t) => [7.6 - t * 2.6, 7 - t * 2.4], vScale: 5 },
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
  // Old rope still knotted round the trunk, sunk into the flesh
  trunk.put('cloth', ring(6.6, 1.1), M({ p: [0, 34, 0], r: [Math.PI / 2, 0, 0] }));

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
  hood.put('membrane', sheet(hoodAt, 40, 26));
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
  // Two dead sockets marked into the back of the hood - the false eyes a real
  // cobra wears, here sunken and weeping rather than painted gold.
  for (const side of [-1, 1]) {
    hood.put('blood', SPHERE_LO, M({ p: [side * 7, 29, -8], s: [4.4, 5.2, 1.2] }));
    hood.put('bone', ring(4.6, 0.9), M({ p: [side * 7, 29, -8.6], r: [0.2, 0, 0] }));
  }
  // Ragged tears through the hood membrane, healed open
  for (let i = 0; i < 5; i++) {
    const u = -0.75 + i * 0.36 + (r() - 0.5) * 0.2;
    const v = 0.25 + r() * 0.5;
    hood.put('blood', tube(
      [hoodAt(u, v - 0.16), hoodAt(u + 0.06, v), hoodAt(u - 0.03, v + 0.18)],
      { segs: 6, radial: 5, radius: (t) => [1.5 * Math.sin(t * Math.PI) + 0.2, 1.4] },
    ));
  }

  // --- head: broad viper skull under a gold crown
  const head = rig.node('head', 'trunk', [0, 43, 0], 1.18);
  head.put('skin', tube(
    [[0, 0, -5], [0, 3, 2], [0, 2.6, 10], [0, 0.5, 18]],
    { segs: 20, radial: 20, radius: (t) => [8.4 - t * 4, 6.6 - t * 3.6] },
  ));
  // Brow scutes with the eye set into the outer edge
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE, M({ p: [side * 5, 4.4, 4], r: [0, 0, side * -0.25], s: [3.8, 2.4, 5] }));
    head.put('skin', SPHERE_LO, M({ p: [side * 6, 2.4, 5.6], s: [3.3, 3.3, 2.8] }));
    head.put('eye', SPHERE_LO, M({ p: [side * 6.6, 2.6, 7.8], s: [1.5, 1.5, 1.2] }));
  }
  // A crest of bare bone spines pushing up through the scalp, uneven
  for (let i = -2; i <= 2; i++) {
    head.put('bone', claw(
      (8 - Math.abs(i) * 1.8) * (0.75 + r() * 0.5), 1.4, 0.3,
      [i * 0.3, 1, -0.15], [0, 0, -1],
    ), M({ p: [i * 3.6, 6.4, 1.2 - Math.abs(i) * 0.5] }));
  }

  // --- jaw, fangs and a flicking forked tongue
  const jaw = rig.node('jaw', 'head', [0, -0.5, -1]);
  jaw.put('skin', tube(
    [[0, -1.5, -3], [0, -3.4, 5], [0, -3.6, 12], [0, -3, 18]],
    { segs: 16, radial: 16, radius: (t) => [6.6 - t * 3.2, 2.6 - t * 1.1] },
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
      { segs: 14, radial: 16, radius: (t) => 3.4 - t * 0.9 },
    ));
    // Wire bitten into the arm, not an armlet
    upper.put('bone', ring(3.1, 0.5), M({ p: [side * 2.8, -15, 1.2], r: [Math.PI / 2, 0, 0] }));

    const fore = rig.node(`fore${s}`, `arm${s}`, [side * 3, -24, 1]);
    fore.put('skin', tube(
      [[0, 0, 0], [0, -12, 1], [0, -24, 0.5]],
      { segs: 14, radial: 16, radius: (t) => 2.6 - t * 0.8 },
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

function buildRakshasa(boss, seed = 1) {
  const rig = new Rig(boss ? 128 : 120);
  rig.dispScale = 1.35; // a bulkier body needs bigger folds to read at all
  const r = rng(seed);
  const K = boss ? 1.1 : 1; // the boss is thicker as well as taller

  // --- hips and dhoti. Legs carry the lower half of the body: hips at 58 of
  // ~120 keeps him a heavy six-heads-tall brute rather than a squat barrel.
  const hips = rig.node('hips', null, [0, 58, 0]);
  hips.put('skin', tube(
    [[0, -10, 0], [0, -2, 0], [0, 8, 0]],
    { segs: 16, radial: 20, radius: (t) => [(13 - t * 1.5) * K, (10 - t) * K] },
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
  hips.put('cloth', ring(13.6 * K, 1.4), M({ p: [0, 4, 0], r: [Math.PI / 2, 0, 0] }));
  // Knotted sash ends hanging down the front
  for (const off of [-4, 4]) {
    hips.put('cloth', tube(
      [[off, 3, 11 * K], [off * 1.3, -9, 12.5 * K], [off * 1.6, -23, 11.5 * K]],
      { segs: 14, radial: 16, radius: (t) => [4.5 - t * 1.2, 1.2], capStart: false, capEnd: false },
    ));
  }

  // --- torso: barrel chest over a heavy gut
  const torso = rig.node('torso', 'hips', [0, 7, 0]);
  const spine = [[0, 0, 0], [0, 11, 1.5], [0, 23, 1], [0, 34, -0.5], [0, 42, -1]];
  const bodyR = (t) => {
    const chest = Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.8);
    return [(13 + chest * 9) * K, (10.5 + chest * 5) * K];
  };
  torso.put('skin', tube(spine, { segs: 30, radial: 24, radius: bodyR, vScale: 2 }));
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
    { segs: 14, radial: 16, radius: (t) => [(8.5 - t * 1.4) * K, (9 - t * 1.6) * K] },
  ));

  // Scaled up as a whole: a brute this wide needs a big head to read at all
  const head = rig.node('head', 'neck', [0, 10, 1], boss ? 1.3 : 1.28);
  head.put('skin', tube(
    boss
      ? [[0, 0, -8], [0, 4, 0], [0, 2, 9], [0, -2, 18]]
      : [[0, 0, -7], [0, 4, 0], [0, 2.5, 8], [0, 0, 15]],
    { segs: 20, radial: 20, radius: (t) => [(11 - t * 4.4) * K, (10.5 - t * 4.6) * K] },
  ));
  // Heavy brow shelf
  head.put('skin', SPHERE, M({ p: [0, 5.2, 6], r: [-0.25, 0, 0], s: [11.5 * K, 3.2, 5] }));
  // Two burning slits plus the third eye above the brow
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE_LO, M({ p: [side * 5 * K, 2, 7.6], s: [3.8, 3.2, 2.6] }));
    head.put('eye', SPHERE_LO, M({ p: [side * 5.1 * K, 2.2, 9.7], s: [1.7, 1.15, 1] }));
  }
  head.put('eye', SPHERE_LO, M({ p: [0, 8.6, 7.8], r: [0, 0, 0], s: [0.95, 2, 0.9] }));
  // Flat bovine nose pad and nostrils
  head.put('skin', SPHERE, M({ p: [0, -1.5, boss ? 17 : 14], s: [6.5, 4.6, 3.4] }));
  for (const side of [-1, 1]) {
    head.put('skin', SPHERE_LO, M({ p: [side * 2.6, -1, boss ? 19.4 : 16.4], s: [1.5, 1.2, 1.2] }));
  }
  // Ears and gold discs
  for (const side of [-1, 1]) {
    // Torn ear, with the ring that tore it still through the remains
    head.put('skin', SPHERE, M({ p: [side * 10.5 * K, 1, -1], r: [0, 0, side * 0.4], s: [3, 5, 2.4] }));
    head.put('gold', ring(3, 0.6, Math.PI * 1.5), M({ p: [side * 11 * K, -4.5, -1], r: [0, Math.PI / 2, 0.6] }));
  }
  // Horns: ram-curled for the rakshasa, a wide buffalo sweep for the boss
  for (const side of [-1, 1]) {
    // Horn spread and curl vary per variant and per side
    const hw = 0.82 + r() * 0.42;
    const hc = 0.78 + r() * 0.5;
    const pts = boss
      ? [
        [side * 7, 8, -1],
        [side * 18 * hw, 12, -3],
        [side * 29 * hw, 13, -5 * hc],
        [side * 37 * hw, 18, -2 * hc],
        [side * 36 * hw, 20 + 9 * hc, 6 * hc],
      ]
      : [
        [side * 8, 7, -1],
        [side * 16 * hw, 12, -4 * hc],
        [side * 20 * hw, 10, -12 * hc],
        [side * 15 * hw, 3, -16 * hc],
        [side * 10 * hw, 0, -11 * hc],
      ];
    head.put('horn', tube(pts, {
      segs: 22,
      radial: 14,
      radius: (t) => (boss ? 5.4 : 4.4) * (1 - t) ** 0.55 + 0.2,
      capEnd: false,
      vScale: 3,
    }));
  }

  const jaw = rig.node('jaw', 'head', [0, -1, -1]);
  jaw.put('skin', tube(
    [[0, -2, -4], [0, -5, 4], [0, -5.5, 12], [0, -4.5, boss ? 18 : 15]],
    { segs: 16, radial: 16, radius: (t) => [(9 - t * 3.6) * K, 4.2 - t * 1.5] },
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
    // A crown of driven iron: spikes hammered through the skull, not worn on it
    head.put('gold', ring(9.5, 1.4, Math.PI * 1.25), M({ p: [0, 9, 1], r: [-1.3, 0, Math.PI * 0.87] }));
    for (let i = -2; i <= 2; i++) {
      head.put('gold', claw(12 - Math.abs(i) * 2.4, 1.5, 0.12, [i * 0.24, 1, 0.05], [0, 0, -1]), M({
        p: [i * 5.4, 10.5, 2 - Math.abs(i) * 0.7],
      }));
      head.put('blood', SPHERE_LO, M({ p: [i * 5.4, 9.5, 2.4 - Math.abs(i) * 0.7], s: [3, 2.4, 2.6] }));
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
      { segs: 14, radial: 16, radius: (t) => (7.6 - t * 1.9) * K },
    ));
    // Iron shackle, with a broken length of chain still hanging off it
    upper.put('gold', ring(6.4 * K, 1.5), M({ p: [side * 2.5, -11, 0.5], r: [Math.PI / 2, 0, 0] }));
    for (let i = 0; i < 4; i++) {
      upper.put('gold', ring(1.9, 0.55), M({
        p: [side * 6.5 * K, -12 - i * 3.2, 1 + Math.sin(i) * 0.8],
        r: [i % 2 ? 0 : Math.PI / 2, 0, 0.2],
      }));
    }
    // Shoulder spurs
    for (let i = 0; i < 3; i++) {
      upper.put('bone', claw(8, 1.7, 0.3, [side * 0.75, 0.6, (i - 1) * 0.35], [0, 1, 0]), M({
        p: [side * 6 * K, 6, (i - 1) * 5.5],
      }));
    }

    const fore = rig.node(`fore${s}`, `arm${s}`, [side * 2.5, -24, 0]);
    fore.put('skin', tube(
      [[0, 0, 0], [0, -12, 1.5], [0, -24, 0]],
      { segs: 14, radial: 16, radius: (t) => (6 - t * 1.7) * K },
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
      { segs: 14, radial: 16, radius: (t) => (9.8 - t * 2.8) * K },
    ));

    const shin = rig.node(`shin${s}`, `leg${s}`, [side * 2, -24, -1]);
    shin.put('skin', tube(
      [[0, 0, 0], [0, -9, 0.5], [0, -18, 2]],
      { segs: 14, radial: 16, radius: (t) => (7 - t * 2.6) * K },
    ));
    shin.put('gold', ring(4.8 * K, 1.2), M({ p: [0, -16, 1.6], r: [Math.PI / 2, 0, 0] })); // leg iron

    const foot = rig.node(`foot${s}`, `shin${s}`, [0, -18, 2]);
    foot.put('skin', tube(
      [[0, 0, -4], [0, -2.5, 2], [0, -3.6, 9]],
      { segs: 14, radial: 16, radius: (t) => (5.4 - t * 1.4) * K },
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

// How hard the flesh noise bites into each material. Soft tissue moves a lot;
// teeth, claws and metal keep the shape they were authored with, or they stop
// reading as hard.
const DISPLACE_BY_MATERIAL = {
  skin: 1, membrane: 0.85, cloth: 0.8, belly: 0.45, blood: 0.2,
  bone: 0.2, horn: 0.35, gold: 0, eye: 0, ember: 0.35,
};

// Faces need to stay legible, and fingers are too thin to survive much.
const DISPLACE_BY_NODE = { head: 0.5, jaw: 0.45, hood: 0.7 };

const BASE_DISPLACE = 0.95;

// Three variants are baked per monster type. Instances pick one at random, so
// a room of asuras is not a row of identical clones - the single strongest
// cue that something is a game asset rather than a creature.
export const VARIANTS = 3;

function rigFor(type, boss, variant = 0) {
  const key = `${boss ? 'boss' : type}#${variant}`;
  if (!RIG_CACHE.has(key)) {
    const seed = 1 + variant * 37;
    const rig = type === 'asura' ? buildAsura(seed)
      : type === 'naga' ? buildNaga(seed)
        : buildRakshasa(!!boss, seed);
    // Bake each node's material slots into finished geometries once. Left and
    // right get different noise seeds so nothing is mirror-perfect.
    for (const node of rig.nodes) {
      node.geos = new Map();
      const nodeAmp = DISPLACE_BY_NODE[node.name] !== undefined ? DISPLACE_BY_NODE[node.name] : 1;
      const sideSeed = node.name.endsWith('R') ? seed + 101 : seed;
      for (const [mat, part] of node.slots) {
        if (part.empty) continue;
        const amp = BASE_DISPLACE * nodeAmp * (DISPLACE_BY_MATERIAL[mat] || 0) * (rig.dispScale || 1);
        node.geos.set(mat, part.build(amp, sideSeed));
      }
      node.slots = null;
    }
    applyAsymmetry(rig, seed);
    RIG_CACHE.set(key, rig);
  }
  return RIG_CACHE.get(key);
}

function rng(seed) {
  let a = seed * 1831565813 + 0x6D2B79F5;
  return () => {
    a = Math.imul(a ^ (a >>> 15), 1 | a);
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
  };
}

// Nothing alive is bilaterally perfect, and perfect symmetry is what makes a
// model read as a toy. Each node gets a small fixed offset and twist, baked
// into its meshes rather than its group, so the per-frame poser cannot wipe
// it. Different variants are lopsided in different directions.
function applyAsymmetry(rig, seed) {
  const r = rng(seed);
  const jitter = (k) => (r() - 0.5) * 2 * k;
  for (const node of rig.nodes) {
    // The pelvis anchors the whole body; shifting it would lift the feet.
    const shoulderOrHip = /^(arm|leg|fore|shin|foot)/.test(node.name);
    const posK = shoulderOrHip ? 1.6 : node.name === 'hips' ? 0 : 0.9;
    const rotK = node.name === 'hips' ? 0.02 : 0.075;
    node.rest = {
      p: [jitter(posK), jitter(posK * 0.7), jitter(posK)],
      r: [jitter(rotK), jitter(rotK * 1.4), jitter(rotK)],
      // A limb that is a few percent longer or thinner than its twin
      s: 1 + jitter(shoulderOrHip ? 0.05 : 0.025),
    };
  }
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
 * @param {number} variant Which baked sculpt to use; defaults to a random one
 * @returns a handle with { root, height, pose(state), setHurt(t), setFade(a), dispose() }
 */
export function createMonster(type, boss, height, variant) {
  const explicit = variant !== undefined;
  const v = explicit ? variant % VARIANTS : (Math.random() * VARIANTS) | 0;
  const rig = rigFor(type, boss, v);
  const protos = materialProtos(type);
  const eyeColor = EYE_COLORS[boss ? 'boss' : type];
  // An explicit variant means a reproducible monster, so the offline capture
  // tool shoots the same creature every run.
  const rnd = rng(explicit ? v * 977 + 13 : v * 977 + ((Math.random() * 1e6) | 0));

  // Per-instance materials so one monster can flash or fade alone. Each also
  // gets its own slight shift in tone and gloss, so a pack does not look like
  // one model stamped out repeatedly.
  const tone = 0.82 + rnd() * 0.34;
  const mats = {};
  const skinLike = [];
  for (const key of Object.keys(protos)) {
    const m = protos[key].clone();
    // clone() drops the shader patch; put it back or the rim silently vanishes.
    if (m.userData && m.userData.rim !== undefined) applyRim(m);
    if (key === 'eye') m.color.setHex(eyeColor);
    else if (key === 'ember') m.color.setHex(boss ? 0xff5a10 : type === 'naga' ? 0xc0ff40 : 0xff5a12);
    else {
      m.color.multiplyScalar(tone);
      m.shininess *= 0.75 + rnd() * 0.5;
    }
    mats[key] = m;
    if (key !== 'eye' && key !== 'ember') skinLike.push(m);
  }

  // What each material wants when the monster is not fading, so setFade can
  // put it back instead of forcing everything opaque.
  const baseTransparent = {};
  const baseOpacity = {};
  for (const key of Object.keys(mats)) {
    baseTransparent[key] = mats[key].transparent;
    baseOpacity[key] = mats[key].opacity;
  }

  const root = new THREE.Group();
  const groups = new Map();
  const restM = new THREE.Matrix4();
  for (const node of rig.nodes) {
    const g = new THREE.Group();
    g.position.set(node.at[0], node.at[1], node.at[2]);
    if (node.scale !== 1) g.scale.setScalar(node.scale);
    g.userData.rest = g.position.clone();
    // The lopsidedness lives on the meshes, below the animated group, so the
    // per-frame poser overwrites rotations without flattening it back out.
    const rest = node.rest;
    if (rest) {
      restM.compose(
        new THREE.Vector3(rest.p[0], rest.p[1], rest.p[2]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rest.r[0], rest.r[1], rest.r[2])),
        new THREE.Vector3(rest.s, rest.s, rest.s),
      );
    }
    for (const [matKey, geo] of node.geos) {
      const mesh = new THREE.Mesh(geo, mats[matKey]);
      mesh.matrixAutoUpdate = false;
      if (rest) mesh.matrix.copy(restM);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
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

  // A little variance in stature on top of everything else.
  const scale = (height * (0.94 + rnd() * 0.12)) / rig.authoredHeight;
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
          const m = mats[key];
          // Restore each material's own setting rather than forcing opaque:
          // blood is authored transparent and must stay that way.
          m.transparent = on || baseTransparent[key];
          m.depthWrite = !m.transparent;
          m.needsUpdate = true;
        }
      }
      for (const key of Object.keys(mats)) {
        mats[key].opacity = on ? alpha : baseOpacity[key];
      }
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
