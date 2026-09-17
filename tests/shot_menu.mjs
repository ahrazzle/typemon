// Drive: menu-open state then pause briefly for screenshot.
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const fire = (k) => document.dispatchEvent(new KeyboardEvent("keydown", { key: k }));
  for (let i = 0; i < 60 && !document.getElementById("worldRoot").classList.contains("on"); i++) await sleep(100);
  fire("ArrowRight"); await sleep(150); fire("Enter"); // into battle menu
  await sleep(600);
  return { phase: "menu-open", menuOn: document.getElementById("menuBar").className.includes("on") };
})();
