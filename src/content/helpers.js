export const m = (key, delta) => ({ type: 'meter', key, delta });
export const flag = (key, value = true) => ({ type: 'flag', key, value });
export const fact = (key) => ({ type: 'fact', key });
export const later = (delay, effects, text) => ({ type: 'later', delay, effects, text });
export const schedule = (eventId, delay) => ({ type: 'schedule', eventId, delay });

// Beijing's patience is limited: it will answer a governor's request for money this many times, in total.
export const BEIJING_HELP_LIMIT = 2;
export const beijingWillHelp = { flag: 'beijingAsks', op: '<', value: BEIJING_HELP_LIMIT };
export const BEIJING_REFUSES = 'Beijing has already helped twice, and will not do so again.';
export const askedBeijing = { type: 'flagAdd', key: 'beijingAsks', delta: 1 };

// Turn 1 is autumn. Winter runs from this turn to WINTER_END_TURN, and spring follows.
export const WINTER_START_TURN = 2;
// The winter ends after this turn, and running relief costs Treasury and Capacity each week of it.
export const WINTER_END_TURN = 8;
export const SPRING_REVENUE = 4;
export const SPRING_RECOVERY = 2;
// Selling provincial assets in a hurry permanently lowers the income that comes back in spring.
export const ASSET_SALE_REVENUE_LOSS = 3;

export function springRevenue(d) {
  return SPRING_REVENUE - (d.flags.assetsSold ? ASSET_SALE_REVENUE_LOSS : 0);
}
export const RELIEF_UPKEEP = 4;

export const UNREST_AT = 30;
export const SEVERE_UNREST_AT = 20;
export const COLLAPSE_AT = 10;
export const OVERSTRETCH_AT = 25;
export const BREAKDOWN_AT = 12;

// Repayments the province has already committed to.
export function owedRepayments(d) {
  return -d.commitments
    .flatMap((c) => c.effects)
    .filter((e) => e.type === 'meter' && e.key === 'treasury' && e.delta < 0)
    .reduce((sum, e) => sum + e.delta, 0);
}

const weeks = (n) => `${n} week${n === 1 ? '' : 's'}`;

// Where the calendar stands: how long until winter, how long it lasts, and when it ends.
export function season(d) {
  const length = WINTER_END_TURN - WINTER_START_TURN + 1;
  if (d.turn < WINTER_START_TURN) {
    const until = WINTER_START_TURN - d.turn;
    return { name: 'Autumn', text: `Autumn. Winter begins in ${weeks(until)} and lasts ${weeks(length)}.` };
  }
  if (d.turn <= WINTER_END_TURN) {
    const week = d.turn - WINTER_START_TURN + 1;
    const left = WINTER_END_TURN - d.turn;
    return {
      name: 'Winter',
      text: left === 0
        ? `Winter, week ${week} of ${length}. This is its last week.`
        : `Winter, week ${week} of ${length}. It ends in ${weeks(left)}.`,
    };
  }
  return { name: 'Spring', text: 'Spring. Winter has ended.' };
}

// Active weekly effects that will apply at the start of next week, before any decision you make.
// Mirrors startTurn() in src/engine/game.js so the sidebar always reflects the true rules.
export function weeklyEffects(d) {
  const next = d.turn + 1;
  const items = [];
  if (next > d.maxTurns) return items;

  const winter = next >= WINTER_START_TURN && next <= WINTER_END_TURN;
  if (winter) {
    items.push({ label: 'Winter weather', deltas: { welfare: -2 } });
  }
  if (winter && d.flags.reliefOn) {
    items.push({ label: 'Relief operations', deltas: { treasury: -RELIEF_UPKEEP } });
  }
  if (next > WINTER_END_TURN && next < d.maxTurns) {
    const deltas = { treasury: springRevenue(d), capacity: SPRING_RECOVERY };
    if (!(d.flags.uncovered > 0)) deltas.welfare = 1;
    items.push({
      label: d.flags.assetsSold ? 'Spring recovery (assets sold)' : 'Spring recovery',
      deltas,
    });
  }
  if (next > 1 && d.flags.uncovered > 0) {
    const n = d.flags.uncovered;
    items.push({
      label: `${n} unreached village${n === 1 ? '' : 's'}`,
      deltas: { welfare: -Math.ceil(n / 5) },
      warn: true,
    });
  }
  if (d.meters.treasury < 0) {
    items.push({
      label: 'Borrowing (Treasury below 0)',
      deltas: { welfare: -3, capacity: -2 },
      warn: true,
    });
  }
  if (d.meters.welfare < SEVERE_UNREST_AT) {
    items.push({
      label: `Open unrest (Welfare below ${SEVERE_UNREST_AT})`,
      deltas: { capacity: -3, treasury: -3 },
      warn: true,
    });
  } else if (d.meters.welfare < UNREST_AT) {
    items.push({
      label: `Spreading unrest (Welfare below ${UNREST_AT})`,
      deltas: { capacity: -2 },
      warn: true,
    });
  }
  if (d.meters.capacity < BREAKDOWN_AT) {
    items.push({
      label: `Administrative breakdown (Capacity below ${BREAKDOWN_AT})`,
      deltas: { treasury: -2, welfare: -2 },
      warn: true,
    });
  } else if (d.meters.capacity < OVERSTRETCH_AT) {
    items.push({
      label: `Overstretched offices (Capacity below ${OVERSTRETCH_AT})`,
      deltas: { treasury: -2 },
      warn: true,
    });
  }
  return items;
}

// Treasury-only summary derived from weeklyEffects(), kept for tests and quick checks.
export function weeklyTreasury(d) {
  const items = weeklyEffects(d)
    .filter((i) => i.deltas.treasury)
    .map((i) => ({ label: i.label, delta: i.deltas.treasury }));
  return { items, net: items.reduce((sum, i) => sum + i.delta, 0) };
}
