import type { ExcalidrawElement } from '@excalidraw/excalidraw/types/element/types';
import type { NormalizedBox } from './sceneCoords';

export const API_BASE = 'http://127.0.0.1:8000';

export type VerificationStatus =
  | 'sympy-confirmed'
  | 'sympy-cleared'
  | 'ai-only'
  | 'cannot-verify'
  | 'no-steps'
  | 'error';

export interface LiveStep {
  n: number;
  latex: string;
  confidence: number;
  bbox: NormalizedBox | null;
}

export type StepVerdict = 'valid' | 'invalid' | 'unverified';

export interface StepVerification {
  n: number;
  status: StepVerdict;
  reason: string | null;
}

export interface LiveCheckResult {
  steps: LiveStep[];
  first_error_step: number | null;
  error_bbox: NormalizedBox | null;
  error_explanation: string | null;
  hint: string;
  next_step: string | null;
  confidence: number;
  needs_user_confirmation: boolean;
  verification_status: VerificationStatus;
  verification_message: string;
  verification: {
    checked_transitions: number;
    total_transitions: number;
    step_status: StepVerification[];
  };
  ai_flagged_error_step?: number | null;
  provider?: string;
  model?: string;
  cached?: boolean;
  tokens_used?: number;
}

export class LiveCheckError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'LiveCheckError';
    this.status = status;
  }
}

/** Stable fingerprint of the drawn content (ignores pan/zoom/selection). */
export function sceneSignature(elements: readonly ExcalidrawElement[]): string {
  if (!elements.length) return '';
  let hash = 2166136261;
  const mix = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= 0x9e3779b9;
    hash = Math.imul(hash, 16777619);
  };
  for (const element of elements) {
    if (element.isDeleted) continue;
    mix(
      [
        element.id,
        element.version,
        element.type,
        element.x,
        element.y,
        element.width,
        element.height,
      ].join(':'),
    );
  }
  return `${elements.length}-${(hash >>> 0).toString(36)}`;
}

export interface RequestLiveCheckArgs {
  imageBase64: string;
  questionId: string;
  questionText?: string;
  signal?: AbortSignal;
  apiBase?: string;
  force?: boolean;
}

export async function requestLiveCheck(args: RequestLiveCheckArgs): Promise<LiveCheckResult> {
  const base = (args.apiBase || API_BASE).replace(/\/$/, '');
  let response: Response;
  try {
    response = await fetch(`${base}/ai/live-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: args.signal,
      body: JSON.stringify({
        image_base64: args.imageBase64,
        question_id: args.questionId,
        question_text: args.questionText || null,
        force: args.force === true,
      }),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new LiveCheckError(
      'Could not reach the maths backend. Is start-backend.bat running?',
    );
  }

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = typeof body?.detail === 'string' ? body.detail : '';
    } catch {
      /* non-JSON error body */
    }
    throw new LiveCheckError(
      detail || `Live check failed (HTTP ${response.status})`,
      response.status,
    );
  }

  const data = (await response.json()) as LiveCheckResult;
  if (!data || !Array.isArray(data.steps)) {
    throw new LiveCheckError('The backend returned an unexpected response.');
  }
  return {
    ...data,
    error_bbox: data.error_bbox || null,
    first_error_step:
      typeof data.first_error_step === 'number' ? data.first_error_step : null,
    verification: data.verification || {
      checked_transitions: 0,
      total_transitions: 0,
      step_status: [],
    },
  };
}
