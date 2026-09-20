// Typemon v1 — monster data registry.
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
// players).
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
  "6": {
    id: "6", name: "HEARTH", type: "BURNING",
    wild: "6-0.png", evolved: "6-1.png",
    moves: [
      { name: "BLAZE", type: "BURNING", letters: 5 },
      { name: "KINDLE", type: "BURNING", letters: 6 },
      { name: "WARM", type: "NEUTRAL", letters: 4 },
    ],
  },
  "7": {
    id: "7", name: "DRIPLET", type: "LIQUID",
    wild: "7-0.png", evolved: "7-1.png",
    moves: [
      { name: "DROPS", type: "LIQUID", letters: 5 },
      { name: "RIPPLE", type: "LIQUID", letters: 6 },
      { name: "POUR", type: "NEUTRAL", letters: 4 },
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
  "11": {
    id: "11", name: "POMKIT", type: "VEGETAL",
    wild: "11-0.png", evolved: "11-1.png",
    moves: [
      { name: "APPLE", type: "VEGETAL", letters: 5 },
      { name: "CORE", type: "NEUTRAL", letters: 4 },
      { name: "JUICE", type: "VEGETAL", letters: 5 },
    ],
  },
  "13": {
    id: "13", name: "NIBBLIT", type: "GROUND",
    wild: "13-0.png", evolved: "13-1.png",
    moves: [
      { name: "BURROW", type: "GROUND", letters: 6 },
      { name: "DUST", type: "GROUND", letters: 4 },
      { name: "GNAW", type: "NEUTRAL", letters: 4 },
    ],
  },
  "15": {
    id: "15", name: "MANTIK", type: "BUG",
    wild: "15-0.png", evolved: "15-1.png",
    moves: [
      { name: "SNIP", type: "BUG", letters: 4 },
      { name: "SWARM", type: "BUG", letters: 5 },
      { name: "STING", type: "TOXIC", letters: 5 },
    ],
  },
  "18": {
    id: "18", name: "JELLIX", type: "MENTAL",
    wild: "18-0.png", evolved: "18-1.png",
    moves: [
      { name: "MIND", type: "MENTAL", letters: 4 },
      { name: "DREAM", type: "MENTAL", letters: 5 },
      { name: "HAZE", type: "GHOST", letters: 4 },
    ],
  },
  "20": {
    id: "20", name: "BUNNIT", type: "NEUTRAL",
    wild: "20-0.png", evolved: "20-1.png",
    moves: [
      { name: "LEAP", type: "NEUTRAL", letters: 4 },
      { name: "DASH", type: "NEUTRAL", letters: 4 },
      { name: "THUMP", type: "FIGHT", letters: 5 },
    ],
  },
  "21": {
    id: "21", name: "SLUDGE", type: "TOXIC",
    wild: "21-0.png", evolved: "21-1.png",
    moves: [
      { name: "OOZE", type: "TOXIC", letters: 4 },
      { name: "SLIME", type: "TOXIC", letters: 5 },
      { name: "FUMES", type: "NEUTRAL", letters: 5 },
    ],
  },
  "22": {
    id: "22", name: "WEBBIT", type: "BUG",
    wild: "22-0.png", evolved: "22-1.png",
    moves: [
      { name: "WEAVE", type: "BUG", letters: 5 },
      { name: "BITE", type: "FIGHT", letters: 4 },
      { name: "TRAP", type: "BUG", letters: 4 },
    ],
  },
  "25": {
    id: "25", name: "PIXIE", type: "MAGIC",
    wild: "25-0.png", evolved: "25-1.png",
    moves: [
      { name: "CHARM", type: "MAGIC", letters: 5 },
      { name: "GLINT", type: "MAGIC", letters: 5 },
      { name: "TWIRL", type: "SKY", letters: 5 },
    ],
  },
  "26": {
    id: "26", name: "TIDEON", type: "FIGHT",
    wild: "26-0.png", evolved: "26-1.png",
    moves: [
      { name: "PUNCH", type: "FIGHT", letters: 5 },
      { name: "WAVE", type: "LIQUID", letters: 4 },
      { name: "CLASH", type: "FIGHT", letters: 5 },
    ],
  },
  "28": {
    id: "28", name: "FLORIT", type: "VEGETAL",
    wild: "28-0.png", evolved: "28-1.png",
    moves: [
      { name: "PETAL", type: "VEGETAL", letters: 5 },
      { name: "POLLEN", type: "VEGETAL", letters: 6 },
      { name: "THORN", type: "GROUND", letters: 5 },
    ],
  },
  "32": {
    id: "32", name: "GEODIT", type: "MINERAL",
    wild: "32-0.png", evolved: "32-1.png",
    moves: [
      { name: "SHARD", type: "MINERAL", letters: 5 },
      { name: "QUARTZ", type: "MINERAL", letters: 6 },
      { name: "PRISM", type: "MAGIC", letters: 5 },
    ],
  },
  "34": {
    id: "34", name: "SHROOM", type: "TOXIC",
    wild: "34-0.png", evolved: "34-1.png",
    moves: [
      { name: "SPORE", type: "TOXIC", letters: 5 },
      { name: "SPROUT", type: "VEGETAL", letters: 6 },
      { name: "DIZZY", type: "TOXIC", letters: 5 },
    ],
  },
  "35": {
    id: "35", name: "DODRIX", type: "SKY",
    wild: "35-0.png", evolved: "35-1.png",
    moves: [
      { name: "PECK", type: "FIGHT", letters: 4 },
      { name: "FLAP", type: "SKY", letters: 4 },
      { name: "SOAR", type: "SKY", letters: 4 },
    ],
  },
  "36": {
    id: "36", name: "STELIX", type: "MAGIC",
    wild: "36-0.png", evolved: "36-1.png",
    moves: [
      { name: "NOVA", type: "MAGIC", letters: 4 },
      { name: "COMET", type: "MAGIC", letters: 5 },
      { name: "ORBIT", type: "BURNING", letters: 5 },
    ],
  },
  "47": {
    id: "47", name: "DUNLIT", type: "GROUND",
    wild: "47-0.png", evolved: "47-1.png",
    moves: [
      { name: "SAND", type: "GROUND", letters: 4 },
      { name: "DUNE", type: "GROUND", letters: 4 },
      { name: "TREMOR", type: "GROUND", letters: 6 },
    ],
  },
  "51": {
    id: "51", name: "SOLRIT", type: "BURNING",
    wild: "51-0.png", evolved: "51-1.png",
    moves: [
      { name: "SUNRAY", type: "BURNING", letters: 6 },
      { name: "FLAIR", type: "MAGIC", letters: 5 },
      { name: "GLOW", type: "BURNING", letters: 4 },
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
  "55": {
    id: "55", name: "WATTIT", type: "ELECTRON",
    wild: "55-0.png", evolved: "55-1.png",
    moves: [
      { name: "BUZZ", type: "ELECTRON", letters: 4 },
      { name: "STATIC", type: "ELECTRON", letters: 6 },
      { name: "TINGLE", type: "NEUTRAL", letters: 6 },
    ],
  },
  "56": {
    id: "56", name: "GLACIT", type: "COLD",
    wild: "56-0.png", evolved: "56-1.png",
    moves: [
      { name: "SLIDE", type: "COLD", letters: 5 },
      { name: "HAIL", type: "COLD", letters: 4 },
      { name: "GLIDE", type: "SKY", letters: 5 },
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
