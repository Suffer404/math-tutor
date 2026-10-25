import type { Question } from '../data/sampleQuestions';

export interface LocalAttempt {
  id: string;
  questionId: string;
  topic: string;
  correct: boolean;
  at: string; // ISO timestamp
  source: 'local' | 'backend';
}

export const ATTEMPTS_KEY = 'math-tutor-attempts';

export function loadAttempts(): LocalAttempt[] {
  try {
    const raw = localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a: any) => a && typeof a.questionId === 'string' && typeof a.correct === 'boolean',
    ) as LocalAttempt[];
  } catch {
    return [];
  }
}

export function saveAttempts(attempts: LocalAttempt[]): void {
  try {
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    /* storage full or blocked — dashboard just won't remember this one */
  }
}

export function recordAttempt(
  question: Question,
  correct: boolean,
  source: 'local' | 'backend' = 'local',
): LocalAttempt {
  const attempt: LocalAttempt = {
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    questionId: question.id,
    topic: question.topic || 'Custom',
    correct,
    at: new Date().toISOString(),
    source,
  };
  const all = loadAttempts();
  all.unshift(attempt);
  saveAttempts(all.slice(0, 500));
  return attempt;
}

export function clearAttempts(): void {
  try {
    localStorage.removeItem(ATTEMPTS_KEY);
  } catch {
    /* ignore */
  }
}

export interface TopicStat {
  topic: string;
  attempts: number;
  correct: number;
  accuracy: number; // 0..1
}

export function topicStats(attempts: LocalAttempt[]): TopicStat[] {
  const map = new Map<string, { attempts: number; correct: number }>();
  for (const a of attempts) {
    const key = a.topic || 'Custom';
    const cur = map.get(key) || { attempts: 0, correct: 0 };
    cur.attempts += 1;
    if (a.correct) cur.correct += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([topic, v]) => ({ topic, ...v, accuracy: v.attempts ? v.correct / v.attempts : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

export function dayBuckets(attempts: LocalAttempt[], days = 7): { label: string; count: number }[] {
  const out: { label: string; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const start = new Date(today);
    start.setDate(start.getDate() - i);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const count = attempts.filter((a) => {
      const t = new Date(a.at).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).length;
    out.push({ label: start.toLocaleDateString(undefined, { weekday: 'short' }), count });
  }
  return out;
}
