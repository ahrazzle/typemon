// Minimal harness sanity check.
(() => {
  return {
    title: document.title,
    hasStart: !!document.getElementById("startBtn"),
    hasBattle: !!document.getElementById("battleRoot"),
    phaseHint: (typeof window.__lastGate !== "undefined") ? window.__lastGate : "no-gate-yet",
  };
})();
