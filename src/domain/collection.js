// Typemon MVP — collection operations (Slice 1). Pure: no DOM, no Typejoy.
// MVP rule (locked): no HP field anywhere. Every battle starts at full HP;
// heal-to-full on commit is structural, not a function.

import { LEVELS, XP } from "../data/monsters.js";

export function levelForXp(xp) {
  let level = 1;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i]) level = i + 1;
  }
  return level;
}

export function makeOwned(monDef, xp) {
  return {
    id: monDef.id,
    name: monDef.name,
    level: levelForXp(xp || 0),
    xp: xp || 0,
    moves: monDef.moves.map((m) => ({ ...m })),
  };
}

// Capture appends a fresh row. Duplicates allowed in MVP (cut list L7).
export function addCapture(collection, monDef) {
  return collection.concat([makeOwned(monDef, 0)]);
}

// Switch active monster. Throws-free: returns { ok, activeId, reason }.
export function switchActive(collection, activeId, nextId) {
  const found = collection.some((m) => m.id === nextId);
  if (!found) return { ok: false, activeId, reason: "not-owned" };
  return { ok: true, activeId: nextId, reason: "" };
}

export function getActive(collection, activeId) {
  return collection.find((m) => m.id === activeId) || null;
}

// XP award for one battle. judgments = { perfect, great, good }.
export function awardXp(owned, judgments, won, captured) {
  const j = judgments || { perfect: 0, great: 0, good: 0 };
  let earned = (j.perfect || 0) * XP.perfect + (j.great || 0) * XP.great + (j.good || 0) * XP.good;
  if (won) earned += XP.win;
  if (captured) earned += XP.capture;
  const before = owned.level;
  const xp = owned.xp + earned;
  const level = levelForXp(xp);
  return { owned: { ...owned, xp, level }, earned, leveledUp: level > before };
}
