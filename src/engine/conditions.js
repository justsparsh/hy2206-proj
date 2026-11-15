const OPS = {
  '>': (a, b) => a > b,
  '>=': (a, b) => a >= b,
  '<': (a, b) => a < b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a === b,
};

function compare(op, a, b) {
  const fn = OPS[op];
  if (!fn) throw new Error(`Unknown operator: ${op}`);
  return fn(a, b);
}

// Conditions are declarative objects so they can be stored in saved state and inspected by tests.
// A plain function is also accepted for content that needs something unusual.
export function evaluate(cond, state) {
  if (cond === undefined || cond === null) return true;
  if (typeof cond === 'function') return Boolean(cond(state));
  if (cond.all) return cond.all.every((c) => evaluate(c, state));
  if (cond.any) return cond.any.some((c) => evaluate(c, state));
  if ('not' in cond) return !evaluate(cond.not, state);
  if ('flag' in cond) {
    const v = state.flags[cond.flag];
    if (cond.op) return compare(cond.op, Number(v || 0), cond.value);
    if (cond.value !== undefined) return v === cond.value;
    return Boolean(v);
  }
  if ('fact' in cond) return state.facts.includes(cond.fact);
  if ('meter' in cond) return compare(cond.op, state.meters[cond.meter], cond.value);
  if ('turn' in cond) return compare(cond.op, state.turn, cond.value);
  if ('charge' in cond) {
    return state.charges.some((c) => c.id === cond.charge && c.status === (cond.status ?? 'open'));
  }
  if ('count' in cond) {
    if (cond.count === 'openCharges') {
      return compare(cond.op, state.charges.filter((c) => c.status === 'open').length, cond.value);
    }
    throw new Error(`Unknown count: ${cond.count}`);
  }
  if ('ministerPresent' in cond) return state.ministerPresent === cond.ministerPresent;
  throw new Error(`Unknown condition: ${JSON.stringify(cond)}`);
}
