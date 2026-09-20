// Typemon MVP — focused pure-domain tests (Slice 1 exit).
// Zero browser, zero Typejoy. Run: node tests/run.mjs (exit != 0 on failure).
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { MONSTERS, TYPE_MULT, LEVELS, XP, ROUND_BUDGET, STARTER_IDS, assertRegistry } =
  await import("../src/data/monsters.js");
const { ROUTE_A, pickEncounter, assertRoute } = await import("../src/data/route_a.js");
const { newWorldState, worldMove, commitNodeClear, isNodeCleared } =
  await import("../src/domain/world.js");
const { levelForXp, makeOwned, addCapture, switchActive, getActive, awardXp } =
  await import("../src/domain/collection.js");
const { CAPTURE_THRESHOLD, captureChance, captureRoll } =
  await import("../src/domain/capture.js");
const { TYPE_CHART, effectiveness, effectivenessLabel, assertChart } =
  await import("../src/data/types.js");
const { ITEM_DEFS, STARTER_ITEMS, countItem, normalizeItems, addItem, useItem, assertItems } =
  await import("../src/domain/items.js");
const { NPCS, SIGNS, npcAt, signAt, isTrainer, trainerFlag, isTrainerDefeated, assertNpcs } =
  await import("../src/data/npcs.js");
const { RIDGE, zoneTable, assertRidge } =
  await import("../src/data/ridge.js");
const { SAVE_KEY, SCHEMA, validateSave, loadSave, saveGame } =
  await import("../src/domain/persistence.js");
const {
  MAPS, TILES, GRASS_THRESHOLD, spawnFor, isWalkable, tileCharAt, encounterZoneAt,
  isBossTile, transitionAt, interactKindAt, moveState, facingTile, advanceGrass,
  applyTransition, zoneToNode, pickEncounterIndexed,
} = await import("../src/domain/overworld.js");

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log("PASS " + name); }
  else { fail++; console.log("FAIL " + name + (extra !== undefined ? " :: " + JSON.stringify(extra) : "")); }
}
const spriteFiles = new Set(readdirSync(join(root, "assets/ccbysa/opmons")));
const listDir = (f) => spriteFiles.has(f);

// ---- monsters registry ----
t("registry.assert clean", assertRegistry(listDir).length === 0, assertRegistry(listDir));
t("registry.starters exist", STARTER_IDS.every((id) => !!MONSTERS[id]));
t("registry.round budget 8", ROUND_BUDGET === 8);
t("registry.28 island mons", Object.keys(MONSTERS).length === 28, Object.keys(MONSTERS).length);
t("registry.xp table", XP.perfect === 3 && XP.great === 2 && XP.good === 1 && XP.win === 10 && XP.capture === 5);
t("registry.types known", Object.values(MONSTERS).every((m) => m.type in TYPE_MULT));
t("registry.moves unique per mon",
  Object.values(MONSTERS).every((m) => new Set(m.moves.map((x) => x.name)).size === 3));

// ---- type chart (original Typemon design) ----
t("types.assert clean", assertChart(Object.keys(TYPE_CHART)).length === 0, assertChart(Object.keys(TYPE_CHART)));
t("types.chart symmetric halves", effectiveness("BURNING", "VEGETAL") === 2 && effectiveness("VEGETAL", "BURNING") === 0.5);
t("types.resisted", effectiveness("BURNING", "LIQUID") === 0.5);
t("types.neutral", effectiveness("NEUTRAL", "BURNING") === 1 && effectiveness("BURNING", "NEUTRAL") === 1);
t("types.unknown -> 1", effectiveness("???", "BURNING") === 1 && effectiveness("BURNING", "???") === 1);
t("types.labels", effectivenessLabel(2) === "SUPER EFFECTIVE!" && effectivenessLabel(1) === "" && effectivenessLabel(0.5) === "It's not very effective\u2026");
t("types.compact rows", Object.keys(TYPE_CHART).length === 18 &&
  Object.values(TYPE_CHART).every((r) => Array.isArray(r.strong) && Array.isArray(r.weak)));

// ---- items (pure inventory) ----
t("items.assert clean", assertItems().length === 0, assertItems());
t("items.starters", STARTER_ITEMS.tonic === 2 && STARTER_ITEMS.snare === 1 && STARTER_ITEMS.slow === 1);
t("items.count empty", countItem(null, "tonic") === 0 && countItem({}, "tonic") === 0);
const inv1 = addItem({}, "tonic", 2);
t("items.add", countItem(inv1, "tonic") === 2 && countItem(inv1, "snare") === 0);
const used = useItem(inv1, "tonic");
t("items.use", used.ok === true && countItem(used.inv, "tonic") === 1);
const used2 = useItem(used.inv, "snare");
t("items.use none fails", used2.ok === false && countItem(used2.inv, "snare") === 0);
t("items.use unknown fails", useItem({}, "zzz").ok === false);
const norm = normalizeItems({ tonic: 3 });
t("items.normalize", norm.tonic === 3 && norm.snare === 0 && norm.slow === 0);
t("items.use never negative", countItem(useItem({ tonic: 1 }, "tonic").inv, "tonic") === 0);

// ---- npcs + signs ----
t("npcs.assert clean", assertNpcs(MONSTERS, MAPS).length === 0, assertNpcs(MONSTERS, MAPS));
t("npcs.four npcs", NPCS.length === 4);
t("npcs.gramps at hut", npcAt("hut_a", 2, 4) && npcAt("hut_a", 2, 4).id === "gramps");
t("npcs.pip trainer", isTrainer(npcAt("route_a", 5, 8)) && npcAt("route_a", 5, 8).trainer.team[0].monId === "13");
t("npcs.miss null", npcAt("route_a", 1, 1) === null);
t("npcs.sign text", signAt("route_a", 5, 2) && signAt("route_a", 5, 2).text.length > 10);
t("npcs.trainer flag", trainerFlag("pip") === "trainer_pip");
t("npcs.defeated", isTrainerDefeated({ trainer_pip: true }, "pip") === true && isTrainerDefeated({}, "pip") === false);

// ---- ridge ----
const bgs = ["background_grass.png", "background_cave.png"];
t("ridge.assert clean", assertRidge(MONSTERS, bgs).length === 0, assertRidge(MONSTERS, bgs));
t("ridge.zones", !!RIDGE.zones.grass_c && !!RIDGE.zones.grass_d);
const zt = zoneTable("grass_c");
t("ridge.zoneTable c", zt && zt.nodeId === "ridge_c" && zt.encounters[0].monId === "6", zt && zt.nodeId);
t("ridge.zoneTable d", zoneTable("grass_d").nodeId === "ridge_d");
t("ridge.zoneTable route", zoneTable("grass_a").nodeId === "grass_a");
t("ridge.zoneTable unknown", zoneTable("nope") === null);
t("ridge.outlevels route", Math.min(...Object.values(RIDGE.zones).flatMap((z) => z.encounters.map((e) => e.level))) > 3);

// ---- route ----
t("route.assert clean", assertRoute(MONSTERS, bgs).length === 0, assertRoute(MONSTERS, bgs));
t("route.shape 5 nodes", ROUTE_A.nodes.length === 5);
const wA = pickEncounter(ROUTE_A, "grass_a", () => 0);
t("route.grass_a rng0 -> mon 5 wild", wA && wA.monId === "5" && wA.mode === "wild", wA);
const wB = pickEncounter(ROUTE_A, "grass_a", () => 0.99);
t("route.grass_a rng.99 -> mon 8 wild", wB && wB.monId === "8" && wB.mode === "wild", wB);
const boss = pickEncounter(ROUTE_A, "cave", () => 0.5);
t("route.boss fixed", boss && boss.monId === "4" && boss.mode === "boss", boss);
t("route.start no encounter", pickEncounter(ROUTE_A, "start", () => 0) === null);
t("route.unknown node null", pickEncounter(ROUTE_A, "nope", () => 0) === null);

// ---- world reducer ----
const ws0 = newWorldState("route_a");
t("world.init", ws0.nodeIndex === 0 && ws0.cleared.length === 0 && ws0.done === false);
t("world.move fwd", worldMove(ws0, 1, 5).nodeIndex === 1);
t("world.move clamp low", worldMove(ws0, -1, 5).nodeIndex === 0);
t("world.move clamp high", worldMove({ ...ws0, nodeIndex: 4 }, 1, 5).nodeIndex === 4);
t("world.move pure", ws0.nodeIndex === 0);
const ws1 = commitNodeClear(ws0, "grass_a", false);
t("world.clear grass", isNodeCleared(ws1, "grass_a") && ws1.done === false);
t("world.clear idempotent", commitNodeClear(ws1, "grass_a", false).cleared.length === 1);
const ws2 = commitNodeClear(ws1, "cave", true);
t("world.boss done", ws2.done === true && isNodeCleared(ws2, "cave"));

// ---- collection ----
t("level.xp0 -> 1", levelForXp(0) === 1);
t("level.xp10 -> 2", levelForXp(10) === 2);
t("level.xp29 -> 2", levelForXp(29) === 2);
t("level.xp100 -> 5", levelForXp(100) === 5);
const owned = makeOwned(MONSTERS["1"], 0);
t("owned.shape", owned.id === "1" && owned.name === "HOPLING" && owned.level === 1 && owned.moves.length === 3 && owned.hp === undefined);
const col1 = addCapture([], MONSTERS["1"]);
t("capture.append", col1.length === 1 && col1[0].id === "1");
t("switch.ok", switchActive(col1, "1", "1").ok === true);
const col2 = addCapture(col1, MONSTERS["2"]);
const sw = switchActive(col2, "1", "2");
t("switch.to captured", sw.ok === true && sw.activeId === "2");
t("switch.not-owned", switchActive(col2, "1", "99").ok === false);
t("getActive", getActive(col2, "2").name === "BUBBLIT" && getActive(col2, "99") === null);
const aw = awardXp(makeOwned(MONSTERS["1"], 0), { perfect: 2, great: 1, good: 1 }, true, false);
t("xp.math 2*3+2+1+10=19", aw.earned === 19 && aw.owned.xp === 19 && aw.owned.level === 2 && aw.leveledUp === true, aw);
const awLose = awardXp(makeOwned(MONSTERS["1"], 0), { perfect: 0, great: 0, good: 0 }, false, false);
t("xp.defeat floor 0", awLose.earned === 0 && awLose.owned.xp === 0, awLose);

// ---- capture ----
t("capture.threshold const", CAPTURE_THRESHOLD === 30);
t("capture.at threshold .8", captureChance(30) === 0.8);
t("capture.above .8", captureChance(99) === 0.8);
t("capture.zero .25", captureChance(0) === 0.25);
t("capture.combo10 .35", Math.abs(captureChance(10) - 0.35) < 1e-9);
t("roll.success", captureRoll(() => 0.0, 30).success === true);
t("roll.fail", captureRoll(() => 0.999, 0).success === false);

// ---- persistence ----
function fakeStorage(initial) {
  let store = { ...(initial || {}) };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    _store: store,
  };
}
function validDoc() {
  return {
    schema: 1, savedAt: 1, activeMonsterId: "1",
    collection: [{ id: "1", name: "HOPLING", level: 1, xp: 0,
      moves: [{ name: "EMBER", type: "BURNING", letters: 5 }, { name: "TACKLE", type: "FIGHT", letters: 6 }, { name: "GUST", type: "SKY", letters: 4 }] }],
    route: { routeId: "route_a", nodeIndex: 0, cleared: [], flags: {} },
  };
}
t("save.key", SAVE_KEY === "typemon.save.v1" && SCHEMA === 1);
const fs1 = fakeStorage();
t("save.roundtrip", saveGame(fs1, validDoc()) === true
  && loadSave(fs1).state !== null && loadSave(fs1).state.activeMonsterId === "1");
t("load.no-save", loadSave(fakeStorage()).state === null);
t("load.corrupt", loadSave(fakeStorage({ [SAVE_KEY]: "{bad" })).reason === "corrupt-json");
t("load.bad-schema", loadSave(fakeStorage({ [SAVE_KEY]: JSON.stringify({ ...validDoc(), schema: 99 }) })).reason === "bad-schema");
const hpDoc = validDoc(); hpDoc.collection[0].hp = 50;
t("save.hp rejected", saveGame(fakeStorage(), hpDoc) === false);
const anDoc = validDoc(); anDoc.activeMonsterId = "2";
t("save.active-not-owned rejected", saveGame(fakeStorage(), anDoc) === false);
const badStore = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
t("load.storage throw", loadSave(badStore).reason === "storage-read-failed");
t("save.storage throw false", saveGame(badStore, validDoc()) === false);

// ---- overworld (world-owned grid map + movement) ----
const flatMap = (id) => MAPS[id].rows.join("");
t("ow.maps exist", !!MAPS.route_a && !!MAPS.cave_a && !!MAPS.hut_a && !!MAPS.ridge_a);
const spH = spawnFor("hut_a");
t("ow.hut spawn walkable", isWalkable("hut_a", spH.row, spH.col), spH);
for (const id of Object.keys(MAPS)) {
  const m = MAPS[id], w = m.rows[0].length;
  t("ow." + id + " rectangular", m.rows.every((r) => r.length === w), w);
  let border = true;
  for (let r = 0; r < m.rows.length; r++)
    for (let c = 0; c < w; c++)
      if ((r === 0 || c === 0 || r === m.rows.length - 1 || c === w - 1) && m.rows[r][c] !== "#") border = false;
  t("ow." + id + " border blocked", border);
}
const flatO = flatMap("route_a"), flatC = flatMap("cave_a"), flatH = flatMap("hut_a"), flatR = flatMap("ridge_a");
for (const ch of [",", ";", "~", "o", "C", "D", "S", "H"]) t("ow.outdoor has tile " + ch, flatO.includes(ch));
for (const ch of ["~", "o", "X", "B", "T"]) t("ow.cave has tile " + ch, flatC.includes(ch));
t("ow.tallgrass zones distinct", encounterZoneAt("route_a", 1, 12) === "grass_a" && encounterZoneAt("route_a", 12, 5) === "grass_b");
t("ow.zoneToNode", zoneToNode("grass_a") === "grass_a" && zoneToNode("grass_b") === "grass_b" && zoneToNode("x") === null);
t("ow.zoneToNode ridge", zoneToNode("grass_c") === "ridge_c" && zoneToNode("grass_d") === "ridge_d");
// ridge grass remaps to the ridge tables end to end: tile -> zone -> node -> table
const rzC = encounterZoneAt("ridge_a", 1, 1), rzD = encounterZoneAt("ridge_a", 1, 13);
t("ow.ridge grass zones", rzC === "grass_c" && rzD === "grass_d", { rzC, rzD });
const rTab = zoneTable(zoneToNode(rzC));
t("ow.ridge grass encounter", rTab && rTab.nodeId === "ridge_c" && rTab.encounters[0].monId === "6" && rTab.encounters[0].level === 4, rTab && rTab.nodeId);
const rTabD = zoneTable(zoneToNode(rzD));
t("ow.ridge grass encounter d", rTabD && rTabD.nodeId === "ridge_d" && rTabD.encounters[0].level === 5, rTabD && rTabD.nodeId);
const spA = spawnFor("route_a");
t("ow.spawn walkable", isWalkable("route_a", spA.row, spA.col), spA);
const s0 = { mapId: "route_a", row: 5, col: 3, face: "right" };
const mvR = moveState(s0, "right");
t("ow.move one tile", mvR.moved && mvR.state.col === 4 && mvR.state.row === 5 && mvR.state.face === "right");
t("ow.move pure (no mutation)", s0.col === 3);
const mvUp = moveState(s0, "up");
t("ow.blocked door turns in place", !mvUp.moved && mvUp.blocked && mvUp.state.face === "up" && mvUp.state.row === 5 && mvUp.state.col === 3);
const mvW = moveState({ mapId: "route_a", row: 7, col: 15, face: "right" }, "right");
t("ow.blocked water", !mvW.moved && mvW.blocked);
let gsteps = 0, trigAt = -1;
for (let i = 1; i <= 5; i++) { const g = advanceGrass(gsteps); gsteps = g.steps; if (g.trigger) { trigAt = i; break; } }
t("ow.grass threshold deterministic", GRASS_THRESHOLD === 3 && trigAt === 3, { GRASS_THRESHOLD, trigAt });
const gz = moveState({ mapId: "route_a", row: 1, col: 11, face: "right" }, "right");
t("ow.grass step exposes zone", gz.moved && gz.dest.zone === "grass_a", gz.dest);
t("ow.cave entrance transition", (transitionAt("route_a", 16, 20) || {}).to === "cave_a");
t("ow.cave exit transition", (transitionAt("cave_a", 8, 2) || {}).to === "route_a");
const applied = applyTransition({ mapId: "route_a", row: 15, col: 20, face: "up" }, transitionAt("route_a", 16, 20));
t("ow.transition applies spawn", applied.mapId === "cave_a" && applied.row === 9 && applied.col === 2 && applied.face === "up", applied);
const facCave = facingTile({ mapId: "route_a", row: 15, col: 20, face: "down" });
t("ow.facing cave mouth", !!facCave.transition && facCave.transition.kind === "enter_cave", facCave.char);
const facDoor = facingTile({ mapId: "route_a", row: 5, col: 3, face: "up" });
t("ow.facing home door", facDoor.char === "D" && facDoor.interact === "home", facDoor.char);
t("ow.boss tile walkable", isBossTile("cave_a", 2, 12) && isWalkable("cave_a", 2, 12));
t("ow.tiles legend covers maps", flatO.concat(flatC, flatH, flatR).split("").every((ch) => !!TILES[ch]));
t("ow.hut transition in", (transitionAt("route_a", 4, 3) || {}).to === "hut_a");
t("ow.hut transition out", (transitionAt("hut_a", 4, 4) || {}).to === "route_a");
const appliedH = applyTransition({ mapId: "route_a", row: 4, col: 2, face: "right" }, transitionAt("route_a", 4, 3));
t("ow.hut transition applies spawn", appliedH.mapId === "hut_a" && appliedH.row === spH.row && appliedH.col === spH.col && appliedH.face === "down", appliedH);
const facHut = facingTile({ mapId: "route_a", row: 4, col: 2, face: "right" });
t("ow.facing hut door", !!facHut.transition && facHut.transition.kind === "enter_hut");
t("ow.sign tile blocked+interact", tileCharAt("route_a", 5, 2) === "S" && interactKindAt("route_a", 5, 2) === "sign");
t("ow.tunnel tile blocked+interact", tileCharAt("cave_a", 2, 14) === "T" && interactKindAt("cave_a", 2, 14) === "enter_ridge");
t("ow.ridge spawn walkable", isWalkable("ridge_a", 8, 1), spawnFor("ridge_a"));
const reachR = owBfs("ridge_a", spawnFor("ridge_a"));
t("ow.ridge grass_c reachable", reachR.has("1,2"));
t("ow.ridge grass_d reachable", reachR.has("1,15"));
t("ow.ridge maro reachable", reachR.has("11,16"));
const reachH = owBfs("hut_a", spawnFor("hut_a"));
t("ow.hut gramps reachable", reachH.has("2,4"));
const encs = [{ monId: "5", level: 2 }, { monId: "8", level: 2 }];
t("ow.pick index 0", pickEncounterIndexed(encs, 0).monId === "5");
t("ow.pick index 1", pickEncounterIndexed(encs, 1).monId === "8");
t("ow.pick wraps", pickEncounterIndexed(encs, 2).monId === "5");
t("ow.pick empty null", pickEncounterIndexed([], 0) === null);
function owBfs(mapId, start) {
  const m = MAPS[mapId], seen = new Set([start.row + "," + start.col]), q = [[start.row, start.col]];
  while (q.length) {
    const [r, c] = q.pop();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc, k = nr + "," + nc;
      if (nr < 0 || nc < 0 || nr >= m.rows.length || nc >= m.rows[0].length) continue;
      const w = TILES[m.rows[nr][nc]];
      if (w && w.walkable && !seen.has(k)) { seen.add(k); q.push([nr, nc]); }
    }
  }
  return seen;
}
const reachO = owBfs("route_a", spawnFor("route_a"));
t("ow.grass_a reachable", reachO.has("1,12"));
t("ow.grass_b reachable", reachO.has("12,5"));
t("ow.cave front reachable", reachO.has("15,20"));
t("ow.cave boss reachable", owBfs("cave_a", spawnFor("cave_a")).has("2,12"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
