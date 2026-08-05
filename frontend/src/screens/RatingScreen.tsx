import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { StarRating } from '../components/StarRating';
import type { EventItem } from '../api/types';

export function RatingScreen() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (id) api.getEvent(id).then((data) => setEvent(data as EventItem));
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
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (submitted) {
    return (
      <div className="screen">
        <h1>Спасибо за оценку!</h1>
        <button onClick={() => navigate('/')}>К ленте</button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Как прошла встреча?</h1>
      <div style={{ margin: 'var(--space-6) 0' }}>
        <StarRating value={stars} onChange={setStars} />
      </div>
      <textarea
        placeholder="Комментарий (необязательно)"
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ marginBottom: 'var(--space-4)' }}
      />
      {error && <p style={{ color: 'var(--error)', marginBottom: 'var(--space-3)' }}>{error}</p>}
      <button onClick={submit} disabled={stars === 0}>
        Отправить оценку
      </button>
    </div>
  );
}
