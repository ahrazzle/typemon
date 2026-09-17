// Typemon MVP — Route A definition (Slice 0). Pure data, no DOM/Typejoy.
// Rail: Start -> Grass A -> Grass B -> Cave Boss -> End.
// Backdrops: the two existing ledgered battle backgrounds only.
export const ROUTE_A = {
  id: "route_a",
  nodes: [
    { id: "start", kind: "start", label: "START", bg: "background_grass.png" },
    {
      id: "grass_a", kind: "grass", label: "GRASS A", bg: "background_grass.png",
      encounters: [
        { monId: "5", level: 2 },
        { monId: "8", level: 2 },
      ],
    },
    {
      id: "grass_b", kind: "grass", label: "GRASS B", bg: "background_grass.png",
      encounters: [
        { monId: "4", level: 2 },
        { monId: "10", level: 3 },
      ],
    },
    {
      id: "cave", kind: "cave", label: "CAVE BOSS", bg: "background_cave.png",
      boss: { monId: "4", level: 3 },
    },
    { id: "end", kind: "end", label: "END", bg: "background_grass.png" },
  ],
};

// Pick a wild encounter candidate for a grass node. rng() -> [0,1).
// Boss nodes always return the single boss def with mode "boss".
export function pickEncounter(route, nodeId, rng) {
  const node = route.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  if (node.boss) return { ...node.boss, mode: "boss", nodeId };
  if (!node.encounters || node.encounters.length === 0) return null;
  const r = typeof rng === "function" ? rng() : Math.random();
  const i = Math.floor(r * node.encounters.length) % node.encounters.length;
  return { ...node.encounters[i], mode: "wild", nodeId };
}

// Registry assertion: every referenced monId exists and every bg is known.
export function assertRoute(monsters, bgs) {
  const errors = [];
  const nodeIds = new Set();
  for (const n of ROUTE_A.nodes) {
    if (nodeIds.has(n.id)) errors.push("duplicate node " + n.id);
    nodeIds.add(n.id);
    if (!bgs.includes(n.bg)) errors.push(n.id + ": unknown bg " + n.bg);
    for (const e of (n.encounters || [])) {
      if (!monsters[e.monId]) errors.push(n.id + ": unknown monId " + e.monId);
      if (!monsters[e.monId + ""] || !monsters[e.monId].wild) errors.push(n.id + ": no wild sprite for " + e.monId);
    }
    if (n.boss) {
      if (!monsters[n.boss.monId]) errors.push(n.id + ": unknown boss monId " + n.boss.monId);
      if (!monsters[n.boss.monId + ""] || !monsters[n.boss.monId].evolved) {
        errors.push(n.id + ": no evolved sprite for boss " + n.boss.monId);
      }
    }
  }
  const kinds = ROUTE_A.nodes.map((n) => n.kind).join(",");
  if (kinds !== "start,grass,grass,cave,end") errors.push("route shape changed: " + kinds);
  return errors;
}
