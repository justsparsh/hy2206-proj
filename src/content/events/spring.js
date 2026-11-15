import { m, flag, later, beijingWillHelp, askedBeijing } from '../helpers.js';
import { CHARGES } from '../charges.js';

const isWrong = (c) => c.status === 'open' && CHARGES[c.id].kind !== 'concern';

const paras = (...p) => p.join('\n\n');
const deaths = (s) => (s.flags.winterLoss ?? 0) * 6;

// Spring: the winter's consequences come due, and early decisions come back.

const thaw = {
  id: 'the-thaw',
  title: 'The Count',
  slot: 'anchor',
  window: [8, 9],
  when: { flag: 'winterLoss', op: '>', value: 0 },
  reveals: ['casualtiesKnown'],
  text: (s) =>
    paras(
      `The snow is melting, and the count of the winter is in. Lin brings the final figure: ${deaths(s)} people died of cold and hunger across the northern counties${s.flags.uncovered > 0 ? ', most of them in villages the relief never reached' : ''}.`,
      'Beijing expects the provincial report within the week.',
    ),
  briefing: () => 'Lin: “Whatever you decide, Governor, the registers are in the counties. They will not change.”',
  choices: [
    {
      id: 'report-true',
      label: 'Send Beijing the full count',
      outcomes: [
        {
          effects: (s) => [m('capacity', -3), ...(s.flags.winterLoss >= 4 ? [flag('beijingWatching')] : [])],
          text: 'Beijing receives the figure without comment. Your phone does not ring that week, which tells you something.',
        },
      ],
    },
    {
      id: 'report-low',
      label: 'Send a lower figure, citing late registrations',
      charges: [{ id: 'concealedLosses' }],
      risk: 'Beijing may check the county registers.',
      outcomes: [
        {
          effects: [flag('lossesUnderstated')],
          text: 'The report goes out with a lower figure and a note about late registrations. Lin reads the copy and says nothing.',
        },
      ],
    },
    {
      id: 'report-late',
      label: 'Hold the report until the figures are “verified”',
      outcomes: [
        {
          effects: [m('capacity', -1), later(2, [m('capacity', -4)], 'Beijing asks why the provincial report is late, and why it was held back.')],
          text: 'You tell Beijing the figures are still being verified. The registers do not change.',
        },
      ],
    },
  ],
};

const seedGrain = {
  id: 'seed-grain',
  title: 'Spring Planting',
  slot: 'anchor',
  window: [10, 10],
  text: (s) =>
    paras(
      'It is planting season. The villages of the north need seed grain, and what the farmers had saved was eaten in the winter.',
      s.flags.reservesSpent
        ? 'The provincial reserve was distributed in the autumn. There is no seed in the depots.'
        : 'The provincial reserve is still in the depots, and the seed grain is in it.',
    ),
  choices: (s) =>
    s.flags.reservesSpent
      ? [
          {
            id: 'buy-seed',
            label: 'Buy seed grain on the market',
            outcomes: [{ effects: [m('treasury', -12), later(2, [m('welfare', 4)], 'The seed arrives in time, and the fields are sown.')], text: 'Prices are high. The seed is on its way.' }],
          },
          {
            id: 'save-seed',
            label: 'Ask farmers to plant what they have saved',
            outcomes: [{ effects: [m('capacity', -2), m('welfare', -2), flag('poorSpring')], text: 'Many plant thinly. The harvest this year will show it.' }],
          },
          {
            id: 'seed-credit',
            label: 'Provide seed on credit through the county cooperatives',
            outcomes: [{ effects: [m('treasury', -5), m('capacity', -4), later(3, [m('welfare', 3)], 'The cooperatives have seed in the ground.')], text: 'It is a lot of paperwork, and it works.' }],
          },
        ]
      : [
          {
            id: 'free-seed',
            label: 'Distribute seed grain free from the reserve',
            outcomes: [{ effects: [m('treasury', -4), m('welfare', 5), flag('reservesSpent')], text: 'The reserve you kept pays for the spring. Farmers sow with a full bag.' }],
          },
          {
            id: 'sell-seed',
            label: 'Sell seed grain at cost',
            outcomes: [{ effects: [m('treasury', 3), m('welfare', 1)], text: 'Those with money buy. Those without wait.' }],
          },
          {
            id: 'farmers-buy',
            label: 'Keep the reserve and let farmers buy their own seed',
            outcomes: [{ effects: [m('welfare', -3), flag('poorSpring')], text: 'The reserve stays full. The fields do not.' }],
          },
        ],
};

const springFlood = {
  id: 'spring-flood',
  title: 'The Meltwater',
  slot: 'anchor',
  window: [11, 12],
  setup: (s, r) => {
    const severe = r() < 0.5;
    const out = [flag('floodSevere', severe), m('welfare', severe ? -12 : -5)];
    if (s.flags.poorSpring) out.push(m('welfare', -3));
    return out;
  },
  text: (s) =>
    paras(
      s.flags.floodSevere
        ? 'The snowmelt comes all at once. Rivers in the lower valleys burst their banks overnight, and the water is still rising.'
        : 'The snowmelt is heavy. Streams in the lower valleys overflow, and some low fields are underwater.',
      'The same villages that suffered the winter are in the path.',
    ),
  briefing: () => 'Lin: “Whatever we have left, Governor, this is the other thing it was for.”',
  choices: [
    {
      id: 'evacuate',
      label: 'Evacuate and shelter the lower valleys',
      requires: { meter: 'capacity', op: '>=', value: 30 },
      lockedReason: 'The administration is too stretched to run an evacuation (needs Capacity 30).',
      outcomes: [{ effects: [m('treasury', -12), m('capacity', -4), m('welfare', 6)], text: 'It is a hard week, and nobody in the valleys drowns.' }],
    },
    {
      id: 'request-grant',
      label: 'Request a central disaster grant',
      requires: { all: [{ not: { flag: 'aidDispute' } }, { not: { charge: 'concealedLosses', status: 'open' } }, beijingWillHelp] },
      lockedReason: 'Beijing has questions about your earlier reports, remembers how earlier support ended, or has already helped as often as it will.',
      risk: 'Beijing will be watching how it is used.',
      outcomes: [{ effects: [m('treasury', 12), m('capacity', -3), flag('beijingWatching'), askedBeijing], text: 'Beijing approves the grant. It also sends a team to see how it is used.' }],
    },
    {
      id: 'flood-reserve',
      label: 'Use the provincial reserve for flood relief',
      requires: { not: { flag: 'reservesSpent' } },
      lockedReason: 'The reserve was distributed earlier.',
      outcomes: [{ effects: [m('treasury', -3), m('welfare', 8), flag('reservesSpent')], text: 'The reserve you kept is opened. It is exactly what it was for.' }],
    },
    {
      id: 'flood-local',
      label: 'Rely on local authorities',
      outcomes: [{ effects: [m('welfare', -4)], text: 'Local officials do what they can. In the lower valleys it is not much.' }],
    },
  ],
};

const outbreak = {
  id: 'the-outbreak',
  title: 'The Outbreak',
  slot: 'pool',
  window: [9, 13],
  weight: 6,
  when: { flag: 'clinicsDiverted' },
  text: () =>
    paras(
      'Illness is spreading through the northern counties: fever and a bad cough, mostly among the children and the old. The county clinics that were meant to catch it early are the ones you closed to pay for relief.',
    ),
  briefing: () => 'Lin: “This was the cost, Governor. It did not arrive when the money was moved, but it arrived.”',
  choices: [
    {
      id: 'fund-clinics',
      label: 'Reopen and fund the clinics, with extra staff',
      outcomes: [{ effects: [m('treasury', -14), m('capacity', -3), m('welfare', 4), flag('clinicsDiverted', false)], text: 'The clinics reopen within the week. The outbreak peaks and fades.' }],
    },
    {
      id: 'quarantine-only',
      label: 'Quarantine the worst-hit counties with minimal support',
      outcomes: [{ effects: [m('capacity', -4), m('welfare', -5)], text: 'The quarantine holds. Inside it, people are on their own.' }],
    },
    {
      id: 'outbreak-wait',
      label: 'Say little and wait for it to pass',
      outcomes: [{ effects: [m('welfare', -9), flag('outbreakIgnored')], text: 'It passes, in time. Not before a good many people are sick who need not have been.' }],
    },
  ],
};

const audit = {
  id: 'the-audit',
  title: 'The Auditors',
  slot: 'pool',
  window: [9, 13],
  weight: 6,
  when: { flag: 'skimmingContinues' },
  text: () =>
    paras(
      'National auditors have arrived. They have receipts, and they are asking where the relief grain went. The skimming you let run in the winter is no longer a rumour.',
    ),
  choices: [
    {
      id: 'open-books',
      label: 'Open the books and name those responsible',
      outcomes: [{ effects: [m('capacity', -5), m('treasury', -3)], text: 'It is painful, and it is complete. The auditors record that the province cooperated.' }],
    },
    {
      id: 'blame-middlemen',
      label: 'Blame the middlemen and say nothing about the depots',
      risk: 'The auditors may dig further.',
      outcomes: [
        {
          chance: 0.5,
          effects: [m('capacity', -8), { type: 'flagAdd', key: 'beijingConcerns', delta: 1 }],
          text: 'The auditors accept the middlemen, then ask about the depots. The questions take a week to answer, and Beijing hears about it.',
        },
        { effects: [m('capacity', -2)], text: 'The auditors accept the explanation and move on.' },
      ],
    },
    {
      id: 'stall-audit',
      label: 'Delay while records are “reconstructed”',
      outcomes: [{ effects: [m('capacity', -1), { type: 'flagAdd', key: 'beijingConcerns', delta: 1 }], text: 'The auditors note the delay in their file. They are patient people.' }],
    },
  ],
};

const petitionersReturn = {
  id: 'petitioners-return',
  title: 'The Petitioners Return',
  slot: 'pool',
  window: [9, 13],
  weight: 5,
  when: { flag: 'petitionersMovedOn' },
  text: () =>
    paras(
      'The villagers you had security move on in the winter are back, and there are more of them. They have brought photographs of the winter’s dead, and the press is outside.',
    ),
  choices: [
    {
      id: 'meet-now',
      label: 'Meet them now, and hear it all',
      outcomes: [{ effects: [m('capacity', -3), m('welfare', 2), flag('petitionersMovedOn', false)], text: 'It takes the whole afternoon. Some of what they say is hard to hear.' }],
    },
    {
      id: 'send-police',
      label: 'Send in police to clear the compound',
      outcomes: [{ effects: [m('welfare', -6), m('capacity', -2), { type: 'flagAdd', key: 'beijingConcerns', delta: 1 }], text: 'The compound is cleared by evening. The photographs are already online.' }],
    },
    {
      id: 'refer-to-beijing',
      label: 'Refer them to the central petition office in Beijing',
      outcomes: [{ effects: [m('welfare', -1), flag('beijingWatching')], text: 'They are sent on their way, and Beijing now knows that Lingbei cannot settle its own petitions.' }],
    },
  ],
};

const kinScandal = {
  id: 'kin-scandal',
  title: 'The Newspaper',
  slot: 'pool',
  window: [9, 13],
  weight: 5,
  when: { flag: 'kinContract' },
  text: () =>
    paras(
      'A newspaper that has been looking at the relief contracts has published its findings. Tianbao Logistics, your brother-in-law’s firm, appears in the third paragraph, and the figures beside its name are not flattering.',
    ),
  choices: [
    {
      id: 'cancel-and-apologise',
      label: 'Cancel the contract and apologise publicly',
      risk: 'Cancelling costs money and goodwill (Treasury −8, Capacity −4).',
      outcomes: [{ effects: [{ type: 'repairCharge', id: 'favouredKin' }, flag('kinContract', false)], text: 'You cancel the contract and say you should not have awarded it. Han Jie stops speaking to you.' }],
    },
    {
      id: 'defend-procedure',
      label: 'Say the contract followed proper procedure',
      outcomes: [{ effects: [m('capacity', -2), { type: 'flagAdd', key: 'beijingConcerns', delta: 1 }], text: 'Your statement is technically accurate. The newspaper prints the figures again, next to it.' }],
    },
    {
      id: 'kin-silence',
      label: 'Say nothing',
      outcomes: [{ effects: [m('capacity', -1), { type: 'flagAdd', key: 'beijingConcerns', delta: 1 }], text: 'Silence does not stop the story. It lets others write it.' }],
    },
  ],
};

const debtService = {
  id: 'debt-service',
  title: 'The Creditors',
  slot: 'pool',
  window: [9, 13],
  weight: 8,
  when: { meter: 'treasury', op: '<', value: 0 },
  text: (s) =>
    paras(
      `The finance bureau has a stack of notices. The province owes more than it can pay, and the Treasury stands at ${s.meters.treasury}. Creditors and the finance ministry want to know how the province intends to meet its obligations.`,
      'Every answer you can give costs something.',
    ),
  choices: [
    {
      id: 'austerity',
      label: 'Impose austerity: cut spending across the province',
      outcomes: [{ effects: [m('treasury', 18), m('welfare', -6), m('capacity', -4)], text: 'The notices stop coming. So does a good deal else.' }],
    },
    {
      id: 'ask-bailout',
      label: 'Ask Beijing to cover the shortfall',
      requires: { all: [{ not: { flag: 'aidDispute' } }, { not: { flag: 'bailedOut' } }, beijingWillHelp] },
      lockedReason: 'Beijing has already shown how it feels about helping you.',
      risk: 'Beijing does not forget a bailout.',
      outcomes: [{ effects: [m('treasury', 20), flag('bailedOut'), flag('beijingWatching'), askedBeijing], text: 'Beijing covers the shortfall. A note in your file says how.' }],
    },
    {
      id: 'sell-assets',
      label: 'Sell provincial assets',
      outcomes: [
        {
          effects: [m('treasury', 16), m('capacity', -3), flag('assetsSold'), later(3, [m('welfare', -3)], 'The privatised services raise their fees, and people notice.')],
          text: 'The sale closes quickly, and the buyers are pleased.',
        },
      ],
    },
    {
      id: 'miss-payments',
      label: 'Miss some payments and negotiate later',
      outcomes: [{ effects: [m('treasury', 12), m('capacity', -2), flag('defaulted'), { type: 'flagAdd', key: 'beijingConcerns', delta: 1 }], text: 'The creditors are not pleased. The finance ministry is less pleased.' }],
    },
  ],
};

const unrest = {
  id: 'the-unrest',
  title: 'The Unrest',
  slot: 'pool',
  window: [3, 13],
  weight: 14,
  when: { meter: 'welfare', op: '<', value: 30 },
  reveals: ['unrestCause'],
  text: (s) =>
    paras(
      s.meters.welfare < 20
        ? 'Crowds have taken to the streets in several counties. Markets are shut, factories are idle, and a county government building has been set on fire.'
        : 'Protests have broken out in the northern counties. Workers have stopped work, and crowds are gathering outside county offices.',
      'Public security reports that most of the people in the crowds are from villages and neighbourhoods where the winter has been worst. Few have any record of trouble.',
    ),
  briefing: () => 'Lin: “They are not rebels, Governor. They are people who have run out of things to lose. How we answer them will be remembered.”',
  choices: [
    {
      id: 'negotiate-concessions',
      label: 'Announce emergency relief and wage support, and open talks with their representatives',
      outcomes: [{ effects: [m('treasury', -10), m('capacity', -2), m('welfare', 6)], text: 'It is expensive, and it works. Within days the crowds are smaller, and the representatives are at the table.' }],
    },
    {
      id: 'meet-representatives',
      label: 'Meet their representatives and promise to look into their complaints',
      requires: { meter: 'capacity', op: '>=', value: 20 },
      lockedReason: 'The administration is too stretched to run talks on this scale (needs Capacity 20).',
      outcomes: [{ effects: [m('capacity', -3), m('welfare', 3)], text: 'They listen. Whether they believe you depends on what happens next.' }],
    },
    {
      id: 'crush-protest',
      label: 'Send in security forces to clear the streets and detain the leaders',
      charges: [{ id: 'crushedUnrest' }],
      outcomes: [{ effects: [m('capacity', -2), m('welfare', -6), flag('orderRestored')], text: 'The streets are cleared by nightfall. Order returns, and so does resentment.' }],
    },
  ],
};

const reconstruction = {
  id: 'the-reconstruction',
  title: 'Rebuilding',
  slot: 'pool',
  window: [9, 13],
  weight: 2,
  text: () =>
    paras(
      'The winter and the spring floods have left houses cracked, roofs gone, and a number of families sleeping with relatives. The counties want to know what, if anything, the province will do about it.',
    ),
  choices: [
    {
      id: 'rebuild-homes',
      label: 'Fund rebuilding for the worst-hit homes',
      outcomes: [{ effects: [m('treasury', -10), m('welfare', 6)], text: 'It is slow, and families are back in houses by summer.' }],
    },
    {
      id: 'subsidised-loans',
      label: 'Offer subsidised repair loans',
      outcomes: [{ effects: [m('treasury', -4), m('capacity', -2), m('welfare', 3)], text: 'Those who can borrow, repair. Those who cannot, wait.' }],
    },
    {
      id: 'leave-to-market',
      label: 'Leave it to the market and families',
      outcomes: [{ effects: [m('welfare', -2)], text: 'Families rebuild as they can, or leave.' }],
    },
  ],
};

const interimInspection = {
  id: 'interim-inspection',
  title: 'An Early Inspection',
  slot: 'anchor',
  window: [8, 8],
  when: { flag: 'inspectionPending' },
  setup: (s) => {
    const wrongs = s.charges.filter(isWrong).length;
    return wrongs >= 1 ? [flag('interimVerdict', 'removed'), flag('removed')] : [flag('interimVerdict', 'warning'), m('capacity', -3)];
  },
  text: (s) =>
    s.flags.interimVerdict === 'removed'
      ? paras(
          'Lin Wei’s resignation reached Beijing weeks ago, and an inspection group has now arrived. It has gone through the matters he raised and found them unresolved. Beijing’s decision is quick: you are relieved of your post, and a successor is named.',
        )
      : paras(
          'Lin Wei’s resignation reached Beijing weeks ago, and an inspection group has now arrived. It finds the matters he raised were settled, and notes his departure and the unease it caused in the provincial administration. Your standing takes a small hit, and the term continues.',
        ),
  choices: (s) => [
    {
      id: 'continue',
      label: s.flags.interimVerdict === 'removed' ? 'Hand over your office' : 'Continue',
      outcomes: [{ effects: [], text: '' }],
    },
  ],
};

export const SPRING_EVENTS = [
  thaw,
  seedGrain,
  springFlood,
  outbreak,
  audit,
  petitionersReturn,
  kinScandal,
  debtService,
  unrest,
  reconstruction,
  interimInspection,
];
