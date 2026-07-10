import { ReactNode } from 'react';
import { Button } from './Button';

interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  confirmVariant?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}

export function ConfirmDialog({ open, title, description, confirmLabel, confirmVariant = 'primary', onConfirm, onCancel, busy }: DialogProps) {
  if (!open) return null;
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="type-h2" style={{ marginBottom: 6 }}>
          {title}
        </div>
        {description && (
          <p className="type-small" style={{ margin: '0 0 14px' }}>
            {description}
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            Оставить
          </Button>
          <Button variant={confirmVariant} size="sm" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
