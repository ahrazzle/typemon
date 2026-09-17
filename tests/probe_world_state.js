(async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const TS = 48, rows = 18, cols = 24;
  function geom(tag) {
    const cvs = document.getElementById('worldCanvas');
    const st = window.__world && window.__world.state ? window.__world.state() : null;
    if (!cvs || !st) return { tag, err: 'no canvas/state', phase: window.W ? W.phase : null };
    const cssW = cvs.clientWidth, cssH = cvs.clientHeight;
    const worldW = cols * TS, worldH = rows * TS;
    const pcx = st.col * TS + TS / 2, pcy = st.row * TS + TS / 2;
    let camX = pcx - cssW / 2, camY = pcy - cssH / 2;
    camX = worldW <= cssW ? (worldW - cssW) / 2 : Math.max(0, Math.min(worldW - cssW, camX));
    camY = worldH <= cssH ? (worldH - cssH) / 2 : Math.max(0, Math.min(worldH - cssH, camY));
    const c0raw = Math.floor(-camX / TS), r0raw = Math.floor(-camY / TS);
    const c0 = Math.max(0, c0raw), c1 = Math.min(cols, Math.ceil((cssW - camX) / TS));
    const r0 = Math.max(0, r0raw), r1 = Math.min(rows, Math.ceil((cssH - camY) / TS));
    return {
      tag, innerW: innerWidth, innerH: innerHeight, dpr: devicePixelRatio,
      cssW, cssH, worldW, worldH, camX, camY,
      c0raw, r0raw, drawnCols: [c0, c1], drawnRows: [r0, r1],
      missingLeftCols: Math.max(0, c0raw), missingTopRows: Math.max(0, r0raw),
      missingLeftPx: Math.max(0, c0raw) * TS,
      mapDrawnFromX: c0 * TS - camX,
      avatarScreenX: pcx - camX, avatarScreenY: pcy - camY,
      state: st,
    };
  }
  const res = [];
  res.push(geom('boot'));
  const sb = document.getElementById('startBtn'); if (sb) sb.click();
  await sleep(1200);
  res.push(geom('after-start'));
  const cards = document.querySelectorAll('.starterCard');
  if (cards.length) cards[1].click();
  await sleep(1500);
  res.push(geom('world'));
  // move right a few steps to mimic user
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowRight']) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    await sleep(300);
  }
  res.push(geom('after-move'));
  return JSON.stringify(res);
})()
