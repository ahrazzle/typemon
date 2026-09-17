// Wait for autoplay to reach terminal title, return the final status + gate-fail count.
(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let title = "";
  let failLines = 0;
  for (let i = 0; i < 400; i++) {
    await sleep(250);
    title = document.title;
    if (title.startsWith("AUTOPLAY-DONE") || title.startsWith("AUTOPLAY-FAIL")) break;
  }
  const rows = [...document.querySelectorAll("#selftest div")].map(x => x.textContent);
  failLines = rows.filter(x => x.startsWith("FAIL")).length;
  // last gate line health
  const gateFails = (rows.filter(x => /RG1 layout gate green/.test(x) && x.startsWith("FAIL")).length);
  return { title, totalRows: rows.length, failLines, gateFailRow: rows.find(x => /RG1/.test(x)) || null };
})();
