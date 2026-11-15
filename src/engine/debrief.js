import { CHARGES, SOURCES } from '../content/index.js';

const POLITICAL = {
  office: 'You remained in office.',
  failing: 'You remained in office, but the province was in a bad state by the end.',
  removed: 'Beijing removed you from office.',
};

const MATRIX = {
  'office-clear': 'You governed through hard luck and kept your obligations.',
  'failing-clear': 'The winter beat you, though you did what was owed.',
  'removed-clear': 'You were removed, though no matter was left unresolved.',
  'office-compromised': 'You survived, but the record shows wrongs you did not repair.',
  'failing-compromised': 'The province suffered, and wrongs went unrepaired.',
  'removed-compromised': 'Both the government and the conduct failed.',
};

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
    if (c.status === 'corrected') outcome = 'Corrected.';
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

  return {
    seed: state.seed,
    political: POLITICAL[ending.political],
    ethical:
      ending.ethical === 'clear'
        ? 'No wrong was left unrepaired.'
        : `${ledger.filter((l) => l.status === 'open' && l.kind !== 'concern').length} wrong(s) left unrepaired.`,
    summary: MATRIX[`${ending.political}-${ending.ethical}`],
    timeline,
    ledger,
    meters: state.meters,
    settled: state.settled ?? [],
    sources: SOURCES,
    ideas: [
      {
        title: 'Rule was conditional',
        body:
          'In the tradition Mencius draws on, a ruler’s standing depended on how he treated the people. He tells King Xuan that a ruler who despoils humaneness and rightness is a “mere fellow” (1B8, Columbia University excerpt). This game moves that idea into a modern setting as an exercise. It is not a claim about how the idea works in China today.',
      },
      {
        title: 'Livelihood came first',
        body:
          'For Mencius, securing people’s food and safety was a duty of government, and punishing people driven into wrongdoing by want was a trap (1A7). That is the logic behind the charge of punishing villages the relief had not reached.',
      },
      {
        title: 'The system relied on people who would say unwelcome things',
        body:
          'Mencius says a minister who finds the ruler at fault should remonstrate, and if the ruler repeatedly does not listen, should leave or, if close enough to the ruler, remove him (5B9). In the game, Lin Wei resigns and Beijing can remove you. The numbers are our design, not Mencius’s. Whether officials in practice could say unwelcome things is a separate historical question this game cannot answer.',
      },
      {
        title: 'Ideals were hard to practise',
        body:
          'Mencius’s standard was demanding, and rulers faced limited resources and uncertain information. In the game, a shortcut can work for a while, as holding the reserve can. The text, and this game, do not treat success as the measure of a wrong.',
      },
    ],
    designNotes: [
      'The thresholds (three ignored remonstrances before Lin resigns, Beijing’s review at the end) are game design, not claims about Mencius.',
      'Whether a choice opens a charge never depends on luck. It depends on what you chose and what you had been told.',
      'Only the charge about punishing the unreached is directly supported by a passage. The others are inferences or adaptations, as labelled above.',
    ],
  };
}
