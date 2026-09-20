// Typemon — sync the repo-root index.html from demo/index.html.
//
// demo/index.html is the source of truth. The root copy exists so GitHub
// Pages serves the game at /<repo>/ as well as /<repo>/demo/; it is a
// generated file — do not edit it by hand.
//
// Rewrite rules (demo/ -> root):
//   "./vendor/typejoy.js"   -> "./demo/vendor/typejoy.js"   (module import)
//   src="vendor/typejoy.js" -> src="demo/vendor/typejoy.js" (script src attribute)
//   "../src/..."             -> "./src/..."                   (all module imports)
//   const RP = "../"         -> const RP = "./"               (repo-relative asset prefix)
//   fetch("words.json")      -> fetch("demo/words.json")      (word pool sits in demo/)
//
// Usage: node scripts/sync-root-index.mjs   (run from the repo root)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const demo = readFileSync(join(root, "demo/index.html"), "utf8");

let out = demo
  .replaceAll('"./vendor/typejoy.js"', '"./demo/vendor/typejoy.js"')
  .replaceAll('src="vendor/typejoy.js"', 'src="demo/vendor/typejoy.js"')
  .replaceAll('"../src/', '"./src/')
  .replaceAll('const RP = "../";', 'const RP = "./";')
  .replaceAll('fetch("words.json")', 'fetch("demo/words.json")');

// sanity: no demo-relative refs may survive
const leftovers = out.match(/"\.\.\/(?!demo\/)/g);
if (leftovers) {
  console.error("sync-root-index: unrewritten ../ refs remain:", leftovers.length);
  process.exit(1);
}
// the word-pool fetch must point at demo/ — a bare "words.json" 404s at root
if (out.includes('fetch("words.json")')) {
  console.error("sync-root-index: unrewritten words.json fetch remains");
  process.exit(1);
}
// the vendored typejoy bundle must resolve under demo/ — a root-relative
// "vendor/" hits a 404 (there is no vendor/ at the repo root)
if (out.includes('src="vendor/') || out.includes('from "./vendor/')) {
  console.error("sync-root-index: unrewritten vendor/typejoy.js reference remains");
  process.exit(1);
}

writeFileSync(join(root, "index.html"), out);
console.log("sync-root-index: index.html regenerated from demo/index.html");
