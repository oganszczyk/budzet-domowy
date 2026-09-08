import {
  CHUNK_SIZE,
  createChunkedStorage,
  splitIntoChunks,
  type KeyValueBackend,
} from './session-storage';

/** Magazyn udający SecureStore, żeby test nie potrzebował telefonu. */
function createFakeBackend() {
  const items = new Map<string, string>();

  const backend: KeyValueBackend = {
    getItem: async (key) => items.get(key) ?? null,
    setItem: async (key, value) => {
      items.set(key, value);
    },
    removeItem: async (key) => {
      items.delete(key);
    },
  };

  return { backend, items };
}

/** Tekst o zadanej długości, bez powtórzeń — sklejenie w złej kolejności rzuca się w oczy. */
function textOfLength(length: number): string {
  let text = '';
  let counter = 0;
  while (text.length < length) {
    text += `${counter++}-abcdefghij`;
  }
  return text.slice(0, length);
}

const KEY = 'sb-projekt-auth-token';

describe('splitIntoChunks', () => {
  it('pusty tekst to jeden pusty kawałek, a nie zero kawałków', () => {
    // Zero kawałków byłoby nieodróżnialne od „nic tu nie zapisano".
    expect(splitIntoChunks('', 4)).toEqual(['']);
  });

  it('tekst krótszy niż kawałek zostaje w całości', () => {
    expect(splitIntoChunks('abc', 4)).toEqual(['abc']);
  });

  it('tekst dokładnej długości kawałka nie dostaje pustego ogona', () => {
    expect(splitIntoChunks('abcd', 4)).toEqual(['abcd']);
  });

  it('dłuższy tekst dzieli się po kolei', () => {
    expect(splitIntoChunks('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
  });
});

describe('createChunkedStorage', () => {
  it('brak klucza to brak sesji', async () => {
    const { backend } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('krótka wartość wraca w niezmienionej postaci', async () => {
    const { backend } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    await storage.setItem(KEY, 'krótka sesja');

    expect(await storage.getItem(KEY)).toBe('krótka sesja');
  });

  it('pusty tekst wraca jako pusty tekst, a nie jako brak sesji', async () => {
    const { backend } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    await storage.setItem(KEY, '');

    expect(await storage.getItem(KEY)).toBe('');
  });

  it('SESJA PRAWDZIWEJ DŁUGOŚCI wraca bez zmiany choćby jednego znaku', async () => {
    // To jest powód istnienia tego pliku. Sesja Supabase to dwa tokeny JWT
    // plus dane konta — około 3 kB, czyli więcej, niż iOS bywa skłonny
    // przyjąć w jednym wpisie.
    const { backend } = createFakeBackend();
    const storage = createChunkedStorage(backend);
    const session = textOfLength(3200);

    await storage.setItem(KEY, session);

    expect(await storage.getItem(KEY)).toBe(session);
  });

  it('ŻADEN pojedynczy wpis nie przekracza rozmiaru kawałka', async () => {
    // Gdyby ten test padł, SecureStore odmówiłby zapisu na iOS, a użytkownik
    // byłby wylogowywany przy każdym zamknięciu aplikacji — bez komunikatu.
    const { backend, items } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    await storage.setItem(KEY, textOfLength(10_000));

    const tooLong = [...items.entries()].filter(([, value]) => value.length > CHUNK_SIZE);
    expect(tooLong).toEqual([]);
  });

  it('krótsza sesja SPRZĄTA kawałki po dłuższej poprzedniej', async () => {
    // Bez sprzątania w Keychainie zostawałby ogon starego tokenu — na zawsze.
    const { backend, items } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    await storage.setItem(KEY, textOfLength(5000));
    const afterLong = items.size;

    await storage.setItem(KEY, 'krótka');

    expect(items.size).toBeLessThan(afterLong);
    expect(await storage.getItem(KEY)).toBe('krótka');
  });

  it('wylogowanie kasuje wszystkie kawałki, nie tylko licznik', async () => {
    const { backend, items } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    await storage.setItem(KEY, textOfLength(5000));
    await storage.removeItem(KEY);

    expect([...items.keys()]).toEqual([]);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('BRAKUJĄCY kawałek daje brak sesji, a nie sklejony ogryzek', async () => {
    // Sklejenie tego, co zostało, dałoby token wyglądający na poprawny.
    const { backend, items } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    await storage.setItem(KEY, textOfLength(5000));
    items.delete(`${KEY}.1`);

    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('uszkodzony licznik daje brak sesji', async () => {
    const { backend, items } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    await storage.setItem(KEY, 'sesja');
    items.set(KEY, 'to nie jest liczba');

    expect(await storage.getItem(KEY)).toBeNull();
  });

  it('sesje różnych kont nie mieszają się ze sobą', async () => {
    const { backend } = createFakeBackend();
    const storage = createChunkedStorage(backend);

    await storage.setItem('konto-a', textOfLength(4000));
    await storage.setItem('konto-b', textOfLength(2500));
    await storage.removeItem('konto-a');

    expect(await storage.getItem('konto-a')).toBeNull();
    expect(await storage.getItem('konto-b')).toBe(textOfLength(2500));
  });
});
