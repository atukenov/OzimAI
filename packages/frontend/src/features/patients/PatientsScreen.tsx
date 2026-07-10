import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ConversationDto, LeadStatus, PatientDto } from '@ozimai/shared';
import { api } from '../../lib/api';
import { Chip } from '../../design-system/Chip';

const STATUS_LABEL: Record<LeadStatus, { label: string; tone: 'neutral' | 'accent' | 'warn' | 'faint' }> = {
  [LeadStatus.Lead]: { label: 'Лид', tone: 'neutral' },
  [LeadStatus.Booked]: { label: '✓ Записан', tone: 'accent' },
  [LeadStatus.Visited]: { label: 'Был на приёме', tone: 'accent' },
  [LeadStatus.Lost]: { label: 'Потерян', tone: 'faint' },
};

export function PatientsScreen() {
  const navigate = useNavigate();
  const { data: patients } = useQuery({ queryKey: ['patients'], queryFn: () => api.get<PatientDto[]>('/patients') });
  const { data: conversations } = useQuery({ queryKey: ['conversations', 'all'], queryFn: () => api.get<ConversationDto[]>('/conversations?filter=all') });

  const convByPatient = new Map((conversations ?? []).map((c) => [c.patientId, c.id]));
  const visible = (patients ?? []).filter((p) => p.phone !== 'test-chat');

  return (
    <div style={{ padding: '28px 32px' }}>
      <h1 className="type-h1" style={{ margin: '0 0 16px' }}>
        Пациенты
      </h1>
      <table style={{ width: '100%', maxWidth: 760, borderCollapse: 'collapse', font: '400 13px var(--font-ui)' }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={thStyle}>Имя</th>
            <th style={thStyle}>Статус</th>
            <th style={thStyle}>Заметка</th>
            <th style={{ ...thStyle, textAlign: 'right' }}></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => {
            const meta = STATUS_LABEL[p.leadStatus];
            const convId = convByPatient.get(p.id);
            return (
              <tr key={p.id}>
                <td style={tdStyle}>
                  <strong>{p.name ?? p.phone}</strong>
                </td>
                <td style={tdStyle}>
                  <Chip tone={meta.tone}>{meta.label}</Chip>
                </td>
                <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{p.lastNote ?? '—'}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  {convId && (
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/dialogues/${convId}`)}>
                      Открыть диалог →
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {visible.length === 0 && (
        <p className="type-small" style={{ marginTop: 12 }}>
          Пациенты появятся автоматически, как только начнётся первый диалог.
        </p>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 10px 8px 0',
  borderBottom: '2px solid var(--text-ink)',
  font: '600 9.5px var(--font-mono)',
  letterSpacing: '.08em',
  color: 'var(--text-faint)',
  textTransform: 'uppercase',
};
const tdStyle: React.CSSProperties = { padding: '10px 10px 10px 0', borderBottom: '1px solid var(--bg-sunken)' };
