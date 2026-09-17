// Typemon MVP — persistence contract (Slice 1). No DOM dependency:
// storage is injected ({ getItem, setItem }), so node tests use a fake.
// Single key, schema 1, full-object replacement. Corrupt saves are discarded
// with a reason; boot never crashes.

export const SAVE_KEY = "typemon.save.v1";
export const SCHEMA = 1;

export function validateSave(obj) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, reason: "not-an-object" };
  }
  if (obj.schema !== SCHEMA) return { ok: false, reason: "bad-schema" };
  if (typeof obj.savedAt !== "number") return { ok: false, reason: "bad-savedAt" };
  if (typeof obj.activeMonsterId !== "string") return { ok: false, reason: "bad-activeMonsterId" };
  if (!Array.isArray(obj.collection) || obj.collection.length === 0) {
    return { ok: false, reason: "bad-collection" };
  }
  for (const m of obj.collection) {
    if (!m || typeof m.id !== "string" || typeof m.name !== "string") return { ok: false, reason: "bad-row" };
    if (typeof m.level !== "number" || typeof m.xp !== "number") return { ok: false, reason: "bad-row-stats" };
    if (!Array.isArray(m.moves) || m.moves.length !== 3) return { ok: false, reason: "bad-row-moves" };
    if (m.hp !== undefined) return { ok: false, reason: "hp-not-allowed" };
  }
  const ids = obj.collection.map((m) => m.id);
  if (!ids.includes(obj.activeMonsterId)) return { ok: false, reason: "active-not-owned" };
  if (!obj.route || typeof obj.route.routeId !== "string" || typeof obj.route.nodeIndex !== "number") {
    return { ok: false, reason: "bad-route" };
  }
  if (!Array.isArray(obj.route.cleared)) return { ok: false, reason: "bad-cleared" };
  return { ok: true, reason: "" };
}

// Read + parse + validate. Never throws. Returns { state, reason } where
// state is null when there is no usable save.
export function loadSave(storage) {
  let raw = null;
  try {
    raw = storage.getItem(SAVE_KEY);
  } catch (e) {
    return { state: null, reason: "storage-read-failed" };
  }
  if (raw === null || raw === undefined) return { state: null, reason: "no-save" };
  let obj = null;
  try {
    obj = JSON.parse(raw);
  } catch (e) {
    return { state: null, reason: "corrupt-json" };
  }
  const v = validateSave(obj);
  if (!v.ok) return { state: null, reason: v.reason };
  return { state: obj, reason: "" };
}

// Full-object replacement write. Returns true on success.
export function saveGame(storage, gameState) {
  const doc = { ...gameState, schema: SCHEMA, savedAt: Date.now() };
  const v = validateSave(doc);
  if (!v.ok) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(doc));
    return true;
  } catch (e) {
    return false;
  }
}
