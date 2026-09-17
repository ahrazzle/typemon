// Typemon MVP — monster data registry (Slice 0).
// Pure data: no DOM, no Typejoy. Imported by the app shell and by node tests.
// Sprite files are listed by basename; the shell prepends its repo-relative
// prefix (demo/index.html -> "../"). Build/test assertion verifies every
// referenced file exists under assets/ccbysa/opmons/.
//
// Naming: original Typemon names only. No Pokemon/Showdown species, moves,
// stats, or sprites are referenced or copied.

export const TYPE_MULT = {
  BURNING: 1.3, LIQUID: 1.2, GROUND: 1.2, ELECTRON: 1.25, FIGHT: 1.15,
  MENTAL: 1.1, DRAGON: 1.35, COLD: 1.2, BUG: 1.05, VEGETAL: 1.0,
  GHOST: 1.1, MAGIC: 1.15, METAL: 1.15, MINERAL: 1.2, TOXIC: 1.1,
  SKY: 1.05, NEUTRAL: 1.0, BAD: 1.0,
};

export const LEVELS = [0, 10, 30, 60, 100];

// Round budget per battle (authored; guarantees termination even for weak
// players). Replaces the vestigial 12-word pool in the battle path.
export const ROUND_BUDGET = 8;

// XP formula: perfect +3, great +2, good +1, win bonus +10, capture bonus +5.
export const XP = { perfect: 3, great: 2, good: 1, win: 10, capture: 5 };

// Move rule: exactly 3 moves per monster, names 4-6 letters A-Z, unique
// per monster. Types must be keys of TYPE_MULT.
export const MONSTERS = {
  "1": {
    id: "1", name: "HOPLING", type: "BURNING",
    wild: "1-0.png", evolved: "1-1.png",
    moves: [
      { name: "EMBER", type: "BURNING", letters: 5 },
      { name: "TACKLE", type: "FIGHT", letters: 6 },
      { name: "GUST", type: "SKY", letters: 4 },
    ],
  },
  "2": {
    id: "2", name: "BUBBLIT", type: "LIQUID",
    wild: "2-0.png", evolved: "2-1.png",
    moves: [
      { name: "SPLASH", type: "LIQUID", letters: 6 },
      { name: "DRIFT", type: "NEUTRAL", letters: 5 },
      { name: "MIST", type: "COLD", letters: 4 },
    ],
  },
  "3": {
    id: "3", name: "LEAFKIT", type: "VEGETAL",
    wild: "3-0.png", evolved: "3-1.png",
    moves: [
      { name: "SEED", type: "VEGETAL", letters: 4 },
      { name: "BLOOM", type: "VEGETAL", letters: 5 },
      { name: "VINE", type: "VEGETAL", letters: 4 },
    ],
  },
  "4": {
    id: "4", name: "FLURRIX", type: "COLD",
    wild: "4-0.png", evolved: "4-1.png",
    moves: [
      { name: "SNOW", type: "COLD", letters: 4 },
      { name: "FROST", type: "COLD", letters: 5 },
      { name: "CHILL", type: "COLD", letters: 5 },
    ],
  },
  "5": {
    id: "5", name: "VOLTIK", type: "ELECTRON",
    wild: "5-0.png", evolved: "5-1.png",
    moves: [
      { name: "SPARK", type: "ELECTRON", letters: 5 },
      { name: "SURGE", type: "ELECTRON", letters: 5 },
      { name: "BOLT", type: "ELECTRON", letters: 4 },
    ],
  },
  "8": {
    id: "8", name: "PEBBLO", type: "MINERAL",
    wild: "8-0.png", evolved: "8-1.png",
    moves: [
      { name: "STONE", type: "MINERAL", letters: 5 },
      { name: "GRAVEL", type: "GROUND", letters: 6 },
      { name: "DUST", type: "GROUND", letters: 4 },
    ],
  },
  "10": {
    id: "10", name: "GLOOMBAT", type: "GHOST",
    wild: "10-0.png", evolved: "10-1.png",
    moves: [
      { name: "SHADE", type: "GHOST", letters: 5 },
      { name: "WAIL", type: "GHOST", letters: 4 },
      { name: "SPOOK", type: "GHOST", letters: 5 },
    ],
  },
  "53": {
    id: "53", name: "BULWARK", type: "MINERAL",
    wild: "53-0.png", evolved: "53-1.png",
    moves: [
      { name: "STONE", type: "MINERAL", letters: 5 },
      { name: "SHIELD", type: "METAL", letters: 6 },
      { name: "QUAKE", type: "GROUND", letters: 5 },
    ],
  },
};

export const STARTER_IDS = ["1", "2", "3"];

// Registry assertion used by node tests and (via console) the served build.
// Returns an array of error strings; empty = green.
export function assertRegistry(listDir) {
  const errors = [];
  const ids = Object.keys(MONSTERS);
  if (ids.length === 0) errors.push("registry empty");
  for (const id of ids) {
    const m = MONSTERS[id];
    if (!m.name || !/^[A-Z0-9 ]+$/.test(m.name)) errors.push(id + ": bad name " + m.name);
    if (!(m.type in TYPE_MULT)) errors.push(id + ": unknown type " + m.type);
    if (!Array.isArray(m.moves) || m.moves.length !== 3) {
      errors.push(id + ": must have exactly 3 moves");
      continue;
    }
    const seen = new Set();
    for (const mv of m.moves) {
      if (!/^[A-Z]{4,6}$/.test(mv.name)) errors.push(id + ": move name must be 4-6 A-Z: " + mv.name);
      if (mv.name.length !== mv.letters) errors.push(id + ": letters mismatch: " + mv.name);
      if (!(mv.type in TYPE_MULT)) errors.push(id + ": unknown move type " + mv.type);
      if (seen.has(mv.name)) errors.push(id + ": duplicate move " + mv.name);
      seen.add(mv.name);
    }
    for (const f of [m.wild, m.evolved]) {
      if (!listDir(f)) errors.push(id + ": sprite missing: " + f);
    }
  }
  return errors;
}
