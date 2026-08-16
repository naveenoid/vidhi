// Vidhi - optional sculpted monster models
//
// The game ships with no model files: every monster is generated in code by
// src/models3d.js. Procedural geometry has a ceiling, though - the detail that
// makes a creature genuinely frightening (pores, sagging skin, asymmetric
// growths, real muscle flow) comes from a sculpt, not from math.
//
// Drop a .glb in here and it replaces the procedural version for that monster,
// with no other code changes. Anything left unconfigured stays procedural, so
// a partial set is fine - sculpt the asura first, leave the rest as they are.
//
// Where to get one:
//   - AI generation (Meshy, Tripo, Rodin): describe the creature, export .glb
//   - Marketplaces (Sketchfab, itch.io, Unity store): buy a rigged demon
//   - Blender: sculpt, rig, and export glTF 2.0 yourself
//   - Mixamo: auto-rig a humanoid mesh and attach walk/attack/death clips
//
// Requirements for a model to drop in cleanly:
//   - glTF 2.0 binary (.glb), embedded textures, no Draco compression
//   - Y-up, facing +Z, feet at the origin (yaw/offset below can fix a model
//     that faces the wrong way; scale is handled automatically)
//   - Optional skeletal clips. Without them the model still loads, it just
//     stands still - the procedural poser cannot drive a foreign skeleton.

export const MONSTER_MODELS = {
  // Want to see the pipeline work before sourcing anything? Uncomment this.
  // assets/monsters/sample-monster.glb ships with the repo: a deliberately
  // crude rigged blob with Idle/Walk/Attack/Death clips. It is ugly on
  // purpose - its job is to prove the plumbing, not to look good.
  // asura: {
  //   url: 'assets/monsters/sample-monster.glb',
  //   clips: { idle: 'Idle', walk: 'Walk', attack: 'Attack', death: 'Death' },
  // },

  // asura: {
  //   url: 'assets/monsters/asura.glb',
  //   yaw: 0,          // radians, if the sculpt faces something other than +Z
  //   scale: 1,        // extra multiplier on top of the automatic height fit
  //   offsetY: 0,      // tiles, if the model's feet are not at its origin
  //   clips: {         // clip names in the file; missing ones fall back to idle
  //     idle: 'Idle',
  //     walk: 'Walk',
  //     attack: 'Attack',
  //     death: 'Death',
  //   },
  // },
  // naga: { ... },
  // rakshasa: { ... },
  // boss: { ... },     // Mahishasura; falls back to `rakshasa` if unset
};

// True when at least one sculpt is configured, so the renderer knows whether
// it is worth spinning up a loader at all.
export const HAS_SCULPTS = Object.keys(MONSTER_MODELS).length > 0;
