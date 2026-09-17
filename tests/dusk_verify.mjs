// Typemon — DUSKPAPER overworld verification driver (real headless Chrome over CDP).
// Boots the world, then samples the LIVE canvas backing store to prove the art
// direction actually rendered: authored NIGHT surround (not black void), coherent
// map edge, distinct grass zones A/B, cave≠outdoor, RIFF visible, movement +
// grass encounter + battle-return intact, zero JS errors.
//
// usage: node tests/dusk_verify.mjs [width] [height] [dpr]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9241;
const BASE = "http://127.0.0.1:8770/demo/";
const W = parseInt(process.argv[2] || "1280", 10);
const H = parseInt(process.argv[3] || "800", 10);
const DPR = parseFloat(process.argv[4] || "1");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page && page.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(300);
  }
  throw new Error("CDP endpoint not ready");
}
function makeRpc(ws) {
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    }
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
}

// In-page pixel sampler. Replicates the renderer camera math (ts=48) and reads the
// raw backing store at CSS*dpr coordinates. Samples window.__probe tile (independent
// of the avatar so RIFF's coral cap can't contaminate a terrain reading), and counts
// coral pixels in a small box around the avatar for the RIFF visibility check.
const SAMPLER = String.raw`(() => {
  const c = document.getElementById('worldCanvas');
  if (!c) return JSON.stringify({ err: 'no canvas' });
  const g = c.getContext('2d');
  const dpr = window.devicePixelRatio;
  const st = window.__world.state();
  const ts = 48;
  const rows = st.mapId === 'cave_a' ? 11 : 18;
  const cols = st.mapId === 'cave_a' ? 16 : 24;
  const worldW = cols*ts, worldH = rows*ts;
  const cssW = c.clientWidth, cssH = c.clientHeight;
  const pcx = st.col*ts + ts/2, pcy = st.row*ts + ts/2;
  let camX = pcx - cssW/2, camY = pcy - cssH/2;
  camX = worldW <= cssW ? (worldW-cssW)/2 : Math.max(0, Math.min(worldW-cssW, camX));
  camY = worldH <= cssH ? (worldH-cssH)/2 : Math.max(0, Math.min(worldH-cssH, camY));
  const px = (cx, cy) => {
    const x = Math.floor(cx*dpr), y = Math.floor(cy*dpr);
    if (x<0||y<0||x>=c.width||y>=c.height) return null;
    const d = g.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]];
  };
  const tr = window.__probe || { row: st.row, col: st.col };
  const tx = tr.col*ts - camX, ty = tr.row*ts - camY;
  const tpx = (fy) => px(tx + ts*0.5, ty + fy);
  // coral count in a 3x3-tile box around the avatar (RIFF's cap)
  const ax = Math.round(pcx - camX), ay = Math.round(pcy - camY);
  let coral = 0;
  const bx0 = Math.max(0, ax-72), by0 = Math.max(0, ay-96);
  const bw = Math.min(c.width, ax+72) - bx0, bh = Math.min(c.height, ay+96) - by0;
  if (bw > 0 && bh > 0) {
    const im = g.getImageData(bx0, by0, bw, bh).data;
    for (let i=0;i<im.length;i+=4)
      if (Math.abs(im[i]-233)<=10 && Math.abs(im[i+1]-69)<=12 && Math.abs(im[i+2]-96)<=14) coral++;
  }
  return JSON.stringify({
    mapId: st.mapId, row: st.row, col: st.col, face: st.face,
    probe: tr, cssW, cssH, dpr, worldW, worldH,
    camX, camY, mapLeft: -camX, mapTop: -camY,
    tileTop: tpx(6), tileMid: tpx(ts*0.5), tileBot: tpx(ts-8),
    outside_left: px(-camX - 12, cssH/2),
    inside_left:  px(-camX + 10, cssH/2),
    beyond_top:   px(cssW/2, -camY - 12),
    cornerTL:     px(3, 3),
    cornerBR:     px(cssW-4, cssH-4),
    coralAvatar: coral,
  });
})()`;

const place = (mapId, row, col, face) =>
  `window.__world.place(${JSON.stringify(mapId)}, ${row}, ${col}, ${JSON.stringify(face)});`;
const probe = (row, col) => `window.__probe = { row: ${row}, col: ${col} };`;

async function main() {
  const userData = mkdtempSync(join(tmpdir(), "tm-dusk-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--mute-audio", "--autoplay-policy=no-user-gesture-required",
    "--force-device-scale-factor=" + DPR,
    `--window-size=${W},${H}`, `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`, "about:blank",
  ], { stdio: "ignore" });

  const errors = [];
  const result = { viewport: { W, H, DPR } };
  try {
    const ws = new WebSocket(await getWsUrl());
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const send = makeRpc(ws);
    await send("Page.enable"); await send("Runtime.enable");
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "exception");
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + (m.params.args||[]).map(a=>a.value??a.description??"").join(" "));
    });
    const evalJs = async (expr, timeout = 30000) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, timeout });
      if (r.exceptionDetails) throw new Error("EVAL_EXC: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result?.value;
    };

    await send("Page.navigate", { url: BASE + "?autostart=1" });
    await sleep(1600);
    await evalJs("try{localStorage.clear();}catch(e){} 'c'");
    await evalJs("document.getElementById('startBtn').click(); 'x'");
    await sleep(600);
    await evalJs("document.dispatchEvent(new KeyboardEvent('keydown',{key:'1'})); 'x'");
    await sleep(700);

    // ---- 1. surround + edge coherence + avatar, on outdoor ----
    await evalJs(place("route_a", 5, 4, "right"));
    await evalJs(probe(11, 8));                        // plain grass, away from avatar
    await sleep(300);
    result.outdoor_spawn = JSON.parse(await evalJs(SAMPLER));
    const shot1 = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync("OUTPUTS/dusk-overworld-" + W + "x" + H + ".png", Buffer.from(shot1.data, "base64"));

    // ---- 2. grass A vs grass B vs plain (probe tiles independent of avatar) ----
    await evalJs(place("route_a", 5, 4, "right")); await evalJs(probe(3, 12)); await sleep(200);
    result.grassA = JSON.parse(await evalJs(SAMPLER));
    await evalJs(place("route_a", 11, 8, "right")); await evalJs(probe(13, 6)); await sleep(200);
    result.grassB = JSON.parse(await evalJs(SAMPLER));
    await evalJs(place("route_a", 5, 4, "right")); await evalJs(probe(11, 8)); await sleep(200);
    result.grassPlain = JSON.parse(await evalJs(SAMPLER));

    // ---- 3. cave zone ----
    await evalJs(place("cave_a", 9, 3, "up")); await evalJs(probe(5, 5)); await sleep(300);
    result.cave = JSON.parse(await evalJs(SAMPLER));
    const shot2 = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync("OUTPUTS/dusk-cave-" + W + "x" + H + ".png", Buffer.from(shot2.data, "base64"));

    // ---- 4. movement still works ----
    result.movement = JSON.parse(await evalJs(`(() => {
      window.__world.place('route_a', 5, 3, 'right');
      const before = window.__world.state();
      window.__world.step('right');
      const after = window.__world.state();
      return JSON.stringify({ before, after });
    })()`));

    // ---- 5. grass encounter -> full battle -> return to SAME position ----
    result.encounter = JSON.parse(await evalJs(`(async () => {
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
      const press=(k)=>{document.dispatchEvent(new KeyboardEvent('keydown',{key:k}));document.dispatchEvent(new KeyboardEvent('keyup',{key:k}));};
      const Q=(s)=>document.querySelector(s);
      const battleOn=()=>Q('#battleRoot').classList.contains('on');
      const worldOn=()=>Q('#worldRoot').classList.contains('on');
      const resolveOn=()=>Q('#resolve').classList.contains('on');
      window.__world.place('route_a', 4, 12, 'up');
      const start = window.__world.state();
      for (let i=0;i<6 && !battleOn(); i++){ press('ArrowUp'); await sleep(160); }
      const enteredBattle = battleOn();
      const battlePos = window.__world.state();
      let guard=0, rounds=0;
      while (guard++ < 600){
        if (resolveOn()){ Q('#againBtn').click(); await sleep(300); continue; }
        if (worldOn() && !battleOn() && guard > 3) break;
        if (battleOn()){
          if (Q('#menuBar').classList.contains('on')){ press('1'); rounds++; await sleep(220); }
          else {
            const chip=Q('#keyFeed .feedKey.current');
            if (chip && chip.dataset.key!=null){ press(chip.dataset.key); }
            await sleep(140);
          }
        } else await sleep(120);
      }
      return JSON.stringify({ start, enteredBattle, battlePos, rounds, after: window.__world.state() });
    })()`, 120000));

    // ---- 5b. grass zone silhouettes / tips / anti-phase pulse ----
    await evalJs(String.raw`window.__grassProbe = (row, col) => {
      const c = document.getElementById('worldCanvas'), g = c.getContext('2d');
      const dpr = window.devicePixelRatio, ts = 48;
      const st = window.__world.state();
      const rows = st.mapId==='cave_a'?11:18, cols = st.mapId==='cave_a'?16:24;
      const worldW=cols*ts, worldH=rows*ts, cssW=c.clientWidth, cssH=c.clientHeight;
      const pcx=st.col*ts+ts/2, pcy=st.row*ts+ts/2;
      let camX=pcx-cssW/2, camY=pcy-cssH/2;
      camX=worldW<=cssW?(worldW-cssW)/2:Math.max(0,Math.min(worldW-cssW,camX));
      camY=worldH<=cssH?(worldH-cssH)/2:Math.max(0,Math.min(worldH-cssH,camY));
      const sx=Math.round(col*ts-camX), sy=Math.round(row*ts-camY);
      const im=g.getImageData(Math.floor(sx*dpr), Math.floor(sy*dpr), Math.floor(ts*dpr), Math.floor(ts*dpr));
      const P=im.data, W=im.width, Hh=im.height;
      const at=(x,y)=>{const i=(y*W+x)*4; return [P[i],P[i+1],P[i+2]];};
      const base=at(Math.floor(W*0.5), Math.floor(3*dpr));
      let covered=0,total=0,sumx=0,nx=0,amber=0,teal=0,topReach=ts;
      for(let y=Math.floor(0.30*Hh); y<Hh; y++){
        for(let x=1;x<W-1;x++){
          const q=at(x,y); total++;
          const d=Math.abs(q[0]-base[0])+Math.abs(q[1]-base[1])+Math.abs(q[2]-base[2]);
          if(d>45){ covered++; if(y<topReach*dpr) topReach=y/dpr; if(y>0.5*Hh){sumx+=x;nx++;} }
          if(q[0]>140 && q[1]>100 && q[1]<185 && q[0]-40>q[2]) amber++;
          if(q[1]>110 && q[2]>100 && q[1]>q[0]+30 && q[2]>q[0]+20) teal++;
        }
      }
      return JSON.stringify({ base, coverage: covered/total, topReach, centroidX: nx? sumx/nx : null, amber, teal });
    }; 'ok'`);
    await evalJs(place("route_a", 9, 8, "down"));
    await evalJs(probe(3, 12));
    await sleep(200);
    result.grassProbe = JSON.parse(await evalJs(`(async () => {
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
      const A=[],B=[];
      for(let i=0;i<6;i++){ A.push(JSON.parse(window.__grassProbe(3,12))); B.push(JSON.parse(window.__grassProbe(13,6))); await sleep(170); }
      return JSON.stringify({A,B});
    })()`, 30000));

    // ---- 7. prefers-reduced-motion path (emulated), still renders + zero errors ----
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await send("Page.navigate", { url: BASE + "?autostart=1" });
    await sleep(1500);
    await evalJs("try{localStorage.clear();}catch(e){} 'c'");
    await evalJs("document.getElementById('startBtn').click(); 'x'");
    await sleep(600);
    await evalJs("document.dispatchEvent(new KeyboardEvent('keydown',{key:'1'})); 'x'");
    await sleep(700);
    await evalJs(place("route_a", 5, 4, "right"));
    await evalJs(probe(11, 8));
    await sleep(300);
    result.reducedMotion = JSON.parse(await evalJs(SAMPLER));
    result.reducedMotion.flag = await evalJs("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    result.errors = errors;

    // ---- assertions (from real pixels / state) ----
    const isNight = (c) => c && c[2] > c[0] + 8 && c[2] > 20 && (c[0] + c[1] + c[2]) < 200;
    const diff = (a, b) => a && b ? Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) + Math.abs(a[2]-b[2]) : -1;
    const S = result;
    const beyondOk = S.outdoor_spawn.mapTop <= 0 ? true : isNight(S.outdoor_spawn.beyond_top);
    const assert = {
      night_surround_not_black: (isNight(S.outdoor_spawn.outside_left) && isNight(S.outdoor_spawn.cornerTL) && isNight(S.outdoor_spawn.cornerBR)) ? "PASS" : "FAIL " + JSON.stringify([S.outdoor_spawn.outside_left, S.outdoor_spawn.cornerTL, S.outdoor_spawn.cornerBR]),
      no_top_void: beyondOk ? "PASS (mapTop=" + S.outdoor_spawn.mapTop + ")" : "FAIL beyond_top=" + JSON.stringify(S.outdoor_spawn.beyond_top),
      map_edge_coherent: diff(S.outdoor_spawn.outside_left, S.outdoor_spawn.inside_left) > 30 ? "PASS" : "FAIL (inside≈outside; map missing at left edge) " + JSON.stringify([S.outdoor_spawn.outside_left, S.outdoor_spawn.inside_left]),
      avatar_visible_outdoor: S.outdoor_spawn.coralAvatar > 5 ? "PASS (" + S.outdoor_spawn.coralAvatar + "px coral)" : "FAIL",
      avatar_visible_cave: S.cave.coralAvatar > 5 ? "PASS (" + S.cave.coralAvatar + "px coral)" : "FAIL",
      grassA_warm: (S.grassA.tileTop && S.grassA.tileTop[1] > S.grassA.tileTop[2]) ? "PASS A=" + JSON.stringify(S.grassA.tileTop) : "FAIL " + JSON.stringify(S.grassA.tileTop),
      grassB_cool: (S.grassB.tileTop && S.grassB.tileTop[2] >= S.grassB.tileTop[0] && S.grassB.tileTop[1] > S.grassB.tileTop[0]) ? "PASS B=" + JSON.stringify(S.grassB.tileTop) : "FAIL " + JSON.stringify(S.grassB.tileTop),
      grassA_vs_B_distinct: diff(S.grassA.tileTop, S.grassB.tileTop) > 25 ? "PASS (Δ=" + diff(S.grassA.tileTop, S.grassB.tileTop) + ")" : "FAIL " + JSON.stringify([S.grassA.tileTop, S.grassB.tileTop]),
      grass_zones_vs_plain: (diff(S.grassA.tileTop, S.grassPlain.tileTop) > 20 && diff(S.grassB.tileTop, S.grassPlain.tileTop) > 20) ? "PASS" : "FAIL " + JSON.stringify([S.grassA.tileTop, S.grassPlain.tileTop, S.grassB.tileTop]),
      cave_differs_from_outdoor: (diff(S.cave.tileTop, S.grassPlain.tileTop) > 40 && S.cave.tileTop[2] >= S.cave.tileTop[1]) ? "PASS cave=" + JSON.stringify(S.cave.tileTop) + " outdoor=" + JSON.stringify(S.grassPlain.tileTop) : "FAIL " + JSON.stringify([S.cave.tileTop, S.grassPlain.tileTop]),
      movement_works: (S.movement.after && S.movement.before && S.movement.after.col === S.movement.before.col + 1) ? "PASS" : "FAIL " + JSON.stringify(S.movement),
      grass_encounter_works: S.encounter && S.encounter.enteredBattle ? "PASS" : "FAIL " + JSON.stringify(S.encounter),
      battle_return_same_position: (S.encounter.after && S.encounter.battlePos && S.encounter.after.mapId === S.encounter.battlePos.mapId && S.encounter.after.row === S.encounter.battlePos.row && S.encounter.after.col === S.encounter.battlePos.col) ? "PASS (" + S.encounter.after.mapId + " R" + S.encounter.after.row + "C" + S.encounter.after.col + ")" : "FAIL after=" + JSON.stringify(S.encounter.after) + " expected=" + JSON.stringify(S.encounter.battlePos),
      zero_js_errors: errors.length === 0 ? "PASS" : "FAIL " + JSON.stringify(errors),
      reduced_motion_renders: (S.reducedMotion && S.reducedMotion.flag && S.reducedMotion.coralAvatar > 5 && S.reducedMotion.tileTop && S.reducedMotion.tileTop[1] > S.reducedMotion.tileTop[0]) ? "PASS (static, avatar " + S.reducedMotion.coralAvatar + "px, grass " + JSON.stringify(S.reducedMotion.tileTop) + ")" : "FAIL " + JSON.stringify(S.reducedMotion && { flag: S.reducedMotion.flag, coral: S.reducedMotion.coralAvatar, tile: S.reducedMotion.tileTop }),
      grassA_amber_seed_tips: (S.grassProbe.A[0].amber > 0) ? "PASS (" + S.grassProbe.A[0].amber + " amber px)" : "FAIL " + JSON.stringify(S.grassProbe.A[0]),
      grassB_teal_frond_tips: (S.grassProbe.B[0].teal > 0) ? "PASS (" + S.grassProbe.B[0].teal + " teal px)" : "FAIL " + JSON.stringify(S.grassProbe.B[0]),
      grass_silhouette_differs: (Math.abs(S.grassProbe.A[0].coverage - S.grassProbe.B[0].coverage) > 0.02 || Math.abs(S.grassProbe.A[0].topReach - S.grassProbe.B[0].topReach) > 2) ? "PASS (A cov=" + S.grassProbe.A[0].coverage.toFixed(3) + " top=" + S.grassProbe.A[0].topReach.toFixed(0) + " | B cov=" + S.grassProbe.B[0].coverage.toFixed(3) + " top=" + S.grassProbe.B[0].topReach.toFixed(0) + ")" : "FAIL",
      grass_opposite_pulse: (() => {
        const csA = S.grassProbe.A.map((x) => x.centroidX), csB = S.grassProbe.B.map((x) => x.centroidX);
        const mA = csA.reduce((a, b) => a + b, 0) / csA.length, mB = csB.reduce((a, b) => a + b, 0) / csB.length;
        let cov = 0, devA = 0, devB = 0;
        for (let i = 0; i < csA.length; i++) { cov += (csA[i] - mA) * (csB[i] - mB); devA += Math.abs(csA[i] - mA); devB += Math.abs(csB[i] - mB); }
        return (cov < 0 && devA > 0.1 && devB > 0.1) ? "PASS (anti-phase cov=" + cov.toFixed(2) + ")" : "FAIL cov=" + cov.toFixed(2) + " dev=" + devA.toFixed(2) + "/" + devB.toFixed(2);
      })(),
    };
    result.assert = assert;
    writeFileSync("OUTPUTS/dusk-verify-" + W + "x" + H + ".json", JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ viewport: result.viewport, assert }, null, 2));
    ws.close();
  } catch (e) {
    console.error("DRIVER_ERROR: " + e.message + "\n" + (e.stack || ""));
    process.exitCode = 1;
  } finally {
    chrome.kill("SIGKILL");
  }
}
main();
