import { isUuid, newUuid, UUID_LENGTH } from './uuid';

describe('trwałe identyfikatory (Etap 14b)', () => {
  it('ma kształt zgodny z tym, co nadaje baza', () => {
    // Wyzwalacze z migracji 3 wypełniają kolumnę zapisem
    // `lower(hex(randomblob(16)))`. Identyfikator z kodu musi wyglądać
    // tak samo, bo przy synchronizacji porównuje się TEKSTY — ten sam
    // rekord zapisany raz z myślnikami, a raz bez, byłby dwoma rekordami.
    expect(newUuid()).toMatch(/^[0-9a-f]{32}$/);
    expect(newUuid()).toHaveLength(UUID_LENGTH);
  });

  it('nie powtarza się', () => {
    // Powtórzony identyfikator jest gorszy niż jego brak: przy synchronizacji
    // jeden wydatek nadpisałby drugi, bo serwer uznałby je za ten sam rekord.
    const wygenerowane = new Set(Array.from({ length: 5000 }, () => newUuid()));

    expect(wygenerowane.size).toBe(5000);
  });

  it('nie zależy od obecności generatora kryptograficznego', () => {
    // Hermes na telefonie bywa bez `crypto.getRandomValues`, a część testów
    // biegnie w Node bez globalnego `crypto`. Zejście do `Math.random` musi
    // dawać identyfikator tego samego kształtu, a nie wyjątek.
    const oryginalny = globalThis.crypto;

    try {
      Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });

      expect(newUuid()).toMatch(/^[0-9a-f]{32}$/);
      expect(new Set(Array.from({ length: 1000 }, () => newUuid())).size).toBe(1000);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: oryginalny, configurable: true });
    }
  });

  it('rozpoznaje własny zapis', () => {
    expect(isUuid(newUuid())).toBe(true);
    expect(isUuid('0'.repeat(32))).toBe(true);
  });

  it('odrzuca wszystko, co identyfikatorem nie jest', () => {
    // Sprawdzane przy wczytywaniu kopii zapasowej, czyli w jedynym miejscu,
    // gdzie wartość może być czymkolwiek.
    const zle = [
      '',
      'nie-jest-identyfikatorem',
      '0'.repeat(31), // za krótki
      '0'.repeat(33), // za długi
      'A'.repeat(32), // wielkie litery — baza zapisuje małe
      'g'.repeat(32), // poza zapisem szesnastkowym
      '550e8400-e29b-41d4-a716-446655440000', // kształt z myślnikami
      42,
      null,
      undefined,
      {},
    ];

    for (const wartosc of zle) {
      expect(isUuid(wartosc)).toBe(false);
    }
  });
});
