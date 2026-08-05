import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getStoredTheme, setTheme, type Theme } from '../theme';

const CATEGORIES = ['Концерты', 'Кино', 'Спорт', 'Прогулки', 'Настолки'];

export function SettingsScreen() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(user?.age ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [saved, setSaved] = useState(false);
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const [theme, setThemeState] = useState<Theme>(getStoredTheme());

  const save = async () => {
    await api.updateMe({
      name,
      age: age ? Number(age) : undefined,
      gender: gender || undefined,
      city,
    });
    await refreshUser();
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const toggleCategory = async (cat: string) => {
    const nowSubscribed = !subscribed.includes(cat);
    setSubscribed((prev) => (nowSubscribed ? [...prev, cat] : prev.filter((c) => c !== cat)));
    if (nowSubscribed) {
      await api.subscribe(cat);
    }
  };

  const chooseTheme = (t: Theme) => {
    setTheme(t);
    setThemeState(t);
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
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
        <h1 style={{ margin: 0, fontSize: 20 }}>Настройки</h1>
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Профиль
      </div>
      <input
        type="text"
        placeholder="Имя"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 10 }}
      />
      <input
        type="number"
        placeholder="Возраст"
        value={age}
        onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
        style={{ marginBottom: 10 }}
      />
      <div className="pill-tabs" style={{ marginBottom: 10 }}>
        <button className={gender === '' ? 'active' : ''} onClick={() => setGender('')}>
          Не указан
        </button>
        <button className={gender === 'female' ? 'active' : ''} onClick={() => setGender('female')}>
          Женский
        </button>
        <button className={gender === 'male' ? 'active' : ''} onClick={() => setGender('male')}>
          Мужской
        </button>
      </div>
      <input
        type="text"
        placeholder="Город"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        style={{ marginBottom: 16 }}
      />
      <button onClick={save} style={{ width: '100%', marginBottom: 'var(--space-6)' }}>
        {saved ? 'Сохранено ✓' : 'Сохранить'}
      </button>

      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Тема
      </div>
      <div className="pill-tabs" style={{ marginBottom: 'var(--space-6)' }}>
        <button className={theme === 'light' ? 'active' : ''} onClick={() => chooseTheme('light')}>
          Светлая
        </button>
        <button className={theme === 'dark' ? 'active' : ''} onClick={() => chooseTheme('dark')}>
          Тёмная
        </button>
      </div>

      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Подписки на категории
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={subscribed.includes(cat) ? '' : 'secondary'}
            onClick={() => toggleCategory(cat)}
            style={{
              minHeight: 38,
              padding: '0 16px',
              fontSize: 13,
              background: subscribed.includes(cat) ? 'var(--accent-2)' : undefined,
              color: subscribed.includes(cat) ? 'var(--tag-bg)' : undefined,
            }}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
