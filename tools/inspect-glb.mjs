// Prints what is actually inside a .glb, so you can fill in
// src/monsterAssets.js without guessing.
//
//   node tools/inspect-glb.mjs assets/monsters/asura.glb
//
// Reports the clip names to put in `clips`, the triangle count, the bounding
// box (so you can see whether it is Y-up and where its feet are), the
// materials, and any extension the game's loader cannot handle.
//
// Reads the glTF JSON chunk directly - no Three.js, no browser, no deps.

import fs from 'fs';
import path from 'path';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/inspect-glb.mjs <model.glb>');
  process.exit(1);
}

const buf = fs.readFileSync(file);

// A .glb is: 12-byte header, then chunks of [length u32, type u32, data].
// Chunk type 0x4E4F534A is 'JSON'.
if (buf.readUInt32LE(0) !== 0x46546C67) {
  console.error(`${file} is not a .glb (bad magic).`);
  console.error('If it is a .gltf, fold it and its side-car files into one file:');
  console.error(`  npx @gltf-transform/cli copy ${file} model.glb`);
  console.error('See docs/SCULPTED-MONSTERS.md section 7.');
  process.exit(1);
}
const version = buf.readUInt32LE(4);
let offset = 12;
let json = null;
let binBytes = 0;
while (offset < buf.length) {
  const len = buf.readUInt32LE(offset);
  const type = buf.readUInt32LE(offset + 4);
  const data = buf.subarray(offset + 8, offset + 8 + len);
  if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(data));
  else binBytes += len;
  offset += 8 + len + ((4 - (len % 4)) % 4);
}
if (!json) {
  console.error('no JSON chunk found');
  process.exit(1);
}

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;
const line = (k, v) => console.log(`  ${k.padEnd(18)} ${v}`);

console.log(`\n${path.basename(file)}  (glTF v${version})`);
console.log('─'.repeat(60));
line('file size', mb(buf.length));
line('binary payload', mb(binBytes));
line('generator', (json.asset && json.asset.generator) || '(unknown)');

// --- Triangles. Position accessor counts give vertices; indices give tris.
let tris = 0;
let verts = 0;
for (const m of json.meshes || []) {
  for (const prim of m.primitives || []) {
    const posAcc = json.accessors[prim.attributes.POSITION];
    if (posAcc) verts += posAcc.count;
    if (prim.indices !== undefined) tris += json.accessors[prim.indices].count / 3;
    else if (posAcc) tris += posAcc.count / 3;
  }
}
line('vertices', verts.toLocaleString());
line('triangles', Math.round(tris).toLocaleString()
  + (tris > 60000 ? '   <-- heavy; see "The game gets slow" in the guide' : ''));
line('meshes', (json.meshes || []).length);
line('materials', (json.materials || []).length);
line('textures', (json.textures || []).length);
line('skins', (json.skins || []).length
  + ((json.skins || []).length === 0 ? '   (no skeleton: it will stand still)' : ''));
line('nodes', (json.nodes || []).length);

// --- Bounds, from the POSITION accessor min/max the spec requires
let min = [Infinity, Infinity, Infinity];
let max = [-Infinity, -Infinity, -Infinity];
for (const m of json.meshes || []) {
  for (const prim of m.primitives || []) {
    const a = json.accessors[prim.attributes.POSITION];
    if (!a || !a.min || !a.max) continue;
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], a.min[i]);
      max[i] = Math.max(max[i], a.max[i]);
    }
  }
}
if (Number.isFinite(min[0])) {
  const size = max.map((v, i) => v - min[i]);
  const f = (n) => n.toFixed(3).padStart(8);
  console.log('\n  bounds (model space, before any node transforms)');
  console.log(`    x ${f(min[0])} .. ${f(max[0])}   width  ${f(size[0])}`);
  console.log(`    y ${f(min[1])} .. ${f(max[1])}   height ${f(size[1])}`);
  console.log(`    z ${f(min[2])} .. ${f(max[2])}   depth  ${f(size[2])}`);
  const tallest = size.indexOf(Math.max(...size));
  if (tallest !== 1) {
    console.log(`    !! longest axis is ${'XYZ'[tallest]}, not Y - this model is probably`);
    console.log('       not Y-up. Fix it in Blender on export, or it will load lying down.');
  }
  if (Math.abs(min[1]) > size[1] * 0.15) {
    console.log(`    note: feet sit at y=${min[1].toFixed(3)}, not 0. The loader compensates`);
    console.log('       automatically, but offsetY is there if it looks wrong.');
  }
}

// --- Clips: the whole reason this tool exists
const anims = json.animations || [];
console.log(`\n  animations (${anims.length})`);
if (!anims.length) {
  console.log('    none. The model will load and stand still - the procedural');
  console.log('    poser cannot drive a foreign skeleton. Add clips in Blender,');
  console.log('    or run the mesh through Mixamo.');
} else {
  const guess = (name) => {
    const n = name.toLowerCase();
    if (/idle|stand/.test(n)) return 'idle';
    if (/walk|run|move/.test(n)) return 'walk';
    if (/attack|strike|hit|punch/.test(n)) return 'attack';
    if (/death|die|fall/.test(n)) return 'death';
    return null;
  };
  const matched = {};
  for (const a of anims) {
    const g = guess(a.name || '');
    if (g && !matched[g]) matched[g] = a.name;
    console.log(`    "${a.name}"${g ? `   -> auto-matches ${g}` : '   (no auto-match)'}`);
  }
  console.log('\n  suggested config:');
  console.log('    clips: {');
  for (const role of ['idle', 'walk', 'attack', 'death']) {
    if (matched[role]) console.log(`      ${role}: '${matched[role]}',`);
    else console.log(`      // ${role}: '???',   <-- nothing matched; pick one above`);
  }
  console.log('    },');
}

// --- Extensions this game's loader cannot handle
const used = json.extensionsUsed || [];
const required = json.extensionsRequired || [];
const unsupported = {
  KHR_draco_mesh_compression: 'Draco compression - needs DRACOLoader, which is not vendored',
  KHR_texture_basisu: 'KTX2/Basis textures - needs KTX2Loader, which is not vendored',
  EXT_meshopt_compression: 'meshopt compression - needs MeshoptDecoder, which is not vendored',
};
if (used.length) {
  console.log(`\n  extensions used: ${used.join(', ')}`);
}
const blockers = used.filter((e) => unsupported[e]);
if (blockers.length) {
  console.log('\n  !! WILL FAIL TO LOAD');
  for (const e of blockers) {
    console.log(`     ${e}: ${unsupported[e]}${required.includes(e) ? ' (required, not optional)' : ''}`);
  }
  console.log('     Fix by re-exporting without compression, or:');
  console.log(`       npx @gltf-transform/cli dedup ${file} out.glb`);
  console.log('     See "Compressed models" in docs/SCULPTED-MONSTERS.md.');
} else {
  console.log('\n  no blocking extensions - this should load.');
}
console.log('');
