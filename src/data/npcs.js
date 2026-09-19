// Typemon v1 — NPC and trainer data (pure data, no DOM/Typejoy).
// NPCs are stationary figures on walkable tiles, drawn by the world view.
// Interacting (Enter/Space while facing) opens dialogue; trainers with an
// undefeated flag start a trainer battle after their intro lines.
//
// All dialogue is original Typemon writing.

export const NPCS = [
  {
    id: "gramps",
    mapId: "hut_a", row: 2, col: 4,
    name: "GRAMPS", color: "#c9a227",
    lines: [
      "Welcome to EMBER REST, traveler. Sit a spell.",
      "Remember the rule of this land: every battle starts your Typemon at full strength. There is no lasting hurt here — only rhythm.",
      "Type each move name in time with the beat. Perfect timing lands criticals; misses let the wild one strike back.",
      "Take these TONICs. And if your combo climbs past 30, your capture throw almost never fails.",
    ],
    gift: { flag: "gramps_gift", items: { tonic: 2 }, giftLine: "Here — two TONICs for the road. Come back any time you're running low." },
    giftRepeat: { items: { tonic: 1 }, maxHave: 1, repeatLine: "A TONIC for the road, kiddo." },
  },
  {
    id: "pip",
    mapId: "route_a", row: 5, col: 8,
    name: "PIP", color: "#e94560",
    lines: ["My NIBBLIT burrows faster than you can type!"],
    trainer: {
      team: [{ monId: "13", level: 2 }],
      intro: ["My NIBBLIT burrows faster than you can type!", "Prove me wrong!"],
      win: ["Burrowed under... fine, you type fast.", "Take this SNARE — you earned it."],
      lose: ["Told you! Come back when your fingers are faster."],
      reward: { items: { snare: 1 }, xpBonus: 8 },
    },
  },
  {
    id: "sage",
    mapId: "route_a", row: 15, col: 18,
    name: "SAGE", color: "#06d6a0",
    lines: ["The cave boss answers only to perfect rhythm."],
    trainer: {
      team: [{ monId: "8", level: 3 }, { monId: "4", level: 3 }],
      intro: ["The cave boss answers only to perfect rhythm.", "Let me test yours first!"],
      win: ["Solid tempo! The boss waits through that cave mouth.", "Take these TONICs — you'll want them."],
      lose: ["The mountain is patient. Practice in the meadow, then return."],
      reward: { items: { tonic: 2 }, xpBonus: 15 },
    },
  },
  {
    id: "maro",
    mapId: "ridge_a", row: 11, col: 16,
    name: "RIDGE KEEPER MARO", color: "#ffd166",
    lines: ["The ridge wind carries only the truest typists."],
    trainer: {
      team: [{ monId: "47", level: 6 }, { monId: "32", level: 7 }, { monId: "26", level: 7 }],
      intro: [
        "So. The cave boss fell to your rhythm.",
        "I am MARO, keeper of this ridge. Three Typemon. One typing master.",
        "Show me!",
      ],
      win: ["Incredible... The ridge is yours, Typemon Master!", "Take these — you have earned every one."],
      lose: ["The ridge still stands. Train harder, type truer."],
      reward: { items: { tonic: 3, slow: 1 }, xpBonus: 30 },
      completesGame: true,
    },
  },
];

// Signposts: blocked tiles carrying flavor text. Positions must match 'S'
// tiles authored in the maps.
export const SIGNS = [
  {
    mapId: "route_a", row: 5, col: 2,
    text: "EMBER MEADOW -> east. Wild Typemon rustle in the tall grass. Type in rhythm to battle!",
  },
  {
    mapId: "route_a", row: 16, col: 17,
    text: "STONE CAVE ->. A boss sleeps within. Only steady typing wakes winners.",
  },
  {
    mapId: "ridge_a", row: 11, col: 15,
    text: "EMBER RIDGE. Strong wilds ahead — and KEEPER MARO waits at the far east.",
  },
];

// NPC standing on a tile (mapId,row,col) or null. NPCs block movement.
export function npcAt(mapId, row, col) {
  return NPCS.find((n) => n.mapId === mapId && n.row === row && n.col === col) || null;
}

export function signAt(mapId, row, col) {
  return SIGNS.find((s) => s.mapId === mapId && s.row === row && s.col === col) || null;
}

export function isTrainer(npc) {
  return !!(npc && npc.trainer);
}

// Flag key marking a trainer as defeated.
export function trainerFlag(id) {
  return "trainer_" + id;
}

export function isTrainerDefeated(flags, id) {
  return !!(flags && flags[trainerFlag(id)]);
}

// Assertion used by node tests.
export function assertNpcs(monsters, maps) {
  const errors = [];
  const ids = new Set();
  for (const n of NPCS) {
    if (ids.has(n.id)) errors.push("duplicate npc " + n.id);
    ids.add(n.id);
    if (!maps[n.mapId]) { errors.push(n.id + ": unknown map " + n.mapId); continue; }
    const rows = maps[n.mapId].rows;
    const ch = rows[n.row] && rows[n.row][n.col];
    if (ch === undefined) errors.push(n.id + ": position out of bounds");
    else if (!".,;-".includes(ch)) errors.push(n.id + ": npc not on walkable tile (" + ch + ")");
    if (!n.name) errors.push(n.id + ": missing name");
    if (!Array.isArray(n.lines) || n.lines.length === 0) errors.push(n.id + ": no lines");
    if (n.trainer) {
      const t = n.trainer;
      if (!Array.isArray(t.team) || t.team.length === 0) errors.push(n.id + ": trainer has no team");
      for (const m of t.team || []) {
        if (!monsters[m.monId]) errors.push(n.id + ": unknown team mon " + m.monId);
        if (!Number.isInteger(m.level) || m.level < 1) errors.push(n.id + ": bad team level");
      }
      if (!Array.isArray(t.intro) || !Array.isArray(t.win) || !Array.isArray(t.lose)) {
        errors.push(n.id + ": trainer missing dialogue");
      }
      if (t.reward && t.reward.items) {
        for (const k of Object.keys(t.reward.items)) {
          if (!Number.isInteger(t.reward.items[k]) || t.reward.items[k] <= 0) errors.push(n.id + ": bad reward count");
        }
      }
    }
    if (n.gift) {
      if (!n.gift.flag) errors.push(n.id + ": gift missing flag");
      for (const k of Object.keys(n.gift.items || {})) {
        if (!Number.isInteger(n.gift.items[k])) errors.push(n.id + ": bad gift count");
      }
    }
  }
  for (const s of SIGNS) {
    if (!maps[s.mapId]) { errors.push("sign: unknown map " + s.mapId); continue; }
    const rows = maps[s.mapId].rows;
    const ch = rows[s.row] && rows[s.row][s.col];
    if (ch !== "S") errors.push("sign at " + s.mapId + " " + s.row + "," + s.col + " not on an S tile (found " + ch + ")");
    if (!s.text) errors.push("sign: missing text");
  }
  return errors;
}
