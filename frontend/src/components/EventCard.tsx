import { Link } from 'react-router-dom';
import type { EventItem } from '../api/types';
import { activityHue, isUrgent } from '../activity';

function formatDeposit(kopecks: number) {
  return `${(kopecks / 100).toLocaleString('ru-RU')} ₽`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function EventCard({ event }: { event: EventItem }) {
  const full = event.slots_taken >= event.slots_total;
  const urgent = isUrgent(event.datetime, full);
  const hue = activityHue(event.activity_type);

  return (
    <Link to={`/events/${event.id}`} className="event-card">
      {event.photo_url ? (
        <img src={event.photo_url} alt="" className="event-card__photo" />
      ) : (
        <div
          className="event-card__photo-placeholder"
          style={{ background: `linear-gradient(135deg, ${hue}, #201e1d)` }}
        >
          <span className="event-card__photo-tag">PHOTO · {event.activity_type}</span>
          {urgent && <span className="event-card__badge">Скоро</span>}
        </div>
      )}
      <div className="event-card__body">
        <h2 style={{ margin: '0 0 6px' }}>{event.activity_type}</h2>
        <p className="text-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          {formatDateTime(event.datetime)} · {event.location_address ?? event.city}
        </p>
        <div className="event-card__footer">
          <span className="deposit-badge">{formatDeposit(event.deposit_amount)}</span>
          <span
            className="text-secondary"
            style={{ fontWeight: 600, color: full ? 'var(--error)' : undefined }}
          >
            {full ? 'Мест нет' : `${event.slots_total - event.slots_taken} мест свободно`}
          </span>
        </div>
      </div>
    </Link>
  );
}
