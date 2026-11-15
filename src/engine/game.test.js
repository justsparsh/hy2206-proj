import { describe as suite, it, expect } from 'vitest';
import { createGame, describe, choose, proceed } from './game.js';
import { evaluate } from './conditions.js';
import { buildDebrief } from './debrief.js';
import { EVENTS, CHARGES, FACTS } from '../content/index.js';

const available = (view) => view.choices.filter((c) => !c.locked);

// Every choice that knowingly opens a charge. A player who knows all of these still has to find another way.
const ALL_WRONGS = new Set([
  'hold-reserve', 'punish', 'visit-hongyan', 'say-nothing', 'award-kin', 'let-it-run', 'cut-rations', 'divert-budgets',
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
    const id = policy(view, s) ?? available(view)[0].id;
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

  it('a run that avoids every wrong ends ethically clear', () => {
    const wrongs = ALL_WRONGS;
    for (let seed = 1; seed <= 150; seed++) {
      const s = play(seed, (v) => available(v).find((c) => !wrongs.has(c.id))?.id);
      expect(s.ending.ethical).toBe('clear');
    }
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

  it('a concern is not a wrong: the defence is accepted only while people still need relief', () => {
    let tested = 0;
    for (let seed = 1; seed <= 100 && tested < 5; seed++) {
      const s = play(seed, (v) => (v.kind === 'remonstrance' ? 'correct' : available(v).find((c) => !ALL_WRONGS.has(c.id))?.id), (st) => st.current?.kind === 'remonstrance');
      if (s.phase === 'ended' || s.current.chargeId !== 'fiscalConcern') continue;

      const needy = structuredClone(s);
      needy.meters.welfare = 50;
      const accepted = choose(needy, 'defend');
      expect(accepted.charges.find((c) => c.id === 'fiscalConcern').status).toBe('defended');
      expect(accepted.remonstrances).toBe(0);

      const fine = structuredClone(s);
      fine.meters.welfare = 80;
      fine.flags.uncovered = 0;
      const rejected = choose(fine, 'defend');
      expect(rejected.charges.find((c) => c.id === 'fiscalConcern').status).toBe('open');
      expect(rejected.remonstrances).toBe(1);
      tested++;
    }
    expect(tested).toBeGreaterThan(0);
  });

  it('Lin raises a charge on the turn after it opens', () => {
    const s = play(5, (v, st) => (st.turn === 1 ? 'hold-reserve' : undefined), (st) => st.turn === 2);
    expect(s.current.kind).toBe('remonstrance');
    expect(s.current.chargeId).toBe('failedTrust');
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

suite('pressure', () => {
  const WRONGS = ALL_WRONGS;
  const cleanFirst = (v) => (v.kind === 'remonstrance' ? 'correct' : available(v).find((c) => !WRONGS.has(c.id))?.id);

  it('avoiding every wrong still strains the Treasury', () => {
    let strained = 0;
    for (let seed = 1; seed <= 200; seed++) {
      let s = createGame(seed);
      let low = s.meters.treasury;
      while (s.phase !== 'ended') {
        s = s.phase === 'result' ? proceed(s) : choose(s, cleanFirst(describe(s)) ?? available(describe(s))[0].id);
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

suite('full-run simulation', () => {
  const runs = Array.from({ length: 600 }, (_, i) => i + 1);
  const seenEvents = new Set();
  const endings = new Set();

  it('random play never breaks and always ends', () => {
    for (const seed of runs) {
      const s = play(seed, (v) => {
        const opts = available(v);
        return opts[Math.floor((seed * 31 + v.title.length * 7 + opts.length) % opts.length)].id;
      });
      expect(s.status).toBe('ended');
      for (const h of s.history) if (h.kind === 'event') seenEvents.add(h.eventId);
      endings.add(`${s.ending.political}/${s.ending.ethical}`);
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

  it('every scheduled event and opened charge exists', () => {
    for (const ev of Object.values(EVENTS)) {
      const json = JSON.stringify(typeof ev.choices === 'function' ? [] : ev.choices);
      for (const [, id] of json.matchAll(/"eventId":"([^"]+)"/g)) expect(EVENTS[id], `missing event ${id}`).toBeTruthy();
      for (const [, id] of json.matchAll(/"id":"(entrapment|failedTrust|notExtended|favouredKin|silencedRemonstrance)"/g)) {
        expect(CHARGES[id]).toBeTruthy();
      }
    }
  });
});
