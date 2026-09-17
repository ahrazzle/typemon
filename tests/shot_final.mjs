// menu-open screenshot drive
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  for (let i = 0; i < 60 && !document.getElementById("worldRoot").classList.contains("on"); i++) await sleep(100);
  fire("ArrowRight"); await sleep(150); fire("Enter"); await sleep(700);
  const mr = document.getElementById("menuBar").getBoundingClientRect();
  const hr = document.getElementById("hud").getBoundingClientRect();
  const oy = Math.max(0, Math.min(mr.bottom, hr.bottom) - Math.max(mr.top, hr.top));
  return { menuOn: true, menuY: Math.round(mr.top), hudY: Math.round(hr.top), oyOverlap: Math.round(oy) };
})();
