import { m, flag, fact, later, schedule } from '../helpers.js';
import { CHARGES } from '../charges.js';

const isWrong = (c) => c.status === 'open' && CHARGES[c.id].kind !== 'concern';

const paras = (...p) => p.join('\n\n');

// A cut to rations or services is only a wrong if the money could have been found another way.
const ALTERNATIVES_EXIST = {
  any: [
    { not: { flag: 'bondsUsed' } },
    { all: [{ not: { flag: 'outsideAid' } }, { not: { flag: 'aidDispute' } }] },
  ],
};

const harvestFailure = {
  id: 'harvest-failure',
  title: 'The Harvest Fails',
  slot: 'anchor',
  window: [1, 1],
  reveals: ['coverageGap', 'reservesAdequate'],
  text: () =>
    paras(
      'The numbers reach your desk before dawn. A dry summer and a dry early autumn have ruined the harvest in the hill counties in the north of your province, and twenty villages face a winter without enough grain.',
      'Vice-Governor Lin Wei, who oversees agriculture and disaster relief, arrives with a folder and without small talk.',
      '“Two things you should know before you decide, Governor. The county relief offices can reach thirteen of the twenty villages quickly. The other seven are up a mountain road that has been closed since the spring landslides, and they will wait. And the provincial grain reserve is enough to feed all twenty for a season. Once it is spent, it is spent.”',
    ),
  choices: [
    {
      id: 'open-reserve',
      label: 'Release the provincial grain reserve and distribute free grain to all twenty villages',
      risk: 'A delay on the mountain roads is possible.',
      outcomes: [
        {
          chance: (s) => (s.meters.capacity >= 60 ? 0.15 : 0.3),
          effects: [m('treasury', -25), m('welfare', 7), m('capacity', -5), flag('reliefOn'), flag('reservesSpent'), flag('uncovered', 0)],
          text: 'Trucks leave the provincial depot by noon, but a washed-out bridge strands the first convoy for three days. The grain arrives, later than it should have.',
        },
        {
          effects: [m('treasury', -25), m('welfare', 12), m('capacity', -5), flag('reliefOn'), flag('reservesSpent'), flag('uncovered', 0)],
          text: 'Trucks leave the provincial depot by noon. By the end of the week, every village has grain.',
        },
      ],
    },
    {
      id: 'targeted-relief',
      label: 'Targeted relief through the county offices, starting with the villages they can reach',
      risk: 'The offices may reach a little further than planned, or not.',
      outcomes: [
        {
          chance: 0.2,
          effects: [m('treasury', -10), m('welfare', 8), m('capacity', -2), flag('reliefOn'), flag('uncovered', 3), fact('unreachedKnown')],
          text: 'The offices stretch further than planned and cover seventeen villages. Three remain unreached; Lin has their names.',
        },
        {
          effects: [m('treasury', -10), m('welfare', 8), m('capacity', -2), flag('reliefOn'), flag('uncovered', 7), fact('unreachedKnown')],
          text: 'County offices begin distribution within days. Thirteen villages are covered. Lin has the names of the other seven on his desk.',
        },
      ],
    },
    {
      id: 'appeal-outside',
      label: 'Appeal to Beijing and a wealthier province for emergency support',
      risk: 'Conditions apply, Beijing will be watching, and it must be repaid (Treasury −15 in 5 turns).',
      outcomes: [
        {
          effects: [
            m('treasury', 5),
            m('welfare', 6),
            m('capacity', -4),
            flag('reliefOn'),
            flag('outsideAid'),
            flag('beijingWatching'),
            flag('uncovered', 7),
            fact('unreachedKnown'),
            schedule('counterpart-delegation', 4),
            {
              type: 'commitment',
              id: 'beijingSupportRepayment',
              label: 'Repay the emergency support (Treasury −15)',
              dueIn: 5,
              effects: [m('treasury', -15)],
              text: 'The emergency support falls due for repayment.',
            },
          ],
          text: 'Beijing approves an emergency allocation, and a wealthier coastal province agrees to send grain and staff. Both attach conditions you have not yet seen, and both will expect to be repaid. County offices begin distribution, but seven villages remain beyond their reach.',
        },
      ],
    },
    {
      id: 'hold-reserve',
      label: 'Hold the reserve for now and let the grain market adjust',
      risk: 'Grain prices are likely to rise.',
      charges: [{ id: 'failedTrust' }],
      outcomes: [
        {
          effects: [m('welfare', -12), flag('reservesHeld'), flag('uncovered', 20)],
          text: 'Prices begin to climb. By the second week, reports of empty pantries start to arrive.',
        },
      ],
    },
  ],
};

const depotThefts = {
  id: 'depot-thefts',
  title: 'Raids on the Depots',
  slot: 'anchor',
  group: 'thefts',
  window: [2, 3],
  when: { flag: 'uncovered', op: '>', value: 0 },
  setup: (s, r) => (r() < 0.4 ? [flag('ringPresent')] : []),
  text: () =>
    paras(
      'Grain depots in three counties were broken into overnight. The amount taken is small, but the photographs are everywhere. Lin’s report is brief: most of the raiders were villagers, and nearly all of them came from villages the relief has not reached.',
      'The public security department wants a curfew in the affected counties. The prefecture leadership wants an example made.',
    ),
  choices: [
    {
      id: 'punish',
      label: 'Impose a curfew and punish everyone caught',
      risk: 'Order will return quickly.',
      charges: [{ id: 'entrapment', when: { flag: 'uncovered', op: '>', value: 0 } }],
      outcomes: [
        {
          when: { flag: 'ringPresent' },
          effects: [m('treasury', -3), m('welfare', -3), flag('orderRestored'), flag('ringCaught')],
          text: 'Order returns within days. Among those arrested, police find the organisers of a small ring that had been reselling stolen grain.',
        },
        {
          when: { not: { flag: 'ringPresent' } },
          effects: [m('treasury', -3), m('welfare', -3), flag('orderRestored')],
          text: 'Order returns within days. Nobody says why the raids started.',
        },
      ],
    },
    {
      id: 'suspend-and-extend',
      label: 'Suspend punishments and send relief to the unreached villages',
      outcomes: [
        {
          effects: [m('treasury', -12), m('capacity', -5), m('welfare', 8), flag('uncovered', 0)],
          text: 'The raids stop within two days. Nobody calls it leadership; there is simply no longer a reason to raid a depot.',
        },
      ],
    },
    {
      id: 'pursue-organisers',
      label: 'Pardon petty theft and go after the organisers',
      requires: { meter: 'capacity', op: '>=', value: 40 },
      lockedReason: 'Investigators are stretched too thin (needs Capacity 40).',
      risk: (s) => (s.meters.capacity >= 60 ? 'Likely to succeed.' : 'Even odds of success.'),
      outcomes: [
        {
          chance: (s) => (s.meters.capacity >= 60 ? 0.8 : 0.6),
          effects: [m('treasury', -5), m('welfare', 3)],
          text: 'Investigators arrest a handful of resellers. Villagers who took grain for their families are left alone, though the villages are still without relief.',
        },
        {
          effects: [m('welfare', -3), flag('investigationStalled')],
          text: 'Investigators lose the trail. The raids slow but do not stop.',
        },
      ],
    },
  ],
};

const depotSkimming = {
  id: 'depot-skimming',
  title: 'Skimming at the Depots',
  slot: 'anchor',
  group: 'thefts',
  window: [2, 3],
  when: { all: [{ flag: 'uncovered', value: 0 }, { flag: 'reliefOn' }] },
  reveals: ['skimmingKnown'],
  text: () =>
    paras(
      'The relief is reaching every village, and that is the problem. Lin has found that at one depot in three, sacks are going missing between the warehouse and the trucks. The thieves are not hungry villagers but middlemen.',
    ),
  choices: [
    {
      id: 'crack-down',
      label: 'Crack down: arrest everyone connected to the depots',
      outcomes: [
        {
          chance: 0.3,
          effects: [m('treasury', -3), m('welfare', -4), m('capacity', 2), flag('orderRestored')],
          text: 'The arrests sweep up some junior porters who had nothing to do with it. Lin mentions it quietly.',
        },
        {
          effects: [m('treasury', -3), m('welfare', -2), m('capacity', 2), flag('orderRestored')],
          text: 'The skimming stops, and the staff learn that you will act.',
        },
      ],
    },
    {
      id: 'audit-chain',
      label: 'Audit the supply chain end to end',
      outcomes: [
        {
          effects: [m('treasury', -5), m('capacity', -3), m('welfare', 3), flag('chainAudited')],
          text: 'The audit is slow and tedious. It also finds where the grain went and who signed for it.',
        },
      ],
    },
    {
      id: 'let-it-run',
      label: 'Let it run: relief is arriving and the loss is modest',
      charges: [{ id: 'lookedAway' }],
      outcomes: [
        {
          effects: [m('welfare', -4), flag('skimmingContinues')],
          text: 'The sacks keep disappearing. Villages further down the line notice first.',
        },
      ],
    },
  ],
};

const photograph = {
  id: 'the-photograph',
  title: 'The Photograph',
  slot: 'pool',
  window: [2, 7],
  weight: 3,
  when: { flag: 'uncovered', op: '>', value: 0 },
  reveals: ['unreachedKnown'],
  text: (s) =>
    paras(
      `A photograph spreads on social media overnight: a girl of about six in a doorway in Hongyan village, holding an empty bowl. Hongyan has not been reached by relief. It is one of ${s.flags.uncovered} villages still waiting.`,
      'By noon the image is everywhere, and your press office wants to know whether the Governor has seen it.',
    ),
  briefing: () => 'Lin: “She is not the only one, Governor. There are other villages like Hongyan on my list.”',
  choices: [
    {
      id: 'visit-hongyan',
      label: 'Travel to Hongyan and airlift supplies for the village',
      charges: [{ id: 'notExtended', when: { all: [{ meter: 'treasury', op: '>=', value: 12 }, { flag: 'uncovered', op: '>', value: 0 }] } }],
      outcomes: [
        {
          effects: [m('treasury', -5), m('welfare', 2)],
          text: 'State television covers your visit. The girl in the photograph is given a coat and a hot meal.',
        },
      ],
    },
    {
      id: 'extend-all',
      label: 'Extend relief to every unreached village now',
      outcomes: [
        {
          effects: [m('treasury', -12), m('capacity', -5), m('welfare', 8), flag('uncovered', 0)],
          text: 'It is expensive and it stretches the county offices thin. By the weekend, no village on Lin’s list is without grain.',
        },
      ],
    },
    {
      id: 'delegate-extend',
      label: 'Order the ministry to extend relief to all unreached villages, more slowly',
      risk: 'About a one in four chance of a further delay.',
      outcomes: [
        {
          chance: 0.25,
          effects: [
            m('treasury', -8),
            m('capacity', -3),
            flag('extendPending'),
            flag('uncovered', 0),
            later(3, [m('welfare', 5)], 'The delayed relief finally reaches the remaining villages.'),
          ],
          text: 'The ministry begins, but the mountain road defeats the first convoy.',
        },
        {
          effects: [
            m('treasury', -8),
            m('capacity', -3),
            flag('extendPending'),
            flag('uncovered', 0),
            later(2, [m('welfare', 5)], 'The relief reaches the remaining villages.'),
          ],
          text: 'The ministry takes on the task. It is slower, and it is cheaper.',
        },
      ],
    },
    {
      id: 'say-nothing',
      label: 'Say nothing and let the news cycle pass',
      charges: [{ id: 'notExtended', when: { all: [{ meter: 'treasury', op: '>=', value: 12 }, { flag: 'uncovered', op: '>', value: 0 }] } }],
      outcomes: [
        {
          effects: [m('welfare', -1)],
          text: 'The photograph is replaced within a day. The girl is still in the doorway.',
        },
      ],
    },
  ],
};

const contract = {
  id: 'the-contract',
  title: 'The Contract',
  slot: 'pool',
  window: [2, 7],
  weight: 2,
  when: { flag: 'reliefOn' },
  reveals: ['kinFirmRecord'],
  text: () =>
    paras(
      'Relief supplies need trucking, and your brother-in-law Han Jie runs Tianbao Logistics. He has called your office twice. His bid is twenty percent above the going rate, and the procurement office’s file shows the firm delivered late on two earlier provincial contracts.',
    ),
  briefing: () => 'Lin: “I am not saying no, Governor. I am saying you should know.”',
  choices: [
    {
      id: 'award-kin',
      label: 'Award the contract to Tianbao Logistics',
      risk: 'A fast start, or a late delivery.',
      charges: [{ id: 'favouredKin' }],
      outcomes: [
        {
          chance: 0.5,
          effects: [m('treasury', -8), m('welfare', 4), flag('kinContract')],
          text: 'Trucks are moving within two days. Han Jie sends flowers to your office.',
        },
        {
          effects: [
            m('treasury', -8),
            m('welfare', 4),
            flag('kinContract'),
            later(2, [m('welfare', -6)], 'Tianbao’s trucks arrive late. A local newspaper has the story.'),
          ],
          text: 'Trucks are moving within two days. Han Jie sends flowers to your office.',
        },
      ],
    },
    {
      id: 'open-tender',
      label: 'Open a public tender',
      outcomes: [
        {
          effects: [m('treasury', -3), m('capacity', -3), later(2, [m('welfare', 4)], 'The tendered contract begins delivering.')],
          text: 'It takes longer. Nobody can say you picked the winner.',
        },
      ],
    },
    {
      id: 'state-transport',
      label: 'Use the province’s own transport units',
      outcomes: [
        {
          effects: [m('treasury', -2), m('capacity', -5), m('welfare', 2)],
          text: 'It strains the units, but it is done in-house and on time.',
        },
      ],
    },
  ],
};

const hoarders = {
  id: 'the-hoarders',
  title: 'The Hoarders',
  slot: 'pool',
  window: [2, 7],
  weight: 2,
  when: { any: [{ flag: 'reliefOn' }, { flag: 'reservesHeld' }] },
  text: () =>
    paras(
      'Rice prices in the northern counties have doubled in a month. Market regulators have found that several wholesalers are sitting on warehouses of grain, waiting for prices to rise further.',
    ),
  choices: [
    {
      id: 'price-ceiling',
      label: 'Decree a price ceiling',
      risk: 'A black market may follow.',
      outcomes: [
        {
          chance: 0.35,
          effects: [m('capacity', -3), flag('blackMarket')],
          text: 'The ceiling holds in the shops and collapses in the alleys. Grain is changing hands out of vans.',
        },
        {
          effects: [m('capacity', -3), m('welfare', 4)],
          text: 'The ceiling holds. Shopkeepers grumble and shoppers do not.',
        },
      ],
    },
    {
      id: 'inspect-requisition',
      label: 'Inspect warehouses and buy the stock at the regulated price',
      requires: { meter: 'capacity', op: '>=', value: 40 },
      lockedReason: 'The regulators are stretched too thin (needs Capacity 40).',
      outcomes: [
        {
          effects: [m('treasury', -8), m('capacity', -6), m('welfare', 6)],
          text: 'Inspectors empty three warehouses. The grain goes to the markets that need it.',
        },
      ],
    },
    {
      id: 'let-prices-adjust',
      label: 'Let prices adjust',
      outcomes: [
        {
          effects: [m('welfare', -5)],
          text: 'Prices stay high through the month. Families skip meals.',
        },
      ],
    },
  ],
};

const fieldReport = {
  id: 'the-field-report',
  title: 'The Field Report',
  slot: 'pool',
  window: [2, 7],
  weight: 2,
  when: { flag: 'reliefOn' },
  setup: (s, r) => (r() < 0.6 ? [flag('reportAccurate')] : []),
  text: () =>
    paras(
      'A county deputy head, Yu Min, has written to you directly: relief shipments in his county are being skimmed by the county head. He attaches receipts.',
    ),
  briefing: () => 'Lin’s note on the file reads: “Credibility uncertain. The deputy has a history with the county head.”',
  choices: [
    {
      id: 'act-at-once',
      label: 'Act at once: dismiss the county head and send replacements',
      outcomes: [
        {
          when: { flag: 'reportAccurate' },
          effects: [m('capacity', -6), m('treasury', -3), m('welfare', 6)],
          text: 'The skimming stops. The replacement team finds the books as the deputy described them.',
        },
        {
          when: { not: { flag: 'reportAccurate' } },
          effects: [m('capacity', -10), m('treasury', -3), m('welfare', -3), flag('innocentDismissed')],
          text: 'The county head is gone. The replacement team finds nothing wrong, and the deputy’s old quarrel is now your problem.',
        },
      ],
    },
    {
      id: 'send-inspectors',
      label: 'Send inspectors first',
      outcomes: [
        {
          when: { flag: 'reportAccurate' },
          effects: [m('capacity', -3), m('treasury', -2), m('welfare', 2)],
          text: 'The inspectors confirm the deputy’s account, and the county head is removed a week later than he might have been.',
        },
        {
          when: { not: { flag: 'reportAccurate' } },
          effects: [m('capacity', -3), m('treasury', -2), m('welfare', -2)],
          text: 'The inspectors find the accusation was a quarrel dressed up as a report. The week it cost is gone.',
        },
      ],
    },
    {
      id: 'take-no-action',
      label: 'Take no action',
      outcomes: [
        {
          when: { flag: 'reportAccurate' },
          effects: [m('welfare', -6), flag('skimmingContinues')],
          text: 'The skimming continues. Months later, you will learn the receipts were genuine.',
        },
        {
          when: { not: { flag: 'reportAccurate' } },
          effects: [],
          text: 'Nothing happens. The accusation fades away.',
        },
      ],
    },
  ],
};

const petition = {
  id: 'the-petition',
  title: 'The Petition',
  slot: 'pool',
  window: [2, 7],
  weight: 2,
  when: { flag: 'uncovered', op: '>', value: 0 },
  text: () =>
    paras(
      'Two hundred villagers from the north have travelled to the provincial capital by bus and on foot. They are standing outside the government compound with a petition. They are orderly, and they are not leaving.',
      'The compound’s security chief wants them moved on before the evening news.',
    ),
  briefing: () => 'Lin: “They walked the last forty kilometres, Governor. I would listen.”',
  choices: [
    {
      id: 'receive-in-person',
      label: 'Receive the delegation in person',
      outcomes: [
        {
          effects: [m('capacity', -2), m('welfare', 1)],
          text: 'You listen for an hour. They tell you which mountain roads are open and which are not, and their list is more accurate than the ministry’s.',
        },
      ],
    },
    {
      id: 'send-deputy',
      label: 'Send a deputy to receive the petition',
      outcomes: [
        {
          effects: [m('capacity', -1)],
          text: 'The petition is accepted and filed. The villagers go home with a receipt.',
        },
      ],
    },
    {
      id: 'move-them-on',
      label: 'Have security move them on',
      outcomes: [
        {
          effects: [m('welfare', -3), m('capacity', -1)],
          text: 'They are bused home by evening. The petition is not read, and it will not be forgotten.',
        },
      ],
    },
  ],
};

const shortfall = {
  id: 'budget-shortfall',
  title: 'The Shortfall',
  slot: 'pool',
  window: [3, 7],
  weight: 4,
  when: { flag: 'reliefOn' },
  text: (s) =>
    paras(
      'The provincial finance bureau has run the numbers. At the current rate, relief spending will exhaust the budget within two weeks, and the cold has not even arrived.',
      s.meters.treasury < 20
        ? 'There is very little left in the Treasury, and the bureau chief says so plainly.'
        : 'There is still some money, but not enough for what is coming.',
    ),
  briefing: () => 'Lin: “Every option here costs someone, Governor. I would rather you choose which than have the budget choose for you.”',
  choices: [
    {
      id: 'cut-rations',
      label: 'Reduce rations in the covered villages by a quarter',
      charges: [{ id: 'squeezedPeople', when: ALTERNATIVES_EXIST }],
      outcomes: [
        {
          effects: [m('treasury', 12), m('welfare', -7), flag('rationsCut')],
          text: 'The money lasts longer. Families in the covered villages stretch the grain by skipping meals, and Lin hears about it from the county offices.',
        },
      ],
    },
    {
      id: 'divert-budgets',
      label: 'Divert county clinic and school budgets to relief',
      charges: [{ id: 'squeezedPeople', when: ALTERNATIVES_EXIST }],
      outcomes: [
        {
          effects: [
            m('treasury', 10),
            m('capacity', -4),
            later(3, [m('welfare', -5)], 'Clinics that were short of staff in autumn are closed by winter, and the illnesses they would have caught are not being caught.'),
          ],
          text: 'The transfer is approved without much argument. Nobody sees the cost yet.',
        },
      ],
    },
    {
      id: 'special-bonds',
      label: 'Raise money through a special bond issue',
      requires: { not: { flag: 'bondsUsed' } },
      lockedReason: 'The bond market will not take another issue.',
      risk: 'Repayment: Treasury −28 in 3 turns. Bonds sold in a crisis carry a high yield.',
      outcomes: [
        {
          effects: [
            m('treasury', 20),
            m('capacity', -2),
            flag('bondsUsed'),
            {
              type: 'commitment',
              id: 'bondRepayment',
              label: 'Repay the special bond issue (Treasury −28)',
              dueIn: 3,
              effects: [m('treasury', -28)],
              text: 'The bond repayment comes due, with interest.',
            },
          ],
          text: 'The bonds sell quickly, at a high yield. The repayment date is on the calendar.',
        },
      ],
    },
    {
      id: 'ask-beijing-loan',
      label: 'Ask Beijing for an emergency loan',
      requires: { all: [{ not: { flag: 'aidDispute' } }, { not: { flag: 'outsideAid' } }] },
      lockedReason: 'Beijing is still waiting on the last round of support.',
      risk: 'Conditions apply, Beijing will be watching, and it must be repaid (Treasury −24 in 4 turns).',
      outcomes: [
        {
          effects: [
            m('treasury', 18),
            m('capacity', -3),
            flag('outsideAid'),
            flag('beijingWatching'),
            schedule('counterpart-delegation', 3),
            {
              type: 'commitment',
              id: 'beijingLoanRepayment',
              label: 'Repay the emergency loan (Treasury −24)',
              dueIn: 4,
              effects: [m('treasury', -24)],
              text: 'The emergency loan falls due for repayment.',
            },
          ],
          text: 'Beijing agrees, and a delegation will follow to see how the money is used. It will also want it back.',
        },
      ],
    },
    {
      id: 'delay-wages',
      label: 'Delay wages to relief and county staff',
      risk: 'Staff may walk out.',
      outcomes: [
        {
          chance: 0.4,
          effects: [m('treasury', 8), m('capacity', -10), m('welfare', -4)],
          text: 'The delay saves money. Within a week, relief workers stage a walkout, and trucks sit idle.',
        },
        {
          effects: [m('treasury', 8), m('capacity', -10)],
          text: 'The delay saves money. Staff grumble and stay, but the offices are visibly slower.',
        },
      ],
    },
  ],
};

const shortfall2 = {
  ...shortfall,
  id: 'budget-shortfall-2',
  title: 'The Shortfall Returns',
  slot: 'anchor',
  window: [5, 6],
  weight: undefined,
  text: (s) =>
    paras(
      'The finance bureau is back, and the news is no better. The winter has barely started, and the budget is short again.',
      s.meters.treasury < 0
        ? 'The province is already borrowing to keep services running.'
        : 'What is left will not carry the province through the cold.',
    ),
};

const counterpartDelegation = {
  id: 'counterpart-delegation',
  title: 'The Counterpart Province',
  slot: 'scheduled',
  when: { flag: 'outsideAid' },
  text: () =>
    paras(
      'A delegation from the wealthier province has arrived, together with an official from a central ministry. They are courteous. They are also clear: the support you requested comes with conditions. They want itemised accounts of how it is being used, joint monitoring of distribution in the villages, and a results report.',
    ),
  briefing: () => 'Lin: “They are within their rights, Governor. It is not unreasonable. It is also a great deal of work.”',
  choices: [
    {
      id: 'accept-conditions',
      label: 'Accept the conditions in full',
      outcomes: [{ effects: [m('capacity', -6), flag('outsideAid', false)], text: 'Joint monitoring teams arrive within the week. Your staff grumble, and the books are open.' }],
    },
    {
      id: 'accept-with-report',
      label: 'Accept in part and promise a results report in two turns',
      risk: 'The report will take staff time you may not have.',
      outcomes: [
        {
          effects: [
            m('capacity', -3),
            {
              type: 'commitment',
              id: 'resultsReport',
              label: 'Results report to your counterpart province and Beijing',
              dueIn: 2,
              effects: [m('capacity', -4), flag('outsideAid', false)],
              failIf: { meter: 'capacity', op: '<', value: 25 },
              failEffects: [m('capacity', -10), flag('aidDispute'), flag('outsideAid', false)],
              text: 'The results report goes out on time.',
              failText: 'The results report is late and thin. Your counterparts and the ministry take note.',
            },
          ],
          text: 'The delegation accepts the compromise, with a date attached.',
        },
      ],
    },
    {
      id: 'return-funds',
      label: 'Decline the conditions and return the unspent portion',
      outcomes: [
        {
          effects: [m('treasury', -10), m('welfare', -3), flag('aidDispute'), flag('outsideAid', false)],
          text: 'The delegation leaves. Beijing will hear about this before the week is out.',
        },
      ],
    },
  ],
};

const coldWave = {
  id: 'cold-wave',
  title: 'The Cold Wave',
  slot: 'anchor',
  window: [6, 7],
  setup: (s, r) => {
    const severe = r() < 0.5;
    const out = [flag('severe', severe), m('welfare', severe ? -16 : -7)];
    if (s.flags.uncovered > 0) out.push(m('welfare', -6));
    if (s.flags.skimmingContinues) out.push(m('welfare', -3));
    if (s.flags.blackMarket) out.push(m('welfare', -2));
    if (s.flags.rationsCut) out.push(m('welfare', -3));
    if (s.flags.chainAudited) out.push(m('welfare', 2));
    return out;
  },
  text: (s) =>
    paras(
      s.flags.severe
        ? 'The cold arrives early and hard. Overnight temperatures in the north fall to levels not seen in a decade.'
        : 'An early cold snap settles over the north. It is bad, but it is not the worst the region has seen.',
      s.flags.uncovered > 0
        ? 'The villages without relief are hit hardest, with no stored grain and no fuel.'
        : 'Villages that received relief are coping, if only just.',
    ),
  briefing: () => 'Lin: “Whatever we have left, Governor, this is what it was for.”',
  choices: [
    {
      id: 'emergency-aid',
      label: 'Fund an emergency aid package',
      outcomes: [
        {
          effects: (s) => [m('treasury', -20), m('welfare', s.flags.severe ? 12 : 9)],
          text: 'Aid goes out within the week. It is expensive, and it is enough.',
        },
      ],
    },
    {
      id: 'draw-reserve',
      label: 'Draw on the provincial grain reserve',
      requires: { not: { flag: 'reservesSpent' } },
      lockedReason: 'The reserve was distributed in the autumn.',
      note: (s) =>
        s.flags.reservesHeld
          ? 'Holding the reserve in autumn left it for the cold wave. That is why the shortcut worked. It is also why neither Mencius nor this game treats success as the measure of a wrong.'
          : null,
      outcomes: [
        {
          effects: [m('treasury', -5), m('welfare', 10), flag('reservesSpent')],
          text: 'The reserve is opened. For the first time in months, the province has grain in hand.',
        },
      ],
    },
    {
      id: 'ask-outside',
      label: 'Request emergency support from Beijing and your counterpart province',
      requires: { not: { flag: 'aidDispute' } },
      lockedReason: 'Beijing and your counterpart province remember how the earlier support ended.',
      outcomes: [
        {
          effects: [m('treasury', -3), m('welfare', 6), m('capacity', -2)],
          text: 'Beijing approves a smaller package than before, but it arrives.',
        },
      ],
    },
    {
      id: 'rely-local',
      label: 'Rely on local authorities',
      outcomes: [
        {
          effects: [m('welfare', -3)],
          text: 'Local officials do what they can. In the unreached villages, it is not much.',
        },
      ],
    },
  ],
};

const beijingReview = {
  id: 'beijing-review',
  title: 'The Inspection',
  slot: 'anchor',
  window: [8, 8],
  setup: (s) => {
    const open = s.charges.filter(isWrong).length;
    // What the province still owes counts: the inspectors read the books, not just the balance.
    const owed = s.commitments.flatMap((c) => c.effects).filter((e) => e.type === 'meter' && e.key === 'treasury').reduce((a, e) => a + e.delta, 0);
    const borrowed = s.flags.bondsUsed || s.flags.beijingWatching;
    const fiscal = borrowed && s.meters.treasury + owed < 0 ? [flag('fiscalCriticism'), m('capacity', -5)] : [];
    // Beijing looks harder at a province that drew on central support.
    const censureAt = s.flags.beijingWatching ? 1 : 2;

    if (!s.ministerPresent) {
      if (open >= 1) return [flag('verdict', 'removed'), flag('removed')];
      return [flag('verdict', 'warning'), m('capacity', -3), ...fiscal];
    }
    if (open >= censureAt) return [flag('verdict', 'censure'), m('capacity', -10), ...fiscal];
    if (open >= 1) return [flag('verdict', 'warning'), m('capacity', -3), ...fiscal];
    return [flag('verdict', 'commended'), ...fiscal];
  },
  text: (s) => {
    const intro =
      'A central inspection group from Beijing has spent a week reviewing the province’s response to the drought.';
    const extras = [
      s.flags.beijingWatching && s.flags.verdict !== 'removed'
        ? 'Because the province drew on central support, the group examined how every yuan of it was used.'
        : null,
      s.flags.fiscalCriticism
        ? 'It also criticises the province’s borrowing: more was owed than the province could comfortably repay.'
        : null,
    ].filter(Boolean);
    const body = (() => {
      switch (s.flags.verdict) {
        case 'removed':
          return 'Lin Wei’s resignation has reached Beijing, and with it the matters he could not get you to address. The group finds those matters unresolved. Beijing’s decision comes within the week: you are relieved of your post, and a successor is named.';
        case 'censure':
          return 'Its report criticises the province’s handling of several matters left unresolved. Your authority within the province suffers. The group gives you one chance to put one of them right in front of it.';
        case 'warning':
          return s.ministerPresent
            ? 'Its report records one unresolved matter and a note of criticism. Your standing in the provincial administration takes a small hit.'
            : 'Lin Wei’s resignation prompted the review. The group found the matters he raised had been settled before it arrived. It notes his departure and the unease it caused in the provincial administration.';
        default:
          return 'Its report contains no criticism of how the people in your care were treated. It also contains no reward. Nothing attaches to it for conduct. The record is only a record.';
      }
    })();
    return paras(intro, body, ...extras);
  },
  choices: (s) =>
    s.flags.verdict === 'censure'
      ? [
          {
            id: 'put-right',
            label: 'Put the oldest unresolved matter right in front of the group',
            outcomes: [
              {
                effects: (st) => [{ type: 'repairCharge', id: st.charges.find(isWrong).id }],
                text: 'You do what Lin asked you to do weeks ago. The group notes that it was done only when Beijing was watching.',
              },
            ],
          },
          {
            id: 'reject-criticism',
            label: 'Reject the criticism',
            outcomes: [
              {
                effects: [{ type: 'openCharge', id: 'silencedRemonstrance' }],
                text: 'The group records your objection and the matters it concerns. They will be in the file.',
              },
            ],
          },
        ]
      : [
          {
            id: 'continue',
            label: s.flags.verdict === 'removed' ? 'Hand over your office' : 'Continue',
            outcomes: [{ effects: [], text: '' }],
          },
        ],
};

const quietWeek = {
  id: 'quiet-week',
  title: 'The Weekly Review',
  slot: 'fallback',
  text: () =>
    paras(
      'No new crisis lands on your desk this week, which means every ongoing cost does. Your staff are behind on everything, and the finance bureau wants to know where the money should go.',
    ),
  choices: [
    {
      id: 'visit-counties',
      label: 'Visit the affected counties',
      outcomes: [{ effects: [m('welfare', 2), m('capacity', -2)], text: 'People tell you things they would not tell Lin. You come back with a longer list and a more tired staff.' }],
    },
    {
      id: 'strengthen-admin',
      label: 'Strengthen the administration: training, staffing, paperwork',
      outcomes: [{ effects: [m('treasury', -4), m('capacity', 4)], text: 'It is unglamorous work, and the offices run a little better for it.' }],
    },
    {
      id: 'cut-spending',
      label: 'Cut back non-essential spending across the province',
      outcomes: [{ effects: [m('treasury', 5), m('capacity', -3), m('welfare', -2)], text: 'The savings are real. So are the complaints from every department that lost something.' }],
    },
  ],
};

export const ARC1_EVENTS = [
  harvestFailure,
  depotThefts,
  depotSkimming,
  photograph,
  contract,
  hoarders,
  fieldReport,
  petition,
  shortfall,
  shortfall2,
  counterpartDelegation,
  coldWave,
  beijingReview,
  quietWeek,
];
