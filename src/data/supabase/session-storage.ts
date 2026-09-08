/**
 * Etap 14a: MAGAZYN SESJI LOGOWANIA.
 *
 * Po zalogowaniu Supabase dostaje od serwera token i musi go gdzieś odłożyć,
 * żeby po zamknięciu aplikacji nie pytać ponownie o hasło. My decydujemy gdzie.
 *
 * DLACZEGO SecureStore, A NIE ZWYKŁY PLIK
 *
 * Token odświeżający jest równoważny hasłu: kto go ma, ten ma dostęp do
 * wszystkich wydatków na koncie, i to bez znajomości hasła. `expo-secure-store`
 * oddaje go systemowi (Android Keystore / iOS Keychain), gdzie leży zaszyfrowany
 * kluczem sprzętowym telefonu.
 *
 * DLACZEGO NA KAWAŁKI
 *
 * SecureStore nie ma twardego limitu, ale dokumentacja Expo ostrzega, że
 * „niektóre wydania iOS odmawiały przyjęcia wartości powyżej mniej więcej
 * 2048 bajtów". Sesja Supabase to dwa tokeny JWT plus dane konta — bywa
 * dłuższa. Awaria byłaby podstępna: zapis kończyłby się błędem, logowanie
 * pozornie działałoby do pierwszego zamknięcia aplikacji, a potem wracałoby
 * do ekranu logowania bez żadnego wyjaśnienia.
 *
 * Dzielimy więc wartość na kawałki po `CHUNK_SIZE` znaków. Pod kluczem `k`
 * leży sama LICZBA kawałków, a treść pod `k.0`, `k.1`, `k.2`...
 *
 * Logika dzielenia jest oddzielona od SecureStore tym samym szwem, co baza
 * (`expo-adapter` / `node-adapter`): przyjmuje magazyn jako parametr, więc
 * daje się przetestować w Node bez telefonu.
 */

/** Minimalny magazyn klucz–wartość. Tyle wymaga od nas Supabase i tyle daje SecureStore. */
export type KeyValueBackend = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * 1536 znaków, a nie 2048.
 *
 * Ostrzeżenie Expo mówi o BAJTACH, a nie o znakach. Tokeny JWT są zapisane
 * w base64, gdzie znak to bajt, więc teoretycznie zmieściłoby się 2048.
 * Zostawiamy jednak zapas: adres e-mail w danych konta może zawierać polskie
 * znaki, a te zajmują po dwa bajty. Zapas kosztuje jeden kawałek więcej,
 * a jego brak kosztowałby wylogowanie przy każdym starcie.
 */
export const CHUNK_SIZE = 1536;

function chunkKey(key: string, index: number): string {
  return `${key}.${index}`;
}

/** Ile kawałków leży pod tym kluczem. 0 oznacza „nic tu nie ma". */
async function readChunkCount(backend: KeyValueBackend, key: string): Promise<number> {
  const head = await backend.getItem(key);
  if (head === null) return 0;

  const count = Number.parseInt(head, 10);
  return Number.isInteger(count) && count > 0 ? count : 0;
}

/** Dzieli tekst na kawałki. Pusty tekst to JEDEN pusty kawałek, a nie zero. */
export function splitIntoChunks(value: string, chunkSize: number): string[] {
  if (value.length === 0) return [''];

  const chunks: string[] = [];
  for (let start = 0; start < value.length; start += chunkSize) {
    chunks.push(value.slice(start, start + chunkSize));
  }
  return chunks;
}

/**
 * Opakowuje magazyn tak, żeby przyjmował wartości dowolnej długości.
 *
 * NIEDOKOŃCZONY ZAPIS jest bezpieczny, choć nie jest niepodzielny. Kawałki
 * zapisujemy PRZED liczbą kawałków — gdyby aplikację ubito w połowie, licznik
 * wskazuje jeszcze stary stan, odczyt zwróci sklejkę starej i nowej sesji,
 * Supabase nie rozpozna jej jako poprawnego JSON-a i potraktuje jak brak
 * sesji. Najgorszy możliwy skutek to jedno dodatkowe logowanie.
 *
 * Odwrotna kolejność byłaby gorsza: licznik obiecywałby kawałki, których
 * jeszcze nie ma.
 */
export function createChunkedStorage(
  backend: KeyValueBackend,
  chunkSize: number = CHUNK_SIZE
): KeyValueBackend {
  return {
    async getItem(key) {
      const count = await readChunkCount(backend, key);
      if (count === 0) return null;

      const parts: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const part = await backend.getItem(chunkKey(key, index));

        // Brakujący kawałek to sesja nie do odtworzenia. Zwracamy `null`,
        // czyli „nie ma sesji" — użytkownik zaloguje się ponownie. Sklejenie
        // tego, co zostało, dałoby token wyglądający na poprawny.
        if (part === null) return null;

        parts.push(part);
      }

      return parts.join('');
    },

    async setItem(key, value) {
      const previousCount = await readChunkCount(backend, key);
      const chunks = splitIntoChunks(value, chunkSize);

      for (let index = 0; index < chunks.length; index += 1) {
        await backend.setItem(chunkKey(key, index), chunks[index]);
      }

      await backend.setItem(key, String(chunks.length));

      // Poprzednia sesja mogła być dłuższa. Nadmiarowe kawałki trzeba usunąć,
      // inaczej zostawałyby w Keychainie na zawsze.
      for (let index = chunks.length; index < previousCount; index += 1) {
        await backend.removeItem(chunkKey(key, index));
      }
    },

    async removeItem(key) {
      const count = await readChunkCount(backend, key);

      // Licznik znika pierwszy: od tej chwili odczyt mówi „brak sesji",
      // nawet gdyby kasowanie kawałków się nie dokończyło.
      await backend.removeItem(key);

      for (let index = 0; index < count; index += 1) {
        await backend.removeItem(chunkKey(key, index));
      }
    },
  };
}
