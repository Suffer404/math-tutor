import React, { useCallback, useEffect, useState } from 'react';

const API_BASE = 'http://127.0.0.1:8000';

interface AiConfig {
  provider: string;
  base_url: string;
  model: string;
  api_key_masked: string;
  has_key: boolean;
  source: string;
}

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const PRESETS: { label: string; provider: string; base_url: string; model: string }[] = [
  { label: 'Requesty', provider: 'requesty', base_url: 'https://router.requesty.ai/v1', model: 'openai/gpt-4o-mini' },
  { label: 'OpenAI', provider: 'custom', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { label: 'OpenRouter', provider: 'custom', base_url: 'https://openrouter.ai/api/v1', model: 'google/gemini-2.0-flash-001' },
  { label: 'Groq', provider: 'custom', base_url: 'https://api.groq.com/openai/v1', model: 'llama-3.2-11b-vision-preview' },
  { label: 'Ollama (local)', provider: 'custom', base_url: 'http://127.0.0.1:11434/v1', model: 'llava' },
];

export const AiSettingsModal: React.FC<AiSettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [provider, setProvider] = useState('custom');
  const [baseUrl, setBaseUrl] = useState('https://router.requesty.ai/v1');
  const [model, setModel] = useState('openai/gpt-4o-mini');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<'' | 'load' | 'test' | 'save'>('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/ai/config`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: AiConfig = await r.json();
      setConfig(data);
      setProvider(data.provider || 'custom');
      setBaseUrl(data.base_url || '');
      setModel(data.model || '');
    } catch (e) {
      setMessage({ kind: 'error', text: `Could not read AI config — is the backend running? (${e instanceof Error ? e.message : 'error'})` });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setApiKey('');
      setMessage(null);
      void loadConfig();
    }
  }, [isOpen, loadConfig]);

  if (!isOpen) return null;

  const applyPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.label === name);
    if (!preset) return;
    setProvider(preset.provider);
    setBaseUrl(preset.base_url);
    setModel(preset.model);
    setMessage(null);
  };

  const loadModels = async () => {
    setBusy('load');
    setMessage(null);
    try {
      const r = await fetch(`${API_BASE}/ai/models`);
      const data = await r.json();
      if (data.ok) {
        setModels(data.models || []);
        setMessage({ kind: 'ok', text: `${data.count} models available — pick one from the list.` });
      } else {
        setMessage({ kind: 'warn', text: data.error || 'Model list failed' });
      }
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Model list failed' });
    } finally {
      setBusy('');
    }
  };

  const testConnection = async () => {
    setBusy('test');
    setMessage({ kind: 'warn', text: 'Sending one tiny request…' });
    try {
      const r = await fetch(`${API_BASE}/ai/test`, { method: 'POST' });
      const data = await r.json();
      if (data.ok) {
        setMessage({ kind: 'ok', text: `Works. ${data.model} replied “${data.reply}” (${data.tokens} tokens).` });
      } else {
        setMessage({ kind: 'error', text: data.error || 'Test failed' });
      }
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setBusy('');
    }
  };

  const save = async () => {
    setBusy('save');
    setMessage(null);
    try {
      const r = await fetch(`${API_BASE}/ai/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          base_url: baseUrl,
          model,
          api_key: apiKey.trim() ? apiKey.trim() : null,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || `HTTP ${r.status}`);
      setConfig(data);
      setApiKey('');
      setMessage({ kind: 'ok', text: `Saved. ${data.model} via ${data.base_url} (${data.api_key_masked}).` });
      onSaved?.();
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : 'Save failed' });
    } finally {
      setBusy('');
    }
  };

  const field: React.CSSProperties = {
    width: '100%',
    padding: '0.4375rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-primary)',
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    fontSize: '0.8125rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block',
    margin: '0 0 0.25rem',
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-muted)',
  };

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
      <div
        className="dialog"
        style={{ maxWidth: '560px', width: '92vw', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="ai-settings-title" style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>
          AI model
        </h2>
        <p style={{ margin: '0 0 0.875rem', color: 'var(--text-secondary)', fontSize: '0.8125rem', lineHeight: 1.5 }}>
          Any OpenAI-compatible endpoint works. The key is stored only on this machine
          (<code>ai_config.json</code>, gitignored) and is never sent to the browser again — you'll see it masked.
        </p>

        <label style={labelStyle}>Preset</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.875rem' }}>
          {PRESETS.map((p) => (
            <button key={p.label} className="btn btn--ghost" style={{ padding: '0.25rem 0.625rem', fontSize: '0.75rem' }} onClick={() => applyPreset(p.label)}>
              {p.label}
            </button>
          ))}
        </div>

        <label style={labelStyle} htmlFor="ai-base-url">Base URL</label>
        <input id="ai-base-url" style={field} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://router.requesty.ai/v1" spellCheck={false} />

        <label style={{ ...labelStyle, marginTop: '0.75rem' }} htmlFor="ai-model">Model</label>
        <input
          id="ai-model"
          style={field}
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="openai/gpt-4o-mini"
          list="ai-model-options"
          spellCheck={false}
        />
        <datalist id="ai-model-options">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>

        <label style={{ ...labelStyle, marginTop: '0.75rem' }} htmlFor="ai-key">API key</label>
        <input
          id="ai-key"
          style={field}
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={config?.has_key ? `saved: ${config.api_key_masked} (leave blank to keep)` : 'paste your key'}
          autoComplete="off"
          spellCheck={false}
        />

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.875rem' }}>
          <button className="btn btn--ghost" onClick={loadModels} disabled={busy !== ''}>
            {busy === 'load' ? 'Loading…' : 'Load models'}
          </button>
          <button className="btn btn--secondary" onClick={testConnection} disabled={busy !== ''}>
            {busy === 'test' ? 'Testing…' : 'Test connection'}
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn btn--primary" onClick={save} disabled={busy !== ''}>
            {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
        </div>

        {message && (
          <p
            style={{
              margin: '0.75rem 0 0',
              padding: '0.5rem 0.625rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8125rem',
              lineHeight: 1.45,
              background: message.kind === 'ok' ? 'var(--success-bg)' : message.kind === 'warn' ? 'var(--warning-bg)' : 'var(--error-bg)',
              color: message.kind === 'ok' ? 'var(--success)' : message.kind === 'warn' ? 'var(--warning)' : 'var(--error)',
              wordBreak: 'break-word',
            }}
          >
            {message.text}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.875rem' }}>
          <button className="btn btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiSettingsModal;
