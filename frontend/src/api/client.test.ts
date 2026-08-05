import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, chatSocketUrl, getAuthToken, setAuthToken } from './client';

// Minimal localStorage polyfill for the node test environment (no jsdom needed
// for this module — it only touches localStorage and fetch).
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  setAuthToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('setAuthToken / getAuthToken', () => {
  it('stores the token and returns it', () => {
    setAuthToken('abc123');
    expect(getAuthToken()).toBe('abc123');
    expect(localStorage.getItem('vmeste_token')).toBe('abc123');
  });

  it('clears the token when set to null', () => {
    setAuthToken('abc123');
    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem('vmeste_token')).toBeNull();
  });
});

describe('api.listEvents query building', () => {
  it('omits undefined params from the query string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.listEvents({ type: 'concert', date: undefined, city: 'Пермь' });

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('type=concert');
    expect(calledUrl).toContain('city=');
    expect(calledUrl).not.toContain('date=');
  });

  it('builds a bare path with no query string when params are empty', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.listEvents();

    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl.endsWith('/events')).toBe(true);
  });
});

describe('api request error handling', () => {
  it('throws the backend detail message on a non-ok JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ detail: 'Вы уже участвуете в этом событии' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.joinEvent('event-1')).rejects.toThrow(
      'Вы уже участвуете в этом событии',
    );
  });

  it('falls back to statusText when the error body is not JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new Error('not json');
      },
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.joinEvent('event-1')).rejects.toThrow('Internal Server Error');
  });

  it('returns undefined for a 204 No Content response instead of parsing JSON', async () => {
    const jsonSpy = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: jsonSpy,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.leaveEvent('event-1');
    expect(result).toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it('attaches the Authorization header when a token is set', async () => {
    setAuthToken('my-token');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.getMe();

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer my-token');
  });

  it('omits the Authorization header when no token is set', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await api.getMe();

    const options = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe('chatSocketUrl', () => {
  it('converts the http(s) API base into a ws(s) URL and appends the token', () => {
    setAuthToken('tok-1');
    const url = chatSocketUrl('event-42');
    expect(url.startsWith('ws')).toBe(true);
    expect(url).toContain('/ws/events/event-42/chat?token=tok-1');
  });

  it('appends an empty token when unauthenticated', () => {
    const url = chatSocketUrl('event-42');
    expect(url).toContain('token=');
    expect(url.endsWith('token=')).toBe(true);
  });
});
