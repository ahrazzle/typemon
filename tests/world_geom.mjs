// Typemon — world renderer geometry probe (real Chrome over CDP).
// Boots into the world and reports the LIVE canvas/camera geometry that drives
// the "map on the right / avatar in the void" report. Also derives painted map
// bounds and avatar pixel position straight from the canvas backing store, so
// we compare what the renderer ACTUALLY painted against the viewport.
//
// usage: node tests/world_geom.mjs [width] [height] [dpr] [outPrefix]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9231;
const BASE = "http://127.0.0.1:8770/demo/";
const W = parseInt(process.argv[2] || "1280", 10);
const H = parseInt(process.argv[3] || "800", 10);
const DPR = parseFloat(process.argv[4] || "1");
const OUT = process.argv[5] || "OUTPUTS/world_geom";
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
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
}

// In-page: read canvas geometry + paint-derived bounds from the backing store.
const PROBE = `(() => {
  const c = document.getElementById('worldCanvas');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio;
  const img = ctx.getImageData(0, 0, c.width, c.height).data;
  const VOID = [0x0b,0x0e,0x1a];
  const isVoid = (r,g,b) => Math.abs(r-VOID[0])<=8 && Math.abs(g-VOID[1])<=8 && Math.abs(b-VOID[2])<=8;
  let minx=1e9,miny=1e9,maxx=-1,maxy=-1;
  // avatar marker colors: cap #e94560 (233,69,96), skin #f0c79a (240,199,154)
  let ax=[], ay=[];
  for (let y=0; y<c.height; y++){
    for (let x=0; x<c.width; x++){
      const i=(y*c.width+x)*4, r=img[i],g=img[i+1],b=img[i+2];
      if (!isVoid(r,g,b)){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; if(y>maxy)maxy=y; }
      if (Math.abs(r-233)<=12 && Math.abs(g-69)<=14 && Math.abs(b-96)<=16){ ax.push(x); ay.push(y); }
    }
  }
  const avg = a => a.length ? a.reduce((s,v)=>s+v,0)/a.length : null;
  // replicate the renderer camera math (ts=48, route_a 24x18) to expose the cull bounds
  const ts=48, rows=18, cols=24, worldW=cols*ts, worldH=rows*ts;
  const st = window.__world.state();
  const pcx = st.col*ts + ts/2, pcy = st.row*ts + ts/2;
  const cssW = c.clientWidth, cssH = c.clientHeight;
  let camX = pcx - cssW/2, camY = pcy - cssH/2;
  camX = worldW <= cssW ? (worldW - cssW)/2 : Math.max(0, Math.min(worldW - cssW, camX));
  camY = worldH <= cssH ? (worldH - cssH)/2 : Math.max(0, Math.min(worldH - cssH, camY));
  const c0 = Math.floor(-camX/ts), c1 = Math.ceil((cssW - camX)/ts);
  const r0 = Math.floor(-camY/ts), r1 = Math.ceil((cssH - camY)/ts);
  const cam = {
    worldW, worldH, pcx, pcy, cssW, cssH,
    camX, camY,
    cull_c0: c0, cull_c1: c1, cull_r0: r0, cull_r1: r1,
    drawn_cols: [Math.max(0,c0), Math.min(cols,c1)-1],
    drawn_rows: [Math.max(0,r0), Math.min(rows,r1)-1],
    expected_map_left: -camX, expected_map_top: -camY,
  };
  return JSON.stringify({
    innerW: window.innerWidth, innerH: window.innerHeight, dpr, cam,
    canvasClientW: c.clientWidth, canvasClientH: c.clientHeight,
    canvasW: c.width, canvasH: c.height,
    rect: (()=>{const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})(),
    paint: {minx:minx<=1e8?minx:null, miny:miny<=1e8?miny:null, maxx:maxx>=0?maxx:null, maxy:maxy>=0?maxy:null},
    avatarCap: ax.length ? {x: avg(ax), y: avg(ay), n: ax.length, minx: Math.min(...ax), maxx: Math.max(...ax), miny: Math.min(...ay), maxy: Math.max(...ay)} : null,
    mapId: window.__world.state() ? window.__world.state().mapId : null,
    row: window.__world.state() ? window.__world.state().row : null,
    col: window.__world.state() ? window.__world.state().col : null,
    face: window.__world.state() ? window.__world.state().face : null,
  });
})()`;

async function main() {
  const userData = mkdtempSync(join(tmpdir(), "tm-geom-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--mute-audio", "--autoplay-policy=no-user-gesture-required",
    "--force-device-scale-factor=" + DPR,
    `--window-size=${W},${H}`, `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`, "about:blank",
  ], { stdio: "ignore" });

  const errors = [];
  try {
    const ws = new WebSocket(await getWsUrl());
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const send = makeRpc(ws);
    await send("Page.enable");
    await send("Runtime.enable");
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description || "exception");
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console.error: " + (m.params.args||[]).map(a=>a.value??a.description??"").join(" "));
    });
    const evalJs = async (expr, timeout = 30000) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, timeout });
      if (r.exceptionDetails) throw new Error("EVAL_EXC: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result?.value;
    };
    await send("Page.navigate", { url: BASE });
    await sleep(1500);
    await evalJs("try{localStorage.clear();}catch(e){} 'c'");
    await evalJs("document.getElementById('startBtn').click(); 'x'");
    await sleep(700);
    await evalJs("document.dispatchEvent(new KeyboardEvent('keydown',{key:'1'})); 'x'");
    await sleep(900);
    const probe = JSON.parse(await evalJs(PROBE));
    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(OUT + `.png`, Buffer.from(shot.data, "base64"));
    console.log(JSON.stringify({ viewport: { W, H, DPR }, probe, errors, shot: OUT + ".png" }, null, 2));
    ws.close();
  } catch (e) {
    console.error("DRIVER_ERROR: " + e.message + "\n" + (e.stack || ""));
    process.exitCode = 1;
  } finally {
    chrome.kill("SIGKILL");
  }
}
main();
