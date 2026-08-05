import { Link } from 'react-router-dom';
import type { EventItem } from '../api/types';

function formatDeposit(kopecks: number) {
  return `${(kopecks / 100).toLocaleString('ru-RU')} ₽`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function EventCard({ event }: { event: EventItem }) {
  const full = event.slots_taken >= event.slots_total;

  return (
    <Link to={`/events/${event.id}`} className="event-card card">
      {event.photo_url && (
        <img src={event.photo_url} alt="" className="event-card__photo" />
      )}
      <div className="event-card__body">
        <h2>{event.activity_type}</h2>
        <p className="text-secondary">
          {formatDateTime(event.datetime)} · {event.location_address ?? event.city}
        </p>
        <div className="event-card__footer">
          <span style={{ color: 'var(--money)' }}>{formatDeposit(event.deposit_amount)}</span>
          <span className="text-secondary">
            {full ? 'Мест нет' : `${event.slots_total - event.slots_taken} мест свободно`}
          </span>
        </div>
      </div>
    </Link>
  );
}
