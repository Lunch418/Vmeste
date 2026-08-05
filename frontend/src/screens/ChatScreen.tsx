import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, chatSocketUrl } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage } from '../api/types';

export function ChatScreen() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;

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
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Чат</h1>
        <button className="secondary" onClick={() => navigate(`/events/${id}/confirm`)}>
          Подтвердить встречу
        </button>
      </div>
      {!connected && <p className="text-secondary">Переподключение…</p>}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 'var(--space-3) 0' }}>
        {messages.length === 0 && (
          <p className="text-secondary">Договоритесь о деталях встречи здесь</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className="card"
            style={{
              alignSelf: m.sender_id === user?.id ? 'flex-end' : 'flex-start',
              background: m.sender_id === user?.id ? 'var(--accent)' : 'var(--surface)',
              color: m.sender_id === user?.id ? '#15121a' : 'var(--text)',
              maxWidth: '80%',
            }}
          >
            {m.text}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <input
          type="text"
          placeholder="Сообщение…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={send}>➤</button>
      </div>
    </div>
  );
}
