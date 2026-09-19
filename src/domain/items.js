// Typemon v1 — battle item system (pure domain, no DOM/Typejoy).
// Items are data + one effect each (OpMon-style composable consumables).
// Inventory is a plain { itemId: count } object carried on the save.

export const ITEM_DEFS = {
  tonic: {
    id: "tonic",
    name: "TONIC",
    desc: "Restore 30 HP mid-battle. Costs your turn.",
    battle: true,
    heal: 30,
  },
  snare: {
    id: "snare",
    name: "SNARE",
    desc: "Throw now: capture roll at +35% chance. Costs your turn on a miss.",
    battle: true,
    captureBonus: 0.35,
  },
  slow: {
    id: "slow",
    name: "SLOW DIAL",
    desc: "Your next word ticks slower (easier timing windows).",
    battle: true,
    slowBpm: 40,
  },
};

// Starting satchel for a new game.
export const STARTER_ITEMS = { tonic: 2, snare: 1, slow: 1 };

export function countItem(inv, id) {
  if (!inv || typeof inv !== "object") return 0;
  const n = inv[id];
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// Normalize any inventory-ish value into a full { id: count } object.
export function normalizeItems(inv) {
  const out = {};
  for (const id of Object.keys(ITEM_DEFS)) out[id] = countItem(inv, id);
  return out;
}

export function addItem(inv, id, n) {
  if (!ITEM_DEFS[id] || !Number.isInteger(n) || n <= 0) return normalizeItems(inv);
  const out = normalizeItems(inv);
  out[id] = out[id] + n;
  return out;
}

// useItem: returns { ok, inv, def }. Pure: never throws, never goes negative.
export function useItem(inv, id) {
  const def = ITEM_DEFS[id];
  if (!def) return { ok: false, inv: normalizeItems(inv), def: null };
  const have = countItem(inv, id);
  if (have <= 0) return { ok: false, inv: normalizeItems(inv), def };
  const out = normalizeItems(inv);
  out[id] = have - 1;
  return { ok: true, inv: out, def };
}

// Assertion: every def has the fields the battle shell reads.
export function assertItems() {
  const errors = [];
  for (const id of Object.keys(ITEM_DEFS)) {
    const d = ITEM_DEFS[id];
    if (d.id !== id) errors.push(id + ": id mismatch");
    if (!d.name || !/^[A-Z0-9 ]+$/.test(d.name)) errors.push(id + ": bad name");
    if (!d.desc) errors.push(id + ": missing desc");
    if (d.battle !== true) errors.push(id + ": battle flag must be true");
  }
  for (const id of Object.keys(STARTER_ITEMS)) {
    if (!ITEM_DEFS[id]) errors.push("starter references unknown item " + id);
  }
  return errors;
}
