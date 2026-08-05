export function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, fontSize: 32 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange?.(n)}
          style={{
            cursor: onChange ? 'pointer' : 'default',
            color: n <= value ? 'var(--money)' : 'var(--border)',
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}
