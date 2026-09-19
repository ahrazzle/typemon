// Typemon MVP — overworld renderer (world-owned VIEW layer).
// Browser-only: reads the pure map from src/domain/overworld.js and paints an
// authored DUSKPAPER diorama (paper-cut, dusk, keyline+rim+contour grammar) plus
// the named trainer RIFF onto a full-viewport canvas.
// Movement/collision/encounters are NOT here — the domain owns them.
//
// Rendering is CSS/canvas-authored (no third-party tilesets, no Tuxemon art).
//
// Art direction: ART_DIRECTION_OVERWORLD.md — "DUSKPAPER: a topolight paper-cut
// diorama of a small world photographed at dusk". One global PULSE = 1.00s rides
// every animation; the map void is designed NIGHT ink, never black.

import { MAPS, TILES, TILE_SIZE } from "../domain/overworld.js";
import { NPCS, isTrainer, trainerFlag } from "../data/npcs.js";

/* ===================== PALETTE (DUSKPAPER) =====================
   Bind to the battle tokens so overworld + battle are one world's day-part. */
const P = {
  // shared tokens
  INK:    "#0b0d14",
  NIGHT:  "#141a26",
  NAVY:   "#1a1a2e",
  CORAL:  "#e94560",   // RESERVED: boss rune + RIFF's cap. Never terrain.
  GOLD:   "#ffd166",
  TEAL:   "#06d6a0",
  RIM:    "#e8e6df",   // avatar halo rim only
  grid:   "#2a3048",   // night contour grid

  // outdoor ground — Ember Meadow
  gj0:    "#2f5d4a", gj1: "#356552", gj2: "#2a5443", gdark: "#26493a",
  contour:"#79b8a0",

  // tall grass A — SEED MEADOW (warm amber signature)
  A0:     "#4a5a2f", A1: "#3d4a26", Abel: "#6f7d3a", Aseed: "#c98f2f",

  // tall grass B — FERN HOLLOW (cool teal-mint signature)
  B0:     "#245046", B1: "#1d4239", Bfrond: "#3f7a68", Btip: "#6fb7a3", Bdew: "#06d6a0",

  // path
  tread:  "#7d6a4a", lit: "#a98d55", stitch: "#3a3024", chev: "#6b5a3d",

  // water
  wdeep:  "#16394f", wmid: "#1e4a63", wshim: "#4d8fa6", wfoam: "#79b8c9",

  // tree
  tcanopy:"#1d3f33", tmid: "#275241", trim: "#57876d", ttrunk: "#4a3626", tleaf: "#7fae7d",

  // rock
  rbody:  "#4a5264", rlit: "#78849b", rrim: "#a3adc0",

  // house
  hwall:  "#6b4f3a", hseam: "#553d2d", hroof: "#38343f", hroofrim: "#5a5468",

  // door
  door:   "#5a3f2b",

  // cave mouth (from outside)
  cface:  "#3f4758", cpitch: "#0d0f17",

  // cave — Glintfall Hollow
  cfloor0:"#1c2030", cfloor1: "#232839", cvein: "#34405c",
  cwall:  "#0f121d", cwallrock: "#2a3048", cwallrim: "#4d5a80",
  crystal:"#06d6a0", crystalHi: "#7fd8c2",
  pool0:  "#10323a", pool1: "#1b4a52", poolshim: "#2f7d72",
  crock:  "#39415a", crockrim: "#66739a",
  runein: "#7a2230",

  // avatar RIFF
  skin:   "#8a5a3c", jacket: "#243052", zipper: "#ffd166", shoe: "#20242e",
};

const TAU = Math.PI * 2;
const PULSE_MS = 1000;   // the one clock: battle note grid = overworld pulse

// Deterministic 0..1 hash for stable decoration placement.
function h2(r, c) {
  let x = (r * 73856093) ^ (c * 19349663);
  x = (x ^ (x >>> 13)) >>> 0;
  return (x % 1000) / 1000;
}
// Extra deterministic channels (decor variants within a tile).
function h3(a, b, c) {
  let x = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791);
  x = (x ^ (x >>> 13)) >>> 0;
  return (x % 1000) / 1000;
}
// The document's clock phase per tile.
function tilePhase(row, col) { return TAU * (row + col) / 5; }

export function createWorldView(canvas) {
  let ctx = canvas.getContext("2d");   // swapped to bctx while building the static layer
  let cssW = 0, cssH = 0, dpr = 1;

  // ---- view state (persists across frames for the ambient loop) ----
  let lastState = null;
  let lastFlags = {};
  let base = null, bctx = null;       // cached static layer (grounds + solids)
  let camX = 0, camY = 0;
  let worldW = 0, worldH = 0, nCols = 0, nRows = 0, ts = TILE_SIZE;
  let map = null;
  let reduced = false;
  let loopStarted = false;
  let lastAmbient = 0;

  // prefers-reduced-motion: keep static separation, drop motion.
  try {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = !!mq.matches;
    if (mq.addEventListener) mq.addEventListener("change", (e) => { reduced = !!e.matches; });
    else if (mq.addListener) mq.addListener((e) => { reduced = !!e.matches; });
  } catch (e) { reduced = false; }

  function fit() {
    dpr = window.devicePixelRatio || 1;
    cssW = canvas.clientWidth || window.innerWidth;
    cssH = canvas.clientHeight || window.innerHeight;
    const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---------------- low-level paper-cut drawing helpers ---------------- */

  function poly(c, pts) {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.closePath();
  }
  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  // 2px near-black keyline around any solid.
  function keyline(c, pts, w) {
    c.strokeStyle = P.INK; c.lineWidth = w || 2; c.lineJoin = "round";
    poly(c, pts); c.stroke();
  }
  // Top rim light: 2px lightest-family tint along the upward edge, clipped inside.
  function rimTop(c, pts, color, w) {
    let minY = Infinity, minX = Infinity, maxX = -Infinity;
    for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; }
    c.save(); poly(c, pts); c.clip();
    c.strokeStyle = color; c.lineWidth = w || 2;
    c.beginPath(); c.moveTo(minX, minY + (w || 2) / 2); c.lineTo(maxX, minY + (w || 2) / 2); c.stroke();
    c.restore();
  }
  // fill → top rim → keyline (the house grammar for every solid).
  function paper(c, pts, fill, rim, keyW, rimW) {
    c.fillStyle = fill; poly(c, pts); c.fill();
    if (rim) rimTop(c, pts, rim, rimW);
    keyline(c, pts, keyW);
  }
  // One sun, one lamp, everywhere: soft INK ellipse at the tile bottom, offset lower-right.
  function groundShadow(cx, by, size, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 0.28 : alpha; ctx.fillStyle = P.INK;
    ctx.beginPath(); ctx.ellipse(cx + size * 0.06, by, size * 0.35, size * 0.11, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function hexPath(c, cx, cy, r, rot) {
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + (rot || 0);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }

  /* ---------------- map helpers (renderer-side adjacency) ---------------- */

  function inb(r, c) { return r >= 0 && c >= 0 && r < nRows && c < nCols; }
  function chAt(r, c) { return inb(r, c) ? map.rows[r][c] : null; }
  function kindAt(r, c) { const ch = chAt(r, c); return ch == null ? null : ((TILES[ch] || {}).kind || null); }
  function isIndoor() { return map && map.kind !== "outdoor"; }

  /* ---------------- per-tile STATIC parts (cached layer) ---------------- */

  function contourSegment(sx, sy, row, col) {
    // continuous-ish hairline crossing the tile at a shallow angle; endpoint shared
    // with the horizontal neighbour so the ground reads as one map, not stamps.
    const ay = (r, c) => r * ts + ts * 0.5 + ts * 0.30 * Math.sin(c * 0.86 + r * 1.7);
    const y0 = ay(row, col) - (row * ts);
    const y1 = ay(row, col + 1) - (row * ts);
    ctx.strokeStyle = P.contour; ctx.lineWidth = 1; ctx.globalAlpha = 0.06;
    ctx.beginPath();
    ctx.moveTo(sx, sy + y0);
    ctx.quadraticCurveTo(sx + ts * 0.5, sy + (y0 + y1) / 2 - ts * 0.04, sx + ts, sy + y1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawOutdoorGround(sx, sy, row, col) {
    const n = h2(row, col);
    const tints = [P.gj0, P.gj1, P.gj2];
    ctx.fillStyle = tints[Math.floor(n * 3) % 3];
    ctx.fillRect(sx, sy, ts, ts);
    if (n < 0.12) {           // 12% dark patch
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = P.gdark;
      ctx.beginPath(); ctx.ellipse(sx + ts * 0.5, sy + ts * 0.55, ts * 0.3, ts * 0.24, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    contourSegment(sx, sy, row, col);
    // ≤1 decoration; 70%+ of tiles stay bare (quietness is the point)
    if (n > 0.30 && n < 0.46) {          // clover trio
      ctx.fillStyle = P.trim;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(sx + ts * (0.14 + i * 0.05), sy + ts * (0.16 + (i % 2) * 0.05), ts * 0.022, 0, TAU); ctx.fill();
      }
    } else if (n > 0.55 && n < 0.68) {   // pebble pair
      ctx.fillStyle = P.rbody;
      ctx.beginPath(); ctx.ellipse(sx + ts * 0.62, sy + ts * 0.7, ts * 0.05, ts * 0.035, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + ts * 0.72, sy + ts * 0.78, ts * 0.035, ts * 0.025, 0, 0, TAU); ctx.fill();
    }
  }

  function drawPath(sx, sy, row, col) {
    ctx.fillStyle = P.tread; ctx.fillRect(sx, sy, ts, ts);
    // worn lit band follows the direction of travel (which edges are also path)
    const pl = kindAt(row, col - 1) === "path", pr = kindAt(row, col + 1) === "path";
    const pu = kindAt(row - 1, col) === "path", pd = kindAt(row + 1, col) === "path";
    const horiz = (pl || pr) && !((pu || pd) && !(pl || pr));
    ctx.fillStyle = P.lit; ctx.globalAlpha = 0.85;
    if (horiz) ctx.fillRect(sx, sy + ts * 0.34, ts, ts * 0.32);
    else ctx.fillRect(sx + ts * 0.34, sy, ts * 0.32, ts);
    ctx.globalAlpha = 1;
    // edge stitching / pebbles on every shared edge with non-path
    const edges = [
      [-1, 0, "top"], [1, 0, "bottom"], [0, -1, "left"], [0, 1, "right"],
    ];
    for (const [dr, dc, side] of edges) {
      if (!inb(row + dr, col + dc)) continue;
      const k = kindAt(row + dr, col + dc);
      if (k === "path") continue;
      if (k === "water") {                       // pebbles, not stitch
        ctx.fillStyle = P.rbody;
        const px = dc ? sx + (dc < 0 ? 2 : ts - 6) : sx + ts * 0.4;
        const py = dr ? sy + (dr < 0 ? 2 : ts - 6) : sy + ts * 0.4;
        ctx.beginPath(); ctx.ellipse(px, py, 3, 2.4, 0, 0, TAU); ctx.fill();
        continue;
      }
      ctx.strokeStyle = P.stitch; ctx.lineWidth = 2; ctx.setLineDash([2, 4]);
      ctx.beginPath();
      if (side === "top") { ctx.moveTo(sx, sy + 1); ctx.lineTo(sx + ts, sy + 1); }
      else if (side === "bottom") { ctx.moveTo(sx, sy + ts - 1); ctx.lineTo(sx + ts, sy + ts - 1); }
      else if (side === "left") { ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 1, sy + ts); }
      else { ctx.moveTo(sx + ts - 1, sy); ctx.lineTo(sx + ts - 1, sy + ts); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    // occasional chevron tread mark pointing along travel, by n>0.7
    const n = h2(row, col);
    if (n > 0.7) {
      ctx.strokeStyle = P.chev; ctx.lineWidth = 2;
      const cx = sx + ts * 0.5, cy = sy + ts * 0.5;
      ctx.beginPath();
      if (horiz) { ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx, cy); ctx.lineTo(cx - 4, cy + 4); }
      else { ctx.moveTo(cx - 4, cy - 4); ctx.lineTo(cx, cy); ctx.lineTo(cx + 4, cy - 4); }
      ctx.stroke();
    }
  }

  function drawHedge(sx, sy, row, col) {
    // continuous canopy field (variant 1). Detail only where a non-tree neighbour exists.
    ctx.fillStyle = P.tcanopy; ctx.fillRect(sx, sy, ts, ts);
    const edges = [[-1, 0, "top"], [1, 0, "bottom"], [0, -1, "left"], [0, 1, "right"]];
    for (const [dr, dc, side] of edges) {
      if (!inb(row + dr, col + dc)) continue;    // outward map edge: rim suppressed
      if (kindAt(row + dr, col + dc) === "tree") continue;
      // keyline + rim on the face the world sees
      ctx.strokeStyle = P.INK; ctx.lineWidth = 2;
      ctx.beginPath();
      if (side === "top") { ctx.moveTo(sx, sy + 1); ctx.lineTo(sx + ts, sy + 1); }
      else if (side === "bottom") { ctx.moveTo(sx, sy + ts - 1); ctx.lineTo(sx + ts, sy + ts - 1); }
      else if (side === "left") { ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 1, sy + ts); }
      else { ctx.moveTo(sx + ts - 1, sy); ctx.lineTo(sx + ts - 1, sy + ts); }
      ctx.stroke();
      ctx.strokeStyle = P.trim; ctx.lineWidth = 2;
      ctx.beginPath();
      if (side === "top") { ctx.moveTo(sx, sy + 3); ctx.lineTo(sx + ts, sy + 3); }
      else if (side === "left") { ctx.moveTo(sx + 3, sy); ctx.lineTo(sx + 3, sy + ts); }
      else continue;
      ctx.stroke();
    }
    // scalloped canopy hem overhanging a walkable tile below
    const below = kindAt(row + 1, col);
    if (below && below !== "tree") {
      ctx.fillStyle = P.tmid;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + ts * i / 3, sy + ts);
        ctx.quadraticCurveTo(sx + ts * (i + 0.5) / 3, sy + ts + ts * 0.12, sx + ts * (i + 1) / 3, sy + ts);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = P.INK; ctx.globalAlpha = 0.26;
      ctx.fillRect(sx, sy + ts, ts, ts * 0.1);
      ctx.globalAlpha = 1;
    }
  }

  function drawLoneTree(sx, sy, row, col) {
    const n = h2(row, col);
    ctx.fillStyle = P.gj1; ctx.fillRect(sx, sy, ts, ts);
    contourSegment(sx, sy, row, col);
    // trunk
    ctx.fillStyle = P.ttrunk; ctx.fillRect(sx + ts * 0.44, sy + ts * 0.5, ts * 0.12, ts * 0.38);
    // 3 overlapping paper lobes (cutout, not a ball)
    const mir = n > 0.5 ? -1 : 1;
    const lobes = [
      [0.5, 0.42, 0.30], [0.5 + mir * 0.16, 0.34, 0.22], [0.5 - mir * 0.14, 0.3, 0.18],
    ];
    const pts = [];
    for (const [lx, ly, r] of lobes) {
      const cx = sx + ts * lx, cy = sy + ts * ly, rr = ts * r;
      const seg = 8;
      for (let i = 0; i <= seg; i++) {
        const a = -Math.PI * 0.15 + (i / seg) * (Math.PI * 1.7);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
    }
    pts.push([sx + ts * 0.44, sy + ts * 0.56], [sx + ts * 0.56, sy + ts * 0.56]);
    paper(ctx, pts, P.tcanopy, P.trim, 2, 2);
    groundShadow(sx + ts * 0.5, sy + ts * 0.9, ts, 0.28);
    if (n > 0.85) {
      ctx.fillStyle = P.tleaf;
      for (let i = 0; i < 3; i++) ctx.fillRect(sx + ts * (0.34 + i * 0.14), sy + ts * 0.26, 2, 2);
    }
  }

  function drawWaterBase(sx, sy, row, col) {
    const g = ctx.createLinearGradient(0, sy, 0, sy + ts);
    g.addColorStop(0, P.wmid); g.addColorStop(1, P.wdeep);
    ctx.fillStyle = g; ctx.fillRect(sx, sy, ts, ts);
    // interior-only depth darkening (no shore edge touches land)
    let shore = false;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
      if (inb(row + dr, col + dc) && kindAt(row + dr, col + dc) !== "water") shore = true;
    if (!shore) { ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = P.INK; ctx.fillRect(sx, sy, ts, ts); ctx.restore(); }
  }

  function drawRock(sx, sy, row, col) {
    const n = h2(row, col);
    const big = n > 0.5;
    const s = big ? 0.72 : 0.55;
    const cx = sx + ts * 0.5, cy = sy + ts * 0.55, r = ts * s * 0.5;
    // faceted pentagon, vertices wobbled by n
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      const wob = 0.85 + 0.3 * h3(row, col, i);
      pts.push([cx + Math.cos(a) * r * wob, cy + Math.sin(a) * r * wob]);
    }
    paper(ctx, pts, P.rbody, P.rrim, 2, 2);
    // upper-left lit facet
    ctx.fillStyle = P.rlit;
    ctx.beginPath();
    ctx.moveTo(pts[4][0], pts[4][1]);
    ctx.lineTo(pts[0][0], pts[0][1]);
    ctx.lineTo(cx, cy);
    ctx.closePath(); ctx.fill();
    groundShadow(cx, sy + ts * 0.9, ts * (big ? 0.9 : 0.7), 0.3);
  }

  function drawHouseWall(sx, sy, row, col) {
    // topmost wall row of the hut gets the roof; the wall diagonally opposite the
    // door gets the lit window.
    const topmost = kindAt(row - 1, col) !== "wall";
    ctx.fillStyle = P.hwall; ctx.fillRect(sx, sy, ts, ts);
    // vertical siding seams
    ctx.strokeStyle = P.hseam; ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx + ts * i / 4, sy); ctx.lineTo(sx + ts * i / 4, sy + ts); ctx.stroke(); }
    // foundation grime (bottom 8%)
    ctx.fillStyle = P.hseam; ctx.globalAlpha = 0.6; ctx.fillRect(sx, sy + ts * 0.92, ts, ts * 0.08); ctx.globalAlpha = 1;
    // keyline on outer edges
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
    if (topmost) {
      // roof band overhanging the top by .18ts, with rim and scalloped eave shadow
      const ry = sy - ts * 0.18;
      ctx.fillStyle = P.hroof; ctx.fillRect(sx - ts * 0.05, ry, ts * 1.1, ts * 0.44);
      ctx.strokeStyle = P.hroofrim; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx - ts * 0.05, ry + 1); ctx.lineTo(sx + ts * 1.05, ry + 1); ctx.stroke();
      ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.strokeRect(sx - ts * 0.05 + 1, ry + 1, ts * 1.1 - 2, ts * 0.44 - 2);
      ctx.fillStyle = P.tmid;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + ts * i / 3, sy + ts * 0.26);
        ctx.quadraticCurveTo(sx + ts * (i + 0.5) / 3, sy + ts * 0.38, sx + ts * (i + 1) / 3, sy + ts * 0.26);
        ctx.closePath(); ctx.fill();
      }
    }
    // window: wall tile diagonally opposite the door
    const doorCol = nearbyDoorCol(row, col);
    if (topmost && doorCol !== -1 && col !== doorCol) {
      const wx = sx + ts * 0.28, wy = sy + ts * 0.34, ws = ts * 0.42;
      ctx.fillStyle = P.GOLD; ctx.fillRect(wx, wy, ws, ws);
      ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.strokeRect(wx, wy, ws, ws);
      ctx.fillStyle = P.hseam;
      ctx.fillRect(wx + ws / 2 - 1, wy, 2, ws);
      ctx.fillRect(wx, wy + ws / 2 - 1, ws, 2);
      // warm light spill wedge on the ground below
      ctx.save(); ctx.globalAlpha = 0.06; ctx.fillStyle = P.GOLD;
      ctx.beginPath(); ctx.moveTo(wx, wy + ws); ctx.lineTo(wx + ws, wy + ws);
      ctx.lineTo(wx + ws * 1.4, sy + ts * 2); ctx.lineTo(wx - ws * 0.4, sy + ts * 2);
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }

  // Find the door column near a wall tile (same column band, up to 2 rows down).
  function nearbyDoorCol(row, col) {
    for (let dr = 1; dr <= 3; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (chAt(row + dr, col + dc) === "D") return col + dc;
    return -1;
  }

  function drawDoor(sx, sy, row, col) {
    ctx.fillStyle = P.hwall; ctx.fillRect(sx, sy, ts, ts);
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
    // arched door: rect + semicircle top
    const dw = ts * 0.56, dx = sx + ts * 0.22, dyTop = sy + ts * 0.18, dyBot = sy + ts;
    ctx.fillStyle = P.door;
    ctx.beginPath();
    ctx.moveTo(dx, dyBot);
    ctx.lineTo(dx, dyTop + dw / 2);
    ctx.arc(dx + dw / 2, dyTop + dw / 2, dw / 2, Math.PI, 0);
    ctx.lineTo(dx + dw, dyBot);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    // gold keydot at the latch side
    ctx.fillStyle = P.GOLD;
    ctx.beginPath(); ctx.arc(dx + dw * 0.8, dyTop + dw * 0.9, ts * 0.04, 0, TAU); ctx.fill();
    // light escapes the bottom seam
    ctx.strokeStyle = P.GOLD; ctx.globalAlpha = 0.35; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(dx, dyBot - 2); ctx.lineTo(dx + dw, dyBot - 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawSign(sx, sy, row, col) {
    // wooden signpost with a plank — paper-cut, INK keyline + gold nail dots
    drawOutdoorGround(sx, sy, row, col);
    const cx = sx + ts / 2;
    ctx.fillStyle = "#3a2c1c";
    ctx.fillRect(cx - ts * 0.05, sy + ts * 0.3, ts * 0.1, ts * 0.7);
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2;
    ctx.strokeRect(cx - ts * 0.05, sy + ts * 0.3, ts * 0.1, ts * 0.7);
    const pw = ts * 0.72, ph = ts * 0.3, px = cx - pw / 2, py = sy + ts * 0.22;
    ctx.fillStyle = "#6b4f2e";
    rrect(ctx, px, py, pw, ph, 3); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = P.RIM; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px + 2, py + 2); ctx.lineTo(px + pw - 2, py + 2); ctx.stroke();
    // carved "!" — readable at a glance
    ctx.fillStyle = P.GOLD;
    ctx.fillRect(cx - 1.5, py + ph * 0.18, 3, ph * 0.42);
    ctx.beginPath(); ctx.arc(cx, py + ph * 0.74, 2, 0, TAU); ctx.fill();
  }

  function drawTunnel(sx, sy, row, col) {
    // ridge tunnel: dark arch cut into the cave wall, crystal seam glints
    drawCaveWall(sx, sy, row, col);
    const cx = sx + ts / 2;
    const aw = ts * 0.6, at = sy + ts * 0.28, ab = sy + ts * 0.95;
    ctx.fillStyle = "#05070c";
    ctx.beginPath();
    ctx.moveTo(cx - aw / 2, ab);
    ctx.lineTo(cx - aw / 2, at + aw / 2);
    ctx.arc(cx, at + aw / 2, aw / 2, Math.PI, 0);
    ctx.lineTo(cx + aw / 2, ab);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.crystal; ctx.lineWidth = 2; ctx.stroke();
    // two glints on the arch
    ctx.fillStyle = P.crystalHi;
    ctx.beginPath(); ctx.arc(cx - aw * 0.22, at + aw * 0.32, 1.8, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + aw * 0.18, at + aw * 0.55, 1.4, 0, TAU); ctx.fill();
  }

  function drawCaveEntrance(sx, sy, row, col) {
    // rock face with a keyhole arch cut (pitch), teal crystal veins
    ctx.fillStyle = P.cface; ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = P.cwallrock;
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + ts);
    ctx.lineTo(sx + 2, sy + ts * 0.3);
    ctx.lineTo(sx + ts * 0.3, sy + 2);
    ctx.lineTo(sx + ts, sy + 2);
    ctx.lineTo(sx + ts, sy + ts);
    ctx.closePath(); ctx.fill();
    // keyhole arch opening
    const w = ts * 0.62, h = ts * 0.8, ax = sx + ts * 0.5, atop = sy + ts * 0.2;
    const g = ctx.createLinearGradient(0, atop, 0, sy + ts);
    g.addColorStop(0, P.cpitch); g.addColorStop(1, "#05060a");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ax - w / 2, sy + ts);
    ctx.lineTo(ax - w / 2, atop + w / 2);
    ctx.arc(ax, atop + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(ax + w / 2, sy + ts);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    // teal crystal veins on the arch rim
    ctx.strokeStyle = P.TEAL; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      ctx.beginPath();
      ctx.moveTo(ax - w / 2 + t * 3, atop + w / 2 - w / 2 * Math.sin(t * Math.PI));
      ctx.lineTo(ax - w * 0.9, sy + ts * (0.4 + t * 0.2));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    groundShadow(sx + ts * 0.5, sy + ts * 0.95, ts, 0.32);
  }

  function drawCaveMouthX(sx, sy, row, col) {
    // the exit arch: brightest thing in the cave — a dusk-jade wedge
    ctx.fillStyle = P.cwall; ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = P.cwallrock;
    ctx.beginPath();
    ctx.moveTo(sx + 2, sy + ts); ctx.lineTo(sx + 2, sy + ts * 0.26);
    ctx.lineTo(sx + ts * 0.28, sy + 2); ctx.lineTo(sx + ts - 2, sy + 2); ctx.lineTo(sx + ts - 2, sy + ts);
    ctx.closePath(); ctx.fill();
    const w = ts * 0.6, ax = sx + ts * 0.5, atop = sy + ts * 0.22;
    const g = ctx.createLinearGradient(0, atop, 0, sy + ts);
    g.addColorStop(0, "#2f5d4a"); g.addColorStop(1, P.cfloor0);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(ax - w / 2, sy + ts);
    ctx.lineTo(ax - w / 2, atop + w / 2);
    ctx.arc(ax, atop + w / 2, w / 2, Math.PI, 0);
    ctx.lineTo(ax + w / 2, sy + ts);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawCaveFloor(sx, sy, row, col) {
    const n = h2(row, col);
    ctx.fillStyle = n > 0.5 ? P.cfloor1 : P.cfloor0;
    ctx.fillRect(sx, sy, ts, ts);
    // crack veins
    ctx.strokeStyle = P.cvein; ctx.lineWidth = 1;
    ctx.beginPath();
    const c0 = h3(row, col, 1), c1 = h3(row, col, 2);
    ctx.moveTo(sx + ts * c0, sy);
    ctx.lineTo(sx + ts * (0.5 + (c1 - 0.5) * 0.6), sy + ts * 0.5);
    ctx.lineTo(sx + ts * c1, sy + ts);
    ctx.stroke();
    // rare crystal wedge
    if (n > 0.72) {
      ctx.fillStyle = P.crystal; ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx + ts * 0.7, sy + ts * 0.3); ctx.lineTo(sx + ts * 0.78, sy + ts * 0.5);
      ctx.lineTo(sx + ts * 0.64, sy + ts * 0.46); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawCaveWall(sx, sy, row, col) {
    const n = h2(row, col);
    ctx.fillStyle = P.cwall; ctx.fillRect(sx, sy, ts, ts);
    // rock silhouette
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i / 6) * TAU;
      const r = ts * (0.46 + 0.1 * h3(row, col, i));
      pts.push([sx + ts * 0.5 + Math.cos(a) * r, sy + ts * 0.52 + Math.sin(a) * r]);
    }
    paper(ctx, pts, P.cwallrock, P.cwallrim, 2, 2);
    if (n > 0.7) { ctx.fillStyle = P.crystal; ctx.beginPath(); ctx.arc(sx + ts * 0.3, sy + ts * 0.7, 2, 0, TAU); ctx.fill(); }
  }

  function drawCavePoolBase(sx, sy, row, col) {
    ctx.fillStyle = P.pool0; ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = P.pool1; ctx.globalAlpha = 0.6; ctx.fillRect(sx, sy + ts * 0.2, ts, ts * 0.15); ctx.globalAlpha = 1;
  }

  function drawCaveRock(sx, sy, row, col) {
    const cx = sx + ts * 0.5, cy = sy + ts * 0.55, r = ts * 0.26;
    const pts = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      const wob = 0.85 + 0.3 * h3(row, col, i);
      pts.push([cx + Math.cos(a) * r * wob, cy + Math.sin(a) * r * wob]);
    }
    paper(ctx, pts, P.crock, P.crockrim, 2, 2);
    groundShadow(cx, sy + ts * 0.9, ts * 0.7, 0.3);
  }

  function drawBossBase(sx, sy, row, col) {
    // the room goes quiet here: INK radial @40% under the tile
    ctx.fillStyle = P.cfloor0; ctx.fillRect(sx, sy, ts, ts);
    const g = ctx.createRadialGradient(sx + ts / 2, sy + ts / 2, 2, sx + ts / 2, sy + ts / 2, ts * 0.75);
    g.addColorStop(0, "rgba(13,15,23,0.55)"); g.addColorStop(1, "rgba(13,15,23,0)");
    ctx.fillStyle = g; ctx.fillRect(sx, sy, ts, ts);
  }

  function drawStaticTile(sx, sy, ch, row, col) {
    const def = TILES[ch] || TILES["#"];
    const kind = def.kind;
    if (isIndoor()) {
      switch (kind) {
        case "tree": return drawCaveWall(sx, sy, row, col);
        case "path": return drawCaveFloor(sx, sy, row, col);
        case "water": return drawCavePoolBase(sx, sy, row, col);
        case "rock": return drawCaveRock(sx, sy, row, col);
        case "cavemouth": return drawCaveMouthX(sx, sy, row, col);
        case "bosstile": return drawBossBase(sx, sy, row, col);
        case "tunnel": return drawTunnel(sx, sy, row, col);
        case "door": return drawDoor(sx, sy, row, col);   // hut exit — must stay visible indoors
        case "grass": return drawCaveFloor(sx, sy, row, col);
        default: return drawCaveFloor(sx, sy, row, col);
      }
    }
    switch (kind) {
      case "grass": return drawOutdoorGround(sx, sy, row, col);
      case "tallgrass": return drawOutdoorGround(sx, sy, row, col); // dynamic blades on top; base + contour here
      case "path": return drawPath(sx, sy, row, col);
      case "tree":
        if (kindAt(row, col - 1) === "tree" || kindAt(row, col + 1) === "tree" ||
            kindAt(row - 1, col) === "tree" || kindAt(row + 1, col) === "tree") return drawHedge(sx, sy, row, col);
        return drawLoneTree(sx, sy, row, col);
      case "water": return drawWaterBase(sx, sy, row, col);
      case "rock": return drawRock(sx, sy, row, col);
      case "wall": return drawHouseWall(sx, sy, row, col);
      case "door": return drawDoor(sx, sy, row, col);
      case "cave": return drawCaveEntrance(sx, sy, row, col);
      case "cavemouth": return drawCaveMouthX(sx, sy, row, col);
      case "bosstile": return drawBossBase(sx, sy, row, col);
      case "sign": return drawSign(sx, sy, row, col);
      default: return drawOutdoorGround(sx, sy, row, col);
    }
  }

  /* ---------------- per-tile DYNAMIC parts (every frame) ---------------- */

  function clumpEdges(sx, sy, row, col, zoneChar) {
    // dense keyline where an encounter clump meets short grass → physical clump
    for (const [dr, dc, side] of [[-1, 0, "top"], [1, 0, "bottom"], [0, -1, "left"], [0, 1, "right"]]) {
      if (!inb(row + dr, col + dc)) continue;
      if (kindAt(row + dr, col + dc) !== "grass") continue;
      ctx.strokeStyle = P.INK; ctx.lineWidth = 2;
      ctx.beginPath();
      if (side === "top") { ctx.moveTo(sx, sy + 1); ctx.lineTo(sx + ts, sy + 1); }
      else if (side === "bottom") { ctx.moveTo(sx, sy + ts - 1); ctx.lineTo(sx + ts, sy + ts - 1); }
      else if (side === "left") { ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 1, sy + ts); }
      else { ctx.moveTo(sx + ts - 1, sy); ctx.lineTo(sx + ts - 1, sy + ts); }
      ctx.stroke();
    }
  }

  function drawTallA(sx, sy, row, col, t) {
    const base = h2(row, col);
    const phase = tilePhase(row, col);
    const sway = reduced ? 0 : Math.sin(TAU * t / PULSE_MS + phase) * 0.052; // ±3°
    const nb = 4 + (base > 0.5 ? 1 : 0);
    for (let i = 0; i < nb; i++) {
      const f = (i + 0.5) / nb;
      const bx = sx + ts * (0.12 + 0.76 * f);
      const bh = ts * 0.68 * (0.82 + 0.34 * h3(row, col, i));
      const tipx = bx + sway * bh * 2.6;
      // thin upright blade (triangle), keylined
      const pts = [[bx - 1.6, sy + ts], [bx + 1.6, sy + ts], [tipx, sy + ts - bh]];
      ctx.fillStyle = P.Abel; poly(ctx, pts); ctx.fill();
      ctx.strokeStyle = P.INK; ctx.lineWidth = 1; poly(ctx, pts); ctx.stroke();
      // amber seed head — the zone's signature from a distance
      ctx.fillStyle = P.Aseed;
      ctx.beginPath(); ctx.ellipse(tipx, sy + ts - bh, 1.7, 3.2, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = P.INK; ctx.lineWidth = 1; ctx.stroke();
    }
    clumpEdges(sx, sy, row, col, ",");
  }

  function drawFrond(bx, by, ang, len, w, fill, tip) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy, ny = dx;
    const teeth = 5, pts = [];
    for (let i = 0; i <= teeth; i++) {
      const f = i / teeth;
      const px = bx + dx * len * f, py = by + dy * len * f;
      const hw = w * (1 - f * 0.75);
      const tooth = (i % 2 === 0) ? 1 : 0.55;      // serrated outer edge
      pts.push([px + nx * hw * tooth, py + ny * hw * tooth]);
    }
    for (let i = teeth; i >= 0; i--) {
      const f = i / teeth;
      const px = bx + dx * len * f, py = by + dy * len * f;
      const hw = w * (1 - f * 0.75);
      pts.push([px - nx * hw, py - ny * hw]);
    }
    ctx.fillStyle = fill; poly(ctx, pts); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 1; poly(ctx, pts); ctx.stroke();
    const tx = bx + dx * len, ty = by + dy * len;
    ctx.fillStyle = tip;
    ctx.beginPath(); ctx.ellipse(tx, ty, w * 0.34, w * 0.55, ang, 0, TAU); ctx.fill();
  }

  function drawTallB(sx, sy, row, col, t) {
    const base = h2(row, col);
    const phase = tilePhase(row, col) + Math.PI;   // zone B leans opposite zone A
    const sway = reduced ? 0 : Math.sin(TAU * t / PULSE_MS + phase) * 0.07; // ±4°
    const bx = sx + ts * 0.5, by = sy + ts;
    for (let i = 0; i < 3; i++) {
      const ang = -Math.PI / 2 + (i - 1) * 0.62 + sway;
      drawFrond(bx, by, ang, ts * 0.62, ts * 0.15, P.Bfrond, P.Btip);
    }
    if (base > 0.8) {   // rare dew glint
      ctx.fillStyle = P.Bdew;
      ctx.beginPath(); ctx.arc(sx + ts * 0.72, sy + ts * 0.28, 2, 0, TAU); ctx.fill();
    }
    clumpEdges(sx, sy, row, col, ";");
  }

  function drawWaterDyn(sx, sy, row, col, t) {
    const n = h2(row, col);
    const drift = reduced ? 0 : Math.sin(TAU * t / (PULSE_MS * 4) + n * TAU) * 6;
    ctx.strokeStyle = P.wshim; ctx.globalAlpha = 0.55; ctx.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const y = sy + ts * (0.34 + 0.3 * ((i + n) % 1));
      const x0 = sx + ts * 0.12 + drift;
      const len = ts * (0.34 + 0.2 * ((i * 0.37 + n) % 1));
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + len, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // shore foam on land-touching edges; pulses on the PULSE
    const foamA = reduced ? 0.45 : (0.3 + 0.3 * (0.5 + 0.5 * Math.sin(TAU * t / PULSE_MS + n * TAU)));
    for (const [dr, dc, side] of [[-1, 0, "top"], [1, 0, "bottom"], [0, -1, "left"], [0, 1, "right"]]) {
      if (!inb(row + dr, col + dc)) continue;
      if (kindAt(row + dr, col + dc) === "water") continue;
      ctx.globalAlpha = foamA; ctx.strokeStyle = P.wfoam; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
      ctx.beginPath();
      if (side === "top") { ctx.moveTo(sx, sy + 1); ctx.lineTo(sx + ts, sy + 1); }
      else if (side === "bottom") { ctx.moveTo(sx, sy + ts - 1); ctx.lineTo(sx + ts, sy + ts - 1); }
      else if (side === "left") { ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 1, sy + ts); }
      else { ctx.moveTo(sx + ts - 1, sy); ctx.lineTo(sx + ts - 1, sy + ts); }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  function drawCavePoolDyn(sx, sy, row, col, t) {
    const n = h2(row, col);
    const drift = reduced ? 0 : Math.sin(TAU * t / (PULSE_MS * 4) + n * TAU) * 5;
    ctx.strokeStyle = P.poolshim; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx + ts * 0.15 + drift, sy + ts * 0.4); ctx.lineTo(sx + ts * 0.7 + drift, sy + ts * 0.4); ctx.stroke();
    if (n > 0.6) { ctx.globalAlpha = 0.8; ctx.fillStyle = P.crystal; ctx.beginPath(); ctx.arc(sx + ts * 0.35, sy + ts * 0.62, 1.6, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  function drawBossRune(sx, sy, row, col, t) {
    const R = ts * 0.39, cx = sx + ts / 2, cy = sy + ts / 2;
    const ph = tilePhase(row, col);
    const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(TAU * t / PULSE_MS + ph));
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(15 * Math.PI / 180);
    // inner fill
    ctx.globalAlpha = 0.5; ctx.fillStyle = P.runein; hexPath(ctx, 0, 0, R * 0.62, 0); ctx.fill();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = P.CORAL; ctx.lineWidth = 3; ctx.lineJoin = "round";
    hexPath(ctx, 0, 0, R, 0); ctx.stroke();
    hexPath(ctx, 0, 0, R * 0.62, 0); ctx.stroke();
    for (let i = 0; i < 6; i++) {             // 6 spokes
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
    }
    // chevron ticks on the outer hexagon vertices
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU, px = Math.cos(a) * R, py = Math.sin(a) * R;
      ctx.beginPath();
      ctx.moveTo(px - Math.sin(a) * 3, py + Math.cos(a) * 3);
      ctx.lineTo(px + Math.cos(a) * 4, py + Math.sin(a) * 4);
      ctx.lineTo(px + Math.sin(a) * 3, py - Math.cos(a) * 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // gold core diamond
    ctx.fillStyle = P.GOLD; const d = R * 0.17;
    ctx.beginPath(); ctx.moveTo(0, -d); ctx.lineTo(d, 0); ctx.lineTo(0, d); ctx.lineTo(-d, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    // ≤3 ember particles drifting up (hash-staggered, ~2s lifetime)
    if (!reduced) {
      for (let i = 0; i < 3; i++) {
        const life = ((t / 2000) + h3(row, col, i)) % 1;
        const ex = cx + Math.sin((h3(row, col, i + 9) - 0.5) * 2) * R * 0.8;
        const ey = cy + R * 0.6 - life * ts * 0.9;
        const a = (1 - life) * 0.9;
        ctx.globalAlpha = a;
        ctx.fillStyle = life < 0.5 ? P.GOLD : P.CORAL;
        ctx.fillRect(ex, ey, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawDynamicTile(sx, sy, ch, row, col, t) {
    const kind = (TILES[ch] || {}).kind;
    if (isIndoor()) {
      if (kind === "water") return drawCavePoolDyn(sx, sy, row, col, t);
      if (kind === "bosstile") return drawBossRune(sx, sy, row, col, t);
      return;
    }
    if (kind === "tallgrass") return ch === ";" ? drawTallB(sx, sy, row, col, t) : drawTallA(sx, sy, row, col, t);
    if (kind === "water") return drawWaterDyn(sx, sy, row, col, t);
    if (kind === "bosstile") return drawBossRune(sx, sy, row, col, t);
  }

  /* ---------------- camera + visible window ---------------- */

  function visibleWindow() {
    const c0 = Math.max(0, Math.floor(camX / ts));
    const c1 = Math.min(nCols, Math.ceil((cssW + camX) / ts));
    const r0 = Math.max(0, Math.floor(camY / ts));
    const r1 = Math.min(nRows, Math.ceil((cssH + camY) / ts));
    return { c0, c1, r0, r1 };
  }
  function sxf(c) { return Math.round(c * ts - camX); }
  function syf(r) { return Math.round(r * ts - camY); }

  /* ---------------- static layer build ---------------- */

  function buildBase() {
    const w = canvas.width, h = canvas.height;
    if (!base) { base = document.createElement("canvas"); bctx = base.getContext("2d"); }
    if (base.width !== w || base.height !== h) { base.width = w; base.height = h; }
    // swap the drawing target to the offscreen layer for the whole static pass
    const restore = ctx; ctx = bctx;
    const c = bctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // authored NIGHT contour-grid surround — the diorama sits on a desk, not a void
    c.fillStyle = P.NIGHT; c.fillRect(0, 0, cssW, cssH);
    c.strokeStyle = P.grid; c.globalAlpha = 0.08; c.lineWidth = 1;
    const gx0 = Math.floor((camX) / 96) * 96 - camX;
    for (let x = gx0; x < cssW; x += 96) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, cssH); c.stroke(); }
    const gy0 = Math.floor((camY) / 96) * 96 - camY;
    for (let y = gy0; y < cssH; y += 96) { c.beginPath(); c.moveTo(0, y); c.lineTo(cssW, y); c.stroke(); }
    c.globalAlpha = 1;
    // tiles
    const { c0, c1, r0, r1 } = visibleWindow();
    for (let r = r0; r < r1; r++) {
      for (let cc = c0; cc < c1; cc++) {
        const ch = map.rows[r][cc];
        const sx = sxf(cc), sy = syf(r);
        if (ch === "," || ch === ";") {
          // clump base (gradient) lives here; blades are dynamic
          if (isIndoor()) { drawCaveFloor(sx, sy, r, cc); }
          else {
            const g = ctx.createLinearGradient(0, sy, 0, sy + ts);
            if (ch === ",") { g.addColorStop(0, P.A0); g.addColorStop(1, P.A1); } else { g.addColorStop(0, P.B0); g.addColorStop(1, P.B1); }
            ctx.fillStyle = g; ctx.fillRect(sx, sy, ts, ts);
          }
        } else {
          drawStaticTile(sx, sy, ch, r, cc);
        }
      }
    }
    // 1px INK border-hem sharpens the "cut paper" map edge
    c.strokeStyle = P.INK; c.lineWidth = 1;
    c.strokeRect(0.5 - camX, 0.5 - camY, worldW - 1, worldH - 1);
    ctx = restore;   // back to the visible canvas
  }

  /* ---------------- ambient overlays ---------------- */

  function drawAmbient(t) {
    const mapArea = { x: -camX, y: -camY, w: worldW, h: worldH };
    if (!isIndoor()) {
      // 2 drifting gold light pools (radial, never rotating)
      const drift = reduced ? 0 : (t / 40000) % 1;
      for (let i = 0; i < 2; i++) {
        const px = mapArea.x + worldW * (0.25 + 0.5 * i) + (drift * 48);
        const py = mapArea.y + worldH * (0.3 + 0.3 * i) + Math.sin(t / 9000 + i) * 10;
        const rad = ts * 4;
        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, "rgba(255,209,102,0.05)"); g.addColorStop(1, "rgba(255,209,102,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
      }
      // dusk filter: one cool ambient wash unifies every tile under one light
      ctx.save(); ctx.globalAlpha = 0.10; ctx.fillStyle = P.NAVY;
      ctx.fillRect(mapArea.x, mapArea.y, mapArea.w, mapArea.h); ctx.restore();
      // ≤6 fireflies (bezier wander, blink on off-beat)
      if (!reduced) {
        for (let i = 0; i < 6; i++) {
          const s1 = h3(i, 1, 7), s2 = h3(i, 2, 11);
          const bx = mapArea.x + worldW * (0.1 + 0.8 * s1);
          const by = mapArea.y + worldH * (0.1 + 0.8 * s2);
          const fx = bx + Math.sin(t / 3400 + i * 1.7) * 30;
          const fy = by + Math.cos(t / 4700 + i * 2.3) * 20;
          const blink = 0.3 + 0.7 * Math.max(0, Math.sin(t / 900 + i * 2.1));
          ctx.globalAlpha = blink; ctx.fillStyle = P.GOLD;
          ctx.beginPath(); ctx.arc(fx, fy, 1.6, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // outdoor vignette 12% at the far corners
      const vg = ctx.createRadialGradient(cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.35, cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.75);
      vg.addColorStop(0, "rgba(11,13,20,0)"); vg.addColorStop(1, "rgba(11,13,20,0.12)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, cssW, cssH);
    } else {
      // ≤8 cave motes + ceiling drip-glints
      if (!reduced) {
        for (let i = 0; i < 8; i++) {
          const s1 = h3(i, 3, 5), s2 = h3(i, 4, 9);
          const bx = mapArea.x + worldW * (0.08 + 0.84 * s1);
          const by = mapArea.y + worldH * (0.08 + 0.84 * s2);
          const mx = bx + Math.sin(t / 5200 + i) * 24;
          const my = by + Math.cos(t / 6100 + i * 1.3) * 16;
          ctx.globalAlpha = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(t / 1400 + i));
          ctx.fillStyle = P.crystalHi;
          ctx.beginPath(); ctx.arc(mx, my, 1.5, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
        // drip glint every ~3s at a hash-fixed spot
        const drip = (t % 3000) / 3000;
        if (drip < 0.25) {
          const dx = mapArea.x + worldW * (0.2 + 0.6 * h3(3, 3, 3));
          const dy = mapArea.y + worldH * (0.2 + 0.6 * h3(4, 4, 4));
          ctx.globalAlpha = 0.3 * (1 - drip / 0.25); ctx.fillStyle = P.crystalHi;
          ctx.beginPath(); ctx.arc(dx, dy, 2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        }
      }
      // 35% vignette + lamp circle centered on RIFF (local light source)
      const st = lastState;
      const ax = st ? (st.col * ts + ts / 2 - camX) : cssW / 2;
      const ay = st ? (st.row * ts + ts / 2 - camY) : cssH / 2;
      const lamp = ts * 3.5;
      const vg = ctx.createRadialGradient(ax, ay, lamp, ax, ay, Math.max(cssW, cssH) * 0.8);
      vg.addColorStop(0, "rgba(11,13,20,0)"); vg.addColorStop(1, "rgba(11,13,20,0.35)");
      ctx.fillStyle = vg; ctx.fillRect(0, 0, cssW, cssH);
    }
  }

  /* ---------------- avatar RIFF ---------------- */

  function drawRiff(cx, cy, face, t) {
    const s = ts;
    const bob = reduced ? 0 : Math.sin(TAU * t / PULSE_MS) * 2;
    const walkHop = walkOffset();
    const feetY = cy + s * 0.38;
    const y = feetY - s * 0.9 + bob + walkHop;   // head-space top reference
    const bcx = cx;
    const scarfSway = reduced ? 0 : Math.sin(TAU * t / PULSE_MS - 0.8) * 2.5;

    // ground shadow (always on the ground, never bobs)
    groundShadow(bcx, feetY + 2, s, 0.32);

    // legs (2-pose step is folded into walkHop via a light stagger)
    ctx.fillStyle = P.shoe;
    const legW = s * 0.11, legH = s * 0.16;
    const ly = y + s * 0.72;
    const off = walkHop !== 0 ? (walkHop > 0 ? 2 : -2) : 0;
    ctx.fillRect(bcx - s * 0.14, ly - off, legW, legH + off);
    ctx.fillRect(bcx + s * 0.03, ly + off, legW, legH - off);

    // torso (jacket) with gold zipper hairline
    const bodyTop = y + s * 0.42, bodyH = s * 0.34, bodyW = s * 0.36;
    const bodyX = bcx - bodyW / 2;
    ctx.fillStyle = P.jacket;
    rrect(ctx, bodyX, bodyTop, bodyW, bodyH, 3); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = P.zipper; ctx.lineWidth = 1.5;      // gold zipper
    ctx.beginPath(); ctx.moveTo(bcx, bodyTop + 2); ctx.lineTo(bcx, bodyTop + bodyH - 2); ctx.stroke();
    // shoulder rim light
    ctx.strokeStyle = P.RIM; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bodyX + 1, bodyTop + 1); ctx.lineTo(bodyX + bodyW - 1, bodyTop + 1); ctx.stroke();

    // head
    const headR = s * 0.14, headY = y + s * 0.3;
    ctx.fillStyle = P.skin;
    ctx.beginPath(); ctx.arc(bcx, headY, headR, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();

    // cap (coral — RIFF's character accent, the only coral on screen outdoors)
    ctx.fillStyle = P.CORAL;
    ctx.beginPath(); ctx.arc(bcx, headY - s * 0.02, headR + s * 0.02, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    // cap rim (light)
    ctx.strokeStyle = P.RIM; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(bcx, headY - s * 0.02, headR + s * 0.02, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();

    // ---- facing-specific detail ----
    if (face === "up") {
      // cap panel seam
      ctx.strokeStyle = P.INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(bcx, headY - s * 0.02 - headR - s * 0.02); ctx.lineTo(bcx, headY - s * 0.02); ctx.stroke();
      // scarf tails over the shoulder, sway horizontally
      drawScarf(bcx, headY + headR * 0.6, s, "up", scarfSway);
    } else if (face === "left" || face === "right") {
      const dir = face === "right" ? 1 : -1;
      // cap brim points the way
      ctx.fillStyle = P.CORAL;
      ctx.beginPath(); ctx.moveTo(bcx, headY - s * 0.03);
      ctx.lineTo(bcx + dir * (headR + s * 0.1), headY - s * 0.05);
      ctx.lineTo(bcx, headY + s * 0.02); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
      // single eye
      ctx.fillStyle = "#20242e";
      ctx.beginPath(); ctx.arc(bcx + dir * s * 0.05, headY + s * 0.01, s * 0.02, 0, TAU); ctx.fill();
      // one scarf tail streaming out the back
      drawScarf(bcx - dir * s * 0.02, headY + headR * 0.7, s, face, scarfSway - dir * 2);
    } else {
      // down: two dot eyes + scarf knot centered at the throat
      ctx.fillStyle = "#20242e";
      ctx.beginPath(); ctx.arc(bcx - s * 0.055, headY + s * 0.0, s * 0.022, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(bcx + s * 0.055, headY + s * 0.0, s * 0.022, 0, TAU); ctx.fill();
      drawScarf(bcx, headY + headR * 0.7, s, "down", scarfSway);
    }
  }

  function drawScarf(bcx, cy, s, face, sway) {
    // the signature: a TEAL scarf, the brightest element on screen in every zone
    ctx.fillStyle = P.TEAL;
    // band around the neck
    ctx.beginPath();
    ctx.ellipse(bcx, cy, s * 0.14, s * 0.05, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 1.5; ctx.stroke();
    if (face === "up") {
      // two tails over the shoulder
      tail(bcx - s * 0.08 + sway, cy + s * 0.02, -0.5, s * 0.22);
      tail(bcx + s * 0.08 + sway, cy + s * 0.02, 0.5, s * 0.22);
    } else if (face === "left" || face === "right") {
      tail(bcx + sway, cy + s * 0.02, face === "right" ? 1.7 : 0.45, s * 0.26);
    } else {
      // down: knot + short centered tail
      tail(bcx + sway * 0.4, cy + s * 0.03, Math.PI / 2, s * 0.16);
    }
  }
  function tail(x, y, ang, len) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const nx = -dy, ny = dx, w = 2.2;
    const pts = [
      [x + nx * w, y + ny * w],
      [x + dx * len + nx * w * 0.5, y + dy * len + ny * w * 0.5],
      [x + dx * len, y + dy * len],
      [x + dx * len - nx * w * 0.5, y + dy * len - ny * w * 0.5],
      [x - nx * w, y - ny * w],
    ];
    ctx.fillStyle = P.TEAL; poly(ctx, pts); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 1.5; poly(ctx, pts); ctx.stroke();
  }

  /* ---------------- NPC figures ---------------- */

  function drawNpc(cx, cy, npc, alert, t) {
    const s = ts;
    const bob = reduced ? 0 : Math.sin(TAU * t / PULSE_MS + 1.3) * 1.5;
    const feetY = cy + s * 0.38;
    const y = feetY - s * 0.9 + bob;
    groundShadow(cx, feetY + 2, s, 0.3);
    // cloak (their color accent)
    const bodyTop = y + s * 0.42, bodyH = s * 0.34, bodyW = s * 0.34;
    ctx.fillStyle = npc.color || "#8a93a6";
    rrect(ctx, cx - bodyW / 2, bodyTop, bodyW, bodyH, 4); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = P.RIM; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - bodyW / 2 + 1, bodyTop + 1); ctx.lineTo(cx + bodyW / 2 - 1, bodyTop + 1); ctx.stroke();
    // gold belt
    ctx.strokeStyle = P.GOLD; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - bodyW / 2 + 2, bodyTop + bodyH * 0.62); ctx.lineTo(cx + bodyW / 2 - 2, bodyTop + bodyH * 0.62); ctx.stroke();
    // head
    const headR = s * 0.13, headY = y + s * 0.3;
    ctx.fillStyle = P.skin;
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, TAU); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    // hood (cloak color, coral never used here)
    ctx.fillStyle = npc.color || "#8a93a6";
    ctx.beginPath(); ctx.arc(cx, headY - s * 0.02, headR + s * 0.02, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    // two dot eyes, facing the viewer
    ctx.fillStyle = "#20242e";
    ctx.beginPath(); ctx.arc(cx - s * 0.05, headY + s * 0.01, s * 0.022, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s * 0.05, headY + s * 0.01, s * 0.022, 0, TAU); ctx.fill();
    if (alert) {
      // "!" bubble over undefeated trainers
      const by = headY - headR - s * 0.34 + (reduced ? 0 : Math.sin(TAU * t / PULSE_MS) * 2);
      ctx.fillStyle = P.GOLD;
      ctx.beginPath(); ctx.arc(cx, by, s * 0.13, 0, TAU); ctx.fill();
      ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = P.INK;
      ctx.font = "700 " + Math.round(s * 0.18) + "px Inter, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("!", cx, by + 1);
    }
  }

  // Renderer-side walk hop: detect a tile change between renders and animate a
  // short crisp hop so RIFF literally walks on his own rhythm. No domain changes.
  let prevPos = null, moveStart = 0;
  function walkOffset() {
    if (reduced) return 0;
    const st = lastState;
    if (!st) return 0;
    const now = performance.now();
    if (!prevPos || prevPos.mapId !== st.mapId || prevPos.row !== st.row || prevPos.col !== st.col) {
      if (prevPos) moveStart = now;
      prevPos = { mapId: st.mapId, row: st.row, col: st.col };
    }
    const dt = now - moveStart;
    if (dt < 0 || dt > 220) return 0;
    const p = dt / 220;
    return -Math.sin(p * Math.PI) * 4;   // 4px hop, overshoot ease
  }

  /* ---------------- reticle + zone plate ---------------- */

  function drawReticle(state, t) {
    const d = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[state.face] || [0, 1];
    const fx = (state.col + d[1]) * ts - camX, fy = (state.row + d[0]) * ts - camY;
    const a = reduced ? 0.7 : (0.5 + 0.4 * (0.5 + 0.5 * Math.sin(TAU * t / PULSE_MS)));
    ctx.globalAlpha = a; ctx.strokeStyle = P.GOLD; ctx.lineWidth = 2;
    const b = 8, m = 3, x = fx + m, y = fy + m, w = ts - 2 * m, h = ts - 2 * m;
    // 4 L-shaped corner brackets
    ctx.beginPath();
    ctx.moveTo(x, y + b); ctx.lineTo(x, y); ctx.lineTo(x + b, y);
    ctx.moveTo(x + w - b, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + b);
    ctx.moveTo(x + w, y + h - b); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - b, y + h);
    ctx.moveTo(x + b, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - b);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawZonePlate() {
    if (cssW < 900) return;   // keep clear of controls on narrow windows
    const name = (map && map.name ? map.name : "EMBER MEADOW").toUpperCase();
    const w = Math.max(168, name.length * 8.2 + 28), h = 26, x = 14, y = 14;
    ctx.save();
    ctx.beginPath();          // angular plate, clipped top-right corner
    ctx.moveTo(x, y); ctx.lineTo(x + w - 10, y); ctx.lineTo(x + w, y + 10);
    ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
    ctx.fillStyle = P.NAVY; ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = P.GOLD; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = P.GOLD; ctx.font = "700 12px Inter, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(name, x + 12, y + h / 2 + 1);
    ctx.restore();
  }

  /* ---------------- per-frame composition ---------------- */

  function drawFrame(now) {
    if (!base || !map || !lastState) return;
    const t = reduced ? 0 : now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.drawImage(base, 0, 0, cssW, cssH);
    const { c0, c1, r0, r1 } = visibleWindow();
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) {
        const ch = map.rows[r][c];
        drawDynamicTile(sxf(c), syf(r), ch, r, c, t);
      }
    }
    drawAmbient(t);
    const st = lastState;
    // NPC figures on this map, drawn under RIFF
    for (const npc of NPCS) {
      if (npc.mapId !== st.mapId) continue;
      if (npc.col < c0 || npc.col >= c1 || npc.row < r0 || npc.row >= r1) continue;
      const alert = isTrainer(npc) && lastFlags && !lastFlags[trainerFlag(npc.id)];
      drawNpc(npc.col * ts + ts / 2 - camX, npc.row * ts + ts / 2 - camY, npc, alert, t);
    }
    drawRiff(st.col * ts + ts / 2 - camX, st.row * ts + ts / 2 - camY, st.face, t);
    drawReticle(st, t);
    drawZonePlate();
  }

  function tick(now) {
    requestAnimationFrame(tick);
    if (canvas.offsetParent === null || !base || !lastState) return;   // hidden → idle
    if (now - lastAmbient < 40) return;                                  // cap ambient to ~25fps
    lastAmbient = now;
    drawFrame(now);
  }
  if (!loopStarted) { loopStarted = true; requestAnimationFrame(tick); }

  function render(state, flags) {
    fit();
    map = MAPS[state.mapId];
    if (!map) return;
    lastState = state;
    lastFlags = flags || {};
    ts = TILE_SIZE;
    nRows = map.rows.length; nCols = map.rows[0].length;
    worldW = nCols * ts; worldH = nRows * ts;
    const pcx = state.col * ts + ts / 2, pcy = state.row * ts + ts / 2;
    let cx = pcx - cssW / 2, cy = pcy - cssH / 2;
    // Visible tile window. Screen X of tile col c is (c*ts - camX); camX/camY are
    // NEGATIVE whenever the map is smaller than the viewport (map centred), so the
    // start index is derived from camX, not -camX — otherwise the leading edge tiles
    // were dropped (192px of blank void at a 1552px viewport). Do not regress this.
    camX = worldW <= cssW ? (worldW - cssW) / 2 : Math.max(0, Math.min(worldW - cssW, cx));
    camY = worldH <= cssH ? (worldH - cssH) / 2 : Math.max(0, Math.min(worldH - cssH, cy));
    buildBase();
    drawFrame(performance.now());
  }

  return { render, fit };
}
