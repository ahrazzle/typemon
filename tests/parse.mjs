import { readFileSync } from "node:fs";
const s = readFileSync(process.argv[2], "utf8");
const j = JSON.parse(s);
console.log(JSON.stringify({
  viewport: j.eval.viewport,
  menuA: j.eval.menuA, hudA: j.eval.hudA, menuHudOverlap: j.eval.menuHudOverlap,
  feedRect: j.eval.feedRect, chips: j.eval.keyFeedChildCount,
  wrap: j.eval.wrap, svg: j.eval.svgRectPx, svgVB: j.eval.svgVB,
  kbdBand: j.eval.keyboardDivBottomAnchor,
  midWord: j.eval.midWord, lastGate: j.eval.lastGate,
}, null, 1));
