// mid-word screenshot: menu -> choose move 1 -> wait for a note in flight
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  for (let i = 0; i < 60 && !document.getElementById("worldRoot").classList.contains("on"); i++) await sleep(100);
  fire("ArrowRight"); await sleep(150); fire("Enter"); await sleep(600);
  fire("1");
  const t0 = Date.now();
  while (Date.now() - t0 < 2600) { await sleep(200); if ((window.__lastGate || "").includes("feedCur")) break; }
  await sleep(500);
  const kb = document.querySelector("#typejoyWrap svg");
  const feed = document.getElementById("keyFeed");
  const hud = document.getElementById("hud");
  const cur = (window.__lastGate || "").match(/feedCur@(\d+)="([^"]+)" vs judge="([^"]+)"/);
  return { cur: cur ? { idx: cur[1], shown: cur[2], judge: cur[3] } : null,
    gate: (window.__lastGate || "").slice(0, 200),
    kbh: kb ? Math.round(kb.getBoundingClientRect().height) : null,
    kbtop: kb ? Math.round(kb.getBoundingClientRect().top) : null,
    feedBottom: feed ? Math.round(innerHeight - feed.getBoundingClientRect().bottom) : null,
    hudBottom: hud ? Math.round(innerHeight - hud.getBoundingClientRect().bottom) : null };
})();
