# Arc 1: The Failed Harvest

Status: complete draft for review. Written as design content; implemented in `src/content/events/arc1.js`. Schema names follow [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

> **Revision (setting and implementation).** This document was written for a fictional "Republic of Yunling". The implemented game uses a realistic setting instead: you are the governor of an unnamed Chinese province, your subordinate is Vice-Governor Lin Wei, and Beijing's central inspection group replaces the "Senior Review Council". The code in `src/content` is now the source of truth. Main changes from this draft:
>
> - **Roles:** Chairperson becomes Governor. "Minister Lin" becomes Vice-Governor Lin Wei. References to a royal line are removed. Beijing can remove you if Lin has resigned and a matter is still unresolved at the inspection (turn 8); with Lin still present, two or more unresolved matters bring formal criticism.
> - **Option C:** the emergency levy on a neighbouring province is replaced by an appeal to Beijing and a wealthier province for support, which comes with conditions (flag `outsideAid`).
> - **E6:** "The Haidong Delegation" becomes "The Counterpart Province": the supporting province and a central ministry demand itemised accounts, joint monitoring and a results report.
> - **E7:** the cold wave's severity is rolled when the event appears, not after the player chooses, and the choices include "Request emergency support from Beijing and your counterpart province".
> - **New event:** "The Petition" (villagers from the unreached north petition the provincial government).
> - **Balance:** starting Treasury is 60; unreached villages cost Welfare each turn; the end-of-term failure thresholds are Welfare 35 or Capacity 15.
> - **Removal rule:** Beijing removes you at the inspection if Lin has resigned and any matter is unresolved.
> - **Pressure pass:** the first version let a player who avoided the five wrongs finish with a flawless record and no strain. Now winter costs Welfare each turn, running relief costs Treasury each turn, the quiet week became a weekly review in which every option has a cost, and a new dilemma ("The Shortfall", which returns once more later) gives ways to find money, each of which costs someone. Tests guard against the pressure-free path returning.
> - **Everyone meets Lin:** a player who never meets a charge never meets the mechanic. Three changes address that. Neglect now opens a charge by itself (`leftWaiting`: known villages left waiting for weeks). Cutting rations or services is a charge only if the money could have been found another way (`squeezedPeople`), and letting known skimming run is a charge (`lookedAway`, from Mencius 1B6, the judge who cannot control his officers). Finally, Lin can raise a **concern** that is not a wrong (`fiscalConcern`: the Treasury is nearly empty, so scale relief back). Defending a concern is accepted only while people still need relief, so the player has to judge whether Lin is right. Concerns are labelled as such in the debrief and do not count against the ethical ending.

All numbers are first guesses to be tuned by simulation. Meters run 0-100 except Treasury, which can go negative.

## 1. Premise and setting

You are the **Chairperson of the Republic of Yunling**, a fictional modern state, newly arrived at the end of your first year in office. Your **Minister of Public Affairs, Lin Wei**, is the voice that briefs you and raises objections. He is of no royal line: he cannot depose you, but he can leave (Mencius 5B9, ministers of other surnames). Above him sits the **Senior Review Council**, which can censure or remove a ruler (5B9, ministers of the ruler's line). This is the game's adaptation of that passage, not a claim about how the text applies to any modern state.

Places: **Lingbei Province** (the failed harvest; twenty affected villages, among them **Qinghe** and **Hongyan**), **Haidong Province** (prosperous neighbour).

Starting state: Treasury 100, Welfare 60, Capacity 50. No flags. The state holds **grain reserves** (a flag, not a meter), enough to feed all affected villages for one season.

### What the player learns in this arc (takeaways 2, 3, 4 from the plan)

- Livelihood is the ruler's duty, and punishing people for what deprivation drives them to do is a wrong the text names (1A7).
- A ruler hears unwelcome things through ministers, and what happens next defines the reign (5B9, 1B6).
- Compassion shown to one visible case does not discharge the duty to all (1A7, the ox passage).
- Good decisions can meet bad luck, and bad decisions can pay off for a while.

## 2. Assumptions the engine must support

- A turn is **up to one remonstrance event followed by one regular event**. Remonstrance events do not consume a regular slot.
- Events can have `setup` (an optional random roll made on entry, hidden from the player) and outcomes can include `later` effects (delayed consequences).
- Labels can be functions of state.
- Charges are opened by the choice, deterministically, only when the charge's `requiresFact` has been revealed earlier. Rolls never open or close charges. A **defence** can still be strengthened by facts discovered later, but the debrief marks it as outcome-dependent so it is not mistaken for vindication of the original decision.

## 3. Flags, facts, charges

### Flags (set during play)

| Flag | Meaning |
|---|---|
| `reliefOn` | Some relief programme is running |
| `reservesSpent` | State grain reserves were distributed |
| `reservesHeld` | Reserves deliberately withheld (choice D) |
| `uncovered` (number) | Villages not yet reached by relief |
| `levyHaidong` | An emergency levy is owed to Haidong |
| `levyDispute` | Haidong's grievance is unresolved |
| `kinContract` | Relief logistics contracted to the Chairperson's brother-in-law |
| `ringPresent` | The raids include an organised ring (hidden until revealed) |
| `ringCaught` | The ring's organisers were among those punished |
| `skimmingContinues` | A real skimming problem was ignored |
| `chainAudited` | Supply chain audited |
| `extendPending` | Relief to unreached villages is on its way |
| `councilWarning`, `removalRisk` | Review Council status |

### Facts (what the player has been told)

| Fact | Revealed by |
|---|---|
| `coverageGap` | E1: provincial offices can reach only 13 of 20 villages quickly |
| `reservesAdequate` | E1: reserves can feed all twenty villages for a season |
| `unreachedKnown` | E4 (and E1 under options B and C): the unreached villages are named |
| `kinFirmRecord` | E5: Lin warns that the firm has delivered late before and bids above the going rate |

### Charges

| Charge | Opens when | Source (status) | Repair | Valid defence |
|---|---|---|---|---|
| `entrapment` | You punish raiders while `uncovered > 0` and `coverageGap` was revealed | Mencius 1A7 (direct): "to go and punish the people is to trap them" (Stanford, quoting Van Norden 2008, 14) | Release those punished and extend relief: Treasury -10, Capacity -3, Welfare +6, `uncovered = 0` | `ringCaught`. Organised exploitation is not driven wrongdoing, though hungry people may still have been punished with them |
| `failedTrust` | You hold reserves (D) while `reservesAdequate` was revealed | Mencius 1B6 (inference): a ruler who lets those entrusted to him go hungry and cold should be renounced; the passage's analogy is to a ruler who lets the state go ungoverned | Open reserves late: Treasury -25, Welfare +10, `uncovered = 0` | None. The charge opens only when the means were known to exist |
| `notExtended` | You know of unreached villages, have Treasury 12 or more, and do not extend relief (E4 options 1 or 4) | Mencius 1A7, the ox passage (inference): a ruler spares an ox but ignores his subjects' suffering | Extend relief: Treasury -12, Capacity -5, Welfare +8, `uncovered = 0` | Treasury below 12 when remonstrated |
| `favouredKin` | You award the contract to kin while `kinFirmRecord` was revealed | Adaptation. No passage has been verified for this case. Research lead: Mencius 5A3 (Shun and his brother), unverified | Cancel and retender: Treasury -8, Capacity -4 | None |
| `silencedRemonstrance` | You suppress a remonstrance | Mencius 5B9 and 1B6 (inference): the king in 1B6 "looked left and right and spoke of other things" | Publicly restore Lin's briefings: Capacity -5; `remonstrances` becomes 1 | None |

Every `adaptation` charge must be labelled as such in the debrief.

## 4. Event sequence

| Turn | Event | Slot |
|---|---|---|
| 1 | E1 The Harvest Fails | Anchor |
| 2-3 | E2 Raids on the Depots, or E2b Skimming at the Depots (whichever is eligible) | Anchor |
| each turn | R Lin's Remonstrance, if any charge is open and Lin is present | Priority |
| 3-6 | Pool: E4 The Photograph, E5 The Contract, P1 The Hoarders, P2 The Field Report | Pool, once each |
| 5 | E6 The Haidong Delegation, if `levyHaidong` (scheduled) | Scheduled |
| 6-7 | E7 The Cold Wave | Anchor |
| 8 | E8 The Council Review | Anchor |

The pool has more events than the arc has slots in a full game, so no two runs see the same set. In an arc-only test, up to four pool draws are possible; a run typically sees two or three.

---

## E1. The Harvest Fails

**Slot** anchor, turn 1. **Reveals** `coverageGap`, `reservesAdequate`.

> The numbers reach your desk before dawn. In Lingbei, the autumn rains never came, and the harvest in the northern counties has failed. Twenty villages face a hungry winter.
>
> Minister Lin Wei arrives with a folder and without small talk. "There are two things you should know before you choose, Chairperson. Our provincial relief offices can reach thirteen of the twenty villages quickly. The other seven are over the pass, and they will wait. And the state reserves are enough to feed all twenty for a season. Once they are spent, they are spent."

| Choice | What happens | Persists |
|---|---|---|
| **A. Open the state reserves and distribute free to all twenty villages** | Treasury -25, Welfare +15, Capacity -5. Roll: if Capacity 60 or more, 15% delay, else 30%. A delay cuts the Welfare gain to +7. Text: "Trucks leave the capital by noon. Whether they arrive in time depends on a road you do not control." | `reliefOn`, `reservesSpent`, `uncovered = 0` |
| **B. Targeted relief through the provincial offices** | Treasury -10, Welfare +8, Capacity -2. Roll: 20% the offices stretch further than expected, leaving `uncovered = 3` instead of 7. Text: "It is cheaper and quicker for most. Lin does not say which villages are among the seven, but the list is on his desk." | `reliefOn`, `uncovered = 7` (or 3), fact `unreachedKnown` |
| **C. Emergency levy on Haidong Province to fund relief through the provincial offices** | Treasury +5, Welfare +6, Capacity -5. Text: "Haidong has had a good harvest. Its governor will not be pleased." | `reliefOn`, `levyHaidong`, `uncovered = 7`, fact `unreachedKnown`; schedules E6 in 4 turns |
| **D. Hold the reserves, watch the markets, let prices adjust** | No cost. Welfare -12. Text: "Prices begin to climb. By the second week, the first reports of empty pantries arrive." | `reservesHeld`, `uncovered = 20`. **Opens `failedTrust`** because `reservesAdequate` was revealed |

**Notes.** D has no immediate resource cost and keeps the reserves intact, which pays off in E7. This is deliberate: a shortcut can work, and the game must show that it is a wrong anyway. A is the best choice for people now and leaves the state exposed in winter. B is cheap and defensible but leaves seven known villages waiting.

**Debrief line (D).** "You were told the reserves could feed every affected village, and you held them back. This is the situation the text describes in 1B6 (inference): a trust handed to the ruler and left unmet."

---

## E2. Raids on the Depots

**Slot** anchor, turn 2-3. **When** `uncovered > 0`. **Setup** 40% set `ringPresent` (hidden). **Reveals** nothing new.

> Three depots in Lingbei were broken into overnight. The grain taken is a tiny fraction of the stock, but the pictures are on every screen. Lin's report is short: most of the raiders were villagers, and nearly all came from villages the offices have not reached.
>
> The interior minister wants a curfew. The provincial governor wants an example made.

| Choice | What happens | Persists |
|---|---|---|
| **1. Impose a curfew and punish everyone caught** | Treasury -3, Welfare -3. Order returns within days. If `ringPresent`, text adds: "Among those arrested, police find the organisers of a small ring that had been reselling grain." | `orderRestored`; if ring, `ringCaught`. **Opens `entrapment`** (requires `coverageGap` and `uncovered > 0`) |
| **2. Suspend punishments and extend relief to the unreached villages** | Treasury -12, Capacity -5, Welfare +8. Text: "The raids stop in two days. Nobody calls it leadership. It is simply that no one has a reason to raid anymore." | `uncovered = 0` |
| **3. Pardon petty theft; pursue the organisers** | Requires Capacity 40 or more. Chance of success 80% if Capacity 60 or more, else 60%. Success: Treasury -5, Welfare +3, `ringCaught` if `ringPresent`. Failure: Welfare -3, Lin reports that investigators lost the trail. | On success, the crackdown targets exploitation; the hungry are not punished; `uncovered` remains. On failure, `investigationStalled` |

**Notes.** Option 3 does not repair the underlying hunger, so a later event can still land on it, but it opens no charge: you did not punish people for hunger. Option 1 is the cheap, effective, and wrongful path under 1A7. The ring makes the defence of option 1 meaningful without justifying it.

**Debrief line (1).** "You punished people who raided depots while seven villages had received no relief, and you had been told seven villages were unreachable. Mencius 1A7 (direct) names exactly this: to punish people who have sunk into crime is to trap them."

---

## E2b. Skimming at the Depots

**Slot** anchor, turn 2-3 (alternative to E2). **When** `uncovered == 0` and `reliefOn`.

> The relief is reaching every village, and that is the problem. Lin has found that at one depot in three, sacks are going missing between the warehouse and the trucks. Not hungry villagers: middlemen.

| Choice | What happens | Persists |
|---|---|---|
| **1. Crack down: arrest everyone connected** | Treasury -3, Welfare -2, Capacity +2. 30% chance that the arrests include some junior porters who had nothing to do with it; Lin notes it quietly. | `orderRestored` |
| **2. Audit the supply chain** | Treasury -5, Capacity -3, Welfare +3. | `chainAudited` |
| **3. Let it run: relief is arriving, and the loss is modest** | Welfare -4. | `skimmingContinues` |

No charges. This event keeps the arc from being only about punishment, and it shows that thorough response costs Capacity.

---

## R. Lin's Remonstrance

**Slot** priority. **When** any charge is open and Lin is present, and no remonstrance has been raised this turn. Choose the open charge with the lowest turn opened.

### Lin's lines by charge

- **`entrapment`:** "The people you punished last week did not take grain for profit, Chairperson. They took it because we had not come. I would not be doing my job if I let this pass."
- **`failedTrust`** (the 1B6 beat): "Suppose a man entrusted his family to a friend and came back to find them hungry and cold. What should he do about that friend? ... Now suppose the state itself is entrusted to someone, and the pantries of Lingbei are empty while the reserves sit full. What should be done about *that*?" He waits.
- **`notExtended`:** "You went to Hongyan, and the child will eat. There are six more villages on my list, and nobody has taken a picture of them."
- **`favouredKin`:** "The contract went to your brother-in-law's firm. I told you the record. I am telling you again."
- **`silencedRemonstrance`:** "I am told I am not to raise this. I will be obedient or I will be honest. I do not think I can do both for long."

### Choices

| Choice | Effect |
|---|---|
| **Correct it** | Pay the charge's repair cost. Charge closes. Lin's line: "Thank you. It will be remembered." |
| **Defend it** | If the charge's valid defence holds, it closes as `defended` and the debrief marks it. Otherwise Lin: "I hear the argument, Chairperson, and I do not accept it." The charge stays open and `remonstrances` +1. |
| **Suppress it** | For `failedTrust` the label is **"Change the subject"** (the king in 1B6 "looked left and right and spoke of other things"). No cost now. Charge stays open, **opens `silencedRemonstrance`**, `remonstrances` +1. |

### Escalation

- `remonstrances` at 2: Lin states plainly that he will resign if this continues.
- `remonstrances` at 3: **Lin resigns** (5B9, ministers of other surnames leave after repeated remonstrance). From then on events show fewer details: the coverage numbers on relief, the risk wording on rolls, and Lin's warnings. Open charges remain open, and charge knowledge is not affected by his absence.

**Debrief line (resignation).** "Lin left after repeated, unheeded remonstrances. The text (5B9) treats this as what a minister of another surname should do. The thresholds in this game are design choices, not Mencius's."

---

## E4. The Photograph

**Slot** pool, turn 3-6, once. **When** `uncovered > 0`. **Reveals** `unreachedKnown`.

> A photograph spreads overnight: a girl of about six in a doorway in Hongyan, holding an empty bowl. Hongyan is one of the villages the offices have not reached. By noon the image is on every front page, and your office has been asked whether the Chairperson has seen it.
>
> Lin: "She is not the only one, Chairperson. There are six more villages like Hongyan on my list."

| Choice | What happens | Persists |
|---|---|---|
| **1. Fly to Hongyan; airlift supplies for the village** | Treasury -5, Welfare +2. A strong news cycle: "The Chairperson Visits Hongyan." | **Opens `notExtended`** if Treasury is 12 or more |
| **2. Extend relief to every unreached village now** | Treasury -12, Capacity -5, Welfare +8. | `uncovered = 0` |
| **3. Order Lin to extend relief to all unreached villages through the ministry** | Treasury -8, Capacity -3. Welfare +5, arriving two turns later. 25% chance of a further delay. | `extendPending`, `uncovered = 0` immediately; no charge |
| **4. Say nothing; let the news cycle pass** | Welfare -1. | **Opens `notExtended`** if Treasury is 12 or more |

**Notes.** The ox passage (1A7): the king spared an ox out of pity and had to be shown that his subjects deserved the same concern. The game's version is the photograph. The gesture itself (option 1) is not the wrong. The wrong is treating it as enough when you know of the others and could afford to reach them.

**Debrief line (1 or 4).** "Mencius 1A7 (inference): the king pitied a single ox, yet his people suffered unnoticed. His advisor's point was that the same compassion could be extended. You saw one picture and left the six others unreached."

---

## E5. The Contract

**Slot** pool, turn 3-6, once. **When** `reliefOn`. **Reveals** `kinFirmRecord`.

> Relief supplies need trucking, and your brother-in-law, Han Jie, runs Tianbao Logistics. He has called your office twice. His bid is twenty percent above the going rate, and Lin says the firm has delivered late on two earlier state contracts.
>
> "I am not saying no, Chairperson," says Lin. "I am saying you should know."

| Choice | What happens | Persists |
|---|---|---|
| **1. Award it to Tianbao** | Treasury -8, Welfare +4 (a fast start). Roll: 50% the firm performs; 50% it delays, with **later** (2 turns) Welfare -6 and a press scandal. | `kinContract`. **Opens `favouredKin`** (requires `kinFirmRecord`), whether or not the roll goes well |
| **2. Open a public tender** | Treasury -3, Capacity -3. Welfare +0 this turn, **later** (2 turns) Welfare +4. | none |
| **3. Use the state's own transport corps** | Treasury -2, Capacity -5, Welfare +2. | none |

**Notes.** Mencian differentiated concern for kin (7A45, via Stanford) does not by itself license favouritism in public office, and this event does not claim a passage that says so. `favouredKin` is labelled an adaptation. Research lead: Mencius 5A3, Shun and his brother. If verified, it may become a direct source. The wrong is deterministic: the charge opens even when the roll goes well, because the player knowingly overpaid a relative with a poor record.

**Debrief line (1).** "You knowingly awarded a contract to a relative whose record you had been told was poor. Whether the firm happened to perform is luck; the choice is not. (Adaptation: no verified passage applies directly.)"

---

## P1. The Hoarders

**Slot** pool, turn 3-6, once. **When** `reliefOn`.

> Rice prices in Lingbei have doubled in a month, and Lin has found a pattern: several wholesalers are sitting on warehouses full of stock and waiting for the price to rise further.

| Choice | What happens | Persists |
|---|---|---|
| **1. Decree a price ceiling** | Capacity -3, Welfare +4. 35% chance of a black market: Welfare -4 and `blackMarket`. | |
| **2. Inspect warehouses and requisition stock at a fair price** | Requires Capacity 40 or more. Treasury -8, Capacity -6, Welfare +6. | |
| **3. Let prices adjust** | Welfare -5. | |

No charges. Consequence only. It shows that policy that looks right can backfire (35% black market on option 1).

---

## P2. The Field Report

**Slot** pool, turn 3-6, once. **When** `reliefOn`. **Setup** hidden: 60% the report is accurate, 40% it is a rival's accusation.

> A county deputy, Yu Min, writes directly to you: relief shipments in Zhang County are being skimmed by the county head. He includes receipts. Lin's note on the file reads: "Credibility uncertain. The deputy has a history with the county head."

| Choice | What happens | Persists |
|---|---|---|
| **1. Act at once: dismiss the county head and send replacements** | Capacity -6, Treasury -3. If accurate: Welfare +6. If false: Welfare -3, Capacity -4 more, `innocentDismissed`. | |
| **2. Send inspectors first** | Capacity -3, Treasury -2, Welfare -2 (delay). The truth is revealed. If accurate: Welfare +4. | |
| **3. Take no action** | If accurate: Welfare -6, `skimmingContinues`. If false: no effect. | |

No charges. This is the arc's cheapest example of takeaway 4: you cannot know, and each response has a price. It is also a lighter test of whether the player trusts or checks.

---

## E6. The Haidong Delegation

**Slot** scheduled, turn 5. **When** `levyHaidong`.

> Governor Sun of Haidong has come in person, with representatives of the province's farmers' cooperatives. They are not angry; they are very polite. The levy took grain they had put by for their own winter. They would like it back.

| Choice | What happens | Persists |
|---|---|---|
| **1. Repay in full** | Treasury -15. | clears `levyHaidong` |
| **2. Pay half; promise the rest in two turns** | Treasury -8. Commitment: Treasury -7 due in 2 turns. If Treasury is below 7 on the due turn, you default: Capacity -10 and `levyDispute`. | commitment `haidongBalance` |
| **3. Refuse** | Capacity -10, Welfare -3. | `levyDispute` |

No charges. The levy burden itself is the cost, and it carries into E7: Haidong will not help while `levyDispute` stands.

---

## E7. The Cold Wave

**Slot** anchor, turn 6-7. **Setup** (visible risk): 50% severe, 50% mild. The forecast says "an even chance of a severe cold wave."

> The cold arrives early. Overnight temperatures in Lingbei fall to levels not seen in a decade. The unreached villages are worst affected, with no relief and no stored fuel.

**Base harm on entry**

- Mild: Welfare -4. Severe: Welfare -10.
- Extra Welfare -4 if `uncovered > 0`.
- Extra Welfare -3 if `skimmingContinues`.
- Extra Welfare -2 if `blackMarket`.
- Reduced by 2 if `chainAudited`.

| Choice | What happens | Notes |
|---|---|---|
| **1. Emergency aid package** | Treasury -15, Welfare +8 (+10 if severe). | May push Treasury below zero. |
| **2. Draw on the state reserves** | Treasury -5, Welfare +10. `reservesSpent`. | **Locked if `reservesSpent`:** "The reserves were distributed in autumn." If you chose D, they are intact, which is the shortcut's one payoff. |
| **3. Ask Haidong for help** | Treasury -3, Welfare +6, Capacity -2. | **Locked if `levyHaidong` or `levyDispute`:** "Haidong is not in a position to be asked." |
| **4. Rely on provincial authorities** | Welfare -3. No cost. | Not a charge, but a clear consequence in the debrief. |

**Debt rule.** If Treasury is below 0 at the start of a turn, Welfare -3 and Capacity -2 that turn (services cut). Shown in the log as "You are borrowing."

**Debrief line (2, after D).** "Holding the reserves in autumn left them for the cold wave. That is why the shortcut worked. It is also why the text, and this game, do not treat success as the measure of a wrong."

---

## E8. The Council Review

**Slot** anchor, turn 8.

> The Senior Review Council meets once a year to examine the conduct of the government. Its members are not elected and not partisan; they are senior figures who have held office and, by tradition, are not afraid to say what they have seen.

Count `open` = charges with status open or suppressed.

| Condition | Outcome |
|---|---|
| `open == 0` | **Commendation, no resources.** "The Council notes the record. Nothing attaches." (The record is only a record: virtue is not banked.) |
| `open == 1` | **Warning.** `councilWarning`. Capacity -3. |
| `open >= 2` and Lin present | **Censure.** Capacity -10. A forced choice: pay the repair cost for one open charge, or reject the censure (opens `silencedRemonstrance`, adds `removalRisk`). |
| `open >= 2` and Lin has resigned | **Censure and `removalRisk`.** Capacity -10. |

**Mencian basis (adaptation).** 5B9 says ministers of the royal line should depose a ruler who does not listen to repeated remonstrance. The Council stands in for that. The conditions above are design choices.

---

## 5. Arc 1 endings (for arc-only testing)

**Political outcome**

- **Removed**: `removalRisk` is set at the review.
- **Failing**: Welfare 15 or below, or Capacity 10 or below, at the review.
- **In office**: otherwise.

**Ethical assessment**

- **Clear**: no open or suppressed charges.
- **Compromised**: one or more open or suppressed charges. The debrief lists each with its source and status.

| | Clear | Compromised |
|---|---|---|
| **In office** | You governed through hard luck and kept your obligations. | You survived, but the record shows wrongs you did not repair. |
| **Removed or failing** | You did what was owed and the winter beat you anyway. | The government failed and so did its conduct. |

Each ending is followed by the generated debrief: pivotal decisions in order, each with what you were told, what you did, the charge if any, the source passage and its status, and a plain note on which parts are game design.

## 6. Design checks for this arc

- **No clean answer.** E1 has four options, each defensible except D, and D is the only one that works at no cost.
- **No virtue bank.** The commendation gives nothing. Repairing a charge does not offset another.
- **Foreseeability is explicit.** Every charge requires a fact the player was told.
- **Luck is separate.** Every roll is in resources. No roll opens or closes a charge.
- **Callbacks.** E1 shapes E2, E4, E7. E4 can close E2's damage. E5's choice returns two turns later. C returns in E6 and E7. D pays off in E7.
- **Randomness.** Pool draws, the 40% ring, the 60/40 field report, the cold wave, and the E1 delay rolls vary runs without changing what the player is judged on.
- **Source honesty.** Of five charges, one is direct (`entrapment`), three are inference (`failedTrust`, `notExtended`, `silencedRemonstrance`), one is adaptation (`favouredKin`).

## 7. Open questions for review

1. Is D too punishing as an opening choice, and does the E7 payoff feel earned or like a cheap tilt back?
2. Should `silencedRemonstrance` be repairable at all once Lin has resigned?
3. Should there be an investigation option in more events, or is that over-engineered for a first version?
4. Are four charge sources enough for a debrief that teaches takeaway 3, or does the arc need one more Lin-centred beat?
5. The Council is a game device. Is it better to keep it, or to let Lin's resignation be the only consequence?

## 8. Research still needed before this arc is "air-tight"

- Verify in a full translation: 1A7 (the ox and the livelihood passages), 1B6, 3A3, 3A2, 5A3. 1B6 and 5B9 were read from the Columbia selection; 1A7's trapping line comes from Stanford's quotation.
- Confirm the Van Norden (2008) page reference quoted in `entrapment`.
- Decide whether to name any real imperial parallel in the debrief. Not required, since events are fictional.
