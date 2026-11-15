import React, { useState } from 'react';
import { createGame, describe, choose, proceed } from '../engine/game.js';
import { buildDebrief } from '../engine/debrief.js';
import { CHARGES, FACTS } from '../content/index.js';

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
        <h3>Commitments</h3>
        {state.commitments.length === 0 ? <p className="muted">None.</p> : (
          <ul>{state.commitments.map((c) => <li key={c.id}>{c.label} (due turn {c.dueTurn})</li>)}</ul>
        )}
      </section>
      <section>
        <h3>Matters raised and unresolved</h3>
        {raised.length === 0 ? <p className="muted">None.</p> : (
          <ul>{raised.map((c) => <li key={c.id}>{CHARGES[c.id].label}</li>)}</ul>
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
        You are the governor of a province in China. A drought has ruined the autumn harvest in the hills of the north.
        Over the coming weeks you will decide how the province responds, with limited money, limited administrative
        capacity, and uncertain information.
      </p>
      <p>
        <strong>You are being judged by Mencius.</strong> This game takes a standard of good rule from the Confucian
        philosopher Mencius (4th century BCE): that rulers owe the people their livelihood, that punishing people driven to
        wrongdoing by want is a wrong, and that officials should say unwelcome things to a ruler who is going astray.
      </p>
      <p>
        There is no morality score. Your vice-governor, Lin Wei, will raise specific matters with you. If you keep ignoring
        him, he will resign, and Beijing may send an inspection group. Good luck is separate from good conduct, and a shortcut
        can work for a while.
      </p>
      <p className="muted">
        This is a fictional scenario for a class on the history of China. It does not depict real officials and makes no claim about how
        Mencius’s ideas work in China today.
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

function Play({ state, setState }) {
  const view = describe(state);

  if (view.kind === 'result') {
    return (
      <div className="main">
        <h2>{view.result.title}</h2>
        {view.result.text.split('\n\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
        <Deltas deltas={view.result.deltas} />
        <button className="primary" onClick={() => setState(proceed(state))}>Continue</button>
      </div>
    );
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

function Ended({ state, onRestart }) {
  const d = buildDebrief(state);
  return (
    <main className="page debrief">
      <h1>The end of the term</h1>
      <p className="verdict">{d.political} {d.summary}</p>
      <Meters meters={d.meters} />
      <p>{d.ethical}</p>

      <h2>What happened</h2>
      <ol className="timeline">
        {d.timeline.map((t, i) => (
          <li key={i}>
            <strong>Turn {t.turn}: {t.title}.</strong> {t.choice}.
            {t.outcome && <span className="muted"> {t.outcome.replace(/\n\n/g, ' ')}</span>}
            {t.note && <div className="note">{t.note}</div>}
          </li>
        ))}
      </ol>

      <h2>What Lin raised with you</h2>
      {d.ledger.length === 0 ? <p>Nothing. Lin never found cause to raise a matter.</p> : d.ledger.map((l) => (
        <div className="ledger" key={l.id}>
          <h3>{l.label} <span className="tag">{l.kind === 'concern' ? 'A concern, not a wrong' : 'A wrong'}</span></h3>
          <p>{l.opened}</p>
          <p><strong>{l.outcome}</strong></p>
          <p className="source"><strong>{l.source.passage}</strong> · {l.sourceLabel}. {l.source.note}</p>
        </div>
      ))}

      <h2>What this game is drawing on</h2>
      {d.ideas.map((i) => (
        <div key={i.title}><h3>{i.title}</h3><p>{i.body}</p></div>
      ))}

      <h2>What is game design, not Mencius</h2>
      <ul>{d.designNotes.map((n) => <li key={n}>{n}</li>)}</ul>

      <h2>Passages used</h2>
      <ul>{d.sources.map((s) => (
        <li key={s.passage}><strong>{s.passage}.</strong> {s.summary} <span className="muted">{s.check}</span></li>
      ))}</ul>

      <p className="muted">Seed: {d.seed}</p>
      <button className="primary" onClick={onRestart}>Play again</button>
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
    return <Ended state={state} onRestart={() => { setStarted(false); setState(null); }} />;
  }
  return (
    <div className="layout">
      <header>
        <div className="turn">Turn {state.turn} of {state.maxTurns}</div>
        <Meters meters={state.meters} />
      </header>
      <div className="body">
        <Play state={state} setState={setState} />
        <Sidebar state={state} />
      </div>
    </div>
  );
}
