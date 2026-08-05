import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function AuthFlow() {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const requestCode = async () => {
    setError(null);
    setLoading(true);
    try {
      await api.requestPhoneCode(phone);
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await api.verifyPhoneCode(phone, code);
      await login(access_token);
      navigate('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const backToPhone = () => {
    setStep('phone');
    setCode('');
    setError(null);
  };

  return (
    <div
      className="screen"
      style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100%' }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'var(--surface-raised)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          boxShadow: '0 12px 32px rgba(46,43,37,0.22)',
        }}
      >
        <svg width="38" height="38" viewBox="0 0 38 38">
          <circle cx="16" cy="19" r="11" fill="var(--accent)" />
          <circle cx="24" cy="19" r="11" fill="var(--accent-2)" fillOpacity="0.82" />
        </svg>
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 38, lineHeight: 1.05, marginBottom: 4 }}>
        Togethr
      </div>
      <div
        style={{
          fontSize: 12,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--money)',
          fontWeight: 700,
          marginBottom: 14,
        }}
      >
        Вместе
      </div>
      <p className="text-secondary" style={{ marginBottom: 36, maxWidth: 260, fontSize: 15 }}>
        Находи компанию на конкретное событие — сегодня же, в Перми
      </p>

      {step === 'phone' ? (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>
            Номер телефона
          </div>
          <input
            type="tel"
            placeholder="+7 900 000-00-00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <button onClick={requestCode} disabled={loading || !phone} style={{ width: '100%', fontFamily: 'var(--font-display)', fontWeight: 400 }}>
            {loading ? 'Отправляем…' : 'Получить код'}
          </button>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 14, fontSize: 14, color: 'var(--text-secondary)' }}>
            Код отправлен на <b style={{ color: 'var(--text)' }}>{phone}</b>
          </p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0 0 0 0"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ marginBottom: 'var(--space-3)', textAlign: 'center', letterSpacing: 6, fontSize: 22 }}
          />
          <button
            onClick={verify}
            disabled={loading || code.length < 4}
            style={{ width: '100%', marginBottom: 10, fontFamily: 'var(--font-display)', fontWeight: 400 }}
          >
            {loading ? 'Проверяем…' : 'Подтвердить'}
          </button>
          <button className="ghost" onClick={backToPhone} style={{ width: '100%', minHeight: 'auto' }}>
            Изменить номер
          </button>
        </>
      )}

      {error && <p style={{ color: 'var(--error)', marginTop: 'var(--space-3)' }}>{error}</p>}
    </div>
  );
}
