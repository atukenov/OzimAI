import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function VerifyScreen() {
  const [params] = useSearchParams();
  const { verify } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setError('Ссылка неполная — токен не найден.');
      return;
    }
    verify(token)
      .then(() => navigate('/', { replace: true }))
      .catch((err) => setError(err.message ?? 'Ссылка недействительна или устарела'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
      {error ? <p style={{ color: 'var(--danger-600)' }}>{error}</p> : <p className="type-small">Входим…</p>}
    </div>
  );
}
