# Implementation plan

Status: **Phase 1-5 implemented for Arc 1** (engine, content, UI, debrief, simulation). Playtesting and further arcs remain. Content for the first arc is in [ARC-1-FAILED-HARVEST.md](./ARC-1-FAILED-HARVEST.md) (see its revision note); the code in `src/content` is the source of truth. Source research is in [../RESEARCH.md](../RESEARCH.md). To run: see [../README.md](../README.md).

Setting change: the game is set in a realistic modern China. The player is the governor of an unnamed province, answers to Beijing, and is removed by Beijing's leadership when the subordinate who raises matters (Vice-Governor Lin Wei) has resigned and a matter is unresolved. The word "royal" is no longer used in game text; the Mencius 5B9 distinction between ministers who may depose a ruler and those who should leave is described in the debrief only.

## 1. Purpose and learning goals

A short browser game for a history of China class. The player rules a fictional modern state for one term, under an explicitly Mencian standard of rule.

Intended takeaways about imperial China (to be stated in the game's framing and debrief):

1. **Authority was conditional.** Under the Mandate of Heaven tradition, a ruler's standing depended on how he treated the people (Mencius 1B8).
2. **Livelihood came first.** Securing people's food and safety was a duty of rule, and punishing people driven to wrongdoing by deprivation was condemned (Mencius 1A7).
3. **The system relied on officials who would say unwelcome things.** Ministers were expected to remonstrate, and, in the ideal, leave or depose a ruler who would not listen (Mencius 5B9). Whether this worked in practice is a separate historical question the debrief must not overclaim.
4. **Ideals were hard to practise.** Rulers faced limited resources, uncertain information, and competing obligations.

Connections the project prompt asks for: contemporary accountability after disasters, performance-based legitimacy, cross-cultural contrast with divine right of kings. A personal connection is optional and not yet chosen.

## 2. Settled design decisions

- **Setting:** a fictional modern state, one ruler, one term of roughly 12 turns. Events are fictional; the imperial link comes from the principles, not from reenacting real episodes.
- **Standard of judgment:** Mencius, stated openly. Other schools (Laozi, Mozi) are out of scope for this version (see RESEARCH.md).
- **Visible meters:** Treasury, Welfare, State Capacity. There is no morality meter and no spendable virtue or luck.
- **Ethics are modelled as charges.** A charge is a specific wrong the player knowingly authorised. It is raised by one minister and has to be addressed specifically.
- **One minister (Minister Lin)** in the first version, a single voice rather than a cast.
- **Luck is separate from morality.** Luck affects outcomes and never whether a charge arises.
- **Good conduct is not rewarded mechanically.** A clean record gives a commendation in the log, not resources.
- **Randomness** comes from a weighted event pool, outcome rolls with visible risk, and parameter variation, using a seeded generator.
- **No victory by survival alone.** Endings combine political outcome and ethical assessment.

## 3. Open decisions

- Plain JavaScript or TypeScript (recommendation below).
- Exact balance numbers; those in the arc document are first guesses.
- Whether to add a personal connection or a modern real-world parallel in the framing.
- How the term-end ladder (Council removal) scales across four arcs.
- Hosting target (static host such as GitHub Pages or Netlify).

## 4. Technology

- **Vite + React**, plain JavaScript with JSDoc types. This fits the "nothing more complex than JavaScript/React" constraint. TypeScript would catch schema mistakes in content, so reconsider it if content errors become frequent.
- **Vitest** for engine tests. No backend, no database, no accounts.
- **Static build** for hosting. State lives in memory; optional save to `localStorage` later.

## 5. Architecture

Three layers, with the engine independent of React.

```
src/
  engine/        pure functions, no React, no DOM
    state.js       createGame(seed), initial state
    rng.js         seeded generator
    conditions.js  evaluate(when, state)
    effects.js     applyEffect(state, effect)
    turn.js        drawEvent, applyChoice, advanceTurn, checkEnd
    remonstrance.js  escalation ladder, charge handling
    debrief.js     buildDebrief(state) from history
  content/
    sources.js     registry of passages with status
    charges.js     charge definitions
    events/
      arc1-failed-harvest.js
  ui/            React components only
  tests/         engine tests, content validation, bot simulation
docs/
```

### 5.1 State

```js
GameState = {
  turn, maxTurns, seed, rngState,
  meters: { treasury, welfare, capacity },
  flags: { [key]: boolean | number },
  facts: string[],            // what the player has been told
  commitments: Commitment[],  // promises with due turns and costs
  charges: Charge[],
  remonstrances: number,      // escalation counter
  ministerPresent: boolean,
  scheduled: { eventId, dueTurn }[],
  seenEvents: string[],
  history: DecisionRecord[],
  status: 'playing' | 'ended',
  ending: null | Ending,
}
```

### 5.2 Content objects

```js
Event = {
  id, arc, slot,        // slot: 'anchor' | 'pool'
  window: [fromTurn, toTurn],
  when: Condition,      // eligibility
  setup: Effect[],      // optional hidden rolls made on entry (e.g. ringPresent)
  weight, once,
  title, text: (state) => string,
  reveals: string[],    // facts revealed when shown
  choices: Choice[],
}

Choice = {
  id, label,
  requires: Condition,        // availability, with a visible reason if locked
  outcomes: [{ chance | chanceFn, effects: Effect[], text }],
  charges: ChargeRule[],      // deterministic, never rolled
  sourceTags: SourceTag[],
}

Effect =
  | { type: 'meter', key, delta }
  | { type: 'flag', key, value }
  | { type: 'fact', key }
  | { type: 'schedule', eventId, delay }
  | { type: 'later', delay, effects, text }   // delayed consequence, shown in the log
  | { type: 'setFlagRoll', key, chance }      // used in setup; hidden from the player
  | { type: 'commitment', id, dueIn, effects }
  | { type: 'openCharge', id }
  | { type: 'closeCharge', id, how }

Condition = { all: [...] } | { any: [...] } | { not: ... } |
  { flag } | { fact } | { meter, op, value } | { charge, status } | { turn, op, value }

ChargeDef = {
  id, label, wrong,
  source: SourceRef,           // passage and support status
  requiresFact,                // charge is "knowing" only if this fact was revealed
  defenceValid: Condition,     // when "defend" is a legitimate response
}

SourceRef = { passage, status: 'direct' | 'inference' | 'adaptation', note }
```

### 5.3 Turn flow

1. Apply upkeep: commitments due, debt penalty, delayed (`later`) effects, scheduled events.
2. If any charge is open and the minister is present and has not already remonstrated this turn, show a remonstrance event first (see 5.4). It does not use the turn's regular slot, so a turn is up to one remonstrance followed by one regular event.
3. Draw the regular event: scheduled events first, then anchors whose window is due, else a weighted draw among eligible pool events. Anchors can share a slot (e.g. `thefts`) and pick the eligible variant.
3a. Labels and text may be functions of state, so one choice can read differently depending on earlier play.
4. Show text and known facts; the player chooses.
5. Resolve the chosen outcome (roll if it has chances), apply effects, open charges.
6. Record a `DecisionRecord`.
7. Check end conditions.

### 5.4 Remonstrance ladder (game rule, not a historical claim)

Grounded in Mencius 5B9, where ministers of the ruler's line depose and ministers of other surnames leave after repeated remonstrance. The thresholds are design choices.

- A charge is raised by the minister the turn after it opens.
- Responses: **correct** (pay the repair cost, charge closes), **defend** (closes only if the charge's `defenceValid` condition holds, otherwise it stays open), **suppress** (stays open, adds a `silencedRemonstrance` charge).
- Each unresolved raise adds 1 to `remonstrances`. At 3, the minister resigns and the player loses his optional briefing details (risk estimates, coverage reports). Resigning does not erase open charges, and charge knowledge does not depend on him.
- A term review by a Senior Review Council (the royal-line analogue) can censure or remove the ruler when open charges are numerous and the minister has already gone.

### 5.5 Randomness rules

- Seeded generator; the seed is shown in the debrief so a run can be reproduced.
- **Charges are deterministic.** The same choice with the same known facts always produces the same charge.
- Rolls happen only inside `outcomes`, with the chance shown to the player in words (unlikely, even, likely).
- Preparation changes odds: high capacity makes relief more likely to arrive on time.
- Pool events are capped per arc so players cannot memorise a path.

### 5.6 Debrief

Generated from `history`. For each pivotal decision it shows: what you did, what you had been told, the charge opened or avoided, the repair or response, and the source passage with its status tag. It also states plainly which rules are game design rather than the text's claims.

## 6. Content authoring rules

Every event must have:

- A source tag per choice that has an ethical dimension, with status `direct`, `inference`, or `adaptation`.
- The facts it reveals, so foreseeability is checkable.
- At least one choice that is a defensible compromise, and no choice that is obviously "the ethical button".
- A statement of what persists afterwards (flag, commitment, charge, schedule).

Do not claim a charge corresponds to a Mencian verdict unless its source status is `direct`.

## 7. Phases

| Phase | Output | Done when |
|---|---|---|
| 0. Source check | Verify unconfirmed passages (1B7, 5A3, 3A3, 3A2) in a full translation | Sources registry has no unverified `direct` tags |
| 1. Engine | rng, conditions, effects, turn flow, remonstrance ladder | Unit tests pass; engine runs without React |
| 2. Content | Arc 1 encoded as data | Content validator passes (every referenced fact, flag, event id exists) |
| 3. UI | Meters, event screen, choices, commitments, log | A full playthrough works in the browser |
| 4. Debrief | Generated end report with sources | Debrief reads correctly for 5 sample runs |
| 5. Simulation | Bot runs thousands of seeded games | No dead ends; every event reachable; ending distribution sane |
| 6. Playtest | Class-level playtest | Players can state the takeaways afterwards |
| 7. More arcs | Arcs 2-4 (see 9) | Same validator and simulation pass |
| 8. Deploy | Static build hosted | URL works on a clean browser |

## 8. Testing

- **Engine unit tests:** conditions, effects, charge rules, escalation ladder, determinism (same seed gives the same run).
- **Content validator:** all references resolve; no event without source tags on ethical choices; no unreachable events.
- **Bot simulation:** random and heuristic bots; checks reachability, balance, and that ethical outcomes do not depend on rolls.
- **Fairness test:** every charge's `requiresFact` is revealed by an earlier event or the same one.

## 9. Planned arcs after Arc 1

Not written. Candidates: a border crisis (Mencius on Yan, 1B10-11); a succession-style or loyalty crisis for personal dilemmas; a public-works project with displacement; a corruption scandal. Four arcs interleaved over 12 turns is the target.

## 10. Risks

- Writing volume is the main cost. The structure makes events cheap to add but not cheap to write well.
- Hidden flags are only fair when the player was told the relevant fact. The fairness test is there for that.
- The "defend" option could reward bluffing. Keep `defenceValid` conditions concrete and explain the verdict in the debrief.
- Players may learn a rule like "always pick the most expensive option." Include events where the expensive option is wrong or fails.
- Single minister can make the game feel scripted. Variants and randomness have to compensate until more characters are added.
