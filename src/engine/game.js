import { evaluate } from './conditions.js';
import { applyEffect, applyEffects, openCharge, repairCharge } from './effects.js';
import { rand, pickWeighted } from './rng.js';
import { EVENTS, CHARGES } from '../content/index.js';

import {
  WINTER_START_TURN, WINTER_END_TURN, springRevenue, RELIEF_UPKEEP, RELIEF_UPKEEP_SCALED, RELIEF_SCALED_WELFARE_COST,
} from '../content/helpers.js';

export const MAX_TURNS = 14;
const WINTER_END = WINTER_END_TURN;
const SPRING_RECOVERY = 2;
const RESIGN_AT = 3;
const UNREST_AT = 30;
const SEVERE_UNREST_AT = 20;
const COLLAPSE_AT = 10;

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

  // Winter closes in, and relief operations cost money every turn. Both ease when winter ends.
  const winter = d.turn >= WINTER_START_TURN && d.turn <= WINTER_END;
  if (winter) {
    applyEffect(d, { type: 'meter', key: 'welfare', delta: -2 });
    d.turnNotes.push('Winter closes in. Every week without improvement costs the province.');
  }
  if (winter && d.flags.reliefOn) {
    const upkeep = d.flags.reliefScaled ? RELIEF_UPKEEP_SCALED : RELIEF_UPKEEP;
    applyEffect(d, { type: 'meter', key: 'treasury', delta: -upkeep });
    d.turnNotes.push('Relief operations cost money every week: trucks, staff, storage.');
    if (d.flags.reliefScaled) {
      // The saving is real, and so is what it takes away.
      applyEffect(d, { type: 'meter', key: 'welfare', delta: -RELIEF_SCALED_WELFARE_COST });
      d.turnNotes.push('Smaller rations mean smaller meals. Families in the covered villages feel it every week.');
    }
  }
  if (d.turn > WINTER_END && d.turn < d.maxTurns) {
    applyEffect(d, { type: 'meter', key: 'treasury', delta: springRevenue(d) });
    applyEffect(d, { type: 'meter', key: 'capacity', delta: SPRING_RECOVERY });
    d.turnNotes.push('Spring revenue begins to come back in, and the administration starts to recover.');
    if (!(d.flags.uncovered > 0)) applyEffect(d, { type: 'meter', key: 'welfare', delta: 1 });
  }

  if (d.meters.treasury < 0) {
    applyEffects(d, [
      { type: 'meter', key: 'welfare', delta: -3 },
      { type: 'meter', key: 'capacity', delta: -2 },
    ]);
    d.turnNotes.push('You are borrowing to keep services running, and the cuts are showing.');
  }

  // If you were warned the money would run out, kept spending, and it did, the finance bureau reports it.
  if (d.flags.budgetWarningIgnored && !d.flags.warningCalledIn && d.meters.treasury < 0) {
    d.flags.warningCalledIn = true;
    applyEffects(d, [
      { type: 'meter', key: 'capacity', delta: -3 },
      { type: 'flagAdd', key: 'beijingConcerns', delta: 1 },
    ]);
    d.turnNotes.push('The Treasury has run dry, as Lin warned it would. The provincial finance bureau reports the shortfall to Beijing. Lin does not say “I told you so”; the figures do.');
  }

  // Hunger deepens in villages the relief has not reached.
  if (d.turn > 1 && d.flags.uncovered > 0) {
    const loss = Math.ceil(d.flags.uncovered / 5);
    applyEffect(d, { type: 'meter', key: 'welfare', delta: -loss });
    d.turnNotes.push('Hunger deepens in the villages the relief has not reached.');
  }

  // Low welfare is not a score: it breaks the province, in stages.
  if (d.meters.welfare <= COLLAPSE_AT) {
    collapse(d);
    return;
  }
  if (d.meters.welfare < SEVERE_UNREST_AT) {
    applyEffects(d, [
      { type: 'meter', key: 'capacity', delta: -3 },
      { type: 'meter', key: 'treasury', delta: -3 },
    ]);
    d.turnNotes.push('The province is in open unrest. Strikes and protests are cutting revenue, and the administration is struggling to function.');
  } else if (d.meters.welfare < UNREST_AT) {
    applyEffect(d, { type: 'meter', key: 'capacity', delta: -2 });
    d.turnNotes.push('Unrest is spreading. Officials are spending their weeks keeping order instead of governing.');
  }

  // Some charges open by themselves when neglect has gone on long enough. Each fires at most once.
  for (const def of Object.values(CHARGES)) {
    if (def.trigger && !d.charges.some((c) => c.id === def.id) && evaluate(def.trigger, d) && openCharge(d, def.id)) {
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
  // Lin raises each open matter once. A matter you defended or told him was closed is not repeated every week;
  // it remains on the record, and closing a matter opens a separate charge about the silencing itself.
  return d.charges.find((c) => c.status === 'open' && !c.suppressed && !c.raised && c.turnOpened < d.turn) ?? null;
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

  const pool = all.filter((e) => e.slot === 'pool' && eligible(e, d) && hasOption(e, d));
  if (pool.length) return pickWeighted(d, pool, (e) => e.weight ?? 1);

  const fallback = all.filter((e) => e.slot === 'fallback');
  return pickWeighted(d, fallback, () => 1);
}

// A province in which people are starving in the streets ends the career of the governor who let it happen.
function collapse(d) {
  d.flags.removed = true;
  d.flags.collapsed = true;
  const text = 'The province has broken down. Protests have turned into riots in several counties, and the provincial government can no longer keep order or deliver relief.';
  d.history.push({
    turn: d.turn,
    kind: 'event',
    eventId: 'collapse',
    title: 'The province breaks down',
    choiceId: 'none',
    choiceLabel: 'Beijing intervened',
    outcomeText: text,
    opened: [],
    note: null,
  });
  d.result = {
    title: 'Beijing relieves you of your post',
    text,
    deltas: {},
    kind: 'dismissal',
    notice: {
      title: 'Beijing has relieved you of your post',
      paragraphs: [
        'The province has broken down. People are starving, protests have become riots in several counties, and the provincial government can no longer keep order.',
        'Beijing sends in a working group at once. You are removed from office, and your conduct is referred for review.',
      ],
    },
  };
  d.phase = 'result';
}

// A crisis that leaves the player with no move they can afford or are allowed to make ends the career.
function dismissForNoOptions(d, ev) {
  d.flags.removed = true;
  d.flags.insolvent = true;
  const text = `You face “${ev.title}”, and there is nothing left that you can do about it. Every response needs money or standing that the province no longer has.`;
  d.history.push({
    turn: d.turn,
    kind: 'event',
    eventId: ev.id,
    title: ev.title,
    choiceId: 'none',
    choiceLabel: 'No option was left to you',
    outcomeText: text,
    opened: [],
    note: null,
  });
  d.current = { kind: 'event', eventId: ev.id };
  d.result = {
    title: 'Beijing relieves you of your post',
    text,
    deltas: {},
    kind: 'dismissal',
    notice: {
      title: 'Beijing has relieved you of your post',
      paragraphs: [
        `“${ev.title}” has arrived, and you have no response left to give it. The Treasury is empty or the province’s standing is gone, and every option on your desk is closed to you.`,
        'Beijing does not wait for a governor who cannot act. A successor is named within the week, and your conduct is referred for review.',
      ],
    },
  };
  d.phase = 'result';
}

function drawRegular(d) {
  const ev = pickEvent(d);
  d.seenEvents.push(ev.id);
  if (ev.group) d.doneGroups.push(ev.group);
  for (const f of ev.reveals ?? []) applyEffect(d, { type: 'fact', key: f });
  const setup = typeof ev.setup === 'function' ? ev.setup(d, () => rand(d)) : ev.setup ?? [];
  applyEffects(d, setup);
  if (!hasOption(ev, d)) {
    dismissForNoOptions(d, ev);
    return;
  }
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

// What a set of effects does to the Treasury right now. Repayments due later are not counted.
function treasuryChange(effects, d) {
  let total = 0;
  for (const e of effects) {
    if (e.type === 'meter' && e.key === 'treasury') total += e.delta;
    else if (e.type === 'repairCharge' && d.charges.some((c) => c.id === e.id && c.status === 'open')) {
      total += treasuryChange(CHARGES[e.id].correct.effects, d);
    }
  }
  return total;
}

const cannotCover = (d, change) => `The Treasury cannot cover this: it needs ${-change}, and you have ${d.meters.treasury}.`;

// The state of every choice in an event: whether its requirements are met and whether the Treasury can pay for it.
function choiceStates(ev, d) {
  return resolveChoices(ev, d).map((choice) => {
    const allowed = Boolean(evaluate(choice.requires, d));
    const eff = asList(likeliestOutcome(choice, d).effects, d);
    const change = treasuryChange(eff, d);
    return { choice, eff, allowed, change, unaffordable: allowed && change < 0 && d.meters.treasury + change < 0 };
  });
}

const hasOption = (ev, d) => choiceStates(ev, d).some((s) => s.allowed && !s.unaffordable);

// Everything the UI needs to render the current screen.
export function describe(state) {
  const d = state;
  if (d.phase === 'ended') return { kind: 'ended' };
  if (d.phase === 'result') return { kind: 'result', result: d.result };

  if (d.current.kind === 'remonstrance') {
    const charge = d.charges.find((c) => c.id === d.current.chargeId);
    const def = CHARGES[charge.id];
    const concern = def.kind === 'concern';
    const escalation =
      !concern && d.remonstrances >= 2
        ? '\n\nHe adds, quietly: “If this continues, Governor, I will not be able to stay.”'
        : '';
    const line = typeof def.linLine === 'function' ? def.linLine(d) : def.linLine;
    const repairChange = treasuryChange(def.correct.effects, d);
    const cannotRepair = repairChange < 0 && d.meters.treasury + repairChange < 0;
    const options = [
      {
        id: 'correct',
        label: def.correctLabel,
        cost: costOf(def.correct.effects),
        locked: cannotRepair,
        lockedReason: cannotRepair ? cannotCover(d, repairChange) : undefined,
      },
      { id: 'defend', label: def.defendLabel ?? 'Defend the decision', cost: [] },
    ];
    // Advice can be declined. Only a matter of wrongdoing can be shut down, and shutting it down is itself a wrong.
    if (!concern) options.push({ id: 'suppress', label: def.suppressLabel ?? 'Tell him the matter is closed', cost: [] });
    return {
      kind: 'remonstrance',
      title: concern ? 'Vice-Governor Lin raises a concern' : 'Vice-Governor Lin raises a matter',
      paragraphs: [`“${line}”${escalation}`],
      choices: options,
      notes: d.turnNotes,
    };
  }

  const ev = EVENTS[d.current.eventId];
  const choices = choiceStates(ev, d).map((s) => {
    const c = s.choice;
    const locked = !s.allowed || s.unaffordable;
    const risk = typeof c.risk === 'function' ? c.risk(d) : c.risk;
    return {
      id: c.id,
      label: typeof c.label === 'function' ? c.label(d) : c.label,
      cost: costOf(s.eff),
      risk: d.ministerPresent ? risk : risk ? 'No briefing is available on the risks.' : undefined,
      locked,
      lockedReason: !locked ? undefined : !s.allowed ? (typeof c.lockedReason === 'function' ? c.lockedReason(d) : c.lockedReason) : cannotCover(d, s.change),
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
  const picked = choiceStates(ev, d).find((s) => s.choice.id === choiceId);
  if (!picked) throw new Error(`Unknown choice: ${choiceId}`);
  if (!picked.allowed) throw new Error(`Choice unavailable: ${choiceId}`);
  if (picked.unaffordable) throw new Error(`The Treasury cannot cover: ${choiceId}`);
  const choice = picked.choice;

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
    if (treasuryChange(def.correct.effects, d) < 0 && d.meters.treasury + treasuryChange(def.correct.effects, d) < 0) {
      throw new Error('The Treasury cannot cover the repair');
    }
    repairCharge(d, charge.id, 'corrected');
    text = def.correct.text;
    // Once you have let Lin speak again, the matters you shut him out of can be raised again.
    if (charge.id === 'silencedRemonstrance') {
      for (const c of d.charges) {
        if (c.suppressed) {
          c.suppressed = false;
          c.raised = false;
        }
      }
    }
  } else if (choiceId === 'defend') {
    valid = Boolean(def.defence?.when) && evaluate(def.defence.when, d);
    if (valid) {
      charge.status = 'defended';
      charge.outcomeDependentDefence = Boolean(def.defence.outcomeDependent);
      if (def.defence.effects) applyEffects(d, def.defence.effects);
      text = def.defence.acceptText;
    } else {
      d.remonstrances += 1;
      applyEffect(d, { type: 'meter', key: 'capacity', delta: -2 });
      text = def.defence?.rejectText ?? 'Lin hears you out. “I hear the argument, Governor, and I do not accept it.”';
    }
  } else if (choiceId === 'suppress') {
    if (CHARGES[charge.id].kind === 'concern') throw new Error('Advice cannot be shut down');
    charge.suppressed = true;
    if (charge.id === 'silencedRemonstrance') {
      // Told twice to be quiet, he has nothing left to say.
      d.remonstrances = RESIGN_AT;
      text = 'Lin nods once. “Then I will not trouble you again, Governor.”';
    } else {
      openCharge(d, 'silencedRemonstrance');
      d.remonstrances += 1;
      text = 'Lin closes his folder. “As you wish, Governor. I will not raise it again.” He does not look as if he agrees.';
    }
  } else {
    throw new Error(`Unknown response: ${choiceId}`);
  }

  let notice = null;
  if (d.remonstrances >= RESIGN_AT && d.ministerPresent) {
    d.ministerPresent = false;
    d.flags.inspectionPending = true;
    notice = {
      title: 'Vice-Governor Lin Wei has resigned',
      paragraphs: [
        'A few days after your last conversation, Lin Wei submits his resignation. He gives no public reason, and he does not need to.',
        'Beijing has already been informed, and an inspection group is expected.',
        'From now on you will not have his briefings, his risk estimates, or his warnings. Nobody will raise matters with you before they reach Beijing.',
      ],
    };
    text += '\n\nA few days later, Vice-Governor Lin Wei submits his resignation. Beijing has already been informed, and an inspection group is expected.';
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
  const shown = notice ? text.split('\n\n')[0] : text;
  d.result = { title: 'Vice-Governor Lin', text: shown, deltas: deltas(before, d.meters), kind: 'remonstrance', notice };
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
  // A province that ended the term in collapse is a collapse, even if the last turn was the one that broke it.
  if (d.meters.welfare <= COLLAPSE_AT && !d.flags.removed) {
    d.flags.removed = true;
    d.flags.collapsed = true;
  }
  const failing = d.meters.welfare <= 40 || d.meters.capacity <= 15;
  const political = d.flags.removed ? 'removed' : failing ? 'failing' : 'office';

  // Beijing judges results, not Mencian conduct: the province's accounts and condition decide the posting.
  const debt = d.meters.treasury;
  let career;
  const strongProvince = d.meters.welfare >= 55 && debt >= 0 && d.meters.capacity >= 25;
  const strongNumbers = debt >= 15 && d.meters.capacity >= 35 && d.meters.welfare >= 42;
  if (d.flags.removed) career = 'dismissed';
  else if (debt <= -10 || (d.flags.defaulted && debt < 0)) career = 'demoted';
  else if (failing || debt < 0 || d.flags.bailedOut) career = 'sidelined';
  else if ((strongProvince || strongNumbers) && d.flags.verdict !== 'censure') career = 'promoted';
  else career = 'retained';

  d.ending = { political, ethical: open.length ? 'compromised' : 'clear', career };
  d.status = 'ended';
  d.phase = 'ended';
  d.current = null;
  return d;
}
