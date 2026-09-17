// Typemon — CDP driver for served-page verification (headless Chrome).
// Node 22 native WebSocket; no external deps. Usage:
//   node tests/cdp.mjs <served-url> <path-to-eval-js-file>
// The JS file is read and Runtime.evaluate'd on the loaded page. Prints JSON:
//   { console:[], errors:[], eval:<value> }
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9225;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getWsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
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
  const url = process.argv[2];
  const jsPath = process.argv[3];
  if (!url || !jsPath) { console.error("usage: node tests/cdp.mjs <url> <eval-js-file>"); process.exit(2); }
  const code = readFileSync(jsPath, "utf8");

  const userData = mkdtempSync(join(tmpdir(), "tm-cdp-"));
  const chrome = spawn(CHROME, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--mute-audio", "--autoplay-policy=no-user-gesture-required",
    "--window-size=1280,800", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userData}`, "about:blank",
  ], { stdio: "ignore" });

  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.addEventListener("open", res); ws.addEventListener("error", rej); });
    const send = makeRpc(ws);
    const jsErrors = [];
    const consoleLog = [];
    await send("Page.enable");
    await send("Runtime.enable");
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Runtime.exceptionThrown") {
        jsErrors.push(msg.params.exceptionDetails?.exception?.description ||
                      msg.params.exceptionDetails?.text || "exception");
      }
      if (msg.method === "Runtime.consoleAPICalled") {
        const txt = (msg.params.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
        consoleLog.push(`[${msg.params.type}] ${txt}`);
      }
    });
    await send("Page.navigate", { url });
    await new Promise((res) => {
      const onEv = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.method === "Page.loadEventFired") { ws.removeEventListener("message", onEv); res(); }
      };
      ws.addEventListener("message", onEv);
    });
    await sleep(400);
    // optional pre-eval wait so probes can drive into a state before screenshot
    if (process.env.PREWAIT) await sleep(parseInt(process.env.PREWAIT, 10));
    const evalResult = await send("Runtime.evaluate", {
      expression: code, awaitPromise: true, returnByValue: true, timeout: 25000,
    });
    if (process.env.SHOT) {
      const shot = await send("Page.captureScreenshot", { format: "png" });
      const { writeFileSync } = await import("node:fs");
      writeFileSync(process.env.SHOT, Buffer.from(shot.data, "base64"));
    }
    console.log(JSON.stringify({
      console: consoleLog,
      errors: jsErrors,
      eval: evalResult.result?.value ??
        (evalResult.exceptionDetails ? "EVAL_EXC: " + (evalResult.exceptionDetails.exception?.description || evalResult.exceptionDetails.text) : evalResult),
    }, null, 0));
    ws.close();
  } catch (e) {
    console.error("CDP_DRIVER_ERROR: " + e.message);
    process.exitCode = 1;
  } finally {
    chrome.kill("SIGKILL");
  }
}
main();
