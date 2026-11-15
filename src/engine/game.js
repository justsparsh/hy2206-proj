import { evaluate } from './conditions.js';
import { applyEffect, applyEffects, openCharge, repairCharge } from './effects.js';
import { rand, pickWeighted } from './rng.js';
import { EVENTS, CHARGES } from '../content/index.js';

export const MAX_TURNS = 8;
const RESIGN_AT = 3;

export function createGame(seed = Math.floor(Math.random() * 1e9)) {
  const d = {
    seed,
    rngState: seed >>> 0,
    turn: 1,
    maxTurns: MAX_TURNS,
    meters: { treasury: 60, welfare: 60, capacity: 50 },
    flags: {},
    facts: [],
    commitments: [],
    settled: [],
    charges: [],
    remonstrances: 0,
    ministerPresent: true,
    scheduled: [],
    delayed: [],
    seenEvents: [],
    doneGroups: [],
    history: [],
    status: 'playing',
    phase: 'event',
    current: null,
    result: null,
    turnNotes: [],
    remonstratedThisTurn: false,
    ending: null,
  };
  startTurn(d);
  return d;
}

const asList = (v, s) => (typeof v === 'function' ? v(s) : v ?? []);

function startTurn(d) {
  d.remonstratedThisTurn = false;
  d.turnNotes = [];

  const dueDelayed = d.delayed.filter((x) => x.dueTurn <= d.turn);
  d.delayed = d.delayed.filter((x) => x.dueTurn > d.turn);
  for (const x of dueDelayed) {
    applyEffects(d, x.effects);
    if (x.text) d.turnNotes.push(x.text);
  }

  const dueCommitments = d.commitments.filter((c) => c.dueTurn <= d.turn);
  d.commitments = d.commitments.filter((c) => c.dueTurn > d.turn);
  for (const c of dueCommitments) {
    const failed = c.failIf ? evaluate(c.failIf, d) : false;
    applyEffects(d, failed ? c.failEffects : c.effects);
    d.turnNotes.push(failed ? c.failText : c.text);
  }

  // Winter closes in, and relief operations cost money every turn.
  if (d.turn > 1) {
    applyEffect(d, { type: 'meter', key: 'welfare', delta: -2 });
    d.turnNotes.push('Winter closes in. Every week without improvement costs the province.');
  }
  if (d.flags.reliefOn) {
    const upkeep = d.flags.reliefScaled ? 2 : 4;
    applyEffect(d, { type: 'meter', key: 'treasury', delta: -upkeep });
    d.turnNotes.push('Relief operations cost money every week: trucks, staff, storage.');
  }

  if (d.meters.treasury < 0) {
    applyEffects(d, [
      { type: 'meter', key: 'welfare', delta: -3 },
      { type: 'meter', key: 'capacity', delta: -2 },
    ]);
    d.turnNotes.push('You are borrowing to keep services running, and the cuts are showing.');
  }

  // Hunger deepens in villages the relief has not reached.
  if (d.turn > 1 && d.flags.uncovered > 0) {
    const loss = Math.ceil(d.flags.uncovered / 5);
    applyEffect(d, { type: 'meter', key: 'welfare', delta: -loss });
    d.turnNotes.push('Hunger deepens in the villages the relief has not reached.');
  }

  // Some charges open by themselves when neglect has gone on long enough.
  for (const def of Object.values(CHARGES)) {
    if (def.trigger && evaluate(def.trigger, d) && openCharge(d, def.id)) {
      d.charges[d.charges.length - 1].turnOpened = d.turn - 1;
    }
  }

  const pending = pendingRemonstrance(d);
  if (pending) {
    pending.raised = true;
    d.current = { kind: 'remonstrance', chargeId: pending.id };
    d.phase = 'event';
    return;
  }
  drawRegular(d);
}

function pendingRemonstrance(d) {
  if (!d.ministerPresent || d.remonstratedThisTurn) return null;
  return d.charges.find((c) => c.status === 'open' && c.turnOpened < d.turn) ?? null;
}

function inWindow(ev, turn) {
  return !ev.window || (turn >= ev.window[0] && turn <= ev.window[1]);
}

function eligible(ev, d) {
  if (ev.group && d.doneGroups.includes(ev.group)) return false;
  if (ev.slot !== 'fallback' && d.seenEvents.includes(ev.id)) return false;
  return inWindow(ev, d.turn) && evaluate(ev.when, d);
}

function pickEvent(d) {
  const all = Object.values(EVENTS);

  // An anchor on the last turn of its window must run, even if a scheduled event is also due.
  const overdue = all.find((e) => e.slot === 'anchor' && e.window[1] === d.turn && eligible(e, d));
  if (overdue) return overdue;

  while (d.scheduled.some((s) => s.dueTurn <= d.turn)) {
    const idx = d.scheduled.findIndex((s) => s.dueTurn <= d.turn);
    const [{ eventId }] = d.scheduled.splice(idx, 1);
    const ev = EVENTS[eventId];
    if (ev && !d.seenEvents.includes(ev.id) && evaluate(ev.when, d)) return ev;
  }

  const anchors = all
    .filter((e) => e.slot === 'anchor' && eligible(e, d))
    .sort((a, b) => a.window[1] - b.window[1]);
  for (const ev of anchors) {
    if (d.turn === ev.window[1] || rand(d) < 0.5) return ev;
  }

  const pool = all.filter((e) => e.slot === 'pool' && eligible(e, d));
  if (pool.length) return pickWeighted(d, pool, (e) => e.weight ?? 1);

  const fallback = all.filter((e) => e.slot === 'fallback');
  return pickWeighted(d, fallback, () => 1);
}

function drawRegular(d) {
  const ev = pickEvent(d);
  d.seenEvents.push(ev.id);
  if (ev.group) d.doneGroups.push(ev.group);
  for (const f of ev.reveals ?? []) applyEffect(d, { type: 'fact', key: f });
  const setup = typeof ev.setup === 'function' ? ev.setup(d, () => rand(d)) : ev.setup ?? [];
  applyEffects(d, setup);
  d.current = { kind: 'event', eventId: ev.id };
  d.phase = 'event';
}

function resolveChoices(ev, d) {
  return typeof ev.choices === 'function' ? ev.choices(d) : ev.choices;
}

function chanceOf(o, d) {
  return typeof o.chance === 'function' ? o.chance(d) : o.chance;
}

function eligibleOutcomes(choice, d) {
  return choice.outcomes.filter((o) => evaluate(o.when, d));
}

function pickOutcome(choice, d) {
  const list = eligibleOutcomes(choice, d);
  if (list.length === 1) return list[0];
  const fixed = list.reduce((sum, o) => sum + (chanceOf(o, d) ?? 0), 0);
  let r = rand(d);
  for (const o of list) {
    const c = chanceOf(o, d) ?? Math.max(0, 1 - fixed);
    if (r < c) return o;
    r -= c;
  }
  return list[list.length - 1];
}

function costOf(effects) {
  const parts = [];
  for (const key of ['treasury', 'capacity']) {
    const total = effects.filter((e) => e.type === 'meter' && e.key === key).reduce((s, e) => s + e.delta, 0);
    if (total !== 0) parts.push(`${key[0].toUpperCase()}${key.slice(1)} ${total > 0 ? '+' : '−'}${Math.abs(total)}`);
  }
  return parts;
}

function likeliestOutcome(choice, d) {
  const list = eligibleOutcomes(choice, d);
  const fixed = list.reduce((sum, o) => sum + (chanceOf(o, d) ?? 0), 0);
  return list.reduce((best, o) => {
    const c = chanceOf(o, d) ?? Math.max(0, 1 - fixed);
    return c > best.c ? { o, c } : best;
  }, { o: list[0], c: -1 }).o;
}

// Everything the UI needs to render the current screen.
export function describe(state) {
  const d = state;
  if (d.phase === 'ended') return { kind: 'ended' };
  if (d.phase === 'result') return { kind: 'result', result: d.result };

  if (d.current.kind === 'remonstrance') {
    const charge = d.charges.find((c) => c.id === d.current.chargeId);
    const def = CHARGES[charge.id];
    const escalation =
      d.remonstrances >= 2
        ? '\n\nHe adds, quietly: “If this continues, Governor, I will not be able to stay.”'
        : '';
    const concern = def.kind === 'concern';
    return {
      kind: 'remonstrance',
      title: concern ? 'Vice-Governor Lin raises a concern' : 'Vice-Governor Lin raises a matter',
      paragraphs: [`“${def.linLine}”${escalation}`],
      choices: [
        { id: 'correct', label: def.correctLabel, cost: costOf(def.correct.effects) },
        { id: 'defend', label: def.defendLabel ?? 'Defend the decision', cost: [] },
        { id: 'suppress', label: def.suppressLabel ?? 'Tell him the matter is closed', cost: [] },
      ],
      notes: d.turnNotes,
    };
  }

  const ev = EVENTS[d.current.eventId];
  const choices = resolveChoices(ev, d).map((c) => {
    const locked = !evaluate(c.requires, d);
    const outcome = likeliestOutcome(c, d);
    const eff = asList(outcome.effects, d);
    const risk = typeof c.risk === 'function' ? c.risk(d) : c.risk;
    return {
      id: c.id,
      label: typeof c.label === 'function' ? c.label(d) : c.label,
      cost: costOf(eff),
      risk: d.ministerPresent ? risk : risk ? 'No briefing is available on the risks.' : undefined,
      locked,
      lockedReason: locked ? c.lockedReason : undefined,
    };
  });
  return {
    kind: 'event',
    title: ev.title,
    paragraphs: ev.text(d).split('\n\n'),
    briefing: d.ministerPresent && ev.briefing ? ev.briefing(d) : null,
    choices,
    notes: d.turnNotes,
  };
}

function snapshotMeters(d) {
  return { ...d.meters };
}

function deltas(before, after) {
  const out = {};
  for (const k of Object.keys(before)) if (after[k] !== before[k]) out[k] = after[k] - before[k];
  return out;
}

export function choose(state, choiceId) {
  const d = structuredClone(state);
  if (d.phase !== 'event') throw new Error('No decision is pending');
  if (d.current.kind === 'remonstrance') return respond(d, choiceId);

  const ev = EVENTS[d.current.eventId];
  const choice = resolveChoices(ev, d).find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Unknown choice: ${choiceId}`);
  if (!evaluate(choice.requires, d)) throw new Error(`Choice unavailable: ${choiceId}`);

  const before = snapshotMeters(d);
  const note = choice.note ? choice.note(d) : null;
  const opened = [];
  for (const rule of choice.charges ?? []) {
    if (evaluate(rule.when, d) && openCharge(d, rule.id)) opened.push(rule.id);
  }

  const outcome = pickOutcome(choice, d);
  applyEffects(d, asList(outcome.effects, d));

  d.history.push({
    turn: d.turn,
    kind: 'event',
    eventId: ev.id,
    title: ev.title,
    choiceId,
    choiceLabel: typeof choice.label === 'function' ? choice.label(d) : choice.label,
    outcomeText: outcome.text,
    opened,
    note,
  });
  d.result = { title: ev.title, text: outcome.text, deltas: deltas(before, d.meters), kind: 'event' };
  d.phase = 'result';
  return d;
}

function respond(d, choiceId) {
  const charge = d.charges.find((c) => c.id === d.current.chargeId && c.status === 'open');
  const def = CHARGES[charge.id];
  const before = snapshotMeters(d);
  d.remonstratedThisTurn = true;
  let text;
  let valid = null;

  if (choiceId === 'correct') {
    repairCharge(d, charge.id, 'corrected');
    text = def.correct.text;
  } else if (choiceId === 'defend') {
    valid = Boolean(def.defence) && evaluate(def.defence.when, d);
    if (valid) {
      charge.status = 'defended';
      charge.outcomeDependentDefence = def.defence.outcomeDependent;
      text = def.defence.acceptText;
    } else {
      d.remonstrances += 1;
      text = def.defence?.rejectText ?? 'Lin hears you out. “I hear the argument, Governor, and I do not accept it.”';
    }
  } else if (choiceId === 'suppress') {
    charge.suppressed = true;
    openCharge(d, 'silencedRemonstrance');
    d.remonstrances += 1;
    text = 'Lin closes his folder. “As you wish, Governor.” He does not look as if he agrees.';
  } else {
    throw new Error(`Unknown response: ${choiceId}`);
  }

  if (d.remonstrances >= RESIGN_AT && d.ministerPresent) {
    d.ministerPresent = false;
    d.flags.inspectionPending = true;
    text +=
      '\n\nA few days later, Vice-Governor Lin Wei submits his resignation. He gives no public reason, and he does not need to: Beijing has already been informed, and an inspection group is expected.';
  }

  d.history.push({
    turn: d.turn,
    kind: 'remonstrance',
    chargeId: charge.id,
    title: 'Lin raises a matter',
    choiceId,
    choiceLabel: choiceId,
    outcomeText: text,
    valid,
    opened: [],
  });
  d.result = { title: 'Vice-Governor Lin', text, deltas: deltas(before, d.meters), kind: 'remonstrance' };
  d.phase = 'result';
  return d;
}

export function proceed(state) {
  const d = structuredClone(state);
  if (d.phase !== 'result') throw new Error('Nothing to continue from');
  d.result = null;
  if (d.flags.removed) return finish(d);

  if (d.current.kind === 'remonstrance') {
    d.current = null;
    drawRegular(d);
    return d;
  }
  d.turn += 1;
  if (d.turn > d.maxTurns) return finish(d);
  startTurn(d);
  return d;
}

function finish(d) {
  // Anything still owed when the term ends is settled against the final accounts.
  d.settled = d.commitments.map((c) => c.label);
  for (const c of d.commitments) applyEffects(d, c.effects);
  d.commitments = [];

  const open = d.charges.filter((c) => c.status === 'open' && CHARGES[c.id].kind !== 'concern');
  const political = d.flags.removed
    ? 'removed'
    : d.meters.welfare <= 45 || d.meters.capacity <= 15
      ? 'failing'
      : 'office';
  d.ending = { political, ethical: open.length ? 'compromised' : 'clear' };
  d.status = 'ended';
  d.phase = 'ended';
  d.current = null;
  return d;
}
