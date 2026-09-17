(() => {
  const cvs = document.getElementById('worldCanvas');
  if (!cvs) return JSON.stringify({ err: 'no worldCanvas', phase: window.W ? W.phase : null });
  const r = cvs.getBoundingClientRect();
  const st = window.__world && window.__world.state ? window.__world.state() : null;
  // reproduce renderer camera math
  const TS = 48;
  const out = { innerW: innerWidth, innerH: innerHeight, dpr: devicePixelRatio,
                rect: { x: r.x, y: r.y, w: r.width, h: r.height },
                client: { w: cvs.clientWidth, h: cvs.clientHeight },
                backing: { w: cvs.width, h: cvs.height }, state: st };
  if (st && st.mapId) {
    const rows = 18, cols = 24;
    const worldW = cols * TS, worldH = rows * TS;
    const cssW = cvs.clientWidth, cssH = cvs.clientHeight;
    const pcx = st.col * TS + TS / 2, pcy = st.row * TS + TS / 2;
    let camX = pcx - cssW / 2, camY = pcy - cssH / 2;
    camX = worldW <= cssW ? (worldW - cssW) / 2 : Math.max(0, Math.min(worldW - cssW, camX));
    camY = worldH <= cssH ? (worldH - cssH) / 2 : Math.max(0, Math.min(worldH - cssH, camY));
    const c0 = Math.floor(-camX / TS), c1 = Math.ceil((cssW - camX) / TS);
    const r0 = Math.floor(-camY / TS), r1 = Math.ceil((cssH - camY) / TS);
    out.cam = { camX, camY, worldW, worldH, cssW, cssH };
    out.loop = { c0raw: c0, c1raw: c1, r0raw: r0, r1raw: r1,
                 cStart: Math.max(0, c0), cEnd: Math.min(cols, c1),
                 rStart: Math.max(0, r0), rEnd: Math.min(rows, r1) };
    out.missingCols = Math.max(0, c0);
    out.missingRows = Math.max(0, r0);
    out.mapDrawnFromX = Math.max(0, c0) * TS - camX;
  }
  return JSON.stringify(out);
})()
