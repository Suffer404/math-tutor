import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Question } from '../data/sampleQuestions';
import {
  clearAttempts,
  dayBuckets,
  loadAttempts,
  recordAttempt,
  saveAttempts,
  topicStats,
  type LocalAttempt,
} from '../lib/attempts';

interface DashboardProps {
  questions: Question[];
  onOpenQuestion: (id: string) => void;
}

const API_BASE = 'http://127.0.0.1:8000';

const Stat: React.FC<{ label: string; value: string; sub?: string; tone?: 'ok' | 'warn' | 'bad' }> = ({
  label,
  value,
  sub,
  tone,
}) => {
  const color =
    tone === 'ok' ? 'var(--success)' : tone === 'warn' ? 'var(--warning)' : tone === 'bad' ? 'var(--error)' : 'var(--text-primary)';
  return (
    <div
      style={{
        flex: '1 1 150px',
        minWidth: 150,
        padding: '0.875rem 1rem',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 600, color, lineHeight: 1.4 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
};

export const Dashboard: React.FC<DashboardProps> = ({ questions, onOpenQuestion }) => {
  const [attempts, setAttempts] = useState<LocalAttempt[]>(() => loadAttempts());
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'offline' | 'done'>('idle');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setAttempts(loadAttempts());
  }, []);

  const stats = useMemo(() => topicStats(attempts), [attempts]);
  const days = useMemo(() => dayBuckets(attempts, 7), [attempts]);
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const accuracy = total ? correct / total : 0;
  const attemptedIds = new Set(attempts.map((a) => a.questionId));
  const weak = stats.filter((s) => s.attempts >= 2 && s.accuracy < 0.6);
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const byId = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const openTopic = useCallback(
    (topic: string) => {
      const q = questions.find((item) => item.topic === topic);
      if (q) onOpenQuestion(q.id);
    },
    [questions, onOpenQuestion],
  );

  const syncFromBackend = useCallback(async () => {
    setSyncState('syncing');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const merged = [...attempts];
      const known = new Set(merged.map((a) => a.id));
      for (const q of questions.slice(0, 60)) {
        const res = await fetch(`${API_BASE}/attempts/${encodeURIComponent(q.id)}`, { signal: controller.signal });
        if (!res.ok) continue;
        const rows = (await res.json()) as any[];
        for (const row of rows) {
          const id = `backend_${q.id}_${row.id ?? row.created_at}`;
          if (known.has(id)) continue;
          known.add(id);
          merged.push({
            id,
            questionId: q.id,
            topic: q.topic || 'Custom',
            correct: Boolean(row.is_correct),
            at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            source: 'backend',
          });
          if (merged.length > 800) break;
        }
      }
      merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      saveAttempts(merged);
      setAttempts(merged);
      setSyncState('done');
    } catch {
      setSyncState('offline');
    } finally {
      clearTimeout(timer);
    }
  }, [attempts, questions]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), attempts }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `math-tutor-attempts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [attempts]);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '1.25rem 1.5rem 4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Progress</h2>
        <span
          style={{
            fontSize: '0.7rem',
            padding: '0.125rem 0.5rem',
            borderRadius: 999,
            border: '1px solid var(--border-primary)',
            color:
              syncState === 'offline'
                ? 'var(--warning)'
                : syncState === 'done'
                ? 'var(--success)'
                : 'var(--text-muted)',
          }}
        >
          {syncState === 'syncing'
            ? 'syncing…'
            : syncState === 'offline'
            ? 'backend offline — showing local history'
            : syncState === 'done'
            ? 'synced'
            : 'local history'}
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn btn--ghost" onClick={syncFromBackend} disabled={syncState === 'syncing'}>
          Sync from backend
        </button>
        <button className="btn btn--ghost" onClick={exportJson} disabled={!attempts.length}>
          Export JSON
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => {
            if (confirmClear) {
              clearAttempts();
              setAttempts([]);
              setConfirmClear(false);
            } else {
              setConfirmClear(true);
              setTimeout(() => setConfirmClear(false), 4000);
            }
          }}
          disabled={!attempts.length}
          style={{ color: confirmClear ? 'var(--error)' : undefined }}
        >
          {confirmClear ? 'Click again to clear' : 'Clear history'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <Stat label="Questions in bank" value={String(questions.length)} sub={`${attemptedIds.size} attempted`} />
        <Stat label="Attempts" value={String(total)} sub={total ? `last: ${new Date(attempts[0].at).toLocaleString()}` : 'none yet'} />
        <Stat
          label="Accuracy"
          value={total ? `${Math.round(accuracy * 100)}%` : '—'}
          sub={`${correct} / ${total} correct`}
          tone={!total ? undefined : accuracy >= 0.7 ? 'ok' : accuracy >= 0.5 ? 'warn' : 'bad'}
        />
        <Stat label="Today" value={String(days[days.length - 1]?.count ?? 0)} sub="attempts" />
      </div>

      <section style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div
          style={{
            flex: '2 1 420px',
            padding: '1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Weak topics</h3>
          {weak.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {total < 2
                ? 'Mark a question as “Struggled” or “Got it” (buttons on the question card) to start building this list.'
                : 'No weak topics right now — nothing below 60% with 2+ attempts.'}
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {weak.map((s) => (
                <li key={s.topic} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ flex: '0 0 150px', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.topic}
                  </span>
                  <span style={{ flex: 1, height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block',
                        width: `${Math.round(s.accuracy * 100)}%`,
                        height: '100%',
                        background: s.accuracy < 0.4 ? 'var(--error)' : 'var(--warning)',
                      }}
                    />
                  </span>
                  <span style={{ flex: '0 0 92px', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                    {Math.round(s.accuracy * 100)}% · {s.attempts}
                  </span>
                  <button className="btn btn--ghost" style={{ padding: '0.125rem 0.5rem', fontSize: '0.75rem' }} onClick={() => openTopic(s.topic)}>
                    Practise
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div
          style={{
            flex: '1 1 260px',
            padding: '1rem',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Last 7 days</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: 96 }}>
            {days.map((d, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  title={`${d.count} attempts`}
                  style={{
                    width: '100%',
                    height: `${Math.max(4, (d.count / maxDay) * 76)}px`,
                    background: d.count ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                    borderRadius: 4,
                  }}
                />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        style={{
          padding: '1rem',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Recent attempts</h3>
        {attempts.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Nothing yet. Open a question and press “Got it” or “Struggled”.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {attempts.slice(0, 12).map((a) => {
              const q = byId.get(a.questionId);
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0.625rem',
                    background: a.correct ? 'var(--success-bg)' : 'var(--error-bg)',
                    borderLeft: `3px solid ${a.correct ? 'var(--success)' : 'var(--error)'}`,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <span style={{ color: a.correct ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>
                    {a.correct ? 'Correct' : 'Wrong'}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {q ? q.question_text : `${a.topic} (question removed)`}
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                    {new Date(a.at).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
