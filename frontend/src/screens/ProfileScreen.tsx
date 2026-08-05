import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  if (!user) return <div className="screen">Загрузка…</div>;

  return (
    <div className="screen">
      <h1>{user.name ?? 'Без имени'}</h1>
      <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
        {user.city ?? 'Город не указан'} {user.age ? `· ${user.age} лет` : ''}
      </p>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 'var(--space-4)' }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--money)' }}>
            {user.rating_avg.toFixed(1)}★
          </div>
          <div className="text-secondary">Рейтинг</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{user.meetings_count}</div>
          <div className="text-secondary">Встреч</div>
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--success)' }}>
            {Math.round(user.attendance_rate * 100)}%
          </div>
          <div className="text-secondary">Явка</div>
        </div>
      </div>

      {user.interests.length > 0 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          {user.interests.map((i) => (
            <span
              key={i}
              className="card"
              style={{ display: 'inline-block', padding: '4px 12px', marginRight: 8, marginBottom: 8 }}
            >
              {i}
            </span>
          ))}
        </div>
      )}

      <Link to="/settings">
        <button className="secondary" style={{ marginBottom: 'var(--space-3)', width: '100%' }}>
          Настройки
        </button>
      </Link>
      <button className="secondary" style={{ width: '100%' }} onClick={logout}>
        Выйти
      </button>
    </div>
  );
}
