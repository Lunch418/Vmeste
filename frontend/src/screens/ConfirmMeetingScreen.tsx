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

  const sendSelfieConfirm = async () => {
    if (!id) return;
    setError(null);
    try {
      await api.confirmSelfie(id, facesDetected, 'cat');
      setConfirmed(true);
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
      setConfirmed(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (confirmed) {
    return (
      <div className="screen">
        <h1>Встреча подтверждена ✅</h1>
        <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
          Депозиты обработаны согласно правилам
        </p>
        <button onClick={() => navigate(`/events/${id}/rate`)}>Оценить встречу</button>
      </div>
    );
  }

  return (
    <div className="screen">
      <h1>Подтверждение встречи</h1>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
        <button className={mode === 'selfie' ? '' : 'secondary'} onClick={() => setMode('selfie')}>
          AR-селфи
        </button>
        <button className={mode === 'qr' ? '' : 'secondary'} onClick={() => setMode('qr')}>
          QR-код
        </button>
      </div>

      {mode === 'selfie' && (
        <>
          <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '3px solid var(--accent)', marginBottom: 'var(--space-3)' }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', background: '#000' }} />
            <span
              style={{
                position: 'absolute',
                bottom: 8,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 999,
                fontSize: 12,
              }}
            >
              Фильтр: cat 🐱
            </span>
          </div>
          <p className="text-secondary" style={{ marginBottom: 'var(--space-2)' }}>
            Демо-переключатель (до подключения MediaPipe): лиц в кадре — {facesDetected}
          </p>
          <input
            type="range"
            min={0}
            max={2}
            value={facesDetected}
            onChange={(e) => setFacesDetected(Number(e.target.value))}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <button onClick={sendSelfieConfirm} disabled={facesDetected < 2}>
            Отправить
          </button>
        </>
      )}

      {mode === 'qr' && (
        <>
          <p className="text-secondary" style={{ marginBottom: 'var(--space-3)' }}>
            Постер генерирует код, второй участник вводит его для подтверждения.
          </p>
          <button className="secondary" onClick={generateQr} style={{ marginBottom: 'var(--space-3)' }}>
            Сгенерировать код (я постер)
          </button>
          {qrToken && (
            <div className="card" style={{ marginBottom: 'var(--space-3)', wordBreak: 'break-all' }}>
              {qrToken}
            </div>
          )}
          <input
            type="text"
            placeholder="Код от постера"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <button onClick={scanQr} disabled={!scanInput}>
            Подтвердить кодом
          </button>
        </>
      )}

      {error && <p style={{ color: 'var(--error)', marginTop: 'var(--space-3)' }}>{error}</p>}
    </div>
  );
}
