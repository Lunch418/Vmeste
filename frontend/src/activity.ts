export const ACTIVITY_TYPES = ['Кино', 'Прогулка', 'Игры', 'Концерт', 'Спорт', 'Кафе'] as const;

const HUES: Record<string, string> = {
  Кино: '#8c6b4a',
  Прогулка: '#6d7a52',
  Игры: '#7a5a3a',
  Концерт: '#5a4a6b',
  Спорт: '#3f6b52',
  Кафе: '#6b5a4a',
};

export function activityHue(activityType: string): string {
  return HUES[activityType] ?? '#8c6b4a';
}

export const FEED_FILTERS: { label: string; activityType: string | null }[] = [
  { label: 'Все', activityType: null },
  { label: 'Кино', activityType: 'Кино' },
  { label: 'Прогулки', activityType: 'Прогулка' },
  { label: 'Игры', activityType: 'Игры' },
  { label: 'Концерты', activityType: 'Концерт' },
  { label: 'Спорт', activityType: 'Спорт' },
  { label: 'Кафе', activityType: 'Кафе' },
];

export function isUrgent(datetimeIso: string, slotsFull: boolean): boolean {
  if (slotsFull) return false;
  const hoursUntil = (new Date(datetimeIso).getTime() - Date.now()) / 3_600_000;
  return hoursUntil >= 0 && hoursUntil <= 3;
}
