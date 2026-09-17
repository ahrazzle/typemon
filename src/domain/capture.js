// Typemon MVP — capture RNG seam (Slice 1). Pure; randomness injected.
// Formula (locked from demo): combo >= threshold -> 0.8 else 0.25 + combo*0.01.
export const CAPTURE_THRESHOLD = 30;

export function captureChance(combo, threshold) {
  const t = threshold == null ? CAPTURE_THRESHOLD : threshold;
  if (combo >= t) return 0.8;
  return 0.25 + combo * 0.01;
}

// rng() must return [0,1). Tests pass a seeded function.
export function captureRoll(rng, combo, threshold) {
  const chance = captureChance(combo, threshold);
  const roll = rng();
  return { success: roll < chance, chance, roll };
}
