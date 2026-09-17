// Capture the gate console lines mid-autoplay (they're logged by the page each ~2s/rAF).
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let title = "";
  for (let i = 0; i < 300; i++) { await sleep(200); title = document.title; if (title.startsWith("AUTOPLAY")) break; }
  // keep reading a bit more then summarize
  for (let i = 0; i < 30; i++) await sleep(100);
  return { title, done: /DONE/.test(title) };
})();
