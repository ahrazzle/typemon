// Drive: menu -> choose move 1 -> hold mid-word for screenshot.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  for (let i = 0; i < 60 && !document.getElementById("worldRoot").classList.contains("on"); i++) await sleep(100);
  fire("ArrowRight"); await sleep(150); fire("Enter"); // into battle menu
  await sleep(600);
  fire("1"); // choose move -> battle session begins
  const t0 = Date.now();
  let midWord = false;
  while (Date.now() - t0 < 2500) {
    await sleep(200);
    if ((window.__lastGate || "").includes("keyFeed.bottom")) { midWord = true; break; }
  }
  await sleep(600); // hold so note is visibly mid-window
  const kbd = document.querySelector("#typejoyWrap svg");
  const krect = kbd ? kbd.getBoundingClientRect() : null;
  return { phase: "mid-word", midWord,
    svg: krect ? { top: Math.round(krect.top), w: Math.round(krect.width), h: Math.round(krect.height) } : null,
    gate: (window.__lastGate || "").slice(0, 120) };
})();
