import type { Question } from '../data/sampleQuestions';

export interface ParseResult {
  questions: Question[];
  errors: string[];
}

interface Draft {
  topic?: string;
  difficulty?: Question['difficulty'];
  question_type?: string;
  question_text?: string;
  answer_latex?: string;
  hints: string[];
  steps: string[];
  plain: string[];
}

const KEY_RE = /^\s*(topic|difficulty|type|q|question|a|answer|h|hint|s|step)\s*:\s*(.*)$/i;

/**
 * Parse pasted text (or a JSON array) into questions.
 *
 * Plain-text format — blocks separated by a blank line, all keys optional:
 *
 *   Topic: Chain Rule
 *   Difficulty: medium
 *   Q: Differentiate y = (3x^2+1)^5
 *   A: 30x(3x^2+1)^4
 *   H: Identify the outer and inner functions
 *   S: Let u = 3x^2+1
 *
 * A block with no keys at all is treated as a single question (whole text).
 */
export function parseQuestions(raw: string): ParseResult {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return { questions: [], errors: ['Paste some questions first.'] };

  if (text.startsWith('[')) return parseJson(text);

  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions: Question[] = [];
  const errors: string[] = [];

  blocks.forEach((block, index) => {
    const draft: Draft = { hints: [], steps: [], plain: [] };

    for (const line of block.split('\n')) {
      const match = line.match(KEY_RE);
      if (!match) {
        draft.plain.push(line.trim());
        continue;
      }
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (!value) continue;

      if (key === 'topic') draft.topic = value;
      else if (key === 'difficulty') draft.difficulty = toDifficulty(value);
      else if (key === 'type') draft.question_type = value;
      else if (key === 'q' || key === 'question') draft.question_text = value;
      else if (key === 'a' || key === 'answer') draft.answer_latex = value;
      else if (key === 'h' || key === 'hint') draft.hints.push(value);
      else if (key === 's' || key === 'step') draft.steps.push(value);
    }

    const questionText = (draft.question_text || draft.plain.join(' ')).trim();
    if (!questionText) {
      errors.push(`Block ${index + 1}: no question text found — add "Q: …" or just the text.`);
      return;
    }

    questions.push(
      normalize(
        {
          topic: draft.topic || 'Custom',
          difficulty: draft.difficulty || 'medium',
          question_type: draft.question_type || 'problem',
          question_text: questionText,
          answer_latex: draft.answer_latex || '',
          hints: draft.hints,
          solution_steps: draft.steps,
        },
        index,
      ),
    );
  });

  if (!questions.length && !errors.length) {
    errors.push('No questions recognised — separate each question with a blank line.');
  }
  return { questions, errors };
}

function parseJson(text: string): ParseResult {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { questions: [], errors: ['JSON must be an array of questions.'] };
    }
    const questions = parsed
      .map((q: any, i: number) => normalize(q, i))
      .filter((q) => q.question_text.trim().length > 0);
    if (!questions.length) return { questions: [], errors: ['No question_text found in the JSON.'] };
    return { questions, errors: [] };
  } catch (e) {
    return {
      questions: [],
      errors: [`JSON could not be read: ${e instanceof Error ? e.message : 'unknown error'}`],
    };
  }
}

function toDifficulty(value: string): Question['difficulty'] {
  const v = value.toLowerCase();
  return v === 'easy' || v === 'hard' ? v : 'medium';
}

function normalize(input: any, index: number): Question {
  const topic = String(input.topic || 'Custom');
  return {
    schema_version: '1.0',
    id: input.id || `q_user_${Date.now()}_${index}`,
    course: input.course || 'Custom',
    topic,
    difficulty: toDifficulty(String(input.difficulty || 'medium')),
    question_type: input.question_type || 'problem',
    question_text: String(input.question_text || '').trim(),
    question_latex: input.question_latex || undefined,
    source: input.source || { filename: 'manual', page: undefined, section: undefined },
    hints: Array.isArray(input.hints) ? input.hints.filter(Boolean).map(String) : [],
    answer_latex: input.answer_latex || '',
    solution_steps: Array.isArray(input.solution_steps)
      ? input.solution_steps.filter(Boolean).map(String)
      : [],
    verification_status: input.verification_status || 'pending',
    tags: Array.isArray(input.tags) ? input.tags : [topic.toLowerCase().replace(/\s+/g, '-')],
  };
}

export const QUESTION_TEMPLATE = `Topic: Chain Rule
Difficulty: medium
Q: Differentiate y = (3x^2 + 1)^5
A: 30x(3x^2 + 1)^4
H: Identify the outer and inner functions
H: Differentiate the outer function
S: Let u = 3x^2 + 1
S: dy/du = 5u^4
S: dy/dx = 5u^4 * 6x

Topic: Integration
Difficulty: easy
Q: Evaluate the integral of 2x dx
A: x^2 + C
H: Use the power rule for integration
S: Integral of x^n dx = x^(n+1)/(n+1)
S: 2x integrates to x^2
S: Add + C`;
