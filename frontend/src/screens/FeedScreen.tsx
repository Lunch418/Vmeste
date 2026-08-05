import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EventCard } from '../components/EventCard';
import type { EventItem } from '../api/types';

export function FeedScreen() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listEvents()
      .then((data) => setEvents(data as EventItem[]))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="screen">
      <h1>Лента</h1>
      {error && <p style={{ color: 'var(--error)' }}>{error}</p>}
      {events === null && !error && <p className="text-secondary">Загрузка…</p>}
      {events?.length === 0 && (
        <p className="text-secondary">Пока нет событий рядом — стань первым, создай своё!</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {events?.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    </div>
  );
}
