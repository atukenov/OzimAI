import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WeeklyReportDto } from '@ozimai/shared';
import { api } from '../../lib/api';

export function ReportsScreen() {
  const [offset, setOffset] = useState(0);
  const { data } = useQuery({
    queryKey: ['reports', 'weekly', offset],
    queryFn: () => api.get<WeeklyReportDto>(`/reports/weekly?offset=${offset}`),
  });

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18 }}>
        <h1 className="type-h1" style={{ margin: 0 }}>
          Отчёты
        </h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" style={{ width: 30, padding: 0 }} onClick={() => setOffset((o) => o - 1)}>
            ‹
          </button>
          <span className="type-small" style={{ minWidth: 140, textAlign: 'center' }}>
            {data?.weekLabel ?? '…'}
          </span>
          <button className="btn btn-secondary btn-sm" style={{ width: 30, padding: 0 }} onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0}>
            ›
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', maxWidth: 640 }}>
        <div style={{ background: 'var(--accent-050)', padding: '16px 18px' }}>
          <div className="type-label" style={{ color: 'var(--accent-700)' }}>
            Деньги от AI
          </div>
          <div style={{ font: '700 24px var(--font-ui)', color: 'var(--accent-700)', marginTop: 6 }}>₸ {(data?.moneyFromAi ?? 0).toLocaleString('ru-RU')}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '16px 18px' }}>
          <div className="type-label">Записей AI</div>
          <div style={{ font: '700 24px var(--font-ui)', marginTop: 6 }}>{data?.aiAppointments ?? 0}</div>
        </div>
        <div style={{ background: 'var(--surface)', padding: '16px 18px' }}>
          <div className="type-label">Неявки</div>
          <div style={{ font: '700 24px var(--font-ui)', marginTop: 6 }}>{Math.round((data?.noShowRate ?? 0) * 100)}%</div>
        </div>
      </div>

      <div style={{ marginTop: 20, maxWidth: 640 }}>
        <div className="type-label" style={{ marginBottom: 8 }}>
          Потерянные лиды · {data?.lostLeads.length ?? 0}
        </div>
        {(data?.lostLeads ?? []).length === 0 ? (
          <p className="type-small">На этой неделе потерянных лидов нет.</p>
        ) : (
          data!.lostLeads.map((l, i) => (
            <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
              <strong>{l.patientName}</strong> — <span className="type-small">{l.reason}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
