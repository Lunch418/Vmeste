export function WizardStepper({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--space-4)' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: i < current ? 'var(--accent)' : 'var(--border)',
          }}
        />
      ))}
    </div>
  );
}
