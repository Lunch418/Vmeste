import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { WizardStepper } from '../components/WizardStepper';
import type { EventDraft, GenderFilter } from '../api/types';

const TOTAL_STEPS = 5;

const initialDraft: EventDraft = {
  activity_type: '',
  datetime: '',
  age_min: 18,
  age_max: 99,
  gender_filter: 'any',
  slots_total: 1,
  description: '',
  deposit_amount: 0,
};

export function CreateEventWizard() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<EventDraft>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const update = (patch: Partial<EventDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const event = (await api.createEvent({
        ...draft,
        datetime: new Date(draft.datetime).toISOString(),
      })) as { id: string };
      navigate(`/events/${event.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <WizardStepper current={step} total={TOTAL_STEPS} />

      {step === 1 && (
        <>
          <h2>Фото или афиша</h2>
          <input
            type="url"
            placeholder="Ссылка на фото (необязательно)"
            value={draft.photo_url ?? ''}
            onChange={(e) => update({ photo_url: e.target.value })}
          />
        </>
      )}

      {step === 2 && (
        <>
          <h2>Тип активности</h2>
          <input
            type="text"
            placeholder="Концерт, поход в кино, прогулка…"
            value={draft.activity_type}
            onChange={(e) => update({ activity_type: e.target.value })}
          />
        </>
      )}

      {step === 3 && (
        <>
          <h2>Дата, время, место</h2>
          <input
            type="datetime-local"
            value={draft.datetime}
            onChange={(e) => update({ datetime: e.target.value })}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <input
            type="text"
            placeholder="Адрес встречи"
            value={draft.location_address ?? ''}
            onChange={(e) => update({ location_address: e.target.value })}
          />
        </>
      )}

      {step === 4 && (
        <>
          <h2>Места, возраст, пол</h2>
          <label className="text-secondary">Количество мест</label>
          <input
            type="number"
            min={1}
            value={draft.slots_total}
            onChange={(e) => update({ slots_total: Number(e.target.value) })}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <input
              type="number"
              placeholder="Возраст от"
              value={draft.age_min}
              onChange={(e) => update({ age_min: Number(e.target.value) })}
            />
            <input
              type="number"
              placeholder="Возраст до"
              value={draft.age_max}
              onChange={(e) => update({ age_max: Number(e.target.value) })}
            />
          </div>
          <select
            value={draft.gender_filter}
            onChange={(e) => update({ gender_filter: e.target.value as GenderFilter })}
          >
            <option value="any">Любой пол</option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </>
      )}

      {step === 5 && (
        <>
          <h2>Описание и депозит</h2>
          <textarea
            placeholder="Расскажи о планах"
            rows={4}
            value={draft.description}
            onChange={(e) => update({ description: e.target.value })}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <label className="text-secondary">Депозит, ₽</label>
          <input
            type="number"
            min={0}
            value={draft.deposit_amount / 100}
            onChange={(e) => update({ deposit_amount: Number(e.target.value) * 100 })}
          />
        </>
      )}

      {error && <p style={{ color: 'var(--error)', marginTop: 'var(--space-3)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
        {step > 1 && (
          <button className="secondary" onClick={back}>
            Назад
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button onClick={next}>Далее</button>
        ) : (
          <button onClick={submit} disabled={submitting}>
            {submitting ? 'Публикуем…' : 'Опубликовать'}
          </button>
        )}
      </div>
    </div>
  );
}
