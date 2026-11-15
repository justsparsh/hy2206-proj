import { m, flag } from './helpers.js';

// Each charge is a specific wrong the player can knowingly commit.
// `source.status`: direct (the passage addresses it), inference (an application of the passage),
// adaptation (game design; no verified passage applies).
export const CHARGES = {
  entrapment: {
    id: 'entrapment',
    label: 'Punishing people the relief had not reached',
    requiresFact: 'coverageGap',
    source: {
      passage: 'Mencius 1A7',
      status: 'direct',
      note:
        '“When they thereupon sink into crime, to go and punish the people is to trap them. When there are benevolent persons in positions of authority, how is it possible for them to trap the people?” (Van Norden 2008, as quoted in the Stanford Encyclopedia of Philosophy.)',
    },
    linLine:
      'The people you punished did not take grain for profit, Governor. They took it because we had not come. I would not be doing my job if I let this pass.',
    correctLabel: 'Review the arrests, release those detained, and send relief to the unreached villages',
    correct: {
      effects: [m('treasury', -10), m('capacity', -3), m('welfare', 6), flag('uncovered', 0)],
      text: 'You order the arrests reviewed, the detainees released, and relief sent over the pass.',
    },
    defence: {
      when: { flag: 'ringCaught' },
      outcomeDependent: true,
      acceptText:
        'You point out that those arrested included the organisers of a ring reselling grain. Lin considers it. “That is true. It does not make the others less hungry. But I will not call it a trap for the men who were profiting.” He lets the matter rest.',
    },
    opened:
      'You had been told that seven villages could not be reached quickly. When people in those villages raided depots, you punished them rather than reaching them.',
  },

  failedTrust: {
    id: 'failedTrust',
    label: 'Holding back the grain reserve while people went hungry',
    requiresFact: 'reservesAdequate',
    source: {
      passage: 'Mencius 1B6',
      status: 'inference',
      note:
        'Mencius asks King Xuan what should be done to a man who lets the family entrusted to him go hungry and cold, and then what should be done if the state has no proper government. The king “looked left and right and spoke of other things.” (Sources of Chinese Tradition, via Columbia University.) Applying this to a withheld reserve is an inference.',
    },
    linLine:
      'Suppose a man entrusted his family to a friend, and came back to find them hungry and cold. What should he do about that friend? … Now suppose a province is entrusted to someone, and the villages of the north are empty while the reserve sits full. What should be done about that?',
    suppressLabel: 'Change the subject',
    correctLabel: 'Open the reserve now, late as it is',
    correct: {
      effects: [m('treasury', -25), m('welfare', 10), flag('reservesSpent'), flag('reliefOn'), flag('uncovered', 0)],
      text: 'You order the provincial reserve opened. It is later than it should have been, and you both know it.',
    },
    defence: null,
    opened:
      'You were told the reserve could feed every affected village, and you held it back. This is the situation Mencius describes in 1B6: a trust handed to someone and left unmet.',
  },

  notExtended: {
    id: 'notExtended',
    label: 'Helping the one visible case and leaving the rest',
    source: {
      passage: 'Mencius 1A7 (the ox)',
      status: 'inference',
      note:
        'A king spares an ox out of pity but ignores the suffering of his own people. Mencius urges him to extend the same compassion to them (Stanford Encyclopedia of Philosophy). Applying this to a single publicised case is an inference.',
    },
    linLine:
      'You went to Hongyan, and that child will eat. There are other villages on my list, and nobody has taken a picture of them.',
    correctLabel: 'Extend relief to the remaining villages',
    correct: {
      effects: [m('treasury', -12), m('capacity', -5), m('welfare', 8), flag('uncovered', 0)],
      text: 'You order relief extended to every village still on Lin’s list.',
    },
    defence: {
      when: { meter: 'treasury', op: '<', value: 12 },
      outcomeDependent: true,
      acceptText:
        'You explain that the money is no longer there. Lin checks the figures and nods slowly. “Then we ask Beijing again. But I take your point.”',
    },
    opened:
      'You saw one photograph and could afford to reach the other villages. The one you helped is not the point of the passage; the others are.',
  },

  favouredKin: {
    id: 'favouredKin',
    label: 'Awarding the relief contract to a relative’s firm',
    requiresFact: 'kinFirmRecord',
    source: {
      passage: 'No verified passage',
      status: 'adaptation',
      note:
        'Game design. Mencius discusses differentiated concern for family (7A45), but nothing verified here says it licenses favouritism in public office. Mencius 5A3 (Shun and his brother) is a research lead and is unverified.',
    },
    linLine:
      'The contract went to your brother-in-law’s firm. I told you its record. I am telling you again.',
    correctLabel: 'Cancel the contract and open it to tender',
    correct: {
      effects: [m('treasury', -8), m('capacity', -4), flag('kinContract', false)],
      text: 'You cancel the contract and open it to tender. Han Jie does not return your calls.',
    },
    defence: null,
    opened:
      'You knowingly gave a contract to a relative whose record you had been told was poor. Whether the firm happened to perform was luck; the choice was not.',
  },

  leftWaiting: {
    id: 'leftWaiting',
    label: 'Leaving known villages waiting for relief',
    requiresFact: 'unreachedKnown',
    // Opens by itself at the start of a turn, so neglect is a charge even if no single choice caused it.
    trigger: {
      all: [
        { flag: 'uncovered', op: '>', value: 0 },
        { turn: true, op: '>=', value: 4 },
        { meter: 'treasury', op: '>=', value: 8 },
      ],
    },
    source: {
      passage: 'Mencius 1A7',
      status: 'inference',
      note:
        'Stanford’s account of Mencius says it is the obligation of government to ensure that the people are well-fed and free from the fear of violence, and that compassion should be extended from the case in front of you to the rest (the ox passage). Treating weeks of neglect of known villages as a failure of that obligation is an inference.',
    },
    linLine:
      'The villages over the pass have been waiting for weeks, Governor. We could have reached some of them by now. I need to know why we have not.',
    correctLabel: 'Send relief to the waiting villages now',
    correct: {
      effects: [m('treasury', -12), m('capacity', -5), m('welfare', 8), flag('uncovered', 0)],
      text: 'You order relief sent over the pass at once. Lin writes the names on the order himself.',
    },
    defence: {
      when: { meter: 'treasury', op: '<', value: 8 },
      outcomeDependent: true,
      acceptText:
        'You show him the accounts: the money has been spent on other needs. Lin studies them. “Then I understand why. But I would ask Beijing for more.”',
    },
    opened:
      'You knew which villages had not been reached, and you could have afforded to help some of them. Weeks passed.',
  },

  // Not a wrong: a disagreement. Sometimes the minister is right to worry and sometimes the ruler is right to hold firm.
  fiscalConcern: {
    id: 'fiscalConcern',
    kind: 'concern',
    label: 'Lin’s warning about the Treasury',
    trigger: {
      all: [
        { flag: 'reliefOn' },
        { turn: true, op: '>=', value: 3 },
        { meter: 'treasury', op: '<', value: 14 },
        { not: { flag: 'reliefScaled' } },
      ],
    },
    source: {
      passage: 'No verified passage',
      status: 'adaptation',
      note:
        'Game design. Mencius does not discuss provincial budgets. This is an ordinary disagreement between minister and ruler, included so that remonstrance is not always a verdict: sometimes the minister is wrong, and the ruler’s task is to tell the difference.',
    },
    linLine:
      'The Treasury is nearly empty, Governor, and relief is costing us every week. I think we should scale it back before we are forced to. I may be wrong, and the cold may be mild, but I would rather say it now than after.',
    correctLabel: 'Scale relief back to essentials',
    defendLabel: 'Explain why you are keeping relief at its current level',
    correct: {
      effects: [m('treasury', 8), m('welfare', -6), flag('reliefScaled')],
      text: 'You scale relief back to essentials. The Treasury breathes, and some families notice.',
    },
    defence: {
      when: { any: [{ meter: 'welfare', op: '<', value: 62 }, { flag: 'uncovered', op: '>', value: 0 }] },
      outcomeDependent: false,
      acceptText:
        'You tell Lin the people are not out of danger yet, and that the cold has not even arrived. He considers it. “Then we find the money another way. But I will say it again if it gets worse.”',
      rejectText:
        'You tell Lin relief must stay as it is. He looks at the welfare figures. “They are better than I feared, Governor. I am not sure that is a reason to keep spending at this rate.”',
    },
    opened: 'Lin warned you that the Treasury was nearly empty and that relief might need to be scaled back.',
  },

  squeezedPeople: {
    id: 'squeezedPeople',
    label: 'Making the people pay for the shortfall',
    source: {
      passage: 'Mencius 1A7 and 3A3',
      status: 'inference',
      note:
        'Stanford’s account of Mencius stresses that government is obliged to secure people’s livelihoods and discusses taxation in 3A3. Treating a cut to rations or services as a failure when other ways to find the money existed is an inference. 3A3 has not been checked in a full translation.',
    },
    linLine:
      'We found the money by taking it from the people who can least spare it, Governor. There were other ways to find it. They were harder, but they were there.',
    correctLabel: 'Restore the rations and services you cut',
    correct: {
      effects: [m('treasury', -10), m('welfare', 5), flag('rationsCut', false)],
      text: 'You reverse the cuts. The Treasury takes the cost.',
    },
    defence: null,
    opened:
      'When the money ran short, you had other ways to find it, and you took it from rations and services that people depended on.',
  },

  lookedAway: {
    id: 'lookedAway',
    label: 'Letting officials skim the relief',
    requiresFact: 'skimmingKnown',
    source: {
      passage: 'Mencius 1B6',
      status: 'inference',
      note:
        'Mencius asks the king what should be done to a chief criminal judge who cannot control his officers, and the king answers: “Get rid of him.” (Sources of Chinese Tradition, via Columbia University.) Applying this to a ruler who knowingly lets officials steal relief is an inference.',
    },
    linLine:
      'You know where the sacks are going, Governor, and nothing has been done. If a chief judge could not control his officers, what would we say of him?',
    correctLabel: 'Audit the supply chain and stop the skimming',
    correct: {
      effects: [m('treasury', -5), m('capacity', -3), flag('chainAudited'), flag('skimmingContinues', false)],
      text: 'You order the audit. The staff learn that you were paying attention after all.',
    },
    defence: null,
    opened: 'You were told officials were skimming the relief, and you let it continue.',
  },

  silencedRemonstrance: {
    id: 'silencedRemonstrance',
    label: 'Refusing to hear your vice-governor',
    source: {
      passage: 'Mencius 5B9 and 1B6',
      status: 'inference',
      note:
        '5B9: a minister who finds the ruler at fault should remonstrate, and if the ruler repeatedly does not listen, should leave (or, for ministers closest to the ruler, depose him). 1B6: the king “looked left and right and spoke of other things.” Applying this to a modern provincial leader is an inference.',
    },
    linLine:
      'I am told I am not to raise this. I can be obedient or I can be honest. I do not think I can be both for long.',
    correctLabel: 'Tell Lin you were wrong to dismiss him, and restore his briefings',
    correct: {
      effects: [m('capacity', -5), { type: 'remonstrances', value: 1 }],
      text: 'You tell Lin you were wrong to shut him out. He says nothing for a moment, then opens his folder.',
    },
    defence: null,
    opened: 'You shut out an official whose job was to tell you what you did not want to hear.',
  },
};
