import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  if (!user) return <div className="screen">Загрузка…</div>;

  return (
    <div className="screen" style={{ padding: 0 }}>
      <div style={{ padding: '20px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
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
          {(user.name ?? '?')[0]}
        </div>
        <h1 style={{ marginBottom: 0 }}>{user.name ?? 'Без имени'}</h1>
        <p className="text-secondary" style={{ marginTop: 2 }}>
          {user.city ?? 'Город не указан'} {user.age ? `· ${user.age} лет` : ''}
        </p>
      </div>

      <div
        className="card"
        style={{ display: 'flex', justifyContent: 'space-around', margin: '0 20px 20px', padding: '18px 0' }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--money)' }}>
            {user.rating_avg.toFixed(1)}
          </div>
          <div className="text-secondary">рейтинг</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{user.meetings_count}</div>
          <div className="text-secondary">встреч</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--accent-2)' }}>
            {Math.round(user.attendance_rate * 100)}%
          </div>
          <div className="text-secondary">явка</div>
        </div>
      </div>

      {user.interests.length > 0 && (
        <div style={{ padding: '0 20px 16px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {user.interests.map((i) => (
            <span key={i} className="tag">
              {i}
            </span>
          ))}
        </div>
      )}

      <div style={{ padding: '8px 20px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link to="/settings" style={{ textDecoration: 'none' }}>
          <button className="secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
            Настройки
          </button>
        </Link>
        <button className="ghost" style={{ width: '100%' }} onClick={logout}>
          Выйти
        </button>
      </div>
    </div>
  );
}
