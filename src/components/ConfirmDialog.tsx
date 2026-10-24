import React, { ReactNode } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'secondary';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}) => {
  if (!isOpen) return null;

  const variantClasses = {
    danger: 'btn--danger',
    primary: 'btn--primary',
    secondary: 'btn--secondary',
  };

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h2 id="confirm-dialog-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>{title}</h2>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button
            className={`btn ${variant === 'danger' ? 'btn--secondary' : 'btn--ghost'}`}
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={`btn ${variantClasses[variant]}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

interface AlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  okText?: string;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  isOpen,
  onClose,
  title,
  message,
  okText = 'OK',
}) => {
  if (!isOpen) return null;

  return (
    <div className="dialog-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="alert-dialog-title">
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h2 id="alert-dialog-title" style={{ margin: '0 0 1rem', fontSize: '1.125rem' }}>{title}</h2>
        <p style={{ margin: '0 0 1.5rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn btn--primary"
            onClick={onClose}
            autoFocus
          >
            {okText}
          </button>
        </div>
      </div>
    </div>
  );
}