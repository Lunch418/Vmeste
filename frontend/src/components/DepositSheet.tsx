export type SheetPhase = 'none' | 'idle' | 'processing' | 'success';

function formatDeposit(kopecks: number) {
  return `${(kopecks / 100).toLocaleString('ru-RU')} ₽`;
}

export function DepositSheet({
  phase,
  amount,
  title = 'Депозит-гарантия',
  description,
  successTitle = 'Депозит в резерве',
  successSubtitle,
  onPay,
  onClose,
}: {
  phase: SheetPhase;
  amount: number;
  title?: string;
  description: string;
  successTitle?: string;
  successSubtitle: string;
  onPay: () => void;
  onClose: () => void;
}) {
  if (phase === 'none') return null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(32,30,29,0.4)',
        display: 'flex',
        alignItems: 'flex-end',
        zIndex: 30,
      }}
    >
      <div
        style={{
          width: '100%',
          background: 'var(--bg)',
          borderRadius: '28px 28px 0 0',
          padding: '18px 22px 34px',
        }}
      >
        <div style={{ width: 44, height: 5, borderRadius: 999, background: 'var(--border)', margin: '0 auto 18px' }} />

        {phase === 'idle' && (
          <>
            <h2 style={{ marginBottom: 6 }}>{title}</h2>
            <p className="text-secondary" style={{ marginBottom: 18, lineHeight: 1.5 }}>
              {description}
            </p>
            <button onClick={onPay} style={{ width: '100%', marginBottom: 10 }}>
              Оплатить {formatDeposit(amount)}
            </button>
            <button className="ghost" onClick={onClose} style={{ width: '100%' }}>
              Отмена
            </button>
          </>
        )}

        {phase === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: 46,
                height: 46,
                borderRadius: 999,
                border: '4px solid var(--money-bg)',
                borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite',
                marginBottom: 16,
              }}
            />
            <p className="text-secondary">Проводим оплату через ЮKassa…</p>
          </div>
        )}

        {phase === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0 8px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                background: 'var(--accent-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
                animation: 'pop-in 0.5s cubic-bezier(.34,1.56,.64,1)',
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="var(--tag-bg)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 style={{ marginBottom: 4 }}>{successTitle}</h2>
            <p className="text-secondary">{successSubtitle}</p>
          </div>
        )}
      </div>
    </div>
  );
}
