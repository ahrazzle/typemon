// Probe: drive autostart boot -> world -> battle menu -> choose move -> mid-word.
// Uses REAL input paths (document keydown, same as a user). Returns geometry + gate snapshots.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  const rect = (n) => {
    if (!n) return null; const r = n.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
             top: Math.round(r.top), bottom: Math.round(innerHeight - r.bottom),
             disp: getComputedStyle(n).display };
  };
  const gate = () => window.__lastGate || "";
  const gates = [];

  // autostart param handled at boot; just wait for world
  for (let i = 0; i < 60 && !document.getElementById("worldRoot").classList.contains("on"); i++) await sleep(100);
  gates.push("world:" + gate().slice(0, 40));
  fire("ArrowRight"); // start -> grass node so worldSearch finds an encounter
  await sleep(150);
  fire("Enter"); // worldSearch -> beginBattle -> openMenu (menu on, no session yet)
  await sleep(700);
  const menuOn1 = document.getElementById("menuBar").className.includes("on");
  const hudA = rect(document.getElementById("hud"));
  const menuA = rect(document.getElementById("menuBar"));
  // MENU vs HUD overlap check at menu-open state
  let menuHudOverlap = null;
  if (menuA && hudA) {
    const ox = Math.max(0, Math.min(menuA.x + menuA.w, hudA.x + hudA.w) - Math.max(menuA.x, hudA.x));
    const oy = Math.max(0, Math.min(menuA.top + menuA.h, hudA.top + hudA.h) - Math.max(menuA.top, hudA.top));
    menuHudOverlap = { ox, oy, overlap: ox > 0 && oy > 0 };
  }
  gates.push("menu:" + gate().slice(0, 60));
  gates.push("menuGate:" + gate());

  // choose move 1 -> creates session, battle begins, word approaches
  fire("1");
  const t0 = Date.now();
  let inWordGate = "";
  while (Date.now() - t0 < 3000) {
    await sleep(250);
    const g = gate();
    if (g.includes("keyFeed.bottom") && g.includes("ekStrip.stamp")) { inWordGate = g; }
    gates.push(g.slice(0, 90));
  }

  const wrap = document.getElementById("typejoyWrap");
  const svg = document.querySelector("#typejoyWrap svg");
  const kbDiv = document.querySelector("#typejoyWrap [style*='bottom']");
  const ekStrip = document.getElementById("ekStrip");
  const keyFeed = document.getElementById("keyFeed");
  const hudB = rect(document.getElementById("hud"));
  const feedKeys = document.querySelectorAll("#keyFeed .feedKey");
  const feedRect = rect(keyFeed);
  const firstKey = feedKeys[0] ? feedKeys[0].getBoundingClientRect() : null;
  const midWord = inWordGate;
  const svgVB = svg ? svg.getAttribute("viewBox") : null;
  const svgRectPx = svg ? (() => { const r = svg.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }; })() : null;

  return {
    stage: "battle+menu-snapshot",
    viewport: innerWidth + "x" + innerHeight,
    menuOn1, menuA, hudA, menuHudOverlap,
    midWord, feedRect,
    keyFeedChildCount: feedKeys.length,
    firstKey: firstKey ? { x: Math.round(firstKey.x), w: Math.round(firstKey.width), h: Math.round(firstKey.height) } : null,
    wrap: rect(wrap),
    svgRectPx, svgVB,
    keyboardDivBottomAnchor: kbDiv ? (() => { const r = kbDiv.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), bottomFromViewBottom: Math.round(innerHeight - r.bottom) }; })() : null,
    ekStrip: rect(ekStrip),
    hudB,
    lastGate: gate(),
    uniqueGates: [...new Set(gates)].slice(-6),
    menuKeyTexts: [...document.querySelectorAll("#menuBar .menuKey .moveName")].map(x => x.textContent),
    menuWidth: rect(document.getElementById("menuBar")),
  };
})();
