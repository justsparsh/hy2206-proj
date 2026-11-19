import { describe as suite, it, expect } from 'vitest';
import { createGame, describe, choose, proceed } from './game.js';
import { evaluate } from './conditions.js';
import { buildDebrief } from './debrief.js';
import { EVENTS, CHARGES, FACTS } from '../content/index.js';
import { season, weeklyTreasury } from '../content/helpers.js';

const available = (view) => view.choices.filter((c) => !c.locked);

// A policy that asks to put a matter right falls back to defending it when the Treasury cannot cover the repair.
const orFallback = (view, id) => (id === 'correct' && view.choices.find((c) => c.id === 'correct')?.locked ? 'defend' : id);

// Every choice that knowingly opens a charge. A player who knows all of these still has to find another way.
const ALL_WRONGS = new Set([
  'hold-reserve', 'punish', 'visit-hongyan', 'say-nothing', 'award-kin', 'let-it-run', 'cut-rations', 'divert-budgets', 'report-low', 'crush-protest', 'collect-full', 'stage-visit',
]);

// Plays a run. `policy(view, state)` returns a choice id, or undefined to take the first available choice.
function play(seed, policy = () => undefined, stopWhen = () => false) {
  let s = createGame(seed);
  let guard = 0;
  while (s.phase !== 'ended' && guard++ < 200) {
    if (stopWhen(s)) return s;
    if (s.phase === 'result') {
      s = proceed(s);
      continue;
    }
    const view = describe(s);
    const id = orFallback(view, policy(view, s) ?? available(view)[0].id);
    s = choose(s, id);
  }
  return s;
}

const currentEventId = (s) => (s.current?.kind === 'event' ? s.current.eventId : null);

suite('conditions', () => {
  const s = createGame(1);
  it('evaluates flags, meters, facts and combinators', () => {
    s.flags.x = 3;
    expect(evaluate({ flag: 'x', op: '>', value: 2 }, s)).toBe(true);
    expect(evaluate({ flag: 'x', op: '<', value: 2 }, s)).toBe(false);
    expect(evaluate({ meter: 'treasury', op: '>=', value: 60 }, s)).toBe(true);
    expect(evaluate({ not: { fact: 'nope' } }, s)).toBe(true);
    expect(evaluate({ all: [{ flag: 'x' }, { any: [{ fact: 'a' }, { flag: 'x' }] }] }, s)).toBe(true);
    expect(evaluate(undefined, s)).toBe(true);
  });
});

suite('determinism', () => {
  it('replays identically for the same seed', () => {
    const a = play(42);
    const b = play(42);
    expect(a.history).toEqual(b.history);
    expect(a.meters).toEqual(b.meters);
  });
  it('does not mutate the state passed in', () => {
    const s = createGame(7);
    const snapshot = JSON.stringify(s);
    choose(s, available(describe(s))[0].id);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});

suite('ethics are deterministic and fair', () => {
  it('holding the reserve always opens failedTrust, whatever the luck', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const s = play(seed, (v, st) => (st.turn === 1 ? 'hold-reserve' : undefined), (st) => st.turn === 2);
      expect(s.charges.some((c) => c.id === 'failedTrust')).toBe(true);
    }
  });

  it('punishing raiders opens entrapment only after the coverage gap was revealed', () => {
    for (let seed = 1; seed <= 100; seed++) {
      let s = play(seed, (v, st) => (st.turn === 1 ? 'targeted-relief' : undefined), (st) => currentEventId(st) === 'depot-thefts' && st.turn >= 2);
      if (currentEventId(s) !== 'depot-thefts') continue;
      expect(s.facts).toContain('coverageGap');
      s = choose(s, 'punish');
      expect(s.charges.some((c) => c.id === 'entrapment')).toBe(true);
    }
  });

  it('a run that avoids every wrong ends ethically clear, unless it was forced into one', () => {
    const wrongs = ALL_WRONGS;
    let checked = 0;
    for (let seed = 1; seed <= 150; seed++) {
      let forced = false;
      const s = play(seed, (v) => {
        const open = available(v);
        const clean = open.find((c) => !wrongs.has(c.id));
        if (!clean && v.kind !== 'remonstrance') forced = true;
        return clean?.id;
      });
      if (forced) continue;
      checked++;
      expect(s.ending.ethical, `seed ${seed}`).toBe('clear');
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('being broke can leave force as the only response to unrest, so it is never forced by luck', () => {
    const s = play(2, undefined, (st) => st.turn >= 3 && st.phase === 'event');
    const crisis = structuredClone(s);
    crisis.meters = { treasury: 0, welfare: 25, capacity: 10 };
    crisis.seenEvents = crisis.seenEvents.filter((e) => e !== 'the-unrest');
    crisis.current = { kind: 'event', eventId: 'the-unrest' };
    const ids = describe(crisis).choices.filter((c) => !c.locked).map((c) => c.id);
    expect(ids).toEqual(['crush-protest']);
  });
});

suite('remonstrance and removal', () => {
  it('even a player who avoids every known wrong meets Lin', () => {
    let met = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = play(seed, (v) => (v.kind === 'remonstrance' ? 'correct' : available(v).find((c) => !ALL_WRONGS.has(c.id))?.id));
      if (s.charges.length > 0) met++;
    }
    expect(met / 200).toBeGreaterThan(0.9);
  });

  it('Lin’s budget warning is informative, not a verdict: it shows numbers and cannot be shut down', () => {
    let tested = 0;
    for (let seed = 1; seed <= 100 && tested < 5; seed++) {
      const s = play(seed, (v) => (v.kind === 'remonstrance' ? 'correct' : available(v).find((c) => !ALL_WRONGS.has(c.id))?.id), (st) => st.current?.kind === 'remonstrance');
      if (s.phase === 'ended' || s.current.chargeId !== 'fiscalConcern') continue;
      const view = describe(s);
      expect(view.choices.map((c) => c.id)).toEqual(['correct', 'defend']);
      expect(view.paragraphs[0]).toMatch(/Treasury stands at -?\d+/);
      expect(view.paragraphs[0]).toMatch(/about \d+ short/);
      expect(() => choose(s, 'suppress')).toThrow();
      tested++;
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('declining the advice is allowed, never escalates toward resignation, and is a bet', () => {
    let tested = 0;
    for (let seed = 1; seed <= 100 && tested < 5; seed++) {
      const s = play(seed, (v) => (v.kind === 'remonstrance' ? 'correct' : available(v).find((c) => !ALL_WRONGS.has(c.id))?.id), (st) => st.current?.kind === 'remonstrance');
      if (s.phase === 'ended' || s.current.chargeId !== 'fiscalConcern') continue;
      const next = choose(s, 'defend');
      expect(next.charges.find((c) => c.id === 'fiscalConcern').status).toBe('defended');
      expect(next.remonstrances).toBe(0);
      expect(next.flags.budgetWarningIgnored).toBe(true);
      tested++;
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('heeding the advice has a real price in welfare and a real saving in money', () => {
    const def = CHARGES.fiscalConcern;
    const eff = def.correct.effects;
    expect(eff.some((e) => e.type === 'meter' && e.key === 'treasury' && e.delta > 0)).toBe(true);
    expect(eff.some((e) => e.type === 'meter' && e.key === 'welfare' && e.delta < 0)).toBe(true);
  });

  it('scaled-back relief keeps costing welfare every winter week, so heeding is not a free win', () => {
    const turn = (flags) => {
      const s = createGame(6);
      s.turn = 4;
      s.phase = 'result';
      s.current = { kind: 'event', eventId: 'x' };
      s.result = { title: '', text: '', deltas: {} };
      s.flags = { ...s.flags, reliefOn: true, ...flags };
      s.meters.welfare = 60;
      return proceed(s);
    };
    const full = turn({});
    const scaled = turn({ reliefScaled: true });
    expect(scaled.meters.welfare).toBeLessThan(full.meters.welfare);
    expect(scaled.meters.treasury).toBeGreaterThan(full.meters.treasury);
  });

  it('it only appears when the money really is going to run out', () => {
    const mk = (treasury) => {
      const s = createGame(6);
      s.turn = 4;
      s.flags.reliefOn = true;
      s.meters.treasury = treasury;
      return s;
    };
    const warn = (d) => CHARGES.fiscalConcern.trigger(d);
    expect(warn(mk(80))).toBe(false);
    expect(warn(mk(5))).toBe(true);
    const scaled = mk(5);
    scaled.flags.reliefScaled = true;
    expect(warn(scaled)).toBe(false);
  });

  it('ignoring it and running dry is reported to Beijing, once', () => {
    const s = createGame(6);
    s.turn = 5;
    s.phase = 'result';
    s.current = { kind: 'event', eventId: 'x' };
    s.result = { title: '', text: '', deltas: {} };
    s.flags.budgetWarningIgnored = true;
    s.flags.reliefOn = true;
    s.meters.treasury = -2;
    const first = proceed(s);
    expect(first.flags.warningCalledIn).toBe(true);
    expect(first.flags.beijingConcerns).toBe(1);
    expect(first.turnNotes.join(' ')).toMatch(/as Lin warned/);

    first.phase = 'result';
    first.current = { kind: 'event', eventId: 'x' };
    first.result = { title: '', text: '', deltas: {} };
    const second = proceed(first);
    expect(second.flags.beijingConcerns).toBe(1);
  });

  it('keeping the money safe means the warning never comes true', () => {
    const s = createGame(6);
    s.turn = 5;
    s.phase = 'result';
    s.current = { kind: 'event', eventId: 'x' };
    s.result = { title: '', text: '', deltas: {} };
    s.flags.budgetWarningIgnored = true;
    s.flags.reliefOn = true;
    s.meters.treasury = 40;
    const next = proceed(s);
    expect(next.flags.warningCalledIn).toBeFalsy();
    expect(next.flags.beijingConcerns).toBeFalsy();
  });

  it('Lin raises a charge on the turn after it opens', () => {
    const s = play(5, (v, st) => (st.turn === 1 ? 'hold-reserve' : undefined), (st) => st.turn === 2);
    expect(s.current.kind).toBe('remonstrance');
    expect(s.current.chargeId).toBe('failedTrust');
  });

  it('Lin’s resignation is delivered as a notice the player must acknowledge', () => {
    let s = play(11, (v, st) => (st.turn === 1 ? 'hold-reserve' : undefined), (st) => st.turn === 2);
    const noticeSeen = [];
    let guard = 0;
    while (s.phase !== 'ended' && s.ministerPresent && guard++ < 30) {
      if (s.phase === 'result') { s = proceed(s); continue; }
      const v = describe(s);
      s = choose(s, v.kind === 'remonstrance' ? 'suppress' : available(v)[0].id);
      if (s.result?.notice) noticeSeen.push(s.result.notice.title);
    }
    expect(noticeSeen).toEqual(['Vice-Governor Lin Wei has resigned']);
    expect(s.ministerPresent).toBe(false);
  });

  it('refusing to listen makes Lin resign, and Beijing removes you', () => {
    const s = play(
      11,
      (v, st) => {
        if (st.turn === 1) return 'hold-reserve';
        if (st.current?.kind === 'remonstrance') return 'suppress';
        return undefined;
      },
    );
    expect(s.ministerPresent).toBe(false);
    expect(s.flags.removed).toBe(true);
    expect(s.ending.political).toBe('removed');
  });

  it('correcting a charge closes it and costs resources', () => {
    let s = play(5, (v, st) => (st.turn === 1 ? 'hold-reserve' : undefined), (st) => st.turn === 2);
    const before = s.meters.treasury;
    s = choose(s, 'correct');
    expect(s.charges.find((c) => c.id === 'failedTrust').status).toBe('corrected');
    expect(s.meters.treasury).toBeLessThan(before);
  });

  it('an invalid defence leaves the charge open and escalates', () => {
    let s = play(5, (v, st) => (st.turn === 1 ? 'hold-reserve' : undefined), (st) => st.turn === 2);
    s = choose(s, 'defend');
    expect(s.charges.find((c) => c.id === 'failedTrust').status).toBe('open');
    expect(s.remonstrances).toBe(1);
  });

  it('a clean Beijing review gives commendation without resources', () => {
    const wrongs = ALL_WRONGS;
    const s = play(3, (v) => available(v).find((c) => !wrongs.has(c.id))?.id, (st) => currentEventId(st) === 'beijing-review');
    const before = { ...s.meters };
    expect(s.flags.verdict).toBe('commended');
    expect(s.meters).toEqual(before);
  });
});

suite('the calendar and weekly accounts shown to the player match the rules', () => {
  const stateAt = (turn, flags = {}) => {
    const s = createGame(8);
    s.turn = turn;
    s.flags = { ...s.flags, ...flags };
    return s;
  };

  it('says how long until winter, how long it lasts, and when it ends', () => {
    expect(season(stateAt(1)).text).toBe('Autumn. Winter begins in 1 week and lasts 7 weeks.');
    expect(season(stateAt(2)).text).toBe('Winter, week 1 of 7. It ends in 6 weeks.');
    expect(season(stateAt(7)).text).toBe('Winter, week 6 of 7. It ends in 1 week.');
    expect(season(stateAt(8)).text).toBe('Winter, week 7 of 7. This is its last week.');
    expect(season(stateAt(9)).name).toBe('Spring');
  });

  it('the winter drain starts exactly when the calendar says it does', () => {
    const turnStart = (turn) => {
      const s = createGame(8);
      s.turn = turn - 1;
      s.phase = 'result';
      s.current = { kind: 'event', eventId: 'x' };
      s.result = { title: '', text: '', deltas: {} };
      s.meters.welfare = 60;
      return proceed(s);
    };
    const first = turnStart(2);
    const last = turnStart(8);
    const after = turnStart(9);
    expect(first.turnNotes.join(' ')).toMatch(/Winter closes in/);
    expect(last.turnNotes.join(' ')).toMatch(/Winter closes in/);
    expect(after.turnNotes.join(' ')).not.toMatch(/Winter closes in/);
    expect(season(first).name).toBe('Winter');
    expect(season(after).name).toBe('Spring');
  });

  it('the weekly Treasury line is exactly what the next turn applies', () => {
    for (const [turn, flags] of [
      [2, { reliefOn: true }],
      [4, { reliefOn: true, reliefScaled: true }],
      [7, { reliefOn: true }],
      [8, { reliefOn: true }],
      [9, { reliefOn: true }],
      [12, {}],
      [13, {}],
    ]) {
      const s = stateAt(turn, flags);
      s.meters.treasury = 50;
      s.maxTurns = 14;
      const predicted = weeklyTreasury(s).net;
      s.phase = 'result';
      s.current = { kind: 'event', eventId: 'x' };
      s.result = { title: '', text: '', deltas: {} };
      const next = proceed(s);
      expect(next.meters.treasury - 50, `turn ${turn} ${JSON.stringify(flags)}`).toBe(predicted);
    }
  });

  it('scaled-back relief shows the lower weekly cost', () => {
    const full = weeklyTreasury(stateAt(3, { reliefOn: true }));
    const scaled = weeklyTreasury(stateAt(3, { reliefOn: true, reliefScaled: true }));
    expect(full.net).toBe(-4);
    expect(scaled.net).toBe(-2);
    expect(scaled.items[0].label).toMatch(/scaled back/);
  });

  it('shows no regular change when relief is off and it is still winter', () => {
    expect(weeklyTreasury(stateAt(3)).items).toEqual([]);
  });
});

suite('low welfare breaks the province', () => {
  const at = (meters, flags = {}) => {
    const s = createGame(4);
    s.turn = 5;
    s.phase = 'result';
    s.current = { kind: 'event', eventId: 'x' };
    s.result = { title: '', text: '', deltas: {} };
    s.meters = { ...s.meters, ...meters };
    s.flags = { ...s.flags, ...flags };
    return proceed(s);
  };

  it('welfare below 30 drains the administration each turn', () => {
    const calm = at({ welfare: 60, capacity: 50 });
    const unrest = at({ welfare: 25, capacity: 50 });
    expect(unrest.meters.capacity).toBeLessThan(calm.meters.capacity);
  });

  it('welfare below 20 also drains the Treasury', () => {
    const calm = at({ welfare: 60, treasury: 50, capacity: 50 });
    const severe = at({ welfare: 15, treasury: 50, capacity: 50 });
    expect(severe.meters.treasury).toBeLessThan(calm.meters.treasury);
    expect(severe.meters.capacity).toBeLessThan(calm.meters.capacity);
  });

  it('welfare of 10 or less ends your career with a notice you must acknowledge', () => {
    const s = at({ welfare: 8 });
    expect(s.flags.collapsed).toBe(true);
    expect(s.phase).toBe('result');
    expect(s.result.notice.title).toMatch(/relieved you of your post/);
    const ended = proceed(s);
    expect(ended.status).toBe('ended');
    expect(ended.ending.career).toBe('dismissed');
    expect(buildDebrief(ended).political).toMatch(/broke down/);
  });

  it('a collapse on the last turn still counts as a collapse', () => {
    const s = createGame(4);
    s.turn = 14;
    s.phase = 'result';
    s.current = { kind: 'event', eventId: 'x' };
    s.result = { title: '', text: '', deltas: {} };
    s.meters.welfare = 6;
    const ended = proceed(s);
    expect(ended.flags.collapsed).toBe(true);
    expect(ended.ending.career).toBe('dismissed');
  });

  it('unrest gives the player a real choice, and force is a charge', () => {
    const s = createGame(4);
    s.turn = 5;
    s.phase = 'result';
    s.current = { kind: 'event', eventId: 'x' };
    s.result = { title: '', text: '', deltas: {} };
    s.meters = { treasury: 50, welfare: 28, capacity: 50 };
    s.seenEvents = [];
    let next = proceed(s);
    for (let i = 0; i < 20 && next.current?.eventId !== 'the-unrest' && next.phase !== 'ended'; i++) {
      next = next.phase === 'result' ? proceed(next) : choose(next, available(describe(next))[0].id);
      next.meters.welfare = Math.min(next.meters.welfare, 28);
    }
    if (next.current?.eventId === 'the-unrest') {
      const crushed = choose(next, 'crush-protest');
      expect(crushed.charges.some((c) => c.id === 'crushedUnrest')).toBe(true);
    }
  });
});

suite('shutting Lin out', () => {
  // Turn 1 holds the reserve, which opens a charge that Lin raises on turn 2.
  const atFirstRemonstrance = (seed = 5) => play(seed, (v, st) => (st.turn === 1 ? 'hold-reserve' : undefined), (st) => st.turn === 2);

  it('a matter you told Lin was closed is not raised again', () => {
    let s = choose(atFirstRemonstrance(), 'suppress');
    expect(s.charges.find((c) => c.id === 'failedTrust').suppressed).toBe(true);
    const raised = [];
    for (let i = 0; i < 40 && s.phase !== 'ended' && s.ministerPresent; i++) {
      if (s.phase === 'result') { s = proceed(s); continue; }
      const v = describe(s);
      if (v.kind === 'remonstrance') {
        raised.push(s.current.chargeId);
        break;
      }
      s = choose(s, available(v)[0].id);
    }
    expect(raised).not.toContain('failedTrust');
    expect(raised).toEqual(['silencedRemonstrance']);
  });

  it('suppression costs one step toward resignation, not one per turn', () => {
    const s = choose(atFirstRemonstrance(), 'suppress');
    expect(s.remonstrances).toBe(1);
  });

  it('shutting him out a second time makes him resign', () => {
    let s = choose(atFirstRemonstrance(), 'suppress');
    for (let i = 0; i < 40 && s.phase !== 'ended'; i++) {
      if (s.phase === 'result') { s = proceed(s); continue; }
      const v = describe(s);
      if (v.kind === 'remonstrance') break;
      s = choose(s, available(v)[0].id);
    }
    expect(s.current.chargeId).toBe('silencedRemonstrance');
    s = choose(s, 'suppress');
    expect(s.ministerPresent).toBe(false);
    expect(s.result.notice.title).toMatch(/has resigned/);
  });

  it('letting him speak again lets him raise the closed matter again', () => {
    let s = choose(atFirstRemonstrance(), 'suppress');
    for (let i = 0; i < 40 && s.phase !== 'ended'; i++) {
      if (s.phase === 'result') { s = proceed(s); continue; }
      const v = describe(s);
      if (v.kind === 'remonstrance') break;
      s = choose(s, available(v)[0].id);
    }
    expect(s.current.chargeId).toBe('silencedRemonstrance');
    s = choose(s, 'correct');
    expect(s.charges.find((c) => c.id === 'failedTrust').suppressed).toBe(false);
    expect(s.ministerPresent).toBe(true);
  });
});

suite('the kin contract is a real temptation', () => {
  const outcome = (id) => EVENTS['the-contract'].choices.find((c) => c.id === id).outcomes[0];
  const total = (eff, key) => eff.filter((e) => e.type === 'meter' && e.key === key).reduce((a, e) => a + e.delta, 0);

  it('it gives more welfare now, and more capacity, than the honest options', () => {
    const kin = outcome('award-kin').effects;
    for (const honest of ['open-tender', 'state-transport']) {
      const eff = outcome(honest).effects;
      expect(total(kin, 'welfare')).toBeGreaterThan(total(eff, 'welfare'));
      expect(total(kin, 'capacity')).toBeGreaterThan(total(eff, 'capacity'));
    }
  });

  it('it still opens a charge and can still go wrong', () => {
    const choice = EVENTS['the-contract'].choices.find((c) => c.id === 'award-kin');
    expect(choice.charges.map((c) => c.id)).toContain('favouredKin');
    expect(choice.outcomes.some((o) => JSON.stringify(o.effects).includes('"type":"later"'))).toBe(true);
  });
});

suite('no option is free money', () => {
  const flat = (effs) => effs.flatMap((e) => (e.type === 'commitment' || e.type === 'later' ? [e, ...e.effects] : [e]));
  const total = (all, key) => all.filter((e) => e.type === 'meter' && e.key === key).reduce((a, e) => a + e.delta, 0);
  const outcomesOf = (eventId, choiceId) => EVENTS[eventId].choices.find((c) => c.id === choiceId).outcomes;

  it('every option that raises money costs something else: Capacity, Welfare, a repayment, or a charge', () => {
    const unpriced = [];
    for (const ev of Object.values(EVENTS)) {
      if (typeof ev.choices === 'function') continue;
      for (const c of ev.choices) {
        for (const o of c.outcomes) {
          if (typeof o.effects === 'function') continue;
          const all = flat(o.effects);
          if (total(all, 'treasury') <= 0) continue;
          const costly =
            total(all, 'capacity') < 0 || total(all, 'welfare') < 0 || (c.charges ?? []).length > 0;
          if (!costly) unpriced.push(`${ev.id}/${c.id}`);
        }
      }
    }
    expect(unpriced).toEqual([]);
  });

  it('missing payments creates arrears that cost more than the relief it gives', () => {
    const all = flat(outcomesOf('debt-service', 'miss-payments')[0].effects);
    expect(total(all, 'treasury')).toBeLessThan(0);
    expect(all.some((e) => e.type === 'commitment')).toBe(true);
    expect(total(all, 'capacity')).toBeLessThanOrEqual(-5);
  });

  it('a bailout is a loan with a repayment plan, not a gift', () => {
    const all = flat(outcomesOf('debt-service', 'ask-bailout')[0].effects);
    expect(all.some((e) => e.type === 'commitment')).toBe(true);
    expect(total(all, 'treasury')).toBeGreaterThan(0);
    expect(total(all, 'treasury')).toBeLessThanOrEqual(10);
    expect(total(all, 'capacity')).toBeLessThan(0);
  });

  it('selling assets lowers every future week of spring revenue, and the panel shows it', () => {
    const mk = (flags) => {
      const s = createGame(3);
      s.turn = 10;
      s.flags = { ...s.flags, ...flags };
      return s;
    };
    const normal = weeklyTreasury(mk({}));
    const sold = weeklyTreasury(mk({ assetsSold: true }));
    expect(sold.net).toBeLessThan(normal.net);
    expect(sold.items[0].label).toMatch(/assets sold/);
    const next = (flags) => {
      const s = mk(flags);
      s.meters.treasury = 50;
      s.phase = 'result';
      s.current = { kind: 'event', eventId: 'x' };
      s.result = { title: '', text: '', deltas: {} };
      return proceed(s).meters.treasury - 50;
    };
    expect(next({ assetsSold: true })).toBe(sold.net);
    expect(next({})).toBe(normal.net);
  });

  it('the immediate gain from selling is smaller than before, since assets go cheap', () => {
    const all = flat(outcomesOf('debt-service', 'sell-assets')[0].effects);
    expect(total(all, 'treasury')).toBeLessThanOrEqual(12);
  });
});

suite('the central flood grant is not free money', () => {
  const grant = () => EVENTS['spring-flood'].choices.find((c) => c.id === 'request-grant');
  const atFlood = (severe, flags = {}) => {
    const s = createGame(9);
    s.turn = 11;
    s.seenEvents = s.seenEvents.filter((e) => e !== 'spring-flood');
    s.current = { kind: 'event', eventId: 'spring-flood' };
    s.phase = 'event';
    s.flags = { ...s.flags, floodSevere: severe, ...flags };
    return s;
  };

  it('is only available for a severe flood, and says why when it is not', () => {
    const mild = describe(atFlood(false)).choices.find((c) => c.id === 'request-grant');
    expect(mild.locked).toBe(true);
    expect(mild.lockedReason).toMatch(/severe/);
    expect(describe(atFlood(true)).choices.find((c) => c.id === 'request-grant').locked).toBe(false);
  });

  it('part of it must be repaid, so the net gain is small', () => {
    const effects = grant().outcomes[0].effects.flatMap((e) => (e.type === 'commitment' ? [e, ...e.effects] : [e]));
    const net = effects.filter((e) => e.type === 'meter' && e.key === 'treasury').reduce((a, e) => a + e.delta, 0);
    expect(net).toBeGreaterThan(0);
    expect(net).toBeLessThanOrEqual(5);
    expect(grant().outcomes[0].effects.some((e) => e.type === 'commitment')).toBe(true);
  });

  it('still counts against Beijing’s patience and says so when it is used up', () => {
    const view = describe(atFlood(true, { beijingAsks: 2 }));
    const g = view.choices.find((c) => c.id === 'request-grant');
    expect(g.locked).toBe(true);
    expect(g.lockedReason).toMatch(/already helped twice/);
  });
});

suite('Beijing’s patience is limited', () => {
  const BEIJING_CHOICES = new Set(['appeal-outside', 'ask-beijing-loan', 'ask-outside', 'request-grant', 'ask-bailout']);

  it('no play style can draw on Beijing more than twice', () => {
    for (let seed = 1; seed <= 300; seed++) {
      // Always take Beijing's money when it is on offer, otherwise pick at random.
      let t = seed * 40503;
      const next = () => { t = (t + 0x6d2b79f5) >>> 0; let x = Math.imul(t ^ (t >>> 15), t | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
      const s = play(seed, (v) => {
        if (v.kind === 'remonstrance') return 'correct';
        const help = available(v).find((c) => BEIJING_CHOICES.has(c.id));
        if (help) return help.id;
        const opts = available(v);
        return opts[Math.floor(next() * opts.length)].id;
      });
      const taken = s.history.filter((h) => BEIJING_CHOICES.has(h.choiceId)).length;
      expect(taken, `seed ${seed}`).toBeLessThanOrEqual(2);
      expect(s.flags.beijingAsks ?? 0).toBeLessThanOrEqual(2);
    }
  });

  it('once Beijing has helped twice, its help is locked with a reason', () => {
    let tested = 0;
    for (let seed = 1; seed <= 200 && tested < 3; seed++) {
      const s = play(seed, undefined, (st) => st.phase === 'event' && st.current?.kind === 'event' && st.current.eventId === 'cold-wave');
      if (s.phase === 'ended') continue;
      s.flags.beijingAsks = 2;
      const view = describe(s);
      const help = view.choices.find((c) => c.id === 'ask-outside');
      expect(help.locked).toBe(true);
      expect(help.lockedReason).toMatch(/already helped|remember/);
      tested++;
    }
    expect(tested).toBeGreaterThan(0);
  });
});

suite('a crisis with no move left', () => {
  it('locks options the Treasury cannot cover, with a reason', () => {
    const s = play(2, undefined, (st) => st.turn === 2 && st.phase === 'event');
    const broke = structuredClone(s);
    broke.meters.treasury = 0;
    const view = describe(broke);
    const locked = view.choices.filter((c) => c.locked);
    const costly = view.choices.filter((c) => c.cost.some((x) => x.startsWith('Treasury') && x.includes('−')));
    for (const c of costly) {
      expect(c.locked).toBe(true);
      expect(c.lockedReason).toMatch(/Treasury cannot cover/);
    }
    expect(locked.length).toBeGreaterThanOrEqual(costly.length);
    expect(() => choose(broke, costly[0]?.id ?? 'x')).toThrow();
  });

  it('Beijing relieves you if a scripted crisis leaves no option at all', () => {
    EVENTS['test-stall'] = {
      id: 'test-stall',
      title: 'An impossible choice',
      slot: 'anchor',
      window: [2, 2],
      text: () => 'Nothing can be done.',
      choices: [{ id: 'a', label: 'Do something', requires: { flag: 'never' }, outcomes: [{ effects: [] }] }],
    };
    try {
      const s = createGame(1);
      s.phase = 'result';
      s.current = { kind: 'event', eventId: 'x' };
      s.result = { title: '', text: '', deltas: {} };
      const next = proceed(s);
      expect(next.phase).toBe('result');
      expect(next.result.notice.title).toMatch(/relieved you of your post/);
      expect(next.flags.removed).toBe(true);
      const ended = proceed(next);
      expect(ended.status).toBe('ended');
      expect(ended.ending.career).toBe('dismissed');
      expect(buildDebrief(ended).political).toMatch(/no response left/);
    } finally {
      delete EVENTS['test-stall'];
    }
  });

  it('a random event that would leave you with no move is not drawn; the weekly review is', () => {
    let drawn = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const s = createGame(seed);
      s.turn = 8;
      s.phase = 'result';
      s.current = { kind: 'event', eventId: 'x' };
      s.result = { title: '', text: '', deltas: {} };
      s.meters.treasury = 0;
      s.flags = { ...s.flags, reliefOn: true };
      const next = proceed(s);
      if (next.flags.removed) continue;
      drawn++;
      expect(describe(next).choices.some((c) => !c.locked)).toBe(true);
    }
    expect(drawn).toBeGreaterThan(0);
  });
});

suite('pressure', () => {
  const WRONGS = ALL_WRONGS;
  const cleanFirst = (v) => (v.kind === 'remonstrance' ? 'correct' : available(v).find((c) => !WRONGS.has(c.id))?.id);

  it('avoiding every wrong still strains the Treasury', () => {
    let strained = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let s = createGame(seed);
      let low = s.meters.treasury;
      while (s.phase !== 'ended') {
        s = s.phase === 'result' ? proceed(s) : choose(s, orFallback(describe(s), cleanFirst(describe(s)) ?? available(describe(s))[0].id));
        low = Math.min(low, s.meters.treasury);
      }
      if (low < 20) strained++;
    }
    expect(strained / 200).toBeGreaterThan(0.9);
  });

  it('saving money by spending as little as possible is not a safe strategy', () => {
    const spend = (c) => {
      const t = c.cost.find((x) => x.startsWith('Treasury'));
      if (!t) return 0;
      const n = Number(t.replace(/[^\d]/g, ''));
      return t.includes('−') ? n : -n;
    };
    let failing = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = play(seed, (v) => {
        if (v.kind === 'remonstrance') return 'correct';
        const clean = available(v).filter((c) => !WRONGS.has(c.id));
        return (clean.length ? clean : available(v)).sort((a, b) => spend(a) - spend(b))[0].id;
      });
      if (s.ending.political !== 'office') failing++;
    }
    expect(failing / 200).toBeGreaterThan(0.3);
  });
});

suite('borrowing is never free', () => {
  // Total Treasury change of a choice's outcome, counting what it commits you to repay later.
  const netTreasury = (eventId, choiceId) => {
    const choice = EVENTS[eventId].choices.find((c) => c.id === choiceId);
    const effects = choice.outcomes[0].effects.flatMap((e) => (e.type === 'commitment' ? [e, ...e.effects] : [e]));
    return effects.filter((e) => e.type === 'meter' && e.key === 'treasury').reduce((sum, e) => sum + e.delta, 0);
  };

  it('bonds and loans cost more than they raise', () => {
    expect(netTreasury('budget-shortfall', 'special-bonds')).toBeLessThan(0);
    expect(netTreasury('budget-shortfall', 'ask-beijing-loan')).toBeLessThan(0);
  });

  it('appealing for outside support is a deferral, not a windfall over targeted relief', () => {
    expect(netTreasury('harvest-failure', 'appeal-outside')).toBeLessThanOrEqual(netTreasury('harvest-failure', 'targeted-relief'));
  });

  it('obligations still owed when the term ends are settled against the final accounts', () => {
    let s = play(1, (v) => available(v).find((c) => !ALL_WRONGS.has(c.id))?.id, (st) => currentEventId(st) === 'beijing-review');
    s.commitments.push({ id: 'late', label: 'A late repayment', dueTurn: 12, effects: [{ type: 'meter', key: 'treasury', delta: -30 }] });
    const before = s.meters.treasury;
    s = choose(s, available(describe(s))[0].id);
    s = proceed(s);
    expect(s.status).toBe('ended');
    expect(s.settled).toContain('A late repayment');
    expect(s.meters.treasury).toBeLessThan(before);
  });
});

suite('the longer term and its consequences', () => {
  const clean = (v) => (v.kind === 'remonstrance' ? 'correct' : available(v).find((c) => !ALL_WRONGS.has(c.id))?.id);

  it('the game runs 14 turns', () => {
    expect(createGame(1).maxTurns).toBe(14);
  });

  it('the autumn reserve decision changes the spring planting options', () => {
    const spent = play(7, (v, st) => (st.turn === 1 ? 'open-reserve' : clean(v)), (st) => currentEventId(st) === 'seed-grain');
    expect(describe(spent).choices.map((c) => c.id)).toContain('buy-seed');
    const kept = play(7, (v, st) => (st.turn === 1 ? 'targeted-relief' : clean(v)), (st) => currentEventId(st) === 'seed-grain');
    expect(describe(kept).choices.map((c) => c.id)).toContain('free-seed');
  });

  it('diverting clinic budgets in the winter leads to an outbreak in spring', () => {
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = play(seed, (v, st) => (v.kind !== 'remonstrance' && available(v).some((c) => c.id === 'divert-budgets') ? 'divert-budgets' : clean(v)));
      if (s.flags.clinicsDiverted !== undefined && s.history.some((h) => h.choiceId === 'divert-budgets') && s.seenEvents.includes('the-outbreak')) seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('every winter has a toll that early decisions change', () => {
    // Same seed, same weather: only the state of the unreached villages differs.
    const toll = (flags) => {
      const s = createGame(3);
      s.turn = 6;
      s.phase = 'result';
      s.current = { kind: 'event', eventId: 'x' };
      s.result = { title: '', text: '', deltas: {} };
      s.flags = { ...s.flags, ...flags };
      const next = proceed(s);
      expect(next.current.eventId).toBe('cold-wave');
      return next.flags.winterLoss;
    };
    expect(toll({ uncovered: 7 })).toBe(toll({ uncovered: 0 }) + 3);
    expect(toll({ rationsCut: true })).toBeGreaterThan(toll({}));
    expect(toll({ chainAudited: true })).toBeLessThanOrEqual(toll({}));
  });

  // A state one turn before the final inspection, with the given charge already open.
  const beforeReview = (seed, charge) => {
    const s = createGame(seed);
    s.turn = 13;
    s.phase = 'result';
    s.current = { kind: 'event', eventId: 'x' };
    s.result = { title: '', text: '', deltas: {} };
    s.facts.push('casualtiesKnown');
    if (charge) s.charges.push({ id: charge, turnOpened: 14, status: 'open', raised: false, suppressed: false, outcomeDependentDefence: false });
    return s;
  };

  it('a hidden understated casualty count is exposed in some cases and not in others', () => {
    let removed = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const s = proceed(beforeReview(seed, 'concealedLosses'));
      if (s.flags.removed) {
        removed++;
        expect(s.flags.exposed).toBe(true);
      }
    }
    expect(removed / 300).toBeGreaterThan(0.25);
    expect(removed / 300).toBeLessThan(0.55);
  });

  const finishWith = (meters, flags = {}) => {
    let s = proceed(beforeReview(5));
    expect(s.flags.removed).toBeFalsy();
    s = choose(s, available(describe(s))[0].id);
    s.meters = { ...s.meters, ...meters };
    s.flags = { ...s.flags, ...flags };
    return proceed(s);
  };

  it('ending far in debt means demotion', () => {
    expect(finishWith({ treasury: -30, welfare: 70, capacity: 60 }).ending.career).toBe('demoted');
  });

  it('missing payments while in debt means demotion even when the debt is small', () => {
    expect(finishWith({ treasury: -4, welfare: 70, capacity: 60 }, { defaulted: true }).ending.career).toBe('demoted');
  });

  it('a small debt or a failing province means being sidelined', () => {
    expect(finishWith({ treasury: -4, welfare: 70, capacity: 60 }).ending.career).toBe('sidelined');
    expect(finishWith({ treasury: 20, welfare: 30, capacity: 60 }).ending.career).toBe('sidelined');
  });

  it('a bailout from Beijing is remembered', () => {
    expect(finishWith({ treasury: 20, welfare: 70, capacity: 60 }, { bailedOut: true }).ending.career).toBe('sidelined');
  });

  it('a healthy province with no debt is retained or promoted', () => {
    expect(['retained', 'promoted']).toContain(finishWith({ treasury: 20, welfare: 70, capacity: 60 }).ending.career);
  });
});

suite('full-run simulation', () => {
  const runs = Array.from({ length: 600 }, (_, i) => i + 1);
  const seenEvents = new Set();
  const endings = new Set();

  it('random play never breaks and always ends', () => {
    for (const seed of runs) {
      // A small generator of its own, so the policy is genuinely random and independent of the game's seed.
      let t = seed * 2654435761;
      const next = () => {
        t = (t + 0x6d2b79f5) >>> 0;
        let x = Math.imul(t ^ (t >>> 15), t | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
      };
      const s = play(seed, (v) => {
        const opts = available(v);
        return opts[Math.floor(next() * opts.length)].id;
      });
      expect(s.status).toBe('ended');
      for (const h of s.history) if (h.kind === 'event') seenEvents.add(h.eventId);
      endings.add(`${s.ending.career}/${s.ending.ethical}`);
      const d = buildDebrief(s);
      expect(d.summary).toBeTruthy();
    }
  });

  it('every event is reachable and several endings occur', () => {
    for (const id of Object.keys(EVENTS)) expect(seenEvents, `event never seen: ${id}`).toContain(id);
    expect(endings.size).toBeGreaterThanOrEqual(3);
  });
});

suite('content', () => {
  it('every fact a charge requires is revealed by some event', () => {
    const revealed = new Set(Object.values(EVENTS).flatMap((e) => e.reveals ?? []));
    for (const c of Object.values(CHARGES)) if (c.requiresFact) expect(revealed).toContain(c.requiresFact);
  });

  it('every fact has a player-facing description', () => {
    const revealed = new Set(Object.values(EVENTS).flatMap((e) => e.reveals ?? []));
    for (const f of revealed) expect(FACTS[f], `no description for fact ${f}`).toBeTruthy();
  });

  it('every charge has a source with a status', () => {
    for (const c of Object.values(CHARGES)) expect(['direct', 'inference', 'adaptation']).toContain(c.source.status);
  });

  it('every charge has a tailored defence label and specific Lin response', () => {
    for (const c of Object.values(CHARGES)) {
      expect(c.defendLabel, `missing defendLabel on ${c.id}`).toBeTruthy();
      expect(c.defence, `missing defence object on ${c.id}`).toBeTruthy();
      if (c.kind !== 'concern') {
        expect(c.defence.rejectText, `missing rejectText on ${c.id}`).toBeTruthy();
      }
    }
  });

  it('defending a charge once leaves it open without repeating the same remonstrance every turn', () => {
    let s = play(5, (v, st) => (st.turn === 1 ? 'hold-reserve' : undefined), (st) => st.turn === 2);
    expect(s.current.kind).toBe('remonstrance');
    expect(s.current.chargeId).toBe('failedTrust');
    const capBefore = s.meters.capacity;
    s = choose(s, 'defend');
    expect(s.charges.find((c) => c.id === 'failedTrust').status).toBe('open');
    expect(s.remonstrances).toBe(1);
    expect(s.meters.capacity).toBeLessThan(capBefore);
    // Advance to next turn: failedTrust should not be raised a second time.
    s = proceed(s);
    s = choose(s, available(describe(s))[0].id);
    s = proceed(s);
    if (s.current?.kind === 'remonstrance') {
      expect(s.current.chargeId).not.toBe('failedTrust');
    }
  });

  it('the two verdicts can disagree in both directions: promoted/compromised and sidelined/clear both occur', () => {
    let promotedCompromised = 0;
    let sidelinedClear = 0;
    const pragmatist = (view, s) => {
      const opts = available(view);
      const has = (id) => opts.some((c) => c.id === id);
      if (view.kind === 'remonstrance') {
        if (s.current.chargeId === 'fiscalConcern') return s.meters.treasury < 12 ? 'correct' : 'defend';
        return s.remonstrances < 2 ? 'defend' : 'correct';
      }
      if (s.turn === 1 && has('targeted-relief')) return 'targeted-relief';
      if (s.flags.uncovered > 0) {
        for (const id of ['delegate-extend', 'suspend-and-extend', 'extend-all']) if (has(id)) return id;
      }
      for (const id of [
        'award-kin', 'fund-park', 'stage-visit', 'collect-full', 'draw-reserve', 'flood-reserve',
        'free-seed', 'sell-seed', 'evacuate', 'emergency-aid', 'rebuild-homes', 'subsidised-loans',
        'price-ceiling', 'send-inspectors', 'defer-affected', 'special-bonds', 'cut-rations',
        'strengthen-admin', 'visit-counties',
      ]) {
        if (id === 'collect-full' && s.meters.welfare < 50) continue;
        if (id === 'stage-visit' && s.meters.welfare < 48) continue;
        if (id === 'cut-rations' && s.meters.welfare < 52) continue;
        if (id === 'fund-park' && s.meters.welfare < 48) continue;
        if (has(id)) return id;
      }
      return opts[0].id;
    };
    const clean = (view) => {
      if (view.kind === 'remonstrance') return 'correct';
      const opts = available(view);
      return (opts.find((c) => !ALL_WRONGS.has(c.id)) ?? opts[0]).id;
    };
    for (let seed = 1; seed <= 120; seed++) {
      const p = play(seed, pragmatist);
      if (p.ending.career === 'promoted' && p.ending.ethical === 'compromised') promotedCompromised++;
      const c = play(seed, clean);
      if (c.ending.career === 'sidelined' && c.ending.ethical === 'clear') sidelinedClear++;
    }
    expect(promotedCompromised).toBeGreaterThan(5);
    expect(sidelinedClear).toBeGreaterThan(20);
  });

  it('inspection choices always show closing text rather than a blank screen', () => {
    const s = createGame(3);
    s.turn = 14;
    s.flags.verdict = 'commended';
    for (const c of EVENTS['beijing-review'].choices(s)) {
      for (const o of c.outcomes) expect(o.text.trim().length).toBeGreaterThan(0);
    }
    s.flags.interimVerdict = 'warning';
    for (const c of EVENTS['interim-inspection'].choices(s)) {
      for (const o of c.outcomes) expect(o.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('every scheduled event and opened charge exists', () => {
    for (const ev of Object.values(EVENTS)) {
      const choices = typeof ev.choices === 'function' ? ev.choices(createGame(1)) : ev.choices;
      const json = JSON.stringify(choices);
      for (const [, id] of json.matchAll(/"eventId":"([^"]+)"/g)) expect(EVENTS[id], `missing event ${id}`).toBeTruthy();
      for (const c of choices) {
        for (const rule of c.charges ?? []) expect(CHARGES[rule.id], `missing charge ${rule.id}`).toBeTruthy();
      }
      for (const [, id] of json.matchAll(/"type":"(?:openCharge|repairCharge)","id":"([^"]+)"/g)) {
        expect(CHARGES[id], `missing charge ${id}`).toBeTruthy();
      }
    }
  });
});
