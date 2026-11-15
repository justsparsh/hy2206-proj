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
// The winter ends after this turn, and running relief costs this much Treasury each week of it.
export const WINTER_END_TURN = 8;
export const SPRING_REVENUE = 4;
// Selling provincial assets in a hurry permanently lowers the income that comes back in spring.
export const ASSET_SALE_REVENUE_LOSS = 3;

export function springRevenue(d) {
  return SPRING_REVENUE - (d.flags.assetsSold ? ASSET_SALE_REVENUE_LOSS : 0);
}
export const RELIEF_UPKEEP = 4;
export const RELIEF_UPKEEP_SCALED = 2;
// Scaled-back relief saves money, and costs this much Welfare every week of the winter it lasts.
export const RELIEF_SCALED_WELFARE_COST = 3;

// How far short of money the province will be when winter ends, if nothing changes. Positive means a shortfall.
export function projectedShortfall(d) {
  const weeksLeft = Math.max(0, WINTER_END_TURN - d.turn);
  const upkeep = d.flags.reliefScaled ? RELIEF_UPKEEP_SCALED : RELIEF_UPKEEP;
  return -(d.meters.treasury - owedRepayments(d) - upkeep * weeksLeft);
}

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

// What happens to the Treasury at the start of next week, before any decision you make. Repayments due are separate.
export function weeklyTreasury(d) {
  const next = d.turn + 1;
  const items = [];
  if (next >= WINTER_START_TURN && next <= WINTER_END_TURN && d.flags.reliefOn) {
    items.push({
      label: d.flags.reliefScaled ? 'Relief operations (scaled back)' : 'Relief operations',
      delta: -(d.flags.reliefScaled ? RELIEF_UPKEEP_SCALED : RELIEF_UPKEEP),
    });
  }
  if (next > WINTER_END_TURN && next < d.maxTurns) {
    items.push({ label: d.flags.assetsSold ? 'Spring revenue (assets sold)' : 'Spring revenue', delta: springRevenue(d) });
  }
  return { items, net: items.reduce((sum, i) => sum + i.delta, 0) };
}
