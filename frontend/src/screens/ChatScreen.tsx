import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, chatSocketUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage, EventItem } from '../api/types';

export function ChatScreen() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;

    api
      .getEvent(id)
      .then((data) => setEvent(data as EventItem))
      .catch(() => {});

    api
      .getMessages(id)
      .then((data) => setMessages(data as ChatMessage[]))
      .catch(() => {
        // событие может быть недоступно — история просто останется пустой
      });

    const ws = new WebSocket(chatSocketUrl(id));
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ChatMessage;
      setMessages((prev) => [...prev, msg]);
    };

    return () => ws.close();
  }, [id]);

  const send = () => {
    if (!text.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text }));
    setText('');
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          flex: 'none',
          padding: '56px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          className="secondary"
          onClick={() => navigate(-1)}
          style={{
            width: 36,
            height: 36,
            minHeight: 0,
            padding: 0,
            borderRadius: 999,
            background: 'var(--surface)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div
          style={{ flex: 1, cursor: event && user?.id !== event.poster_id ? 'pointer' : 'default' }}
          onClick={() => event && user?.id !== event.poster_id && navigate(`/users/${event.poster_id}`)}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16 }}>{event?.activity_type ?? 'Чат'}</div>
          <div className="text-secondary" style={{ fontSize: 11 }}>
            {event ? new Date(event.datetime).toLocaleString('ru-RU') : ''}
          </div>
        </div>
        <button
          onClick={() => navigate(`/events/${id}/confirm`)}
          style={{
            minHeight: 36,
            padding: '0 14px',
            background: 'var(--accent-2)',
            color: 'var(--tag-bg)',
            fontSize: 12,
            fontWeight: 700,
            boxShadow: 'none',
          }}
        >
          Подтвердить встречу
        </button>
      </div>

      {!connected && (
        <p className="text-secondary" style={{ textAlign: 'center', padding: '4px 0' }}>
          Переподключение…
        </p>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && <p className="text-secondary">Договоритесь о деталях встречи здесь</p>}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div
              key={m.id}
              onClick={() => !mine && navigate(`/users/${m.sender_id}`)}
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
                padding: '11px 16px',
                borderRadius: 20,
                fontSize: 14,
                lineHeight: 1.4,
                background: mine ? 'var(--accent)' : 'var(--surface)',
                color: mine ? 'var(--on-accent)' : 'var(--text)',
                cursor: mine ? 'default' : 'pointer',
              }}
            >
              {m.text}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 'none', display: 'flex', gap: 8, padding: '10px 16px 34px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Сообщение…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          style={{ flex: 1 }}
        />
        <button
          onClick={send}
          style={{
            width: 44,
            height: 44,
            minHeight: 0,
            flex: 'none',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M3 20l18-8L3 4l0 7 12 1-12 1z" fill="var(--on-accent)" />
          </svg>
        </button>
      </div>
    </div>
  );
}
