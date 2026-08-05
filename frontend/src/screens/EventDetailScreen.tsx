import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { activityHue } from '../activity';
import { DepositSheet, type SheetPhase } from '../components/DepositSheet';
import type { EventItem, User } from '../api/types';

function formatDeposit(kopecks: number) {
  return `${(kopecks / 100).toLocaleString('ru-RU')} ₽`;
}

export function EventDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [poster, setPoster] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetPhase, setSheetPhase] = useState<SheetPhase>('none');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    api
      .getEvent(id)
      .then((data) => {
        const ev = data as EventItem;
        setEvent(ev);
        return api.getUser(ev.poster_id);
      })
      .then((p) => setPoster(p as User))
      .catch((e) => setError((e as Error).message));
  }, [id]);

  const startJoin = () => setSheetPhase('idle');
  const closeSheet = () => setSheetPhase('none');

  const payDeposit = async () => {
    if (!id) return;
    setSheetPhase('processing');
    setError(null);
    try {
      const participation = (await api.joinEvent(id)) as { id: string };
      await api.createDeposit(participation.id);
      setSheetPhase('success');
      setTimeout(() => navigate(`/events/${id}/chat`), 900);
    } catch (e) {
      setError((e as Error).message);
      setSheetPhase('none');
    }
  };

  if (!event) {
    return <div className="screen">{error ? <p style={{ color: 'var(--error)' }}>{error}</p> : 'Загрузка…'}</div>;
  }

  const isPoster = user?.id === event.poster_id;
  const full = event.slots_taken >= event.slots_total;
  const hue = activityHue(event.activity_type);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 120 }}>
        <div style={{ position: 'relative' }}>
          {event.photo_url ? (
            <img src={event.photo_url} alt="" style={{ width: '100%', height: 280, objectFit: 'cover', display: 'block' }} />
          ) : (
            <div
              style={{
                height: 280,
                display: 'flex',
                alignItems: 'flex-end',
                padding: 16,
                background: `linear-gradient(135deg, ${hue}, #201e1d)`,
              }}
            >
              <span className="event-card__photo-tag">PHOTO · {event.activity_type}</span>
            </div>
          )}
          <button
            className="secondary"
            onClick={() => navigate(-1)}
            style={{
              position: 'absolute',
              top: 56,
              left: 16,
              width: 40,
              height: 40,
              minHeight: 0,
              padding: 0,
              borderRadius: 999,
              background: 'rgba(245,234,216,0.92)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(46,43,37,0.2)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 19l-7-7 7-7" stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {event.activity_type}
          </div>
          <h1 style={{ marginBottom: 10 }}>{event.activity_type}</h1>
          <p className="text-secondary" style={{ marginBottom: 16 }}>
            {new Date(event.datetime).toLocaleString('ru-RU')} · {event.location_address ?? event.city}
          </p>

          {poster && (
            <div
              onClick={() => navigate(`/users/${poster.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: 'var(--surface)',
                borderRadius: 18,
                marginBottom: 16,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  background: 'var(--accent-2)',
                  color: 'var(--tag-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontSize: 15,
                }}
              >
                {(poster.name ?? '?')[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{poster.name ?? 'Без имени'}</div>
                <div className="text-secondary">организатор события · открыть профиль</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, color: 'var(--money)', fontWeight: 700, fontSize: 14 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--accent)">
                  <path d="M12 2l3.1 6.7 7.4.9-5.5 5 1.6 7.3L12 18.3 5.4 21.9 7 14.6 1.5 9.6l7.4-.9z" />
                </svg>
                {poster.rating_avg.toFixed(1)}
              </div>
            </div>
          )}

          {isPoster && (
            <div className="text-secondary" style={{ marginBottom: 16, fontSize: 13 }}>
              Ваш депозит-гарантия:{' '}
              {event.poster_deposit_id ? (
                <span style={{ color: 'var(--accent-2)', fontWeight: 700 }}>внесён</span>
              ) : (
                <span style={{ color: 'var(--error)', fontWeight: 700 }}>не внесён</span>
              )}
            </div>
          )}

          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ lineHeight: 1.6 }}>{event.description}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }} className="text-secondary">
            <span>
              {event.slots_taken}/{event.slots_total} мест
            </span>
            <span>
              {event.age_min}–{event.age_max} лет
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '16px 20px 34px',
          background: 'linear-gradient(180deg, rgba(245,234,216,0), var(--bg) 30%)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Депозит</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--money)' }}>
            {formatDeposit(event.deposit_amount)}
          </div>
        </div>
        {isPoster ? (
          <button className="secondary" style={{ flex: 1 }} onClick={() => navigate(`/events/${id}/chat`)}>
            Открыть чат
          </button>
        ) : (
          <button style={{ flex: 1 }} onClick={startJoin} disabled={full}>
            {full ? 'Мест нет' : 'Присоединиться'}
          </button>
        )}
      </div>

      <DepositSheet
        phase={sheetPhase}
        amount={event.deposit_amount}
        description={`Спишем ${formatDeposit(event.deposit_amount)} — вернём сразу после подтверждённой встречи. Если не придёшь без причины, депозит уйдёт организатору.`}
        successSubtitle="Открываем чат с организатором…"
        onPay={payDeposit}
        onClose={closeSheet}
      />

      {error && (
        <p style={{ color: 'var(--error)', position: 'absolute', bottom: 90, left: 20, right: 20, textAlign: 'center' }}>
          {error}
        </p>
      )}
    </div>
  );
}
