import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConversationDto, ConversationStatus, MessageSenderType } from '@ozimai/shared';
import { api } from '../../lib/api';
import { useConversationsSocket } from '../../lib/useConversationsSocket';
import { Pills } from '../../design-system/Tabs';
import { Button } from '../../design-system/Button';
import { ConversationStatusChip } from '../../design-system/Chip';
import { useToast } from '../../design-system/Toast';
import './dialogues.css';

interface Message {
  id: string;
  senderType: MessageSenderType;
  text: string;
  createdAt: string;
  aiMeta?: { model: string; latencyMs: number; escalationReason?: string } | null;
}
interface Thread {
  conversation: { id: string; status: ConversationStatus; channel: string };
  patient: { id: string; name: string | null; phone: string; lastNote: string | null; leadStatus: string };
  messages: Message[];
}

export function DialoguesScreen() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<'attention' | 'all'>('attention');
  const [draft, setDraft] = useState('');

  const { data: list } = useQuery({
    queryKey: ['conversations', filter],
    queryFn: () => api.get<ConversationDto[]>(`/conversations?filter=${filter}`),
  });

  const selectedId = conversationId ?? list?.[0]?.id;

  const { data: thread } = useQuery({
    queryKey: ['conversation', selectedId],
    queryFn: () => api.get<Thread>(`/conversations/${selectedId}`),
    enabled: Boolean(selectedId),
  });

  useConversationsSocket({
    onMessage: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedId] });
    },
    onStatus: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedId] });
    },
  });

  const takeover = useMutation({
    mutationFn: () => api.post(`/conversations/${selectedId}/takeover`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const returnToAi = useMutation({
    mutationFn: () => api.post(`/conversations/${selectedId}/return`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
  const sendReply = useMutation({
    mutationFn: (text: string) => api.post(`/conversations/${selectedId}/reply`, { text }),
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['conversation', selectedId] });
    },
    onError: (err: any) => toast(err.message ?? 'Не удалось отправить'),
  });

  const isHuman = thread?.conversation.status === ConversationStatus.Human;

  const filtered = useMemo(() => list ?? [], [list]);

  return (
    <div className="dlg-layout">
      <div className="dlg-list">
        <div className="dlg-list-header">
          <Pills
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'attention', label: `Внимание${filtered.length && filter === 'attention' ? ` · ${filtered.length}` : ''}` },
              { value: 'all', label: 'Все' },
            ]}
          />
        </div>
        <div className="dlg-list-body">
          {filtered.length === 0 && (
            <div className="type-small" style={{ padding: 16 }}>
              {filter === 'attention' ? 'Нет диалогов, требующих внимания 🎉' : 'Пока нет диалогов. Отправьте себе сообщение — проверьте Айым.'}
            </div>
          )}
          {filtered.map((c) => (
            <div key={c.id} className={`dlg-row ${c.id === selectedId ? 'selected' : ''}`} onClick={() => navigate(`/dialogues/${c.id}`)}>
              <div className="dlg-row-top">
                <span className="dlg-row-name">{c.patientName}</span>
                <span className="dlg-row-channel">{c.channel}</span>
              </div>
              <div className="dlg-row-preview">{c.lastMessagePreview}</div>
              <ConversationStatusChip status={c.status} />
            </div>
          ))}
        </div>
      </div>

      <div className="dlg-thread">
        {!thread ? (
          <div style={{ padding: 20 }} className="type-small">
            Выберите диалог слева
          </div>
        ) : (
          <>
            <div className="dlg-thread-header">
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div className="type-h2" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {thread.patient.name ?? thread.patient.phone}
                </div>
                <div className="type-small">
                  {thread.patient.phone} · {thread.conversation.channel}
                </div>
              </div>
              {isHuman ? (
                <Button variant="secondary" size="sm" onClick={() => returnToAi.mutate()} disabled={returnToAi.isPending}>
                  Вернуть Айым
                </Button>
              ) : (
                <Button size="sm" onClick={() => takeover.mutate()} disabled={takeover.isPending}>
                  Перехватить
                </Button>
              )}
            </div>

            <div className="dlg-thread-body">
              {thread.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
            </div>

            <div className="dlg-thread-footer">
              {isHuman ? (
                <form
                  style={{ display: 'flex', gap: 10 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (draft.trim()) sendReply.mutate(draft.trim());
                  }}
                >
                  <input
                    className="field-input"
                    style={{ flex: 1 }}
                    placeholder="Написать пациенту от имени клиники…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <Button type="submit" disabled={sendReply.isPending}>
                    Отправить
                  </Button>
                </form>
              ) : (
                <div className="type-small" style={{ textAlign: 'center', padding: 8 }}>
                  Айым ведёт этот диалог. Нажмите «Перехватить», чтобы написать самим.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {thread && (
        <div className="dlg-patient-card">
          <div className="type-label" style={{ marginBottom: 10 }}>
            Карточка пациента
          </div>
          <div className="type-h2" style={{ marginBottom: 2 }}>
            {thread.patient.name ?? 'Без имени'}
          </div>
          <div className="type-small" style={{ marginBottom: 14 }}>
            {thread.patient.phone}
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }} className="type-small">
            {thread.patient.lastNote ?? 'Заметок пока нет'}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const escalated = Boolean(message.aiMeta?.escalationReason);
  const cls =
    message.senderType === MessageSenderType.Patient
      ? 'msg-patient'
      : message.senderType === MessageSenderType.Admin
        ? 'msg-admin'
        : message.senderType === MessageSenderType.System
          ? 'msg-system'
          : escalated
            ? 'msg-ai-escalated'
            : 'msg-ai';

  const justify = message.senderType === MessageSenderType.Patient ? 'flex-start' : message.senderType === MessageSenderType.System ? 'center' : 'flex-end';
  const tagColor = escalated ? 'var(--warn-text)' : 'var(--accent-700)';

  return (
    <div className="msg-row" style={{ justifyContent: justify }}>
      <div>
        <div className={`msg-bubble ${cls}`}>{message.text}</div>
        {message.senderType === MessageSenderType.Ai && (
          <div className="msg-tag" style={{ textAlign: 'right', color: tagColor }}>
            {escalated ? `⚑ эскалация` : '✦ Айым'}
          </div>
        )}
      </div>
    </div>
  );
}
