/**
 * Trwały identyfikator rekordu (Etap 14b).
 *
 * DLACZEGO ISTNIEJE OSOBNY IDENTYFIKATOR OBOK `id`:
 * `id` to `INTEGER PRIMARY KEY AUTOINCREMENT` — numer kolejny NADANY PRZEZ
 * TĘ JEDNĄ BAZĘ. Na drugim telefonie ta sama liczba oznacza zupełnie inny
 * wydatek. Przy synchronizacji dwóch urządzeń „wydatek numer 42" nie jest
 * więc żadnym wskazaniem: serwer nie ma jak odróżnić, czy przysłano mu
 * poprawkę istniejącego rekordu, czy nowy rekord o zajętym numerze.
 * Ostatecznie jeden nadpisałby drugi, po cichu.
 *
 * `uuid` jest losowany przy tworzeniu rekordu i nie zmienia się nigdy.
 * Ten sam wydatek ma ten sam `uuid` na obu telefonach i na serwerze.
 *
 * `id` ZOSTAJE i nadal jest kluczem głównym. Wskazuje na niego kilkanaście
 * kolumn i indeksów, a wewnątrz jednego telefonu działa poprawnie i szybciej
 * niż porównywanie 32 znaków tekstu. `uuid` jest dodatkiem na potrzeby
 * rozmowy z serwerem, nie zamiennikiem.
 *
 * DLACZEGO TEN SAM KSZTAŁT, CO W BAZIE:
 * Wyzwalacze z migracji 3 wypełniają kolumnę zapisem
 * `lower(hex(randomblob(16)))` — 32 znaki szesnastkowe, bez myślników.
 * Ta funkcja daje dokładnie to samo, żeby identyfikator utworzony w kodzie
 * i identyfikator utworzony przez bazę wyglądały jednakowo. Gdyby różniły
 * się myślnikami, porównanie tekstów przy synchronizacji uznałoby ten sam
 * rekord za dwa różne.
 */

const HEX_DIGITS = '0123456789abcdef';

/** Ile znaków szesnastkowych ma identyfikator — 16 bajtów po dwa znaki. */
export const UUID_LENGTH = 32;

/**
 * Losuje 16 bajtów najlepszym dostępnym sposobem.
 *
 * `crypto.getRandomValues` jest w przeglądarce i w nowszym Hermesie, ale nie
 * ma go w każdym środowisku, w którym uruchamiamy ten kod (część testów
 * w Node bez globalnego `crypto`, starsze silniki na telefonie). Zamiast
 * dokładać zależność natywną, schodzimy do `Math.random`.
 *
 * To nie jest generator kryptograficzny i nie musi nim być: identyfikator
 * ma być NIEPOWTARZALNY, a nie NIEODGADYWALNY. Nikt nie zyskuje dostępu do
 * cudzych danych, zgadując `uuid` — o tym rozstrzygają reguły RLS po stronie
 * serwera, które porównują właściciela rekordu z zalogowanym kontem.
 */
function randomBytes(count: number): Uint8Array {
  const bytes = new Uint8Array(count);

  const webCrypto = (globalThis as { crypto?: { getRandomValues?: (array: Uint8Array) => void } })
    .crypto;

  if (typeof webCrypto?.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < count; index++) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

/** Nowy trwały identyfikator: 32 znaki szesnastkowe, np. „a3f1…9c". */
export function newUuid(): string {
  const bytes = randomBytes(16);
  let result = '';

  for (const byte of bytes) {
    result += HEX_DIGITS[(byte >> 4) & 0x0f];
    result += HEX_DIGITS[byte & 0x0f];
  }

  return result;
}

/**
 * Czy tekst wygląda na nasz identyfikator.
 *
 * Używane przy wczytywaniu kopii zapasowej — czyli w jedynym miejscu,
 * gdzie dane przychodzą z zewnątrz i mogą być czymkolwiek.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && new RegExp(`^[0-9a-f]{${UUID_LENGTH}}$`).test(value);
}
