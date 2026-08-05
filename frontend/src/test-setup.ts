// Minimal localStorage polyfill so modules that touch it at import time
// (e.g. src/api/client.ts reads localStorage at module scope) don't throw
// under vitest's default node environment.
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

if (typeof globalThis.localStorage === 'undefined') {
  // @ts-expect-error -- test-only polyfill, not a full Storage implementation
  globalThis.localStorage = new MemoryStorage();
}
