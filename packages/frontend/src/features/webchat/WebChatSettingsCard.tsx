import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrganizationDto } from '@ozimai/shared';
import { api } from '../../lib/api';

/** Panel card: the clinic's shareable chat link + website embed code. */
export function WebChatSettingsCard() {
  const queryClient = useQueryClient();
  const { data: org } = useQuery({ queryKey: ['org', 'me'], queryFn: () => api.get<OrganizationDto>('/organizations/me') });
  const [editing, setEditing] = useState(false);
  const [slug, setSlug] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (publicSlug: string) => api.patch<OrganizationDto>('/organizations/me', { publicSlug }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['org', 'me'] });
    },
  });

  if (!org) return null;

  const origin = window.location.origin;
  const link = `${origin}/c/${org.publicSlug}`;
  const snippet = `<script src="${origin}/widget.js" data-clinic="${org.publicSlug}" async></script>`;

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked — the text is selectable anyway */
    }
  };

  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: 18 }}>
      <h2 className="type-h2" style={{ margin: '0 0 4px' }}>
        Веб-чат
      </h2>
      <p className="type-small" style={{ margin: '0 0 14px' }}>
        Пациенты пишут {org.name ? `в «${org.name}»` : 'в клинику'} без WhatsApp: ссылка для Instagram и кнопка чата для сайта. Диалоги появляются в «Диалогах»,
        напоминания о записи уходят по SMS или push.
      </p>

      <div className="field-label">Ссылка на чат (Instagram, 2GIS, визитки)</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {editing ? (
          <>
            <span className="type-small">{origin}/c/</span>
            <input className="field-input" style={{ width: 200, height: 34 }} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} />
            <button className="btn btn-primary btn-sm" disabled={save.isPending} onClick={() => save.mutate(slug)}>
              Сохранить
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
              Отмена
            </button>
          </>
        ) : (
          <>
            <a href={link} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, wordBreak: 'break-all' }}>
              {link}
            </a>
            <button className="btn btn-secondary btn-sm" onClick={() => copy('link', link)}>
              {copied === 'link' ? 'Скопировано' : 'Копировать'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSlug(org.publicSlug);
                setEditing(true);
              }}
            >
              Изменить адрес
            </button>
          </>
        )}
      </div>
      {save.error && <div className="field-error">⚠ {(save.error as Error).message}</div>}

      <div className="field-label">Код для сайта (вставить перед &lt;/body&gt;)</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <code
          style={{
            flex: 1,
            display: 'block',
            padding: '8px 10px',
            background: 'var(--bg-sunken)',
            borderRadius: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            wordBreak: 'break-all',
          }}
        >
          {snippet}
        </code>
        <button className="btn btn-secondary btn-sm" onClick={() => copy('snippet', snippet)}>
          {copied === 'snippet' ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
    </section>
  );
}
