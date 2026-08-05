import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { StarRating } from '../components/StarRating';
import type { Rating, User } from '../api/types';

export function PublicProfileScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<User | null>(null);
  const [ratings, setRatings] = useState<Rating[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getUser(id)
      .then((p) => setProfile(p as User))
      .catch((e) => setError((e as Error).message));
    api
      .getUserRatings(id)
      .then((r) => setRatings(r as Rating[]))
      .catch(() => setRatings([]));
  }, [id]);

  if (error) {
    return <div className="screen">{error}</div>;
  }
  if (!profile) {
    return <div className="screen">Загрузка…</div>;
  }

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '56px 20px 0' }}>
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
      </div>

      <div style={{ padding: '16px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div
          style={{
            width: 76,
            height: 76,
            borderRadius: 999,
            background: 'var(--accent-2)',
            color: 'var(--tag-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            marginBottom: 12,
            boxShadow: '0 8px 20px rgba(46,43,37,0.18)',
          }}
        >
          {(profile.name ?? '?')[0]}
        </div>
        <h1 style={{ marginBottom: 0 }}>{profile.name ?? 'Без имени'}</h1>
        <p className="text-secondary" style={{ marginTop: 2 }}>
          {profile.city ?? 'Город не указан'} {profile.age ? `· ${profile.age} лет` : ''}
        </p>
      </div>

      <div
        className="card"
        style={{ display: 'flex', justifyContent: 'space-around', margin: '0 20px 20px', padding: '18px 0' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--money)' }}>
            {profile.rating_avg.toFixed(1)}
          </div>
          <div className="text-secondary">рейтинг</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{profile.meetings_count}</div>
          <div className="text-secondary">встреч</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent-2)' }}>
            {Math.round(profile.attendance_rate * 100)}%
          </div>
          <div className="text-secondary">явка</div>
        </div>
      </div>

      {profile.interests.length > 0 && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {profile.interests.map((i) => (
            <span key={i} className="tag">
              {i}
            </span>
          ))}
        </div>
      )}

      <div style={{ padding: '0 20px 40px' }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          Отзывы
        </div>
        {ratings === null && <p className="text-secondary">Загрузка…</p>}
        {ratings?.length === 0 && <p className="text-secondary">Пока нет отзывов</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ratings?.map((r) => (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{r.rater_name ?? 'Пользователь'}</span>
                <StarRating value={r.stars} size={16} />
              </div>
              {r.comment && <p style={{ fontSize: 14, lineHeight: 1.5 }}>{r.comment}</p>}
              <p className="text-secondary" style={{ marginTop: 6 }}>
                {new Date(r.created_at).toLocaleDateString('ru-RU')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
