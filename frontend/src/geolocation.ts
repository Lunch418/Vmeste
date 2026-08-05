import type { GeolocationCoords } from './api/types';

export function getCurrentCoords(): Promise<GeolocationCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Геолокация не поддерживается устройством'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error('Не удалось определить местоположение — разрешите доступ к геолокации')),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
