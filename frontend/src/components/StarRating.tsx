export function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onClick={() => onChange?.(n)}
          style={{
            cursor: onChange ? 'pointer' : 'default',
            display: 'inline-flex',
            transition: 'transform .15s cubic-bezier(.34,1.56,.64,1)',
            transform: n <= value ? 'scale(1.15)' : 'scale(1)',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 24 24" fill={n <= value ? 'var(--accent)' : 'none'}>
            <path
              d="M12 2l3.1 6.7 7.4.9-5.5 5 1.6 7.3L12 18.3 5.4 21.9 7 14.6 1.5 9.6l7.4-.9z"
              stroke="var(--accent)"
              strokeWidth="1"
            />
          </svg>
        </span>
      ))}
    </div>
  );
}
