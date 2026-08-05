import type { GeolocationCoords } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

let authToken: string | null = localStorage.getItem('vmeste_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('vmeste_token', token);
  } else {
    localStorage.removeItem('vmeste_token');
  }
}

export function getAuthToken() {
  return authToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // no-op: no JSON body
    }
    throw new Error(detail);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export const api = {
  requestPhoneCode: (phone: string) =>
    request<void>('/auth/phone', { method: 'POST', body: JSON.stringify({ phone }) }),

  verifyPhoneCode: (phone: string, code: string) =>
    request<{ access_token: string }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  getMe: () => request('/users/me'),
  updateMe: (payload: unknown) =>
    request('/users/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  getUser: (id: string) => request(`/users/${id}`),
  reportUser: (id: string, reason: string, eventId?: string) =>
    request<void>(`/users/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, event_id: eventId }),
    }),

  listEvents: (params: Record<string, string | undefined> = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return request(`/events${query ? `?${query}` : ''}`);
  },
  createEvent: (payload: unknown) =>
    request('/events', { method: 'POST', body: JSON.stringify(payload) }),
  getEvent: (id: string) => request(`/events/${id}`),
  joinEvent: (id: string) => request(`/events/${id}/join`, { method: 'POST' }),
  leaveEvent: (id: string) => request<void>(`/events/${id}/leave`, { method: 'POST' }),
  listParticipations: (id: string) => request(`/events/${id}/participations`),
  getMyParticipation: (id: string) => request(`/events/${id}/participations/me`),

  createDeposit: (participationId: string) =>
    request('/deposits', {
      method: 'POST',
      body: JSON.stringify({ participation_id: participationId }),
    }),
  getDeposit: (id: string) => request(`/deposits/${id}`),
  createPosterDeposit: (eventId: string) =>
    request(`/events/${eventId}/poster-deposit`, { method: 'POST' }),

  getMessages: (eventId: string) => request(`/events/${eventId}/messages`),
  sendMessage: (eventId: string, text: string) =>
    request(`/events/${eventId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),

  confirmSelfie: (eventId: string, facesDetected: number, coords: GeolocationCoords, filterName?: string) =>
    request<{ status: string }>(`/events/${eventId}/confirm/selfie`, {
      method: 'POST',
      body: JSON.stringify({
        faces_detected: facesDetected,
        filter_name: filterName,
        lat: coords.lat,
        lng: coords.lng,
      }),
    }),
  generateQr: (eventId: string, coords: GeolocationCoords) =>
    request<{ qr_token: string }>(`/events/${eventId}/confirm/qr/generate`, {
      method: 'POST',
      body: JSON.stringify({ lat: coords.lat, lng: coords.lng }),
    }),
  scanQr: (eventId: string, token: string, coords: GeolocationCoords) =>
    request<{ status: string }>(`/events/${eventId}/confirm/qr/scan`, {
      method: 'POST',
      body: JSON.stringify({ qr_token: token, lat: coords.lat, lng: coords.lng }),
    }),
  resolveNoShow: (eventId: string, participationId: string) =>
    request<{ status: string; reason: string }>(`/events/${eventId}/resolve-no-show`, {
      method: 'POST',
      body: JSON.stringify({ participation_id: participationId }),
    }),
  getUserRatings: (userId: string) => request(`/users/${userId}/ratings`),
  subscribe: (category: string) =>
    request<void>('/notifications/subscribe', {
      method: 'POST',
      body: JSON.stringify({ category }),
    }),

  rate: (eventId: string, ratedId: string, stars: number, comment?: string) =>
    request(`/events/${eventId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rated_id: ratedId, stars, comment }),
    }),
};

export function chatSocketUrl(eventId: string) {
  const base = API_BASE.replace(/^http/, 'ws');
  return `${base}/ws/events/${eventId}/chat?token=${authToken ?? ''}`;
}
