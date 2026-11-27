import { useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BillingStatus } from '@ozimai/shared';
import { api } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';

interface CompanyRow {
  id: string;
  name: string;
  logo: string | null;
  publicSlug: string;
  billingStatus: BillingStatus;
  plan: string;
  createdAt: string;
}

const STATUS_LABEL: Record<BillingStatus, string> = {
  [BillingStatus.Trial]: 'пробный период',
  [BillingStatus.Active]: 'оплачено',
  [BillingStatus.PastDue]: 'долг',
  [BillingStatus.ReadOnly]: 'отключено',
};

/** Platform owner only: each company's name and logo (clinic staff cannot change these). */
export function SuperAdminScreen() {
  const { user } = useAuth();
  const { data: companies, isLoading } = useQuery({
    queryKey: ['super-admin', 'organizations'],
    queryFn: () => api.get<CompanyRow[]>('/super-admin/organizations'),
    enabled: Boolean(user?.isSuperAdmin),
  });

  if (!user?.isSuperAdmin) return <Navigate to="/dialogues" replace />;

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      <div>
        <h1 className="type-h1" style={{ margin: 0 }}>
          Компании
        </h1>
        <p className="type-small" style={{ margin: '4px 0 0' }}>
          Название и логотип видят пациенты в чате и сотрудники в панели. Менять их можете только вы.
        </p>
      </div>
      {isLoading && <div className="type-small">Загрузка…</div>}
      {(companies ?? []).map((c) => (
        <CompanyCard key={c.id} company={c} />
      ))}
    </div>
  );
}

function CompanyCard({ company }: { company: CompanyRow }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(company.name);
  const [logoError, setLogoError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (body: { name?: string; logo?: string | null }) => api.patch(`/super-admin/organizations/${company.id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'organizations'] });
      queryClient.invalidateQueries({ queryKey: ['org', 'me'] });
    },
  });

  const onFile = async (file: File | undefined) => {
    setLogoError(null);
    if (!file) return;
    try {
      save.mutate({ logo: await toLogoDataUrl(file) });
    } catch (e) {
      setLogoError((e as Error).message);
    }
  };

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          background: 'var(--bg-sunken)',
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
          flex: 'none',
        }}
      >
        {company.logo ? <img src={company.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span className="type-small">нет лого</span>}
      </div>
      <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="field-input" style={{ flex: 1, height: 34 }} value={name} onChange={(e) => setName(e.target.value)} />
          <button
            className="btn btn-primary btn-sm"
            disabled={save.isPending || name.trim().length < 2 || name === company.name}
            onClick={() => save.mutate({ name: name.trim() })}
          >
            Сохранить
          </button>
        </div>
        <div className="type-small">
          /c/{company.publicSlug} · {STATUS_LABEL[company.billingStatus] ?? company.billingStatus} · с{' '}
          {new Date(company.createdAt).toLocaleDateString('ru-RU')}
        </div>
        {(logoError || save.error) && <div className="field-error">⚠ {logoError ?? (save.error as Error).message}</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <button className="btn btn-secondary btn-sm" disabled={save.isPending} onClick={() => fileRef.current?.click()}>
          {company.logo ? 'Заменить логотип' : 'Загрузить логотип'}
        </button>
        {company.logo && (
          <button className="btn btn-ghost btn-sm" disabled={save.isPending} onClick={() => save.mutate({ logo: null })}>
            Убрать
          </button>
        )}
      </div>
    </section>
  );
}

/** Shrinks the image to fit 256×256 and re-encodes it, so any photo becomes a small logo. */
async function toLogoDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Нужен PNG, JPEG или WebP');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let url = canvas.toDataURL('image/png');
  if (url.length > 140_000) url = canvas.toDataURL('image/webp', 0.85);
  if (!url.startsWith('data:image/webp') && url.length > 140_000) url = canvas.toDataURL('image/jpeg', 0.85);
  if (url.length > 140_000) throw new Error('Логотип слишком большой даже после сжатия');
  return url;
}
