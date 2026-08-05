import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StarRating } from '../components/StarRating';
import type { EventItem, User } from '../api/types';

export function RatingScreen() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [poster, setPoster] = useState<User | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submittedAnim, setSubmittedAnim] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      .catch(() => {});
  }, [id]);

  const submit = async () => {
    if (!id || !event || !user) return;
    const ratedId = user.id === event.poster_id ? undefined : event.poster_id;
    if (!ratedId) {
      setError('Постер оценивает участников на экране события — MVP: пока доступна только оценка постера');
      return;
    }
    try {
      await api.rate(id, ratedId, stars, comment || undefined);
      setSubmitted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setSubmittedAnim(true)));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (submitted) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: 'var(--money-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 18,
              transform: submittedAnim ? 'scale(1)' : 'scale(0.3)',
              opacity: submittedAnim ? 1 : 0,
              transition: 'transform .5s cubic-bezier(.34,1.56,.64,1), opacity .3s ease',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="var(--accent)">
              <path d="M12 2l3.1 6.7 7.4.9-5.5 5 1.6 7.3L12 18.3 5.4 21.9 7 14.6 1.5 9.6l7.4-.9z" />
            </svg>
          </div>
          <h1 style={{ marginBottom: 8 }}>Спасибо за оценку!</h1>
          <p className="text-secondary" style={{ marginBottom: 26 }}>
            До следующей встречи 👋
          </p>
          <button onClick={() => navigate('/')} style={{ minWidth: 200 }}>
            К ленте
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1 style={{ marginBottom: 6 }}>Как всё прошло?</h1>
      <p className="text-secondary" style={{ marginBottom: 28 }}>
        Оцени встречу с {poster?.name ?? 'организатором'}
      </p>
      <div style={{ marginBottom: 28 }}>
        <StarRating value={stars} onChange={setStars} />
      </div>
      <textarea
        placeholder="Комментарий (необязательно)"
        rows={4}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ marginBottom: 'var(--space-4)' }}
      />
      {error && <p style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>{error}</p>}
      <button onClick={submit} disabled={stars === 0} style={{ width: '100%' }}>
        Отправить оценку
      </button>
    </div>
  );
}
