import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Input } from '../../design-system/Field';
import { Button } from '../../design-system/Button';
import { Card } from '../../design-system/Card';

export function LoginScreen() {
  const { requestMagicLink } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [needsOrgName, setNeedsOrgName] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await requestMagicLink(email, needsOrgName ? orgName : undefined);
      setSent(res.devMagicLink);
    } catch (err: any) {
      if (String(err.message).includes('orgName')) {
        setNeedsOrgName(true);
        setError('Это новый e-mail — укажите название клиники, чтобы создать организацию.');
      } else {
        setError(err.message ?? 'Не удалось отправить ссылку');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg-page)' }}>
      <Card style={{ width: 380 }}>
        <div className="type-display" style={{ marginBottom: 4 }}>
          Ozim<span style={{ color: 'var(--accent-600)' }}>AI</span>
        </div>
        <p className="type-small" style={{ margin: '0 0 20px' }}>
          Вход по magic-link — без пароля.
        </p>

        {sent ? (
          <div>
            <p className="type-body">Ссылка для входа готова (dev-режим — реальная почта пока не подключена):</p>
            <Button
              variant="primary"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => navigate(sent.replace(window.location.origin, '').replace(/^https?:\/\/[^/]+/, ''))}
            >
              Открыть ссылку входа →
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.kz" />
            {needsOrgName && (
              <Input label="Название клиники" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Стоматология «Айгуль»" />
            )}
            {error && <div className="field-error">{error}</div>}
            <Button type="submit" disabled={busy}>
              {busy ? 'Отправляем…' : 'Получить ссылку для входа'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
