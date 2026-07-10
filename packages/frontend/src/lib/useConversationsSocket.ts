import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from './api';

let socket: Socket | null = null;

function getSocket(): Socket {
  if (!socket) {
    socket = io('/conversations/stream', { path: '/socket.io', auth: { token: getToken() } });
  }
  return socket;
}

/** Live push for the Dialogues feed — new messages and status changes, scoped server-side to the caller's org. */
export function useConversationsSocket(handlers: {
  onMessage?: (payload: { conversationId: string; message: unknown }) => void;
  onStatus?: (payload: { conversationId: string; status: string }) => void;
}) {
  useEffect(() => {
    const s = getSocket();
    if (handlers.onMessage) s.on('message', handlers.onMessage);
    if (handlers.onStatus) s.on('status', handlers.onStatus);
    return () => {
      if (handlers.onMessage) s.off('message', handlers.onMessage);
      if (handlers.onStatus) s.off('status', handlers.onStatus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function reconnectSocketWithToken() {
  socket?.disconnect();
  socket = null;
}
