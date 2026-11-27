import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ChatApiError, ChatMessage, ClinicInfo, canUsePush, enablePush, getChatToken, setChatToken, webChatApi } from './webChatApi';
import './webchat.css';

const POLL_MS = 4000;

/**
 * Public patient-facing chat: `/c/<slug>` (shareable link, Instagram bio)
 * and `/c/<slug>?embed=1` (inside the widget.js iframe on a clinic site).
 */
export function WebChatScreen() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const embedded = params.get('embed') === '1';

  const [info, setInfo] = useState<ClinicInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [token, setToken] = useState<string | null>(() => getChatToken(slug));

  useEffect(() => {
    webChatApi
      .info(slug)
      .then((i) => {
        setInfo(i);
        document.title = i.clinicName;
      })
      .catch(() => setNotFound(true));
  }, [slug]);

  const close = () => window.parent?.postMessage({ type: 'ozimai:close' }, '*');

  return (
    <div className={`wc-root ${embedded ? 'wc-embedded' : ''}`}>
      <header className="wc-header">
        {info?.logo ? (
          <img className="wc-avatar" src={info.logo} alt="" style={{ objectFit: 'contain', background: '#fff' }} />
        ) : (
          <div className="wc-avatar">{(info?.aiName ?? '✦')[0]}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="wc-title">{info?.clinicName ?? ' '}</div>
          <div className="wc-subtitle">{info ? `${info.aiName} · онлайн-администратор` : ' '}</div>
        </div>
        {embedded && (
          <button className="wc-close" onClick={close} aria-label="Закрыть">
            ×
          </button>
        )}
      </header>

      {notFound ? (
        <div className="wc-center">Чат не найден. Проверьте ссылку.</div>
      ) : !info ? (
        <div className="wc-center">Загрузка…</div>
      ) : !info.available ? (
        <div className="wc-center">Онлайн-чат клиники временно недоступен. Пожалуйста, позвоните в клинику.</div>
      ) : token ? (
        <Conversation
          slug={slug}
          token={token}
          info={info}
          embedded={embedded}
          onExpired={() => {
            setChatToken(slug, null);
            setToken(null);
          }}
        />
      ) : (
        <StartForm
          slug={slug}
          info={info}
          onStarted={(t) => {
            setChatToken(slug, t);
            setToken(t);
          }}
        />
      )}

      <footer className="wc-footer">
        Работает на <b>OzimAI</b>
      </footer>
    </div>
  );
}

function StartForm({ slug, info, onStarted }: { slug: string; info: ClinicInfo; onStarted: (token: string) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await webChatApi.start(slug, name.trim(), phone.trim());
      onStarted(res.token);
    } catch (err) {
      setError((err as Error).message || 'Не удалось начать чат');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wc-start" onSubmit={submit}>
      <p className="wc-intro">
        Здравствуйте! Я {info.aiName}, помогу записаться в «{info.clinicName}» и отвечу на вопросы о ценах и услугах.
      </p>
      <label className="field-label" htmlFor="wc-name">
        Ваше имя
      </label>
      <input id="wc-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" />
      <label className="field-label" htmlFor="wc-phone" style={{ marginTop: 12 }}>
        Телефон
      </label>
      <input
        id="wc-phone"
        className="field-input"
        type="tel"
        inputMode="tel"
        placeholder="+7 7__ ___ __ __"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        autoComplete="tel"
      />
      <label className="wc-consent">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>Согласен(на) на обработку данных и SMS-напоминания о записи</span>
      </label>
      {error && <div className="field-error">⚠ {error}</div>}
      <button type="submit" className="btn btn-primary" disabled={busy || !agree || !name.trim() || !phone.trim()} style={{ marginTop: 14, width: '100%' }}>
        {busy ? '…' : 'Начать чат'}
      </button>
    </form>
  );
}

function Conversation({
  slug,
  token,
  info,
  embedded,
  onExpired,
}: {
  slug: string;
  token: string;
  info: ClinicInfo;
  embedded: boolean;
  onExpired: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pushState, setPushState] = useState<'idle' | 'on' | 'denied'>(() =>
    typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'on' : 'idle',
  );
  const scroller = useRef<HTMLDivElement>(null);
  const lastAt = useRef<string | undefined>(undefined);

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastAt.current = incoming[incoming.length - 1].createdAt;
  }, []);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ChatApiError && (err.status === 401 || err.status === 404)) onExpired();
      else setError((err as Error).message || 'Ошибка соединения');
    },
    [onExpired],
  );

  // Initial load + polling (picks up admin replies after a human takeover).
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        merge(await webChatApi.messages(slug, token, lastAt.current));
      } catch (err) {
        if (!stopped) handleError(err);
      }
    };
    tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [slug, token, merge, handleError]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    setError('');
    const optimistic: ChatMessage = { id: `local-${Date.now()}`, from: 'patient', author: 'patient', text, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await webChatApi.send(slug, token, text);
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      merge(res);
    } catch (err) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(text);
      handleError(err);
    } finally {
      setBusy(false);
    }
  };

  const booked = messages.some((m) => m.booked);
  const showPushOffer = booked && pushState === 'idle' && Boolean(info.pushPublicKey) && canUsePush();

  return (
    <>
      <div className="wc-messages" ref={scroller}>
        <div className="wc-msg wc-msg-clinic">
          Здравствуйте! Чем могу помочь? Могу подсказать цены, свободное время у врачей и записать вас.
        </div>
        {messages.map((m) =>
          m.from === 'system' ? (
            <div key={m.id} className="wc-system">
              {m.author === 'system' && /подключился/.test(m.text) ? 'Администратор подключился к чату' : m.text}
            </div>
          ) : (
            <div key={m.id} className={`wc-msg ${m.from === 'patient' ? 'wc-msg-patient' : 'wc-msg-clinic'}`}>
              {m.author === 'admin' && <div className="wc-msg-author">Администратор</div>}
              {m.text}
            </div>
          ),
        )}
        {busy && (
          <div className="wc-msg wc-msg-clinic typing-dots" style={{ padding: '10px 14px' }}>
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      {showPushOffer && (
        <div className="wc-push">
          <span>Прислать напоминание о записи в браузер?</span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={async () => {
              try {
                setPushState((await enablePush(slug, token, info.pushPublicKey!)) ? 'on' : 'denied');
              } catch {
                setPushState('denied');
              }
            }}
          >
            Включить
          </button>
        </div>
      )}
      {embedded && booked && pushState === 'idle' && info.pushPublicKey && !canUsePush() && (
        <div className="wc-push">
          <span>Напомним о записи по SMS.</span>
        </div>
      )}

      {error && <div className="wc-error">{error}</div>}

      <form className="wc-composer" onSubmit={send}>
        <input
          className="field-input"
          placeholder="Напишите сообщение…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={1000}
          aria-label="Сообщение"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()} aria-label="Отправить">
          →
        </button>
      </form>
    </>
  );
}
