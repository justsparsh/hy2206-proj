import { CHARGES } from '../content/charges.js';

const CLAMP = { welfare: [0, 100], capacity: [0, 100], treasury: [-100, 300] };

export function openCharge(d, id) {
  const def = CHARGES[id];
  if (!def) throw new Error(`Unknown charge: ${id}`);
  if (def.requiresFact && !d.facts.includes(def.requiresFact)) return false;
  if (d.charges.some((c) => c.id === id && c.status === 'open')) return false;
  d.charges.push({
    id,
    turnOpened: d.turn,
    status: 'open',
    raised: false,
    suppressed: false,
    outcomeDependentDefence: false,
  });
  return true;
}

export function repairCharge(d, id, how = 'corrected') {
  const charge = d.charges.find((c) => c.id === id && c.status === 'open');
  if (!charge) return;
  for (const e of CHARGES[id].correct.effects) applyEffect(d, e);
  charge.status = how;
  charge.closedTurn = d.turn;
}

export function applyEffect(d, e) {
  switch (e.type) {
    case 'meter': {
      const [lo, hi] = CLAMP[e.key];
      d.meters[e.key] = Math.min(hi, Math.max(lo, d.meters[e.key] + e.delta));
      break;
    }
    case 'flag':
      d.flags[e.key] = e.value === undefined ? true : e.value;
      break;
    case 'fact':
      if (!d.facts.includes(e.key)) d.facts.push(e.key);
      break;
    case 'schedule':
      d.scheduled.push({ eventId: e.eventId, dueTurn: d.turn + e.delay });
      break;
    case 'later':
      d.delayed.push({ dueTurn: d.turn + e.delay, effects: e.effects, text: e.text });
      break;
    case 'commitment':
      d.commitments.push({
        id: e.id,
        label: e.label,
        dueTurn: d.turn + e.dueIn,
        effects: e.effects,
        failIf: e.failIf,
        failEffects: e.failEffects,
        text: e.text,
        failText: e.failText,
      });
      break;
    case 'openCharge':
      openCharge(d, e.id);
      break;
    case 'repairCharge':
      repairCharge(d, e.id, 'corrected');
      break;
    case 'remonstrances':
      d.remonstrances = e.value;
      break;
    default:
      throw new Error(`Unknown effect type: ${e.type}`);
  }
}

export function applyEffects(d, effects) {
  for (const e of effects) applyEffect(d, e);
}
