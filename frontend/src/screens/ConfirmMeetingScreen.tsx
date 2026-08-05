import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';

/**
 * AR-селфи: реальное распознавание двух лиц требует интеграции MediaPipe
 * Face Mesh (см. specs/CHANGES.md — отложено, нужна модель + тюнинг на
 * устройстве). Здесь — рабочий доступ к камере и ручной переключатель
 * "лица в кадре" для демонстрации потока подтверждения и расчёта депозита.
 */
export function ConfirmMeetingScreen() {
  const { id } = useParams<{ id: string }>();
  const [mode, setMode] = useState<'selfie' | 'qr'>('selfie');
  const [facesDetected, setFacesDetected] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmAnim, setConfirmAnim] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [scanInput, setScanInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (mode !== 'selfie') return;
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'user' } })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => setError('Камера недоступна — используйте QR-подтверждение'));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [mode]);

  const finishConfirm = () => {
    setConfirmed(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setConfirmAnim(true)));
  };

  const sendSelfieConfirm = async () => {
    if (!id) return;
    setError(null);
    try {
      await api.confirmSelfie(id, facesDetected, 'cat');
      finishConfirm();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const generateQr = async () => {
    if (!id) return;
    try {
      const res = await api.generateQr(id);
      setQrToken(res.qr_token);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const scanQr = async () => {
    if (!id) return;
    setError(null);
    try {
      await api.scanQr(id, scanInput.trim());
      finishConfirm();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const facesReady = facesDetected >= 2;

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
          <button onClick={sendSelfieConfirm} disabled={!facesReady} style={{ width: '100%' }}>
            Отправить
          </button>
        </>
      )}

      {mode === 'qr' && (
        <>
          <p className="text-secondary" style={{ marginBottom: 16, lineHeight: 1.5 }}>
            Организатор генерирует код, второй участник вводит его для подтверждения встречи.
          </p>
          <button className="secondary" onClick={generateQr} style={{ width: '100%', marginBottom: 14 }}>
            Сгенерировать код (я организатор)
          </button>
          {qrToken && (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
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
          <input
            type="text"
            placeholder="Код от организатора"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            style={{ marginBottom: 14 }}
          />
          <button onClick={scanQr} disabled={!scanInput} style={{ width: '100%' }}>
            Подтвердить кодом
          </button>
        </>
      )}

      {error && <p style={{ color: 'var(--error)', marginTop: 'var(--space-3)' }}>{error}</p>}
    </div>
  );
}
