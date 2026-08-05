import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { WizardStepper } from '../components/WizardStepper';
import { ACTIVITY_TYPES } from '../activity';
import { DepositSheet, type SheetPhase } from '../components/DepositSheet';
import type { EventDraft, GenderFilter } from '../api/types';

const TOTAL_STEPS = 5;
const SWIPE_THRESHOLD = 70;

const initialDraft: EventDraft = {
  activity_type: '',
  datetime: '',
  age_min: 18,
  age_max: 99,
  gender_filter: 'any',
  slots_total: 4,
  description: '',
  deposit_amount: 20000,
};

function StepperControl({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', borderRadius: 16, padding: '8px 12px' }}>
      <button
        onClick={onDec}
        className="secondary"
        style={{ width: 28, height: 28, minHeight: 0, padding: 0, borderRadius: 999, background: 'var(--surface-raised)', border: 'none', fontSize: 16, boxShadow: 'none' }}
      >
        –
      </button>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>{value}</div>
        <div style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{label}</div>
      </div>
      <button
        onClick={onInc}
        className="secondary"
        style={{ width: 28, height: 28, minHeight: 0, padding: 0, borderRadius: 999, background: 'var(--surface-raised)', border: 'none', fontSize: 16, boxShadow: 'none' }}
      >
        +
      </button>
    </div>
  );
}

export function CreateEventWizard() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<EventDraft>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const dragStartX = useRef(0);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [depositPhase, setDepositPhase] = useState<SheetPhase>('none');
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
      setCreatedEventId(event.id);
      setDepositPhase('idle');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const payPosterDeposit = async () => {
    if (!createdEventId) return;
    setDepositPhase('processing');
    setError(null);
    try {
      await api.createPosterDeposit(createdEventId);
      setDepositPhase('success');
      setTimeout(() => navigate(`/events/${createdEventId}`), 900);
    } catch (e) {
      setError((e as Error).message);
      setDepositPhase('idle');
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    setDragging(true);
    dragStartX.current = e.clientX;
    setDragX(0);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    setDragX(e.clientX - dragStartX.current);
  };
  const onPointerUp = () => {
    if (dragX < -SWIPE_THRESHOLD && step < TOTAL_STEPS) setStep((s) => s + 1);
    else if (dragX > SWIPE_THRESHOLD && step > 1) setStep((s) => s - 1);
    setDragging(false);
    setDragX(0);
  };

  const trackStyle: CSSProperties = {
    display: 'flex',
    height: '100%',
    transform: `translateX(calc(${-(step - 1) * 100}% + ${dragging ? dragX : 0}px))`,
    transition: dragging ? 'none' : 'transform .34s cubic-bezier(.22,1,.36,1)',
  };

  const canSubmit = step === TOTAL_STEPS;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ flex: 'none', padding: '56px 20px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <button
            onClick={() => navigate('/')}
            className="secondary"
            style={{
              width: 32,
              height: 32,
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="var(--text)" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
          <h2 style={{ margin: 0, fontSize: 18 }}>Новое событие</h2>
        </div>
        <WizardStepper current={step} total={TOTAL_STEPS} />
      </div>

      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div style={trackStyle}>
          <div style={{ width: '100%', flex: 'none', padding: '12px 20px' }}>
            <h2>Фото или афиша</h2>
            <p className="text-secondary" style={{ marginBottom: 18 }}>
              Необязательно — можно опубликовать и без фото
            </p>
            <div
              style={{
                borderRadius: 24,
                aspectRatio: '4/3',
                background: 'var(--surface)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: 20,
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="14" rx="2" stroke="var(--text-secondary)" strokeWidth="1.6" />
                <circle cx="8.5" cy="10" r="1.5" stroke="var(--text-secondary)" strokeWidth="1.6" />
                <path d="M21 15l-5-5-9 9" stroke="var(--text-secondary)" strokeWidth="1.6" />
              </svg>
              <input
                type="url"
                placeholder="Ссылка на фото"
                value={draft.photo_url ?? ''}
                onChange={(e) => update({ photo_url: e.target.value })}
                style={{ background: 'var(--surface-raised)' }}
              />
            </div>
          </div>

          <div style={{ width: '100%', flex: 'none', padding: '12px 20px' }}>
            <h2>Тип активности</h2>
            <p className="text-secondary" style={{ marginBottom: 18 }}>
              Выбери, чем займётесь
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {ACTIVITY_TYPES.map((a) => (
                <button
                  key={a}
                  onClick={() => update({ activity_type: a })}
                  className={draft.activity_type === a ? '' : 'secondary'}
                  style={{ minHeight: 42, padding: '0 18px', fontSize: 14 }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', flex: 'none', padding: '12px 20px' }}>
            <h2>Дата, время, место</h2>
            <p className="text-secondary" style={{ marginBottom: 18 }}>
              Когда и где встречаемся
            </p>
            <input
              type="datetime-local"
              value={draft.datetime}
              onChange={(e) => update({ datetime: e.target.value })}
              style={{ marginBottom: 12, borderRadius: 16 }}
            />
            <input
              type="text"
              placeholder="Адрес встречи"
              value={draft.location_address ?? ''}
              onChange={(e) => update({ location_address: e.target.value })}
            />
          </div>

          <div style={{ width: '100%', flex: 'none', padding: '12px 20px' }}>
            <h2>Места, возраст, пол</h2>
            <p className="text-secondary" style={{ marginBottom: 18 }}>
              Кому подойдёт эта компания
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                borderRadius: 16,
                padding: '10px 16px',
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>Мест всего</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button
                  onClick={() => update({ slots_total: Math.max(1, draft.slots_total - 1) })}
                  className="secondary"
                  style={{ width: 32, height: 32, minHeight: 0, padding: 0, borderRadius: 999, background: 'var(--surface-raised)', border: 'none', fontSize: 18, boxShadow: 'none' }}
                >
                  –
                </button>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, minWidth: 16, textAlign: 'center' }}>
                  {draft.slots_total}
                </span>
                <button
                  onClick={() => update({ slots_total: draft.slots_total + 1 })}
                  className="secondary"
                  style={{ width: 32, height: 32, minHeight: 0, padding: 0, borderRadius: 999, background: 'var(--surface-raised)', border: 'none', fontSize: 18, boxShadow: 'none' }}
                >
                  +
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <StepperControl
                label="от"
                value={draft.age_min}
                onDec={() => update({ age_min: Math.max(14, draft.age_min - 1) })}
                onInc={() => update({ age_min: Math.min(draft.age_max, draft.age_min + 1) })}
              />
              <StepperControl
                label="до"
                value={draft.age_max}
                onDec={() => update({ age_max: Math.max(draft.age_min, draft.age_max - 1) })}
                onInc={() => update({ age_max: Math.min(99, draft.age_max + 1) })}
              />
            </div>
            <div className="pill-tabs">
              {(['any', 'female', 'male'] as GenderFilter[]).map((g) => (
                <button key={g} className={draft.gender_filter === g ? 'active' : ''} onClick={() => update({ gender_filter: g })}>
                  {g === 'any' ? 'Любой' : g === 'female' ? 'Женский' : 'Мужской'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ width: '100%', flex: 'none', padding: '12px 20px' }}>
            <h2>Описание и депозит</h2>
            <p className="text-secondary" style={{ marginBottom: 18 }}>
              Расскажи о планах, назначь депозит-гарантию
            </p>
            <textarea
              placeholder="Например: идём смотреть закат на набережной, потом кофе рядом"
              rows={4}
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Депозит</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--money)' }}>
                {(draft.deposit_amount / 100).toLocaleString('ru-RU')} ₽
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              step={50}
              value={draft.deposit_amount / 100}
              onChange={(e) => update({ deposit_amount: Number(e.target.value) * 100 })}
              style={{ width: '100%', accentColor: 'var(--accent)' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <p style={{ color: 'var(--error)', padding: '0 20px', marginBottom: 8 }}>{error}</p>
      )}

      <div style={{ flex: 'none', display: 'flex', gap: 10, padding: '14px 20px 34px' }}>
        {step > 1 && (
          <button className="secondary" onClick={back} style={{ flex: 1 }}>
            Назад
          </button>
        )}
        <button
          onClick={canSubmit ? submit : next}
          disabled={submitting}
          style={{ flex: 2 }}
        >
          {submitting ? 'Публикуем…' : canSubmit ? 'Опубликовать' : 'Далее'}
        </button>
      </div>

      <DepositSheet
        phase={depositPhase}
        amount={draft.deposit_amount}
        title="Ваш депозит-гарантия"
        description="Как организатор, ты тоже вносишь депозит — если не придёшь на встречу, он достанется пришедшему участнику как компенсация."
        successSubtitle="Событие опубликовано"
        onPay={payPosterDeposit}
        onClose={() => createdEventId && navigate(`/events/${createdEventId}`)}
      />
    </div>
  );
}
