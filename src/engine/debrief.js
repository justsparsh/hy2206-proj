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

const ETHICAL = {
  clear: 'By Mencius’s standard, no wrong was left unrepaired.',
  compromised: 'By Mencius’s standard, wrongs were left unrepaired.',
};

// Beijing's accounting and Mencius's are different measures, and the end of the game says so.
const MEASURES =
  'Beijing judged you on the province’s accounts and condition. Mencius would have judged you on how you treated the people in your care. Those two verdicts do not always agree, and the game never promised they would.';

const STATUS_LABEL = {
  direct: 'Direct textual support',
  inference: 'Reasonable inference from the text',
  adaptation: 'Game design, not a claim about the text',
};

const RESPONSE_LABEL = { correct: 'You corrected it', defend: 'You defended it', suppress: 'You shut him down' };

export function buildDebrief(state) {
  const { ending } = state;
  const ledger = state.charges.map((c) => {
    const def = CHARGES[c.id];
    let outcome;
    if (def.kind === 'concern') {
      if (c.status === 'corrected') outcome = 'You heeded it, scaled relief back, and paid for it in welfare.';
      else if (state.flags.warningCalledIn) outcome = 'You kept spending, and the Treasury did run dry. Beijing’s finance bureau noted it.';
      else outcome = 'You kept spending, and the money held. Lin’s warning did not come true.';
    } else if (c.status === 'corrected') outcome = 'Corrected.';
    else if (c.status === 'defended') {
      outcome = c.outcomeDependentDefence
        ? 'Defended. The defence rests on something you could not have known when you decided, so it does not vindicate the original choice.'
        : 'Defended.';
    } else outcome = c.suppressed ? 'Left unresolved, and you refused to hear it.' : 'Left unresolved.';
    return {
      id: c.id,
      kind: def.kind ?? 'wrong',
      label: def.label,
      opened: def.opened,
      outcome,
      status: c.status,
      source: def.source,
      sourceLabel: STATUS_LABEL[def.source.status],
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

  const careerSuccess = ending.career === 'promoted' || ending.career === 'retained';
  const measuresNote =
    careerSuccess && ending.ethical === 'compromised'
      ? 'The two verdicts disagreed. Beijing rewarded the province’s results, while Mencius’s standard left wrongs on your record. Keeping the books in order is not the same as treating the people well.'
      : !careerSuccess && ending.ethical === 'clear'
        ? 'The two verdicts disagreed. You left no wrong unrepaired by Mencius’s standard, and Beijing still judged the province’s accounts or condition wanting. Good conduct does not guarantee a career.'
        : MEASURES;

  return {
    seed: state.seed,
    political: state.flags.collapsed ? CAREER.collapsed : state.flags.insolvent ? CAREER.insolvent : CAREER[ending.career],
    career: ending.career,
    measures: measuresNote,
    ethical:
      ending.ethical === 'clear'
        ? 'No wrong was left unrepaired.'
        : `${ledger.filter((l) => l.status === 'open' && l.kind !== 'concern').length} wrong(s) left unrepaired.`,
    summary: ETHICAL[ending.ethical],
    timeline,
    ledger,
    meters: state.meters,
    settled: state.settled ?? [],
    sources: SOURCES,
    ideas: [
      {
        title: 'Livelihood came first',
        body:
          'For Mencius, securing people’s food, safety, and stable livelihood was the ruler’s first obligation (1A7, 3A3). Punishing people driven into wrongdoing by want is a trap, and a shortcut that works on paper — holding the reserve, taxing empty barns, staging a model village — does not cease to be a wrong.',
      },
      {
        title: 'Rule relied on officials who would say unwelcome things',
        body:
          'Mencius says a minister who finds the ruler at fault should remonstrate, and if the ruler repeatedly does not listen, should leave or, if close enough to the ruler, remove him (5B9). In the game, Lin Wei raises specific wrongs, resigns if ignored three times, and leaves you blind to risks. The thresholds are game design, not Mencius’s.',
      },
      {
        title: 'Performance and moral legitimacy can disagree',
        body:
          'In the tradition Mencius draws on, a ruler who despoils humaneness and rightness becomes a “mere fellow” (1B8). Modern commentary often frames legitimacy through economic performance and stability instead. Here Beijing judges the province’s accounts and condition while Mencius judges how the people were treated — and the two verdicts can split.',
      },
    ],
    designNotes: [
      'The thresholds (three ignored remonstrances before Lin resigns, Beijing’s inspection and career ladder at the end) are game design, not claims about Mencius.',
      'Whether a choice opens a charge never depends on luck. It depends on what you chose and what you had been told.',
      'Only the charge about punishing the unreached is directly supported by a passage. The others are inferences or adaptations, as labelled above.',
    ],
  };
}
