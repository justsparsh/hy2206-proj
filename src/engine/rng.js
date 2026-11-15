// Seeded generator (mulberry32). State lives on the game state so runs are reproducible.
export function rand(draft) {
  draft.rngState = (draft.rngState + 0x6d2b79f5) >>> 0;
  let t = draft.rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function pickWeighted(draft, items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let r = rand(draft) * total;
  for (const item of items) {
    r -= weightOf(item);
    if (r < 0) return item;
  }
  return items[items.length - 1];
}
