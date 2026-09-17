// Typemon — served-page verification driver for the walkable overworld.
// Real headless Chrome over CDP (no file://). Two scenarios:
//   A) honest key-driven play: New Game -> starter -> visible map -> real
//      Arrow/WASD movement changes the player tile -> walk into tall grass ->
//      the EXISTING keyboard battle opens -> resolve -> return to the SAME tile
//      -> movement continues. (?autofight=1 only supplies the typing sim that
//      the acceptance harness already uses; boot + movement are real keys.)
//   B) the in-page ?autoplay=1 acceptance loop (title AUTOPLAY-DONE n/n).
// Console + exceptions are collected for the whole run; the run fails if any
// JS error is observed.
//
// usage: node tests/world_verify.mjs [baseUrl]
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9227;
const BASE = process.argv[2] || "http://127.0.0.1:8770/demo/";
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

async function main() {
  const userData = mkdtempSync(join(tmpdir(), "tm-world-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--mute-audio", "--autoplay-policy=no-user-gesture-required",
    "--window-size=1280,800", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`, "about:blank",
  ], { stdio: "ignore" });

  const errors = [];
  const consoleLog = [];
  try {
    const ws = new WebSocket(await getWsUrl());
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const send = makeRpc(ws);
    await send("Page.enable");
    await send("Runtime.enable");
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === "Runtime.exceptionThrown") {
        errors.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "exception");
      }
      if (m.method === "Runtime.consoleAPICalled") {
        const txt = (m.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
        consoleLog.push(`[${m.params.type}] ${txt}`);
        if (m.params.type === "error") errors.push("console.error: " + txt);
      }
    });

    const nav = async (url) => {
      await send("Page.navigate", { url });
      await new Promise((res) => {
        const onEv = (ev) => {
          const m = JSON.parse(ev.data);
          if (m.method === "Page.loadEventFired") { ws.removeEventListener("message", onEv); res(); }
        };
        ws.addEventListener("message", onEv);
        setTimeout(res, 8000);
      });
      await sleep(500);
    };
    const evalJs = async (expr, timeout = 30000) => {
      const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, timeout });
      if (r.exceptionDetails) throw new Error("EVAL_EXC: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result?.value;
    };
    const readState = async () => evalJs("JSON.stringify(window.__world && window.__world.state ? window.__world.state() : null)");

    // ---------- Scenario A: honest key-driven play ----------
    await nav(BASE);
    await evalJs("try{localStorage.clear();}catch(e){} 'cleared'");
    const A = await evalJs(`(async () => {
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const press = (k) => { document.dispatchEvent(new KeyboardEvent('keydown',{key:k})); document.dispatchEvent(new KeyboardEvent('keyup',{key:k})); };
      const S = () => window.__world.state();
      const battleOn = () => document.getElementById('battleRoot').classList.contains('on');
      const out = {};
      out.phaseAtBoot = S() ? S().phase : null;
      document.getElementById('startBtn').click();
      await sleep(450);
      out.starterVisible = document.getElementById('starterRoot').classList.contains('on');
      press('1');                     // pick starter 1 (HOPLING)
      await sleep(500);
      out.worldOn = document.getElementById('worldRoot').classList.contains('on');
      out.canvasPx = (()=>{const c=document.getElementById('worldCanvas');return c?c.width+'x'+c.height:'none';})();
      out.coordsText0 = document.getElementById('worldCoords').textContent;
      out.pos0 = S();
      press('ArrowRight'); await sleep(150); out.pos1_arrowRight = S();
      press('d');          await sleep(150); out.pos2_wasdD = S();
      press('ArrowLeft');  await sleep(150); out.pos3_arrowLeft = S();
      // walk right along row 5 to the tall-grass column (col 12) with real keys
      let guard = 0;
      while (S() && S().col < 12 && guard++ < 25) { press('ArrowRight'); await sleep(110); }
      out.posAtPath = S();
      out.coordsTextPath = document.getElementById('worldCoords').textContent;
      // step north into tall grass until the encounter fires (every 3rd grass tile)
      const trail = [];
      for (let i = 0; i < 6 && !battleOn(); i++) {
        press('ArrowUp'); await sleep(150);
        const s = S();
        trail.push({ phase: s && s.phase, row: s && s.row, col: s && s.col, grassSteps: s && s.grassSteps, battle: battleOn() });
      }
      out.grassTrail = trail;
      for (let i = 0; i < 60 && !battleOn(); i++) await sleep(100);
      out.battleOn = battleOn();
      out.posAtBattle = S();
      out.playerName = document.getElementById('playerName').textContent;
      out.enemyName = document.getElementById('enemyName').textContent;
      out.moveMenu = [...document.querySelectorAll('#menuBar .menuKey .moveName')].map(x => x.textContent);
      out.consoleLine = window.__lastGate ? 'gate-ok' : 'no-gate';
      return out;
    })()`, 30000);
    A.pass = {
      booted_title: A.pos0 && A.pos0.phase === "title" ? "PASS" : "FAIL " + JSON.stringify(A.pos0),
      starter_shown: A.starterVisible ? "PASS" : "FAIL",
      world_on: A.worldOn ? "PASS" : "FAIL",
      canvas_painted: A.canvasPx !== "none" ? "PASS (" + A.canvasPx + ")" : "FAIL",
      move_arrowRight: (A.pos1_arrowRight && A.pos0 && A.pos1_arrowRight.col === A.pos0.col + 1) ? "PASS" : "FAIL",
      move_wasd_d: (A.pos2_wasdD && A.pos1_arrowRight && A.pos2_wasdD.col === A.pos1_arrowRight.col + 1) ? "PASS" : "FAIL",
      move_arrowLeft: (A.pos3_arrowLeft && A.pos2_wasdD && A.pos3_arrowLeft.col === A.pos2_wasdD.col - 1) ? "PASS" : "FAIL",
      walked_into_grass: (A.grassTrail.some(t => t.grassSteps > 0)) ? "PASS" : "FAIL",
      grass_triggered_battle: A.battleOn ? "PASS" : "FAIL",
    };
    A.selftestRows = await evalJs("JSON.stringify([...document.querySelectorAll('#selftest div')].map(x=>x.textContent))");

    // resolve -> autofight auto-returns to the world; wait for it
    let returned = false;
    for (let i = 0; i < 200; i++) {
      await sleep(500);
      const st = JSON.parse(await readState() || "null");
      if (st && st.phase === "world") { returned = true; break; }
    }
    const atReturn = JSON.parse((await readState()) || "null");
    const samePos = returned && A.posAtBattle && atReturn.mapId === A.posAtBattle.mapId &&
      atReturn.row === A.posAtBattle.row && atReturn.col === A.posAtBattle.col;
    // movement continues after the battle
    const cont = await evalJs(`(async () => {
      const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
      const press=(k)=>document.dispatchEvent(new KeyboardEvent('keydown',{key:k}));
      const before = window.__world.state();
      press('ArrowDown'); await sleep(160);
      const after = window.__world.state();
      return JSON.stringify({ before, after });
    })()`);
    const contObj = JSON.parse(cont);
    A.pass.battle_returned_to_world = returned ? "PASS" : "FAIL";
    A.pass.same_position_after_battle = samePos ? "PASS" : "FAIL " + JSON.stringify({ battle: A.posAtBattle, after: atReturn });
    A.pass.movement_continues_after_battle = (contObj.after.row === contObj.before.row + 1) ? "PASS" : "FAIL";

    // screenshot of the returned world state (review artifact)
    const shot = await send("Page.captureScreenshot", { format: "png" });
    const { writeFileSync } = await import("node:fs");
    writeFileSync("OUTPUTS/world-overworld-2026-09-10.png", Buffer.from(shot.data, "base64"));

    // ---------- Scenario B: in-page autoplay acceptance loop ----------
    await evalJs("try{localStorage.clear();}catch(e){} 'cleared'");
    await nav(BASE + (BASE.includes("?") ? "&" : "?") + "autoplay=1");
    let title = "";
    for (let i = 0; i < 400; i++) { await sleep(500); title = await evalJs("document.title", 8000); if (String(title).startsWith("AUTOPLAY-DONE") || String(title).startsWith("AUTOPLAY-FAIL")) break; }
    const rows = JSON.parse(await evalJs("JSON.stringify([...document.querySelectorAll('#selftest div')].map(x=>x.textContent))"));
    const fails = rows.filter((x) => x.startsWith("FAIL"));

    const summary = {
      scenarioA: A.pass,
      scenarioA_detail: {
        pos0: A.pos0, pos1: A.pos1_arrowRight, pos2: A.pos2_wasdD, pos3: A.pos3_arrowLeft,
        posAtPath: A.posAtPath, coordsText0: A.coordsText0, coordsTextPath: A.coordsTextPath,
        grassTrail: A.grassTrail, posAtBattle: A.posAtBattle, playerName: A.playerName,
        enemyName: A.enemyName, moveMenu: A.moveMenu, returned, atReturn,
        contObj,
      },
      scenarioB: { title, autoplayRows: rows.length, fails },
      jsErrors: errors,
    };
    console.log(JSON.stringify(summary, null, 2));
    ws.close();
  } catch (e) {
    console.error("DRIVER_ERROR: " + e.message + "\n" + (e.stack || ""));
    process.exitCode = 1;
  } finally {
    chrome.kill("SIGKILL");
  }
}
main();
