// Mock localStorage for tests. Browser-faithful: supports the indexed Storage API
// (`length` + `key(i)`) so code that enumerates keys (e.g. clearing `sb-*` session
// keys) behaves the same under test as in a real browser.
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value) },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })
