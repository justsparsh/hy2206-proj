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
    } else     if (def.kind === 'concern' && c.status !== 'open') {
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

  return {
    seed: state.seed,
    political: state.flags.collapsed ? CAREER.collapsed : state.flags.insolvent ? CAREER.insolvent : CAREER[ending.career],
    career: ending.career,
    measures: MEASURES,
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
