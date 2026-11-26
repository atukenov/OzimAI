import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { Input } from '../../design-system/Field';
import { Button } from '../../design-system/Button';
import { Card } from '../../design-system/Card';

export function LoginScreen() {
  const { requestCode, verify } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [needsOrgName, setNeedsOrgName] = useState(false);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await requestCode(email, needsOrgName ? orgName : undefined);
      setDevCode(res.devCode ?? null);
      setCode('');
      setStep('code');
    } catch (err: any) {
      if (String(err.message).includes('orgName')) {
        setNeedsOrgName(true);
        setError('Это новый e-mail — укажите название клиники, чтобы создать организацию.');
      } else {
        setError(err.message ?? 'Не удалось отправить код');
      }
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await verify(email, code);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message ?? 'Неверный код');
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
          {step === 'email' ? 'Вход по коду из письма — без пароля.' : `Мы отправили 4-значный код на ${email}.`}
        </p>

        {step === 'email' ? (
          <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input label="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.kz" />
            {needsOrgName && (
              <Input label="Название клиники" required value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Стоматология «Айгуль»" />
            )}
            {error && <div className="field-error">{error}</div>}
            <Button type="submit" disabled={busy}>
              {busy ? 'Отправляем…' : 'Получить код'}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label="Код из письма"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{4}"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }}
            />
            {devCode && <div className="type-small">Dev-режим (почта не настроена): код {devCode}</div>}
            {error && <div className="field-error">{error}</div>}
            <Button type="submit" variant="primary" disabled={busy || code.length !== 4}>
              {busy ? 'Проверяем…' : 'Войти'}
            </Button>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button type="button" variant="ghost" onClick={() => { setStep('email'); setError(''); }}>
                ← Другой e-mail
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => sendCode()}>
                Отправить ещё раз
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
