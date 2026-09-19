// Typemon v1 — Ember Ridge content (pure data, no DOM/Typejoy).
// Ember Ridge is the second outdoor area, reached through the ridge tunnel
// in Stone Cave after the cave boss falls. Higher-level wilds (zones
// grass_c / grass_d) and the final trainer, Ridge Keeper Maro.

import { ROUTE_A } from "./route_a.js";

export const RIDGE = {
  id: "ridge",
  mapId: "ridge_a",
  zones: {
    grass_c: {
      nodeId: "ridge_c",
      label: "RIDGE SLOPES",
      bg: "background_grass.png",
      encounters: [
        { monId: "6", level: 4 },
        { monId: "11", level: 4 },
        { monId: "15", level: 4 },
        { monId: "47", level: 5 },
      ],
    },
    grass_d: {
      nodeId: "ridge_d",
      label: "RIDGE PEAKS",
      bg: "background_grass.png",
      encounters: [
        { monId: "21", level: 5 },
        { monId: "32", level: 5 },
        { monId: "26", level: 6 },
        { monId: "35", level: 6 },
      ],
    },
  },
};

// Unified encounter-table lookup across Route A and Ember Ridge.
// Returns { encounters, bg, label, nodeId } or null for unknown zones.
export function zoneTable(zone) {
  if (!zone) return null;
  const node = ROUTE_A.nodes.find((n) => n.id === zone);
  if (node && node.encounters) {
    return { encounters: node.encounters, bg: node.bg, label: node.label, nodeId: node.id };
  }
  const z = RIDGE.zones[zone];
  if (z) return { encounters: z.encounters, bg: z.bg, label: z.label, nodeId: z.nodeId };
  return null;
}

export function assertRidge(monsters, bgs) {
  const errors = [];
  for (const key of Object.keys(RIDGE.zones)) {
    const z = RIDGE.zones[key];
    if (!bgs.includes(z.bg)) errors.push(key + ": unknown bg " + z.bg);
    if (!Array.isArray(z.encounters) || z.encounters.length === 0) errors.push(key + ": no encounters");
    for (const e of z.encounters) {
      if (!monsters[e.monId]) errors.push(key + ": unknown monId " + e.monId);
      if (!monsters[e.monId + ""] || !monsters[e.monId].wild) errors.push(key + ": no wild sprite for " + e.monId);
      if (!Number.isInteger(e.level) || e.level < 1) errors.push(key + ": bad level for " + e.monId);
    }
  }
  // Ridge wilds must out-level Route A wilds (progression).
  const routeMax = Math.max(...ROUTE_A.nodes.flatMap((n) => (n.encounters || []).map((e) => e.level)));
  const ridgeMin = Math.min(...Object.values(RIDGE.zones).flatMap((z) => z.encounters.map((e) => e.level)));
  if (!(ridgeMin > routeMax)) errors.push("ridge min level " + ridgeMin + " not above route max " + routeMax);
  return errors;
}
