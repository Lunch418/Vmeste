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

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100%' }}>
      <h1>Вместе</h1>
      <p className="text-secondary" style={{ marginBottom: 'var(--space-6)' }}>
        Находи компанию на конкретное событие
      </p>

      {step === 'phone' ? (
        <>
          <input
            type="tel"
            placeholder="+7 900 000-00-00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <button onClick={requestCode} disabled={loading || !phone}>
            Получить код
          </button>
        </>
      ) : (
        <>
          <p style={{ marginBottom: 'var(--space-2)' }}>Код отправлен на {phone}</p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ marginBottom: 'var(--space-3)' }}
          />
          <button onClick={verify} disabled={loading || code.length < 4}>
            Подтвердить
          </button>
        </>
      )}

      {error && <p style={{ color: 'var(--error)', marginTop: 'var(--space-3)' }}>{error}</p>}
    </div>
  );
}
