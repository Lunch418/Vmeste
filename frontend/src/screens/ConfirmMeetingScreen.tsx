import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { getCurrentCoords } from '../geolocation';
import { parseUtcMs } from '../dates';
import type { EventItem, Participation } from '../api/types';

const GRACE_MINUTES = 15;

/**
 * AR-селфи: реальное распознавание двух лиц требует интеграции MediaPipe
 * Face Mesh (см. specs/CHANGES.md — отложено, нужна модель + тюнинг на
 * устройстве). Здесь — рабочий доступ к камере и ручной переключатель
 * "лица в кадре" для демонстрации потока подтверждения и расчёта депозита.
 *
 * Подтверждение теперь двустороннее: и организатор, и участник должны
 * отметиться геолокацией рядом с точкой встречи. Пока вторая сторона не
 * отметилась — статус "ждём", после грейс-периода доступна компенсация.
 */
export function ConfirmMeetingScreen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [myParticipation, setMyParticipation] = useState<Participation | null>(null);
  const [pendingParticipants, setPendingParticipants] = useState<Participation[]>([]);
  const [mode, setMode] = useState<'selfie' | 'qr'>('selfie');
  const [facesDetected, setFacesDetected] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmAnim, setConfirmAnim] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [noShowReason, setNoShowReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const videoRef = useRef<HTMLVideoElement>(null);

  const isPoster = !!event && user?.id === event.poster_id;

  const loadState = () => {
    if (!id) return;
    api
      .getEvent(id)
      .then((data) => {
        const ev = data as EventItem;
        setEvent(ev);
        if (user?.id === ev.poster_id) {
          if (ev.poster_arrived_at) {
            setWaiting(true);
            api
              .listParticipations(id)
              .then((list) => {
                const pending = (list as Participation[]).filter(
                  (p) => p.status === 'joined' && !p.joiner_arrived_at,
                );
                setPendingParticipants(pending);
              })
              .catch(() => {});
          }
        } else {
          api
            .getMyParticipation(id)
            .then((p) => {
              const participation = p as Participation;
              setMyParticipation(participation);
              if (participation.status === 'confirmed') {
                setConfirmed(true);
                setConfirmAnim(true);
              } else if (participation.status === 'no_show') {
                setNoShowReason(participation.no_show_reason);
              } else if (participation.joiner_arrived_at) {
                setWaiting(true);
              }
            })
            .catch(() => {});
        }
      })
      .catch((e) => setError((e as Error).message));
  };

  useEffect(loadState, [id, user?.id]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (mode !== 'selfie' || waiting) return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError('Камера недоступна — используйте QR-подтверждение'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [mode, waiting]);

  const finishConfirm = () => {
    setConfirmed(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setConfirmAnim(true)));
  };

  const handleStatus = (status: string) => {
    if (status === 'confirmed') {
      finishConfirm();
    } else if (status === 'waiting_for_organizer' || status === 'organizer_arrived') {
      setWaiting(true);
      loadState();
    }
  };

  const sendSelfieConfirm = async () => {
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      const coords = await getCurrentCoords();
      const res = await api.confirmSelfie(id, facesDetected, coords, 'cat');
      handleStatus(res.status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const generateQr = async () => {
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      const coords = await getCurrentCoords();
      const res = await api.generateQr(id, coords);
      setQrToken(res.qr_token);
      setWaiting(true);
      loadState();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const scanQr = async () => {
    if (!id) return;
    setError(null);
    setSubmitting(true);
    try {
      const coords = await getCurrentCoords();
      const res = await api.scanQr(id, scanInput.trim(), coords);
      handleStatus(res.status);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const claimMyCompensation = async () => {
    if (!id || !myParticipation) return;
    setError(null);
    try {
      await api.resolveNoShow(id, myParticipation.id);
      navigate(`/events/${id}/rate`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const resolveParticipant = async (participationId: string) => {
    if (!id) return;
    setError(null);
    try {
      await api.resolveNoShow(id, participationId);
      loadState();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const facesReady = facesDetected >= 2;

  const graceElapsedMs = (arrivedAtIso: string) => now - parseUtcMs(arrivedAtIso) - GRACE_MINUTES * 60_000;

  if (confirmed) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 999,
              background: 'var(--accent-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
              transform: confirmAnim ? 'scale(1)' : 'scale(0.3)',
              opacity: confirmAnim ? 1 : 0,
              transition: 'transform .5s cubic-bezier(.34,1.56,.64,1), opacity .3s ease',
            }}
          >
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="var(--tag-bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ marginBottom: 8 }}>Встреча подтверждена</h1>
          <p className="text-secondary" style={{ marginBottom: 28, maxWidth: 260 }}>
            Депозиты обработаны по правилам — можно оценить встречу
          </p>
          <button onClick={() => navigate(`/events/${id}/rate`)} style={{ minWidth: 220 }}>
            Оценить встречу
          </button>
        </div>
      </div>
    );
  }

  if (noShowReason) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <h1 style={{ marginBottom: 8 }}>Встреча не состоялась</h1>
          <p className="text-secondary" style={{ marginBottom: 28, maxWidth: 280 }}>
            {noShowReason === 'poster_absent'
              ? 'Организатор не подтвердил присутствие вовремя — ваш депозит возвращён, компенсация зачислена'
              : 'Вы не подтвердили присутствие вовремя — депозит ушёл организатору'}
          </p>
          <button onClick={() => navigate('/')} style={{ minWidth: 220 }}>
            К ленте
          </button>
        </div>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 999,
              border: '4px solid var(--money-bg)',
              borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
              marginBottom: 20,
            }}
          />
          {isPoster ? (
            <>
              <h1 style={{ marginBottom: 8 }}>Вы отметились</h1>
              <p className="text-secondary" style={{ marginBottom: 24, maxWidth: 280 }}>
                Ждём, пока участники отметятся рядом с точкой встречи
              </p>
              {pendingParticipants.length === 0 && (
                <p className="text-secondary">Все участники уже отметились ✓</p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                {pendingParticipants.map((p) => {
                  const graceMs = event?.poster_arrived_at ? graceElapsedMs(event.poster_arrived_at) : -1;
                  return (
                    <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="text-secondary">Участник ещё не отметился</span>
                      {graceMs >= 0 ? (
                        <button onClick={() => resolveParticipant(p.id)} style={{ minHeight: 36, padding: '0 14px', fontSize: 13 }}>
                          Отметить неявку
                        </button>
                      ) : (
                        <span className="text-secondary" style={{ fontSize: 12 }}>
                          через {Math.max(1, Math.ceil(-graceMs / 60000))} мин
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h1 style={{ marginBottom: 8 }}>Вы отметились</h1>
              <p className="text-secondary" style={{ marginBottom: 24, maxWidth: 280 }}>
                Ждём, пока организатор тоже отметится рядом с точкой встречи
              </p>
              {myParticipation?.joiner_arrived_at &&
                (() => {
                  const graceMs = graceElapsedMs(myParticipation.joiner_arrived_at);
                  if (graceMs >= 0) {
                    return (
                      <button onClick={claimMyCompensation} style={{ minWidth: 240 }}>
                        Получить компенсацию
                      </button>
                    );
                  }
                  return (
                    <p className="text-secondary">
                      Компенсация будет доступна через {Math.max(1, Math.ceil(-graceMs / 60000))} мин, если организатор не придёт
                    </p>
                  );
                })()}
            </>
          )}
          {error && <p style={{ color: 'var(--error)', marginTop: 16 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
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
        <h1 style={{ margin: 0, fontSize: 20 }}>Подтверждение встречи</h1>
      </div>

      <p className="text-secondary" style={{ marginBottom: 16 }}>
        Нужно быть в пределах 150 м от точки встречи. Обе стороны должны отметиться — иначе это будет считаться неявкой.
      </p>

      <div className="pill-tabs" style={{ marginBottom: 20 }}>
        <button className={mode === 'selfie' ? 'active' : ''} onClick={() => setMode('selfie')}>
          AR-селфи
        </button>
        <button className={mode === 'qr' ? 'active' : ''} onClick={() => setMode('qr')}>
          QR-код
        </button>
      </div>

      {mode === 'selfie' && (
        <>
          <div
            style={{
              position: 'relative',
              borderRadius: 28,
              overflow: 'hidden',
              border: '3px solid var(--accent)',
              aspectRatio: '3/4',
              background: 'linear-gradient(135deg, #2e2b25, #474238)',
              marginBottom: 16,
            }}
          >
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <span
              style={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(32,30,29,0.6)',
                color: '#fff8ee',
                padding: '5px 14px',
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              Фильтр: cat 🐱
            </span>
            {facesReady && (
              <span
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  width: 14,
                  height: 14,
                  borderRadius: 999,
                  background: 'var(--accent-2)',
                  boxShadow: '0 0 0 4px rgba(122,138,94,0.35)',
                }}
              />
            )}
          </div>
          <p className="text-secondary" style={{ marginBottom: 8 }}>
            Демо-переключатель (до подключения MediaPipe): лиц в кадре — {facesDetected}
          </p>
          <input
            type="range"
            min={0}
            max={2}
            value={facesDetected}
            onChange={(e) => setFacesDetected(Number(e.target.value))}
            style={{ width: '100%', marginBottom: 18, accentColor: 'var(--accent)' }}
          />
          <button onClick={sendSelfieConfirm} disabled={!facesReady || submitting} style={{ width: '100%' }}>
            {submitting ? 'Определяем местоположение…' : 'Отправить'}
          </button>
        </>
      )}

      {mode === 'qr' && (
        <>
          <p className="text-secondary" style={{ marginBottom: 16, lineHeight: 1.5 }}>
            Организатор генерирует код, второй участник вводит его для подтверждения встречи.
          </p>
          {isPoster ? (
            <button onClick={generateQr} disabled={submitting} style={{ width: '100%', marginBottom: 14 }}>
              {submitting ? 'Определяем местоположение…' : 'Сгенерировать код'}
            </button>
          ) : (
            <>
              <input
                type="text"
                placeholder="Код от организатора"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <button onClick={scanQr} disabled={!scanInput || submitting} style={{ width: '100%' }}>
                {submitting ? 'Определяем местоположение…' : 'Подтвердить кодом'}
              </button>
            </>
          )}
          {qrToken && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 12px' }}>
                <div
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 16,
                    background:
                      'repeating-conic-gradient(var(--text) 0% 25%, var(--bg) 0% 50%) 50% / 20px 20px',
                    border: '8px solid var(--bg)',
                  }}
                />
              </div>
              <p className="text-secondary" style={{ marginBottom: 16, wordBreak: 'break-all', textAlign: 'center' }}>
                {qrToken}
              </p>
            </>
          )}
        </>
      )}

      {error && <p style={{ color: 'var(--error)', marginTop: 'var(--space-3)' }}>{error}</p>}
    </div>
  );
}
