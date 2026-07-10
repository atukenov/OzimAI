import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KnowledgeDocDto } from '@ozimai/shared';
import { api } from '../../lib/api';
import { Button } from '../../design-system/Button';
import { Input } from '../../design-system/Field';
import { Chip } from '../../design-system/Chip';

interface TestChatMessage {
  from: 'user' | 'ai';
  text: string;
  escalated?: boolean;
}

interface TestChatResponse {
  reply: string;
  escalated: boolean;
  provider: string;
  usedFallback: boolean;
  toolCalls: { name: string; input: unknown; output: unknown }[];
}

export function AiKnowledgeScreen() {
  return (
    <div style={{ padding: '28px 32px', display: 'flex', gap: 28 }}>
      <KnowledgePanel />
      <TestChatPanel />
    </div>
  );
}

function KnowledgePanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['knowledge'], queryFn: () => api.get<KnowledgeDocDto[]>('/knowledge') });
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const add = useMutation({
    mutationFn: () => api.post('/knowledge', { question, answer }),
    onSuccess: () => {
      setQuestion('');
      setAnswer('');
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
  });

  const publish = useMutation({
    mutationFn: (id: string) => api.post('/knowledge/publish', { ids: [id] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge'] }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (question.trim() && answer.trim()) add.mutate();
  };

  return (
    <div style={{ flex: 1, maxWidth: 440 }}>
      <h1 className="type-h1" style={{ margin: '0 0 6px' }}>
        База знаний
      </h1>
      <p className="type-small" style={{ margin: '0 0 16px' }}>
        Айым отвечает только на основе этих пар. Всё остальное — эскалация.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        <Input placeholder="Вопрос" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Input placeholder="Ответ" value={answer} onChange={(e) => setAnswer(e.target.value)} />
        <Button type="submit" size="sm" disabled={add.isPending}>
          Добавить и опубликовать
        </Button>
      </form>

      {(data ?? []).map((k) => (
        <div key={k.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', marginBottom: 8, background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div className="type-body" style={{ fontWeight: 600 }}>
              {k.question}
            </div>
            {k.publishedAt ? <Chip tone="accent">опубликовано</Chip> : <Chip tone="warn">черновик</Chip>}
          </div>
          <div className="type-small" style={{ marginTop: 4 }}>
            {k.answer}
          </div>
          {!k.publishedAt && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 6, padding: 0 }} onClick={() => publish.mutate(k.id)}>
              Опубликовать →
            </button>
          )}
        </div>
      ))}
      {(data ?? []).length === 0 && <p className="type-small">База знаний пока пуста.</p>}
    </div>
  );
}

function TestChatPanel() {
  const [messages, setMessages] = useState<TestChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const history = messages.map((m) => ({ from: m.from, text: m.text }));
    setMessages((m) => [...m, { from: 'user', text }]);
    setInput('');
    setBusy(true);
    setNotice('');
    try {
      const res = await api.post<TestChatResponse>('/ai/test-chat', { history, message: text });
      setMessages((m) => [...m, { from: 'ai', text: res.reply, escalated: res.escalated }]);
      if (res.usedFallback) {
        setNotice('Реальный LLM-провайдер не настроен (ANTHROPIC_API_KEY) — использован детерминированный резервный режим.');
      }
    } catch (err: any) {
      setNotice(err.message ?? 'Ошибка при обращении к AI');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ width: 340, flex: 'none' }}>
      <h2 className="type-h2" style={{ margin: '0 0 10px' }}>
        Тест-чат
      </h2>
      <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-page)', height: 400, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  border: m.from === 'user' ? 'none' : `1px solid ${m.escalated ? 'rgba(176,120,24,.35)' : 'rgba(var(--accent-rgb),.3)'}`,
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
          {busy && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div className="typing-dots" style={{ background: 'var(--accent-050)', border: '1px solid rgba(var(--accent-rgb),.3)', borderRadius: 14, padding: '8px 14px' }}>
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>
        <form
          style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input className="field-input" style={{ height: 34, fontSize: 13 }} placeholder="Спросите что-нибудь…" value={input} onChange={(e) => setInput(e.target.value)} />
          <button type="submit" className="btn btn-primary btn-sm" style={{ height: 34 }}>
            →
          </button>
        </form>
      </div>
      {notice && (
        <p className="type-small" style={{ color: 'var(--warn-text)', marginTop: 8 }}>
          {notice}
        </p>
      )}
      <p className="type-small" style={{ marginTop: 8 }}>
        Спросите про цену или запись — а после про «что выпить от боли», чтобы увидеть guardrail. Успешная запись сразу появится в «Календаре».
      </p>
    </div>
  );
}
