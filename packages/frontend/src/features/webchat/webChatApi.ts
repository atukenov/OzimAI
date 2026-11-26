/**
 * Visitor-side API for the public web chat. Deliberately separate from
 * lib/api.ts: it must never send (or clear) the clinic panel's admin token.
 */
export interface ClinicInfo {
  clinicName: string;
  aiName: string;
  locale: 'ru' | 'kk';
  available: boolean;
  pushPublicKey: string | null;
}

export interface ChatMessage {
  id: string;
  from: 'patient' | 'clinic' | 'system';
  author: 'patient' | 'ai' | 'admin' | 'system';
  text: string;
  createdAt: string;
  booked?: boolean;
}

const tokenKey = (slug: string) => `ozimai_chat_${slug}`;

export function getChatToken(slug: string): string | null {
  try {
    return localStorage.getItem(tokenKey(slug));
  } catch {
    return null;
  }
}

export function setChatToken(slug: string, token: string | null) {
  try {
    if (token) localStorage.setItem(tokenKey(slug), token);
    else localStorage.removeItem(tokenKey(slug));
  } catch {
    /* storage blocked (private mode / 3rd-party iframe) — session lives in memory only */
  }
}

export class ChatApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(slug: string, path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/public/chat/${encodeURIComponent(slug)}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join('; ') : (body.message ?? message);
    } catch {
      /* no body */
    }
    throw new ChatApiError(res.status, message);
  }
  return res.json();
}

export const webChatApi = {
  info: (slug: string) => call<ClinicInfo>(slug, '', null),
  start: (slug: string, name: string, phone: string) =>
    call<{ token: string; name: string }>(slug, '/session', null, { method: 'POST', body: JSON.stringify({ name, phone }) }),
  messages: (slug: string, token: string, after?: string) =>
    call<ChatMessage[]>(slug, `/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`, token),
  send: (slug: string, token: string, text: string) =>
    call<ChatMessage[]>(slug, '/messages', token, { method: 'POST', body: JSON.stringify({ text }) }),
  subscribePush: (slug: string, token: string, subscription: PushSubscriptionJSON) =>
    call<{ ok: true }>(slug, '/push-subscription', token, { method: 'POST', body: JSON.stringify(subscription) }),
};

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** True when this browser/context can ask for push (not inside a cross-origin iframe, has SW + Push). */
export function canUsePush(): boolean {
  return typeof window !== 'undefined' && window.top === window.self && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function enablePush(slug: string, token: string, publicKey: string): Promise<boolean> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await webChatApi.subscribePush(slug, token, subscription.toJSON());
  return true;
}
