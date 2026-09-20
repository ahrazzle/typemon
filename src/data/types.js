// Typemon v1 — type effectiveness chart (original design).
// Pure data: no DOM, no Typejoy. Imported by the battle shell and node tests.
//
// Design: for each attacking type, `strong` lists defending types that take
// 2x damage, `weak` lists defending types that take 0.5x. Anything else is 1x.
// The 18 type ids come from the island's type-icon system (poses.json);
// the matchup VALUES below are original Typemon design, not copied from any
// third-party chart.

export const TYPE_CHART = {
  BURNING:  { strong: ["VEGETAL", "COLD", "BUG", "METAL"],            weak: ["LIQUID", "MINERAL", "GROUND"] },
  LIQUID:   { strong: ["BURNING", "MINERAL", "GROUND"],               weak: ["ELECTRON", "VEGETAL", "DRAGON"] },
  VEGETAL:  { strong: ["LIQUID", "GROUND", "MINERAL"],               weak: ["BURNING", "COLD", "BUG", "SKY"] },
  ELECTRON: { strong: ["LIQUID", "SKY"],                             weak: ["GROUND", "VEGETAL", "DRAGON"] },
  COLD:     { strong: ["VEGETAL", "GROUND", "SKY", "DRAGON"],         weak: ["BURNING", "FIGHT", "METAL"] },
  GROUND:   { strong: ["ELECTRON", "BURNING", "METAL", "TOXIC"],      weak: ["LIQUID", "VEGETAL", "SKY"] },
  MINERAL:  { strong: ["COLD", "SKY", "BUG"],                        weak: ["LIQUID", "GROUND", "FIGHT", "METAL"] },
  METAL:    { strong: ["COLD", "MINERAL", "MAGIC"],                  weak: ["BURNING", "GROUND", "FIGHT"] },
  FIGHT:    { strong: ["MINERAL", "COLD", "METAL", "BAD"],           weak: ["SKY", "MENTAL", "MAGIC", "BUG"] },
  SKY:      { strong: ["VEGETAL", "BUG", "FIGHT"],                   weak: ["ELECTRON", "COLD", "MINERAL"] },
  BUG:      { strong: ["VEGETAL", "MENTAL", "BAD"],                  weak: ["BURNING", "SKY", "FIGHT"] },
  TOXIC:    { strong: ["VEGETAL", "MAGIC"],                         weak: ["GROUND", "MENTAL", "GHOST"] },
  GHOST:    { strong: ["MENTAL", "GHOST", "MAGIC"],                  weak: ["BAD"] },
  MENTAL:   { strong: ["FIGHT", "TOXIC"],                           weak: ["BUG", "GHOST", "BAD"] },
  DRAGON:   { strong: ["DRAGON"],                                    weak: ["COLD", "MAGIC"] },
  MAGIC:    { strong: ["FIGHT", "DRAGON", "BAD"],                    weak: ["METAL", "MENTAL", "GHOST"] },
  BAD:      { strong: ["MENTAL", "GHOST", "MAGIC"],                  weak: ["FIGHT", "BUG"] },
  NEUTRAL:  { strong: [],                                            weak: [] },
};

// effectiveness(attackingType, defendingType) -> 2 | 1 | 0.5.
// Unknown type ids degrade to neutral (1x) rather than throwing.
export function effectiveness(atk, def) {
  const row = TYPE_CHART[atk];
  if (!row || !def) return 1;
  if (row.strong.includes(def)) return 2;
  if (row.weak.includes(def)) return 0.5;
  return 1;
}

// Battle label for the effectiveness tier (used by the HUD callouts).
export function effectivenessLabel(mult) {
  if (mult > 1) return "SUPER EFFECTIVE!";
  if (mult < 1) return "It's not very effective\u2026";
  return "";
}

// Assertion used by node tests: every strong/weak entry names a real type,
// and no type is both strong and weak against the same defender.
export function assertChart(typeIds) {
  const errors = [];
  const ids = typeIds || Object.keys(TYPE_CHART);
  for (const atk of Object.keys(TYPE_CHART)) {
    const row = TYPE_CHART[atk];
    for (const def of row.strong) {
      if (!ids.includes(def)) errors.push(atk + ": strong vs unknown " + def);
      if (row.weak.includes(def)) errors.push(atk + ": " + def + " both strong and weak");
    }
    for (const def of row.weak) {
      if (!ids.includes(def)) errors.push(atk + ": weak vs unknown " + def);
    }
  }
  return errors;
}
