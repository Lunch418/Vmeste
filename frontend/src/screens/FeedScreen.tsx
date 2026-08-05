import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { EventCard } from '../components/EventCard';
import { FEED_FILTERS } from '../activity';
import type { EventItem } from '../api/types';

export function FeedScreen() {
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    api
      .listEvents()
      .then((data) => setEvents(data as EventItem[]))
      .catch((e) => setError((e as Error).message));
  }, []);

  const filtered = filter ? (events ?? []).filter((e) => e.activity_type === filter) : events ?? [];
  const todayCount = filtered.filter((e) => {
    const d = new Date(e.datetime);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ padding: '16px 20px 4px' }}>
        <h1>Лента</h1>
        <p className="text-secondary">{todayCount} события сегодня в Перми</p>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '8px 20px 14px', overflowX: 'auto' }}>
        {FEED_FILTERS.map((f) => {
          const active = filter === f.activityType;
          return (
            <button
              key={f.label}
              onClick={() => setFilter(f.activityType)}
              className={active ? '' : 'secondary'}
              style={{ flexShrink: 0, minHeight: 34, padding: '0 16px', fontSize: 13 }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '0 20px 100px' }}>
        {error && <p style={{ color: 'var(--error)' }}>{error}</p>}

        {events === null && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="skeleton" style={{ height: 140, borderRadius: 0 }} />
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ width: '60%', height: 16 }} />
                  <div className="skeleton" style={{ width: '40%', height: 12 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {events !== null && filtered.length === 0 && (
          <p className="text-secondary" style={{ textAlign: 'center', padding: '60px 20px' }}>
            Событий не найдено — попробуй другой фильтр
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      </div>
    </div>
  );
}
