import React, { useState } from 'react';
import { createGame, describe, choose, proceed } from '../engine/game.js';
import { buildDebrief } from '../engine/debrief.js';
import { CHARGES, FACTS } from '../content/index.js';
import { BEIJING_HELP_LIMIT, season, weeklyTreasury } from '../content/helpers.js';

const LABELS = { treasury: 'Treasury', welfare: 'Welfare', capacity: 'State capacity' };

function Meters({ meters }) {
  const bars = [
    ['treasury', meters.treasury, Math.max(0, Math.min(100, meters.treasury / 1.5))],
    ['welfare', meters.welfare, meters.welfare],
    ['capacity', meters.capacity, meters.capacity],
  ];
  return (
    <div className="meters">
      {bars.map(([key, value, pct]) => (
        <div className="meter" key={key}>
          <div className="meter-head">
            <span>{LABELS[key]}</span>
            <strong className={value < 0 ? 'negative' : ''}>{value}</strong>
          </div>
          <div className="bar"><div className={`fill ${key}`} style={{ width: `${pct}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

const signed = (n) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;
const inWeeks = (n) => (n <= 1 ? 'next week' : `in ${n} weeks`);

function Commitments({ state }) {
  const weekly = weeklyTreasury(state);
  return (
    <section>
      <h3>Commitments</h3>
      <p className="muted small">Treasury each week, before any decision you make:</p>
      {weekly.items.length === 0 ? <p className="muted">No regular weekly change.</p> : (
        <ul className="plain">
          {weekly.items.map((i) => (
            <li key={i.label}><span>{i.label}</span> <strong className={i.delta < 0 ? 'negative' : 'positive'}>{signed(i.delta)}</strong></li>
          ))}
          {weekly.items.length > 1 && (
            <li className="net"><span>Net</span> <strong className={weekly.net < 0 ? 'negative' : 'positive'}>{signed(weekly.net)} a week</strong></li>
          )}
        </ul>
      )}
      <p className="muted small">Repayments and obligations coming due:</p>
      {state.commitments.length === 0 ? <p className="muted">None.</p> : (
        <ul>{state.commitments.map((c) => <li key={c.id}>{c.label}, due {inWeeks(c.dueTurn - state.turn)} (turn {c.dueTurn})</li>)}</ul>
      )}
    </section>
  );
}

function Sidebar({ state }) {
  const raised = state.charges.filter((c) => c.raised && c.status === 'open');
  return (
    <aside className="sidebar">
      <section>
        <h3>What you have been told</h3>
        {state.facts.length === 0 ? <p className="muted">Nothing yet.</p> : (
          <ul>{state.facts.map((f) => <li key={f}>{FACTS[f]}</li>)}</ul>
        )}
      </section>
      <section>
        <h3>Beijing's patience</h3>
        {(state.flags.beijingAsks ?? 0) === 0 ? <p className="muted">You have not yet asked Beijing for help.</p> : (
          <p>You have asked Beijing for help {state.flags.beijingAsks} time{state.flags.beijingAsks === 1 ? '' : 's'}. It will answer {BEIJING_HELP_LIMIT} in all.</p>
        )}
      </section>
      <Commitments state={state} />
      <section>
        <h3>Matters raised and unresolved</h3>
        {raised.length === 0 ? <p className="muted">None.</p> : (
          <ul>{raised.map((c, i) => <li key={`${c.id}-${i}`}>{CHARGES[c.id].label}</li>)}</ul>
        )}
        {!state.ministerPresent && <p className="muted">Vice-Governor Lin has resigned. Briefings are no longer available.</p>}
      </section>
    </aside>
  );
}

function Deltas({ deltas }) {
  const entries = Object.entries(deltas);
  if (entries.length === 0) return null;
  return (
    <div className="deltas">
      {entries.map(([k, v]) => (
        <span key={k} className={`delta ${v > 0 ? 'up' : 'down'}`}>{LABELS[k]} {v > 0 ? '+' : '−'}{Math.abs(v)}</span>
      ))}
    </div>
  );
}

function Intro({ onStart }) {
  const [seed, setSeed] = useState('');
  return (
    <main className="page intro">
      <h1>A Hard Autumn</h1>
      <blockquote>
        “Heaven sees from where my people see; heaven hears from where my people hear.”
        <cite>Book of Documents, quoted in Mencius 5A5</cite>
      </blockquote>
      <p>
        You are the governor of a province in China. A drought has ruined the autumn harvest in the northern hills,
        and winter is weeks away. Over the coming months you must carry the province through to spring with a tight
        Treasury, stretched county offices, and incomplete reports.
      </p>
      <p>
        Across the desk sits your vice-governor, <strong>Lin Wei</strong> — a seasoned administrator and a devoted
        student of the Confucian philosopher <strong>Mencius</strong>. Lin holds that a government owes the people their
        livelihood above all else, that punishing people driven into wrongdoing by want is a trap, and that an official
        who cannot speak unwelcome truths should leave office. Whenever he believes you have crossed that line, he will
        say so to your face. Ignore him often enough, and he will resign.
      </p>
      <p>
        Above you both sits <strong>Beijing</strong>. When spring closes, the centre will judge the province’s accounts,
        stability, and results — not Lin’s philosophy — and decide whether you earn a promotion, a quiet sidelining,
        demotion, or dismissal.
      </p>
      <p className="muted">
        A fictional scenario. It does not depict real officials or make claims about modern Chinese politics.
      </p>
      <div className="start-row">
        <button className="primary" onClick={() => onStart(seed === '' ? undefined : Number(seed))}>Begin</button>
        <label className="seed">Seed (optional)
          <input value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ''))} placeholder="random" />
        </label>
      </div>
    </main>
  );
}

function Choices({ view, onPick }) {
  return (
    <div className="choices">
      {view.choices.map((c) => (
        <button key={c.id} className="choice" disabled={c.locked} onClick={() => onPick(c.id)}>
          <span className="choice-label">{c.label}</span>
          {(c.cost.length > 0 || c.risk || c.locked) && (
            <span className="choice-meta">
              {c.cost.map((x) => <span className="chip" key={x}>{x}</span>)}
              {c.risk && <span className="risk">{c.risk}</span>}
              {c.locked && <span className="locked">{c.lockedReason}</span>}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ResultView({ result, onContinue }) {
  // A notice (such as a resignation) takes over the screen and must be acknowledged first.
  const [acknowledged, setAcknowledged] = useState(!result.notice);

  if (!acknowledged) {
    return (
      <div className="notice" role="alertdialog" aria-labelledby="notice-title">
        <div className="notice-box">
          <p className="notice-kicker">News</p>
          <h2 id="notice-title">{result.notice.title}</h2>
          {result.notice.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          <button className="primary" onClick={() => setAcknowledged(true)}>I understand</button>
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      <h2>{result.title}</h2>
      {result.text.split('\n\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
      <Deltas deltas={result.deltas} />
      <button className="primary" onClick={onContinue}>Continue</button>
    </div>
  );
}

function Play({ state, setState }) {
  const view = describe(state);

  if (view.kind === 'result') {
    return <ResultView key={state.history.length} result={view.result} onContinue={() => setState(proceed(state))} />;
  }

  return (
    <div className={`main ${view.kind === 'remonstrance' ? 'remonstrance' : ''}`}>
      {view.notes.length > 0 && (
        <div className="notes">{view.notes.map((n, i) => <p key={i}>{n}</p>)}</div>
      )}
      <h2>{view.title}</h2>
      {view.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      {view.briefing && <p className="briefing">{view.briefing}</p>}
      <Choices view={view} onPick={(id) => setState(choose(state, id))} />
    </div>
  );
}

function Ended({ state, onRestart, onReplaySeed }) {
  const d = buildDebrief(state);
  const [tab, setTab] = useState('record');

  return (
    <main className="page debrief">
      <div className="ending-hero">
        <p className="ending-kicker">
          {d.endedEarly ? `Term cut short · Turn ${d.turnsPlayed} of ${d.maxTurns}` : `End of term · ${d.maxTurns} turns`}
        </p>
        <h1>{d.headline}</h1>
      </div>

      <section className="verdicts" aria-label="Two verdicts">
        <div className={`verdict-card tone-${d.careerTone}`}>
          <div className="verdict-head">
            <span className="verdict-judge">Beijing’s Verdict</span>
            <span className={`stamp ${d.careerTone}`}>{d.careerBadge}</span>
          </div>
          <p>{d.political}</p>
          <div className="verdict-meters">
            <Meters meters={d.meters} />
          </div>
          {d.settled.length > 0 && (
            <p className="muted small">Settled against final accounts: {d.settled.join('; ')}.</p>
          )}
        </div>

        <div className={`verdict-card tone-${d.ethicalTone}`}>
          <div className="verdict-head">
            <span className="verdict-judge">Mencius’s Verdict</span>
            <span className={`stamp ${d.ethicalTone}`}>{d.ethicalBadge}</span>
          </div>
          <p>{d.menciusVerdict}</p>
          <p className="lin-epilogue">{d.linEpilogue}</p>
        </div>
      </section>

      <div className={`split-banner ${d.diverged ? 'diverged' : ''}`}>
        <p>{d.measures}</p>
      </div>

      <div className="ending-actions">
        <div className="ending-buttons">
          <button className="primary" onClick={onRestart}>Play again</button>
          <button className="secondary" onClick={() => onReplaySeed(d.seed)}>Replay seed #{d.seed}</button>
        </div>
        <p className="muted small">{d.replayHint}</p>
      </div>

      <nav className="tabs" role="tablist" aria-label="Post-term details">
        <button
          role="tab"
          aria-selected={tab === 'record'}
          className={tab === 'record' ? 'active' : ''}
          onClick={() => setTab('record')}
        >
          Your Record {d.ledger.length > 0 && <span className="tab-count">{d.ledger.length}</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'chronicle'}
          className={tab === 'chronicle' ? 'active' : ''}
          onClick={() => setTab('chronicle')}
        >
          Chronicle <span className="tab-count">{d.timeline.length}</span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'notes'}
          className={tab === 'notes' ? 'active' : ''}
          onClick={() => setTab('notes')}
        >
          Notes &amp; Sources
        </button>
      </nav>

      {tab === 'record' && (
        <section className="tab-panel">
          {d.ledger.length === 0 ? (
            <div className="empty-record">
              <p>Vice-Governor Lin never found cause to bring a charge against you.</p>
            </div>
          ) : (
            d.ledger.map((l, i) => (
              <article className={`record-card status-${l.statusBadge.toLowerCase()}`} key={`${l.id}-${i}`}>
                <div className="record-head">
                  <h3>{l.label}</h3>
                  <span className={`tag status-${l.statusBadge.toLowerCase()}`}>{l.statusBadge}</span>
                </div>
                <p>{l.opened}</p>
                <p className="record-outcome">{l.outcome}</p>
                <p className="record-mencius">{l.menciusLine}</p>
              </article>
            ))
          )}
        </section>
      )}

      {tab === 'chronicle' && (
        <section className="tab-panel">
          <ol className="timeline">
            {d.timeline.map((t, i) => (
              <li key={i}>
                <strong>Turn {t.turn}: {t.title}.</strong> {t.choice}.
                {t.outcome && <span className="muted"> {t.outcome.replace(/\n\n/g, ' ')}</span>}
                {t.note && <div className="note">{t.note}</div>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {tab === 'notes' && (
        <section className="tab-panel notes-panel">
          <h2>Ideas behind the game</h2>
          {d.ideas.map((i) => (
            <div key={i.title}><h3>{i.title}</h3><p>{i.body}</p></div>
          ))}

          {d.ledger.length > 0 && (
            <>
              <h2>Textual grounding for your record</h2>
              {d.ledger.map((l, i) => (
                <div className="ledger" key={`src-${l.id}-${i}`}>
                  <h3>{l.label}</h3>
                  <p className="source"><strong>{l.source.passage}.</strong> {l.source.note}</p>
                </div>
              ))}
            </>
          )}

          <h2>Passages cited</h2>
          <ul>{d.sources.map((s) => (
            <li key={s.passage}><strong>{s.passage}.</strong> {s.summary} <span className="muted">{s.check}</span></li>
          ))}</ul>
        </section>
      )}
    </main>
  );
}

export default function App() {
  const [state, setState] = useState(null);
  const [started, setStarted] = useState(false);

  if (!started) {
    return <Intro onStart={(seed) => { setState(createGame(seed)); setStarted(true); }} />;
  }
  if (state.status === 'ended') {
    return (
      <Ended
        state={state}
        onRestart={() => { setStarted(false); setState(null); }}
        onReplaySeed={(seed) => { setState(createGame(seed)); }}
      />
    );
  }
  return (
    <div className="layout">
      <header>
        <div className="turn">
          <div>Turn {state.turn} of {state.maxTurns}</div>
          <div className={`season ${season(state).name.toLowerCase()}`}>{season(state).text}</div>
        </div>
        <Meters meters={state.meters} />
      </header>
      <div className="body">
        <Play state={state} setState={setState} />
        <Sidebar state={state} />
      </div>
    </div>
  );
}
