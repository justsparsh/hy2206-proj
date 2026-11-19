import {
  m, flag, WINTER_END_TURN, RELIEF_UPKEEP, RELIEF_UPKEEP_SCALED, projectedShortfall, owedRepayments,
} from './helpers.js';

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
        '“When they thereupon sink into crime, to go and punish the people is to trap them. When there are benevolent persons in positions of authority, how is it possible for them to trap the people?” (Van Norden 2008; confirmed in Legge and Lau.)',
    },
    linLine:
      'The people you punished did not take grain for profit, Governor. They took it because we had not come. I would not be doing my job if I let this pass.',
    correctLabel: 'Review the arrests, release those detained, and send relief to the unreached villages',
    defendLabel: 'Argue that without a curfew, depot raids will spread across every county',
    correct: {
      effects: [m('treasury', -10), m('capacity', -3), m('welfare', 6), flag('uncovered', 0)],
      text: 'You order the arrests reviewed, the detainees released, and relief sent over the pass. Lin closes his folder. “Thank you, Governor. I will see the trucks off myself.”',
    },
    defence: {
      when: { flag: 'ringCaught' },
      outcomeDependent: true,
      acceptText:
        'You point out that those arrested included the organisers of a ring reselling grain. Lin considers it. “That is true. It does not make the others less hungry. But I will not call it a trap for the men who were profiting.” He lets the matter rest.',
      rejectText:
        'Lin shakes his head. “Order kept by arresting hungry villagers is not order, Governor. We knew seven villages had no grain, and we punished them for proving us right. I will record my objection.”',
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
    defendLabel: 'Argue that winter is long, and a governor must hold grain for worse to come',
    correct: {
      effects: [m('treasury', -25), m('welfare', 10), flag('reservesSpent'), flag('reliefOn'), flag('uncovered', 0)],
      text: 'You order the provincial reserve opened. Lin looks at you for a long second before nodding. “Better late than locked behind a gate, Governor. I will call the depots.”',
    },
    defence: {
      rejectText:
        'Lin does not raise his voice. “A reserve kept full while twenty villages empty their pantries is not prudence, Governor. If a friend kept your family cold to save firewood for next month, you would not call him careful.”',
    },
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
        'A king spares an ox out of pity because he sees it trembling, yet ignores the suffering of his own people. Mencius urges him to extend the same compassion to them (Van Norden 2008; Stanford Encyclopedia of Philosophy). Applying this to a single publicised case is an inference.',
    },
    linLine:
      'You went to Hongyan, and that child will eat. There are other villages on my list, and nobody has taken a picture of them.',
    correctLabel: 'Extend relief to the remaining villages',
    defendLabel: 'Argue that calming the public outcry buys time for the rest of the relief',
    correct: {
      effects: [m('treasury', -12), m('capacity', -5), m('welfare', 8), flag('uncovered', 0)],
      text: 'You order relief extended to every village still on Lin’s list. He unfolds the sheet of names without a word of triumph. “Then we can put the cameras away and do the work.”',
    },
    defence: {
      when: { meter: 'treasury', op: '<', value: 12 },
      outcomeDependent: true,
      acceptText:
        'You explain that the money is no longer there. Lin checks the figures and nods slowly. “Then we ask Beijing again. But I take your point.”',
      rejectText:
        'Lin taps the list on your desk. “The cameras left Hongyan yesterday, Governor. The hunger did not. We have the money to reach the others, and choosing only the one in the photograph is not compassion.”',
    },
    opened:
      'You saw one photograph and could afford to reach the other villages. The one you helped is not the point of the passage; the others are.',
  },

  favouredKin: {
    id: 'favouredKin',
    label: 'Awarding the relief contract to a relative’s firm',
    requiresFact: 'kinFirmRecord',
    source: {
      passage: 'Mencius 5A3',
      status: 'inference',
      note:
        'In 5A3, sage-king Shun enriched his brother Xiang out of family feeling, but appointed independent officials to administer the territory so Xiang could not harm the people. Putting an unreliable relative in charge of public relief logistics crosses the line Shun refused to cross. Applying 5A3 to modern procurement is an inference.',
    },
    linLine:
      'The contract went to your brother-in-law’s firm. I told you its record. I am telling you again.',
    correctLabel: 'Cancel the contract and open it to tender',
    defendLabel: 'Argue that Tianbao had trucks ready on the road when nobody else did',
    correct: {
      effects: [m('treasury', -8), m('capacity', -4), flag('kinContract', false)],
      text: 'You cancel the contract and open it to tender. Han Jie stops returning your calls. Lin nods once. “It will cost us a week. It saves us something harder to buy back.”',
    },
    defence: {
      rejectText:
        'Lin folds the procurement file. “Family loyalty is one thing, Governor. Handing public relief to a relative whose firm delivers late — and paying twenty percent over the rate for the privilege — is another. Even Shun did not let his brother run the territory.”',
    },
    opened:
      'You knowingly gave a relief contract to a relative whose record you had been told was poor. Whether the firm happened to perform was luck; the choice was not.',
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
        'Mencius argues that an enlightened ruler secures the people’s livelihood so they have enough to support their parents and children, and urges extending compassion beyond the cases in front of you. Treating weeks of neglect of known villages as a failure of that obligation is an inference.',
    },
    linLine:
      'The villages over the pass have been waiting for weeks, Governor. We could have reached some of them by now. I need to know why we have not.',
    correctLabel: 'Send relief to the waiting villages now',
    defendLabel: 'Argue that the mountain road costs too much while the rest of the province needs grain',
    correct: {
      effects: [m('treasury', -12), m('capacity', -5), m('welfare', 8), flag('uncovered', 0)],
      text: 'You order relief sent over the pass at once. Lin writes the names on the order himself. “They have waited long enough.”',
    },
    defence: {
      when: { meter: 'treasury', op: '<', value: 8 },
      outcomeDependent: true,
      acceptText:
        'You show him the accounts: the money has been spent on other needs. Lin studies them. “Then I understand why. But I would ask Beijing for more.”',
      rejectText:
        'Lin looks at the ledger, then back at you. “We have the money in the Treasury, Governor. They are not outside the province because the road is steep. They are outside your ledger.”',
    },
    opened:
      'You knew which villages had not been reached, and you could have afforded to help some of them. Weeks passed.',
  },

  // Not a wrong: advice. Lin shows the numbers, and the ruler can heed him or bet that he is wrong.
  fiscalConcern: {
    id: 'fiscalConcern',
    kind: 'concern',
    label: 'Lin’s warning that the money would run out',
    trigger: (d) =>
      d.flags.reliefOn && !d.flags.reliefScaled && d.turn >= 3 && d.turn <= WINTER_END_TURN && projectedShortfall(d) > 0,
    source: {
      passage: 'No verified passage',
      status: 'adaptation',
      note:
        'Game design. Mencius does not discuss provincial budgets. This is ordinary advice from a minister, included so that remonstrance is not always a verdict: the ruler can heed the warning or bet that it is wrong, and either choice has a price.',
    },
    linLine: (d) => {
      const owed = owedRepayments(d);
      const weeks = Math.max(0, WINTER_END_TURN - d.turn);
      const upkeep = d.flags.reliefScaled ? RELIEF_UPKEEP_SCALED : RELIEF_UPKEEP;
      return `I have run the numbers, Governor. The Treasury stands at ${d.meters.treasury}${owed ? `, and we owe ${owed} in repayments` : ''}. Relief costs ${upkeep} a week, and there are ${weeks} weeks of winter left. If nothing changes we will be about ${projectedShortfall(d)} short before it ends. I may be wrong about the weather, but that is where the money goes.`;
    },
    correctLabel: 'Scale relief back to essentials now',
    defendLabel: 'Keep spending as it is, and find the money later',
    correct: {
      effects: [m('treasury', 8), m('welfare', -6), flag('reliefScaled')],
      text: 'You scale relief back to essentials. The Treasury breathes, and families in the covered villages notice. Lin says quietly: “I wish I had a cleaner set of numbers to bring you.”',
    },
    defence: {
      when: () => true,
      effects: [flag('budgetWarningIgnored')],
      outcomeDependent: false,
      acceptText:
        'You tell Lin the people come first and the money will be found. He nods slowly. “Then it is your decision, Governor. I will hold us to the numbers.”',
    },
    opened: 'Lin showed you the numbers and warned that the Treasury would run out before winter ended.',
  },

  squeezedPeople: {
    id: 'squeezedPeople',
    label: 'Making the people pay for the shortfall',
    source: {
      passage: 'Mencius 1A7 and 3A3',
      status: 'inference',
      note:
        'In 1A7 and 3A3, Mencius argues that humane government secures the people’s constant livelihood rather than burdening them when they are already strained. Treating a cut to rations or county clinics as a failure when borrowing or central support existed is an inference.',
    },
    linLine:
      'We found the money by taking it from the people who can least spare it, Governor. There were other ways to find it. They were harder, but they were there.',
    correctLabel: 'Restore the rations and services you cut',
    defendLabel: 'Argue that going into debt would ruin the province’s accounts with Beijing',
    correct: {
      effects: [m('treasury', -10), m('welfare', 5), flag('rationsCut', false)],
      text: 'You reverse the cuts. The Treasury takes the cost. Lin exhales once. “We will answer to the finance bureau when the time comes. Better than answering to empty kitchens.”',
    },
    defence: {
      rejectText:
        'Lin’s voice stays flat. “A balanced ledger bought by closing clinics and cutting rations is a tidy book over a hungry county, Governor. You chose the cleaner file over the harder option.”',
    },
    opened:
      'When the money ran short, you had other ways to find it, and you took it from rations and services that people depended on.',
  },

  heavyTaxation: {
    id: 'heavyTaxation',
    label: 'Collecting the full tax assessment from drought-hit counties',
    requiresFact: 'taxBurdenKnown',
    source: {
      passage: 'Mencius 3A3',
      status: 'inference',
      note:
        'In 3A3, Mencius tells Duke Wen of Teng that humane government begins by regulating land and taxation so that ordinary people keep a “constant livelihood” and thus a “constant heart”, rather than being stripped bare by heavy exactions. Applying this to a modern provincial tax quota after a harvest failure is an inference.',
    },
    linLine:
      'The northern counties had no harvest to tax, Governor. Families are selling seed and tools to meet the assessment. You met the bureau’s target by taking what they need to live next year.',
    correctLabel: 'Remit the assessment in the drought-hit counties and refund what was collected',
    defendLabel: 'Argue that Beijing evaluates the province on revenue collection, and the Treasury needs the cash',
    correct: {
      effects: [m('treasury', -12), m('capacity', -3), m('welfare', 5), flag('heavyTaxCollected', false)],
      text: 'You order the northern assessments remitted and the collections returned. Lin signs the circular beside you. “The finance bureau will complain. The farmers will still have ploughs in spring.”',
    },
    defence: {
      rejectText:
        'Lin sets the county ledgers on your desk. “You could have collected from the south and spared the drought counties, Governor. Taking tax from people who lost their harvest does not strengthen the province — it empties it.”',
    },
    opened:
      'You were told farmers in the drought-hit counties had no surplus left, and you enforced the full tax assessment anyway.',
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
    defendLabel: 'Argue that an audit will slow the trucks while villages still need grain',
    correct: {
      effects: [m('treasury', -5), m('capacity', -3), flag('chainAudited'), flag('skimmingContinues', false)],
      text: 'You order the audit. Lin picks up the phone before you finish speaking. “Once the warehouses know someone is counting sacks, the losses drop by half in a day.”',
    },
    defence: {
      rejectText:
        'Lin does not blink. “Every sack stolen between the warehouse and the truck is a family that eats less, Governor. Looking away so the paperwork stays smooth makes you a partner to it.”',
    },
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
      'You told me the matter was closed, Governor, and I have kept to that. But I cannot keep to it and do my job. I can be obedient or I can be honest, and I do not think I can be both for long.',
    correctLabel: 'Tell Lin you were wrong to dismiss him, and restore his briefings',
    defendLabel: 'Argue that once a governor decides, debate has to stop so the province can move',
    suppressLabel: 'Tell him again that the matter is closed',
    correct: {
      effects: [m('capacity', -5), { type: 'remonstrances', value: 1 }],
      text: 'You tell Lin you were wrong to shut him out. He says nothing for a moment, then opens his folder. “Then I will keep telling you what the reports say, Governor — even when you would rather not hear it.”',
    },
    defence: {
      rejectText:
        'Lin studies his hands. “Unity built on silence is just a faster way to walk into a wall, Governor. You will still have my signature on routine orders. You will not have my agreement.”',
    },
    opened: 'You shut out an official whose job was to tell you what you did not want to hear.',
  },

  concealedLosses: {
    id: 'concealedLosses',
    label: 'Understating the winter’s deaths to Beijing',
    requiresFact: 'casualtiesKnown',
    source: {
      passage: 'No verified passage',
      status: 'adaptation',
      note:
        'Game design. Mencius 5B9 presupposes that the ruler hears the truth from his ministers. Nothing verified here addresses a subordinate reporting to a superior, though the same logic of honest reporting is at stake: a government that hides its failures cannot correct them.',
    },
    linLine:
      'The figure we sent Beijing is not the figure I gave you, Governor. Somebody will check. When they do, it will not be only the number that is questioned.',
    correctLabel: 'Send Beijing a corrected report',
    defendLabel: 'Argue that sending the raw number will bring a central purge that helps nobody in the north',
    correct: {
      effects: [m('capacity', -4), flag('beijingWatching')],
      text: 'You send Beijing the true figure with an explanation. It arrives with a note that corrections of this kind are rarely welcome. Lin does not say “thank you”; he nods once.',
    },
    defence: {
      rejectText:
        'Lin’s eyes stay on yours. “The dead are still in the county registers, Governor. Changing the number on the cover page protects one person’s file, and it is not anyone in the northern counties.”',
    },
    opened:
      'You were given the true count of winter deaths, and you reported fewer to Beijing.',
  },

  stagedRecovery: {
    id: 'stagedRecovery',
    label: 'Staging a showcase village for a visiting official while poorer counties went without',
    requiresFact: 'stagingCostKnown',
    source: {
      passage: 'Mencius 1A7 (the ox) and 1B6',
      status: 'inference',
      note:
        'Mencius warns against tending to what sits visibly before the eye while neglecting the unseen suffering of the people (1A7) and against turning away from misgovernment (1B6). Applying this to a staged modern inspection route is an inference.',
    },
    linLine:
      'Qinghe looks very fine today, Governor. Fresh paint on the clinic, full sacks by the door. The counties two valleys over are still waiting for the money that paid for it.',
    correctLabel: 'Send matching recovery funds to the neglected counties',
    defendLabel: 'Argue that a good report from the visiting official keeps Beijing’s support flowing to the whole province',
    correct: {
      effects: [m('treasury', -8), m('capacity', -2), m('welfare', 5)],
      text: 'You release matching funds for the counties off the motorcade route. Lin notes the transfer. “Let the visitor remember the paint, Governor. The counties will remember this.”',
    },
    defence: {
      rejectText:
        'Lin closes his notebook. “We did not paint Qinghe for the people who live in Qinghe, Governor. We painted it for a car that stayed twenty minutes. You know who paid for the paint.”',
    },
    opened:
      'You were told staging a showcase village for a visiting official would divert funds from poorer counties, and you approved it anyway.',
  },

  crushedUnrest: {
    id: 'crushedUnrest',
    label: 'Using force on people the winter had left with nothing',
    requiresFact: 'unrestCause',
    source: {
      passage: 'Mencius 1A7',
      status: 'inference',
      note:
        '“When they thereupon sink into crime, to go and punish the people is to trap them.” (Van Norden 2008; confirmed in Legge and Lau.) The passage concerns crime driven by want; applying it to protest is an inference.',
    },
    linLine:
      'You were told who was in those crowds, Governor. They were not an enemy. They were people the winter had broken, and we sent the police. Whatever we call it, it will not feed them.',
    correctLabel: 'Release those detained and open talks',
    defendLabel: 'Argue that rioting had to be stopped before the whole province collapsed',
    correct: {
      effects: [m('treasury', -8), m('capacity', -3), m('welfare', 5)],
      text: 'You order the detainees released and open talks. It is expensive, and the representatives are slow to trust you. Lin sits beside you at the table all afternoon.',
    },
    defence: {
      rejectText:
        'Lin speaks quietly. “You cleared the square, Governor. You did not fill a single pantry. Driving people to desperation and then arresting them for shouting is the oldest trap in government.”',
    },
    opened:
      'You were told the crowds were mostly people from the places the winter had hit worst, with no record of trouble, and you sent security forces to clear them.',
  },
};
