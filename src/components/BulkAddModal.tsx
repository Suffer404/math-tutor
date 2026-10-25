import React, { useMemo, useRef, useState } from 'react';
import type { Question } from '../data/sampleQuestions';
import { parseQuestions, QUESTION_TEMPLATE } from '../lib/parseQuestions';

interface BulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (questions: Question[]) => void;
}

/**
 * Paste many questions at once (plain text or JSON), or load a .txt/.md/.json file.
 * Nothing is sent to a server: the parsed questions are appended to the local list.
 */
export const BulkAddModal: React.FC<BulkAddModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { questions, errors } = useMemo(() => parseQuestions(text), [text]);

  if (!isOpen) return null;

  const handleFile = async (file: File) => {
    setFileError(null);
    if (file.size > 2 * 1024 * 1024) {
      setFileError('File is larger than 2 MB.');
      return;
    }
    try {
      const content = await file.text();
      setText(content);
    } catch {
      setFileError('Could not read that file.');
    }
  };

  const submit = () => {
    if (!questions.length) return;
    onAdd(questions);
    setText('');
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="bulk-add-title">
      <div
        className="dialog"
        style={{ maxWidth: '760px', width: '92vw', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="bulk-add-title" style={{ margin: '0 0 0.5rem', fontSize: '1.125rem' }}>
          Add questions (text)
        </h2>
        <p style={{ margin: '0 0 0.75rem', color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          Separate questions with a blank line. Keys are optional: <code>Topic:</code>, <code>Difficulty:</code>{' '}
          <code>Q:</code>, <code>A:</code>, <code>H:</code> (hint, repeatable), <code>S:</code> (step, repeatable).
          A JSON array also works.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          onDragOver={(e) => e.preventDefault()}
          placeholder={QUESTION_TEMPLATE}
          spellCheck={false}
          style={{
            flex: 1,
            minHeight: '260px',
            width: '100%',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            padding: '0.625rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-primary)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            resize: 'vertical',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.625rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', color: questions.length ? 'var(--success)' : 'var(--text-muted)' }}>
            {questions.length ? `${questions.length} question${questions.length > 1 ? 's' : ''} ready` : 'Nothing parsed yet'}
          </span>
          <span style={{ flex: 1 }} />
          <button className="btn btn--ghost" onClick={() => setText(QUESTION_TEMPLATE)}>Load example</button>
          <button className="btn btn--ghost" onClick={() => fileRef.current?.click()}>Open file…</button>
          <button className="btn btn--ghost" onClick={() => setText('')} disabled={!text}>Clear</button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.json,text/plain,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />
        </div>

        {(errors.length > 0 || fileError) && (
          <div style={{ marginTop: '0.5rem', maxHeight: '96px', overflowY: 'auto', fontSize: '0.8125rem', color: 'var(--error)' }}>
            {fileError && <div>• {fileError}</div>}
            {errors.map((err, i) => (
              <div key={i}>• {err}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.875rem' }}>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn--primary" onClick={submit} disabled={!questions.length}>
            Add {questions.length || ''} question{questions.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkAddModal;
