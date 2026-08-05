import { useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['Концерты', 'Кино', 'Спорт', 'Прогулки', 'Настолки'];

export function SettingsScreen() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [age, setAge] = useState(user?.age ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [saved, setSaved] = useState(false);
  const [subscribed, setSubscribed] = useState<string[]>([]);

  const save = async () => {
    await api.updateMe({ name, age: age ? Number(age) : undefined, city });
    await refreshUser();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleCategory = async (cat: string) => {
    const nowSubscribed = !subscribed.includes(cat);
    setSubscribed((prev) => (nowSubscribed ? [...prev, cat] : prev.filter((c) => c !== cat)));
    if (nowSubscribed) {
      await api.subscribe(cat);
    }
  };

  return (
    <div className="screen">
      <h1>Настройки</h1>

      <h2 style={{ marginTop: 'var(--space-4)' }}>Профиль</h2>
      <input
        type="text"
        placeholder="Имя"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ marginBottom: 'var(--space-3)' }}
      />
      <input
        type="number"
        placeholder="Возраст"
        value={age}
        onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
        style={{ marginBottom: 'var(--space-3)' }}
      />
      <input
        type="text"
        placeholder="Город"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        style={{ marginBottom: 'var(--space-3)' }}
      />
      <button onClick={save} style={{ marginBottom: 'var(--space-6)' }}>
        {saved ? 'Сохранено ✓' : 'Сохранить'}
      </button>

      <h2>Подписки на категории</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={subscribed.includes(cat) ? '' : 'secondary'}
            onClick={() => toggleCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}
