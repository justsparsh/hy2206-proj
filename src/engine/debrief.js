import { CHARGES, SOURCES } from '../content/index.js';

const CAREER = {
  promoted:
    'Beijing is pleased with how the province came through the year. You are moved to a larger province, with a bigger budget and a harder set of problems.',
  retained: 'Beijing leaves you in post. The year goes into your file without comment.',
  sidelined:
    'Beijing moves you to a largely ceremonial post on a provincial standing committee, with no role in running anything. On paper it is a lateral move. Everyone understands what it is.',
  demoted:
    'Beijing considers the province’s finances and condition a failure. You are demoted in rank and posted as a deputy to a remote western prefecture, where nobody expects you to come back.',
  dismissed: 'Beijing removes you from office and refers your conduct for review.',
  insolvent:
    'A crisis arrived and you had no response left to give it: no money, no standing, no move you could make. Beijing relieved you of your post and referred your conduct for review.',
  collapsed:
    'The province broke down: people starving, protests turned to riots, and a government that could no longer keep order. Beijing removed you from office and referred your conduct for review.',
};

const CAREER_META = {
  promoted: { label: 'Promoted', tone: 'good' },
  retained: { label: 'Retained', tone: 'neutral' },
  sidelined: { label: 'Sidelined', tone: 'warn' },
  demoted: { label: 'Demoted', tone: 'bad' },
  dismissed: { label: 'Dismissed', tone: 'bad' },
};

const ETHICAL = {
  clear: 'By Mencius’s standard, no wrong was left unrepaired.',
  compromised: 'By Mencius’s standard, wrongs were left unrepaired.',
};

// Short, player-facing Mencian reflection for each matter, kept separate from scholarly provenance notes.
const MENCIUS_LINE = {
  entrapment: 'Mencius 1A7 — punishing people driven into wrongdoing by want is to trap them.',
  failedTrust: 'Mencius 1B6 — a ruler entrusted with a people who lets them go hungry breaks that trust.',
  notExtended: 'Mencius 1A7 — sparing the one creature before your eyes means little if compassion stops there.',
  favouredKin: 'Mencius 5A3 — even sage-king Shun refused to let an unreliable brother administer the people.',
  leftWaiting: 'Mencius 1A7 — securing livelihood is not charity; it is the first duty of office.',
  squeezedPeople: 'Mencius 1A7 & 3A3 — balancing accounts by taking from those with nothing left undermines the basis of rule.',
  heavyTaxation: 'Mencius 3A3 — without a constant livelihood, ordinary people cannot keep a constant heart.',
  lookedAway: 'Mencius 1B6 — a judge who cannot control his own officers should not remain in charge.',
  silencedRemonstrance: 'Mencius 5B9 & 1B6 — turning away from honest counsel strips rule of its safeguard.',
  concealedLosses: 'Honest reporting — a government that hides the toll from above cannot answer for it below.',
  stagedRecovery: 'Mencius 1A7 & 1B6 — tending to what sits before the visitor’s eye while neglecting the unseen counties.',
  crushedUnrest: 'Mencius 1A7 — sending force against people broken by want traps them twice.',
};

// Beijing's accounting and Mencius's are different measures, and the end of the game says so.
const MEASURES =
  'Beijing judged you on the province’s accounts and condition. Mencius would have judged you on how you treated the people in your care. Those two verdicts do not always agree, and the game never promised they would.';

const RESPONSE_LABEL = { correct: 'You corrected it', defend: 'You defended it', suppress: 'You shut him down' };

function makeHeadline(state) {
  const { career, ethical } = state.ending;
  if (state.flags.collapsed) return 'The Province Broke Down';
  if (state.flags.insolvent) return 'Left With No Move';
  if (state.flags.exposed) return 'Exposed and Dismissed';
  if (career === 'dismissed') return 'Relieved of Your Post';
  const careerWord = {
    promoted: 'Promoted',
    retained: 'Kept in Post',
    sidelined: 'Sidelined',
    demoted: 'Demoted',
  }[career];
  return ethical === 'clear' ? `${careerWord} — with a Clear Record` : `${careerWord} — and Compromised`;
}

function makeMenciusVerdict(state, openWrongs, repairedWrongs) {
  const { ethical } = state.ending;
  if (ethical === 'clear') {
    if (!state.ministerPresent) {
      return 'No wrong remained unrepaired when the term ended, though your refusal to listen drove Vice-Governor Lin from office along the way.';
    }
    if (repairedWrongs > 0) {
      return 'You answered every wrong Vice-Governor Lin placed before you. Putting them right cost the province dearly, and by Mencius’s standard nothing was left unrepaired.';
    }
    return 'You governed through a hard winter and spring without leaving a knowing wrong on the record. By Mencius’s standard, you kept the trust placed in you.';
  }
  const noun = openWrongs === 1 ? 'One wrong stood' : `${openWrongs} wrongs stood`;
  if (!state.ministerPresent) {
    return `${noun} unrepaired when the term ended, and your refusal to heed them drove Vice-Governor Lin to resign. In Mencius’s view, a ruler who neither cares for the people nor hears his ministers has lost the standing of office.`;
  }
  return `${noun} unrepaired on your record. Vice-Governor Lin stayed at his desk, but his objections remained in the file. By Mencius’s standard, keeping order on paper does not undo a wrong done to the people in your care.`;
}

function makeLinEpilogue(state, wrongs) {
  if (!state.ministerPresent) {
    return 'Vice-Governor Lin Wei resigned after you repeatedly refused his counsel.';
  }
  if (wrongs.length === 0) {
    return 'Vice-Governor Lin Wei remained at his post through the year and never had cause to bring a charge.';
  }
  const repaired = wrongs.filter((w) => w.status === 'corrected').length;
  const open = wrongs.filter((w) => w.status === 'open').length;
  if (open === 0) {
    return `Vice-Governor Lin Wei remained at his post. You answered ${repaired === 1 ? 'the matter' : `all ${repaired} matters`} he brought before you.`;
  }
  return `Vice-Governor Lin Wei remained at his post, though ${open === 1 ? 'one objection remains' : `${open} objections remain`} unanswered in the provincial file.`;
}

function makeReplayHint(state, diverged) {
  const { career, ethical } = state.ending;
  const careerSuccess = career === 'promoted' || career === 'retained';
  if (diverged && careerSuccess) {
    return 'You satisfied Beijing by cutting corners. Try the same winter again without leaving a wrong unrepaired — and see what it costs your career.';
  }
  if (diverged && !careerSuccess) {
    return 'You kept a clean record and paid for it in Beijing. Try again with a colder eye on the books — or see if you can satisfy both ledgers at once.';
  }
  if (career === 'promoted' && ethical === 'clear') {
    return 'You threaded the needle: Beijing promoted you and Mencius cleared you. Try a new seed to see whether a harsher winter lets you do it twice.';
  }
  if (career === 'dismissed') {
    return 'Try another term — watch the mountain villages early, keep the Treasury from running dry, and think twice before shutting Lin Wei out.';
  }
  return 'Every winter unfolds differently. Try a new seed, or replay this one to see how far Beijing’s scorecard and Mencius’s standard can pull apart.';
}

export function buildDebrief(state) {
  const { ending } = state;
  const ledger = state.charges.map((c) => {
    const def = CHARGES[c.id];
    let outcome;
    let statusBadge;
    if (c.status === 'corrected') {
      statusBadge = 'Repaired';
      outcome = 'Corrected.';
    } else if (c.status === 'defended') {
      statusBadge = 'Defended';
      outcome = c.outcomeDependentDefence
        ? 'Defended. The defence rests on something you could not have known when you decided, so it does not vindicate the original choice.'
        : 'Defended.';
    } else {
      statusBadge = 'Unresolved';
      outcome = c.suppressed ? 'Left unresolved, and you refused to hear it.' : 'Left unresolved.';
    }
    return {
      id: c.id,
      label: def.label,
      opened: def.opened,
      outcome,
      status: c.status,
      statusBadge,
      menciusLine: MENCIUS_LINE[c.id] ?? `${def.source.passage}.`,
      source: def.source,
    };
  });

  const timeline = state.history.map((h) => ({
    turn: h.turn,
    title: h.title,
    choice: h.kind === 'remonstrance' ? RESPONSE_LABEL[h.choiceId] : h.choiceLabel,
    outcome: h.outcomeText,
    opened: h.opened.map((id) => CHARGES[id].label),
    note: h.note,
  }));

  const openWrongs = ledger.filter((l) => l.status === 'open').length;
  const repairedWrongs = ledger.filter((l) => l.status === 'corrected').length;
  const careerSuccess = ending.career === 'promoted' || ending.career === 'retained';
  const diverged = (careerSuccess && ending.ethical === 'compromised') || (!careerSuccess && ending.ethical === 'clear');

  const measuresNote =
    careerSuccess && ending.ethical === 'compromised'
      ? 'The two verdicts disagreed. Beijing rewarded the province’s results, while Mencius’s standard left wrongs on your record. Keeping the books in order is not the same as treating the people well.'
      : !careerSuccess && ending.ethical === 'clear'
        ? 'The two verdicts disagreed. You left no wrong unrepaired by Mencius’s standard, and Beijing still judged the province’s accounts or condition wanting. Good conduct does not guarantee a career.'
        : MEASURES;

  return {
    seed: state.seed,
    turnsPlayed: Math.min(state.turn, state.maxTurns),
    maxTurns: state.maxTurns,
    endedEarly: Boolean(state.flags.removed && state.turn < state.maxTurns),
    headline: makeHeadline(state),
    careerBadge: CAREER_META[ending.career].label,
    careerTone: CAREER_META[ending.career].tone,
    ethicalBadge: ending.ethical === 'clear' ? 'Clear' : 'Compromised',
    ethicalTone: ending.ethical === 'clear' ? 'good' : 'bad',
    diverged,
    political: state.flags.collapsed ? CAREER.collapsed : state.flags.insolvent ? CAREER.insolvent : CAREER[ending.career],
    menciusVerdict: makeMenciusVerdict(state, openWrongs, repairedWrongs),
    linEpilogue: makeLinEpilogue(state, ledger),
    replayHint: makeReplayHint(state, diverged),
    career: ending.career,
    measures: measuresNote,
    ethical:
      ending.ethical === 'clear'
        ? 'No wrong was left unrepaired.'
        : `${openWrongs} wrong(s) left unrepaired.`,
    summary: ETHICAL[ending.ethical],
    timeline,
    ledger,
    meters: state.meters,
    settled: state.settled ?? [],
    sources: SOURCES,
    ideas: [
      {
        title: 'Conditional rule — and two ways to measure it',
        body:
          'In the tradition Mencius draws on, a ruler’s standing is never permanent: one who despoils humaneness and rightness becomes a “mere fellow” (1B8). Modern commentary often frames legitimacy through economic performance and stability instead. Here Beijing judges the province’s accounts and condition while Mencius’s standard judges how the people were treated — and under scarcity, those two verdicts can pull apart.',
      },
      {
        title: 'How Mencius shaped the choices: livelihood first',
        body:
          'Rather than using a morality meter, the game draws its specific wrongs from Mencius’s claim that securing people’s livelihood is the first duty of government (1A7, 1B6, 3A3, 5A3). Punishing people driven into wrongdoing by want is a trap, and shortcuts that look prudent on paper — holding back reserves, taxing drought-hit counties, staging a model village — remain wrongs even when they work.',
      },
      {
        title: 'How Mencius shaped the voice: ministerial remonstrance',
        body:
          'Mencius places the duty to reprove a wayward ruler on ministers close to power: if the ruler repeatedly refuses to listen, the minister should leave or remove him (5B9). Vice-Governor Lin Wei embodies that safeguard — confronting you directly and resigning if ignored.',
      },
    ],
  };
}
