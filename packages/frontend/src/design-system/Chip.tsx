import { ConversationStatus } from '@ozimai/shared';

type ChipTone = 'neutral' | 'accent' | 'warn' | 'info' | 'faint';

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: React.ReactNode }) {
  return <span className={`chip chip-${tone}`}>{children}</span>;
}

const STATUS_META: Record<ConversationStatus, { tone: ChipTone; label: string }> = {
  [ConversationStatus.Attention]: { tone: 'warn', label: '⚑ Ждёт человека' },
  [ConversationStatus.Human]: { tone: 'info', label: 'Вы отвечаете' },
  [ConversationStatus.Ai]: { tone: 'neutral', label: 'AI ответил' },
};

export function ConversationStatusChip({ status }: { status: ConversationStatus }) {
  const meta = STATUS_META[status] ?? STATUS_META[ConversationStatus.Ai];
  return <Chip tone={meta.tone}>{meta.label}</Chip>;
}
