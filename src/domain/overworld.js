// Typemon MVP — overworld domain (world-owned grid map + movement).
// PURE: no DOM, no Typejoy. Map DATA + movement/collision/encounter GEOMETRY live
// here so the browser renderer and the node tests share one source of truth.
//
// The map is authored ASCII (rows of equal width). Rendering (colors, sprites,
// camera) lives in src/view/world_view.js and never owns movement.
//
// Legend (TILES below):
//   .  short grass (walkable)
//   ,  tall grass, zone grass_a (walkable, counts toward an encounter)
//   ;  tall grass, zone grass_b (walkable, counts toward an encounter)
//   -  worn path (walkable)
//   #  tree / wall (blocked)
//   ~  water (blocked)
//   o  rock (blocked)
//   H  house wall (blocked)
//   D  house door (blocked, interactable)
//   C  cave entrance (blocked, interact -> cave_a)
//   X  cave mouth (blocked, interact -> route_a)
//   B  cave boss tile (walkable; stepping on it starts the boss battle)

export const GRASS_THRESHOLD = 3;   // deterministic: every 3rd tall-grass step -> encounter
export const TILE_SIZE = 48;        // world tile edge in CSS px (renderer + camera)

export const TILES = {
  ".": { kind: "grass", walkable: true },
  ",": { kind: "tallgrass", walkable: true, zone: "grass_a" },
  ";": { kind: "tallgrass", walkable: true, zone: "grass_b" },
  "-": { kind: "path", walkable: true },
  "#": { kind: "tree", walkable: false },
  "~": { kind: "water", walkable: false },
  "o": { kind: "rock", walkable: false },
  "H": { kind: "wall", walkable: false },
  "D": { kind: "door", walkable: false, interact: "home" },
  "C": { kind: "cave", walkable: false, interact: "enter_cave" },
  "X": { kind: "cavemouth", walkable: false, interact: "exit_cave" },
  "B": { kind: "bosstile", walkable: true, boss: true },
};

// ---- authored maps -------------------------------------------------------
const OUTDOOR_ROWS = [
  "########################",
  "#..........,,,,,.......#",
  "#..HH......,,,,,.......#",
  "#..HH......,,,,,.......#",
  "#..D........-.......o..#",
  "#..----------..........#",
  "###-................o..#",
  "###-............~~~~...#",
  "#..-............~~~~...#",
  "#..-............~~~~...#",
  "#..------------------..#",
  "#...................-..#",
  "#...;;;;;...........-..#",
  "#...;;;;;...........-..#",
  "#...;;;;;...........-..#",
  "#................o..-###",
  "#...................C###",
  "########################",
];

const CAVE_ROWS = [
  "################",
  "#--------------#",
  "#---o-------B--#",
  "#-----------o--#",
  "#------~~~~----#",
  "#------~~~~----#",
  "#-------o------#",
  "#--------------#",
  "#-X---o--------#",
  "#--------------#",
  "################",
];

export const MAPS = {
  route_a: {
    id: "route_a",
    name: "ROUTE A",
    kind: "outdoor",
    rows: OUTDOOR_ROWS,
    spawn: { mapId: "route_a", row: 5, col: 3, face: "right" },
    transitions: {
      "16,20": { kind: "enter_cave", to: "cave_a", spawn: { mapId: "cave_a", row: 9, col: 2, face: "up" } },
    },
  },
  cave_a: {
    id: "cave_a",
    name: "STONE CAVE",
    kind: "cave",
    rows: CAVE_ROWS,
    spawn: { mapId: "cave_a", row: 9, col: 2, face: "up" },
    transitions: {
      "8,2": { kind: "exit_cave", to: "route_a", spawn: { mapId: "route_a", row: 15, col: 20, face: "down" } },
    },
  },
};

export const DIRS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export function getMap(mapId) { return MAPS[mapId] || null; }

export function inBounds(map, row, col) {
  return !!map && row >= 0 && col >= 0 && row < map.rows.length && col < map.rows[0].length;
}

export function tileCharAt(mapId, row, col) {
  const map = getMap(mapId);
  if (!inBounds(map, row, col)) return null;
  return map.rows[row][col];
}

export function tileDefAt(mapId, row, col) {
  const ch = tileCharAt(mapId, row, col);
  return ch === null ? null : (TILES[ch] || null);
}

export function isWalkable(mapId, row, col) {
  const def = tileDefAt(mapId, row, col);
  return !!(def && def.walkable);
}

// Encounter zone for a tile ("grass_a" | "grass_b" | null).
export function encounterZoneAt(mapId, row, col) {
  const def = tileDefAt(mapId, row, col);
  return (def && def.zone) || null;
}

// Boss tile?
export function isBossTile(mapId, row, col) {
  const def = tileDefAt(mapId, row, col);
  return !!(def && def.boss);
}

// Door / cave-mouth interaction on a tile (interact kind) or null.
export function interactKindAt(mapId, row, col) {
  const def = tileDefAt(mapId, row, col);
  return (def && def.interact) || null;
}

// Transition record authored on a tile, or null.
export function transitionAt(mapId, row, col) {
  const map = getMap(mapId);
  if (!map) return null;
  return map.transitions[row + "," + col] || null;
}

export function spawnFor(mapId) {
  const map = getMap(mapId);
  return map ? { ...map.spawn } : null;
}

// Zone -> route node id (the encounter table lives in src/data/route_a.js).
export function zoneToNode(zone) {
  return zone === "grass_a" || zone === "grass_b" ? zone : null;
}

// Deterministic encounter selection: cycle the node's candidate list by index.
// No Math.random — the first tester (and the CDP harness) always get the same
// sequence, so "walk into grass" is reproducible.
export function pickEncounterIndexed(encounters, index) {
  if (!encounters || encounters.length === 0) return null;
  const i = ((index % encounters.length) + encounters.length) % encounters.length;
  return { ...encounters[i], index: i };
}

// Advance one grid cell. Returns the resulting state plus what the destination
// tile carries, so the caller decides about grass counters / boss battles.
// A blocked move still TURNS the character (facing updates), matching classic
// tile RPGs — but the position does not change.
export function moveState(state, dir) {
  const d = DIRS[dir];
  if (!d) return { moved: false, blocked: false, state, dest: null };
  const nr = state.row + d.dr, nc = state.col + d.dc;
  const facing = { ...state, face: dir };
  if (!isWalkable(state.mapId, nr, nc)) {
    return { moved: false, blocked: true, state: facing, dest: { row: nr, col: nc, char: tileCharAt(state.mapId, nr, nc) } };
  }
  const moved = { ...state, row: nr, col: nc, face: dir };
  return {
    moved: true,
    blocked: false,
    state: moved,
    dest: {
      row: nr, col: nc,
      char: tileCharAt(state.mapId, nr, nc),
      zone: encounterZoneAt(state.mapId, nr, nc),
      boss: isBossTile(state.mapId, nr, nc),
    },
  };
}

// What the character is facing (for Enter/Space interaction).
export function facingTile(state) {
  const d = DIRS[state.face] || DIRS.down;
  const row = state.row + d.dr, col = state.col + d.dc;
  return {
    row, col,
    char: tileCharAt(state.mapId, row, col),
    transition: transitionAt(state.mapId, row, col),
    interact: interactKindAt(state.mapId, row, col),
  };
}

// Apply a grass step. Returns { steps, trigger } where trigger is true when the
// visible threshold is reached (caller then starts the encounter and resets).
export function advanceGrass(steps) {
  const next = steps + 1;
  return { steps: next, trigger: next >= GRASS_THRESHOLD };
}

// Apply a transition: returns the destination world state (mapId/row/col/face).
export function applyTransition(state, tr) {
  if (!tr || !tr.spawn) return state;
  return { mapId: tr.spawn.mapId, row: tr.spawn.row, col: tr.spawn.col, face: tr.spawn.face };
}
