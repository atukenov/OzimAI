import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KnowledgeDocDto, KnowledgeSourceType } from '@ozimai/shared';
import { api } from '../../lib/api';
import { Button } from '../../design-system/Button';
import { Input, Textarea } from '../../design-system/Field';
import { Card } from '../../design-system/Card';

const STEPS = ['Клиника', 'Знания', 'Канал', 'Проверка'] as const;

export function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', padding: '40px 24px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div className="type-display" style={{ marginBottom: 4 }}>
          Ozim<span style={{ color: 'var(--accent-600)' }}>AI</span> · Онбординг
        </div>
        <div style={{ display: 'flex', gap: 8, margin: '16px 0 24px' }}>
          {STEPS.map((label, i) => (
            <div
              key={label}
              className="type-label"
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 0',
                borderRadius: 6,
                background: i <= step ? 'var(--text-ink)' : 'var(--bg-sunken)',
                color: i <= step ? 'var(--on-ink)' : 'var(--text-faint)',
              }}
            >
              {i + 1} · {label}
            </div>
          ))}
        </div>

        <Card>
          {step === 0 && <ClinicStep onNext={() => setStep(1)} />}
          {step === 1 && <KnowledgeStep onNext={() => setStep(2)} onBack={() => setStep(0)} />}
          {step === 2 && <ChannelStep onNext={() => setStep(3)} onBack={() => setStep(1)} />}
          {step === 3 && <VerifyStep onBack={() => setStep(2)} onLaunch={() => navigate('/dialogues')} />}
        </Card>
      </div>
    </div>
  );
}

function StepFooter({ onBack, onNext, nextLabel = 'Далее', nextDisabled }: { onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
      <div>
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            Назад
          </Button>
        )}
      </div>
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}

function ClinicStep({ onNext }: { onNext: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [doctorName, setDoctorName] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      if (name) await api.patch('/organizations/me', { name });
      const branch = await api.post<{ id: string }>('/organizations/branches', { name: address || 'Основной филиал', address });
      if (doctorName) {
        await api.post('/organizations/practitioners', { branchId: branch.id, name: doctorName });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      onNext();
    },
  });

  return (
    <div>
      <div className="type-h2" style={{ marginBottom: 12, color: 'var(--accent-700)' }}>
        Шаг 1 · Клиника
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Название клиники" value={name} onChange={(e) => setName(e.target.value)} placeholder="Стоматология «Айгуль»" />
        <Input label="Адрес" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="г. Алматы, ул. Достык 89" />
        <Input label="Врач (можно добавить ещё позже)" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Доктор Серикова" />
      </div>
      <StepFooter onNext={() => save.mutate()} nextDisabled={save.isPending} />
    </div>
  );
}

function KnowledgeStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState('Чистка - 25000\nИмплантация - 180000\nЧасы работы клиники - Ежедневно 09:00-20:00');
  const [drafts, setDrafts] = useState<KnowledgeDocDto[] | null>(null);

  const parse = useMutation({
    mutationFn: () => api.post<KnowledgeDocDto[]>('/knowledge/import', { raw, sourceType: KnowledgeSourceType.Text }),
    onSuccess: (data) => setDrafts(data),
  });

  const publish = useMutation({
    mutationFn: () => api.post('/knowledge/publish', { ids: drafts!.map((d) => d.id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      onNext();
    },
  });

  return (
    <div>
      <div className="type-h2" style={{ marginBottom: 12, color: 'var(--accent-700)' }}>
        Шаг 2 · Знания
      </div>
      {!drafts ? (
        <>
          <Textarea label="Прайс-лист (по одной услуге на строке: «Название - Цена»)" rows={6} value={raw} onChange={(e) => setRaw(e.target.value)} />
          <StepFooter onBack={onBack} onNext={() => parse.mutate()} nextLabel="Разобрать" nextDisabled={parse.isPending} />
        </>
      ) : (
        <>
          <p className="type-small" style={{ marginBottom: 10 }}>
            Предпросмотр — так Айым будет отвечать пациентам:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
            {drafts.map((d) => (
              <div key={d.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
                <div className="type-small" style={{ fontWeight: 600, color: 'var(--text-ink)' }}>
                  {d.question}
                </div>
                <div className="type-small">{d.answer}</div>
              </div>
            ))}
            {drafts.length === 0 && <p className="type-small">Не удалось распознать ни одной строки — проверьте формат.</p>}
          </div>
          <StepFooter onBack={() => setDrafts(null)} onNext={() => publish.mutate()} nextLabel="Опубликовать и продолжить" nextDisabled={publish.isPending || drafts.length === 0} />
        </>
      )}
    </div>
  );
}

function ChannelStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [aiName, setAiName] = useState('Айым');
  const [aiTone, setAiTone] = useState('тёплый и прямой');

  const save = useMutation({
    mutationFn: () => api.patch('/organizations/me', { aiName, aiTone }),
    onSuccess: onNext,
  });

  return (
    <div>
      <div className="type-h2" style={{ marginBottom: 12, color: 'var(--accent-700)' }}>
        Шаг 3 · Канал
      </div>
      <div
        style={{
          border: '1px dashed var(--border-strong)',
          borderRadius: 8,
          padding: 20,
          textAlign: 'center',
          marginBottom: 14,
          color: 'var(--text-muted)',
        }}
        className="type-small"
      >
        Подключение WhatsApp по QR-коду появится здесь после настройки WhatsApp Business Platform (BSP-партнёр). Пока продукт работает через встроенный тестовый канал.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input label="Имя AI-сотрудника" value={aiName} onChange={(e) => setAiName(e.target.value)} />
        <Input label="Тон общения" value={aiTone} onChange={(e) => setAiTone(e.target.value)} />
      </div>
      <StepFooter onBack={onBack} onNext={() => save.mutate()} nextDisabled={save.isPending} />
    </div>
  );
}

function VerifyStep({ onBack, onLaunch }: { onBack: () => void; onLaunch: () => void }) {
  const [messages, setMessages] = useState<{ from: 'user' | 'ai'; text: string; escalated?: boolean }[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const history = messages.map((m) => ({ from: m.from, text: m.text }));
    setMessages((m) => [...m, { from: 'user', text }]);
    setInput('');
    setBusy(true);
    try {
      const res = await api.post<{ reply: string; escalated: boolean }>('/ai/test-chat', { history, message: text });
      setMessages((m) => [...m, { from: 'ai', text: res.reply, escalated: res.escalated }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="type-h2" style={{ marginBottom: 6, color: 'var(--accent-700)' }}>
        Шаг 4 · Проверка
      </div>
      <p className="type-small" style={{ marginBottom: 10 }}>
        Попробуйте «сломать» Айым — спросите цену вне прайса, что-то медицинское, или задайте странный вопрос. Она должна отвечать только из базы знаний или передавать вопрос человеку.
      </p>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-page)', height: 260, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  maxWidth: '80%',
                  borderRadius: 14,
                  padding: '8px 12px',
                  font: '400 12.5px/1.45 var(--font-ui)',
                  background: m.from === 'user' ? 'var(--text-ink)' : m.escalated ? 'var(--warn-bg)' : 'var(--accent-050)',
                  color: m.from === 'user' ? 'var(--on-ink)' : 'var(--text-ink)',
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
        <form
          style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input className="field-input" style={{ height: 34, fontSize: 13 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Спросите что-нибудь…" />
          <button type="submit" className="btn btn-primary btn-sm" style={{ height: 34 }}>
            →
          </button>
        </form>
      </div>
      <StepFooter onBack={onBack} onNext={onLaunch} nextLabel="Запустить Айым →" />
    </div>
  );
}
