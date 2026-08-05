import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { EventItem } from '../api/types';

function formatDeposit(kopecks: number) {
  return `${(kopecks / 100).toLocaleString('ru-RU')} ₽`;
}

export function EventDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const load = () => {
    if (!id) return;
    api
      .getEvent(id)
      .then((data) => setEvent(data as EventItem))
      .catch((e) => setError((e as Error).message));
  };

  useEffect(load, [id]);

  const handleJoin = async () => {
    if (!id) return;
    setJoining(true);
    setError(null);
    try {
      const participation = (await api.joinEvent(id)) as { id: string };
      await api.createDeposit(participation.id);
      navigate(`/events/${id}/chat`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoining(false);
    }
  };

  if (!event) {
    return <div className="screen">{error ? <p style={{ color: 'var(--error)' }}>{error}</p> : 'Загрузка…'}</div>;
  }

  const isPoster = user?.id === event.poster_id;
  const full = event.slots_taken >= event.slots_total;

  return (
    <div className="screen">
      {event.photo_url && (
        <img src={event.photo_url} alt="" style={{ width: '100%', borderRadius: 16, marginBottom: 'var(--space-4)' }} />
      )}
      <h1>{event.activity_type}</h1>
      <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
        {new Date(event.datetime).toLocaleString('ru-RU')} · {event.location_address ?? event.city}
      </p>
      <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <p>{event.description}</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-6)' }}>
        <span style={{ color: 'var(--money)', fontSize: 20, fontWeight: 700 }}>
          {formatDeposit(event.deposit_amount)}
        </span>
        <span className="text-secondary">
          {event.slots_taken}/{event.slots_total} мест · {event.age_min}–{event.age_max} лет
        </span>
      </div>

      {error && <p style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>{error}</p>}

      {isPoster ? (
        <button className="secondary" onClick={() => navigate(`/events/${id}/chat`)}>
          Открыть чат
        </button>
      ) : (
        <button onClick={handleJoin} disabled={joining || full}>
          {full ? 'Мест нет' : joining ? 'Присоединяемся…' : 'Присоединиться'}
        </button>
      )}
    </div>
  );
}
