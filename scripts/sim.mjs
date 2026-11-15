// Plays many seeded runs with different strategies and prints ending and meter statistics.
// Usage: node scripts/sim.mjs
import { createGame, describe, choose, proceed } from '../src/engine/game.js';

const WRONGS = new Set([
  'hold-reserve', 'punish', 'visit-hongyan', 'say-nothing', 'award-kin', 'let-it-run', 'cut-rations', 'divert-budgets',
]);

const policies = {
  // Takes the first option that is not one of the five wrongs, and always corrects what Lin raises.
  careful: (view) => {
    const opts = view.choices.filter((c) => !c.locked);
    if (view.kind === 'remonstrance') return 'correct';
    return (opts.find((c) => !WRONGS.has(c.id)) ?? opts[0]).id;
  },
  // Avoids the wrongs and takes the cheapest remaining option in Treasury terms.
  cheapestEthical: (view) => {
    const opts = view.choices.filter((c) => !c.locked);
    if (view.kind === 'remonstrance') return 'correct';
    const spend = (c) => {
      const t = c.cost.find((x) => x.startsWith('Treasury'));
      if (!t) return 0;
      const n = Number(t.replace(/[^\d]/g, ''));
      return t.includes('−') ? n : -n;
    };
    const clean = opts.filter((c) => !WRONGS.has(c.id));
    return (clean.length ? clean : opts).sort((a, b) => spend(a) - spend(b))[0].id;
  },
  // Avoids the wrongs but spends generously: prefers the most expensive remaining option.
  generousEthical: (view) => {
    const opts = view.choices.filter((c) => !c.locked);
    if (view.kind === 'remonstrance') return 'correct';
    const spend = (c) => {
      const t = c.cost.find((x) => x.startsWith('Treasury'));
      if (!t) return 0;
      const n = Number(t.replace(/[^\d]/g, ''));
      return t.includes('−') ? n : -n;
    };
    const clean = opts.filter((c) => !WRONGS.has(c.id));
    return (clean.length ? clean : opts).sort((a, b) => spend(b) - spend(a))[0].id;
  },
  random: (view, s, rnd) => {
    const opts = view.choices.filter((c) => !c.locked);
    return opts[Math.floor(rnd() * opts.length)].id;
  },
  shortcut: (view, s) => {
    const opts = view.choices.filter((c) => !c.locked);
    if (view.kind === 'remonstrance') return 'suppress';
    if (s.turn === 1) return 'hold-reserve';
    return (opts.find((c) => WRONGS.has(c.id)) ?? opts[0]).id;
  },
  shortcutButListens: (view, s) => {
    const opts = view.choices.filter((c) => !c.locked);
    if (view.kind === 'remonstrance') return 'correct';
    if (s.turn === 1) return 'hold-reserve';
    return (opts.find((c) => WRONGS.has(c.id)) ?? opts[0]).id;
  },
};

function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const N = 1000;
for (const [name, policy] of Object.entries(policies)) {
  const counts = {};
  const sum = { treasury: 0, welfare: 0, capacity: 0 };
  let debt = 0;
  let resigned = 0;
  let everBroke = 0;
  let minWelfare = 0;
  for (let seed = 1; seed <= N; seed++) {
    const rnd = mulberry(seed * 7919);
    let s = createGame(seed);
    let broke = false;
    let lowW = 100;
    while (s.phase !== 'ended') {
      if (s.phase === 'result') s = proceed(s);
      else s = choose(s, policy(describe(s), s, rnd));
      if (s.meters.treasury < 0) broke = true;
      lowW = Math.min(lowW, s.meters.welfare);
    }
    if (broke) everBroke++;
    minWelfare += lowW;
    const key = `${s.ending.political}/${s.ending.ethical}`;
    counts[key] = (counts[key] ?? 0) + 1;
    for (const k of Object.keys(sum)) sum[k] += s.meters[k];
    if (s.meters.treasury < 0) debt++;
    if (!s.ministerPresent) resigned++;
  }
  console.log(`\n${name}`);
  console.log('  endings:', Object.entries(counts).map(([k, v]) => `${k} ${((v / N) * 100).toFixed(0)}%`).join(', '));
  console.log('  avg meters:', Object.entries(sum).map(([k, v]) => `${k} ${(v / N).toFixed(0)}`).join(', '));
  console.log(`  in debt at end: ${((debt / N) * 100).toFixed(0)}%, ever in debt: ${((everBroke / N) * 100).toFixed(0)}%, lowest welfare reached (avg): ${(minWelfare / N).toFixed(0)}, Lin resigned: ${((resigned / N) * 100).toFixed(0)}%`);
}
