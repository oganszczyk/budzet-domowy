/**
 * Etap 14a: KLIENT SUPABASE.
 *
 * Jedno miejsce, w którym powstaje połączenie z chmurą. Reszta aplikacji
 * pyta stąd o klienta i musi być gotowa na odpowiedź „nie ma".
 *
 * DLACZEGO KLIENT MOŻE NIE ISTNIEĆ
 *
 * Bez pliku `.env` nie ma do czego się łączyć (patrz `config.ts`). To nie
 * jest stan awaryjny — to normalny stan świeżo sklonowanego repozytorium.
 * Aplikacja działa wtedy dokładnie tak, jak działała przez trzynaście etapów:
 * na lokalnej bazie SQLite, bez konta i bez synchronizacji.
 *
 * DLACZEGO POWSTAJE DOPIERO PRZY PIERWSZYM UŻYCIU
 *
 * `createClient` zaczyna od sięgnięcia do magazynu sesji, a ten na Androidzie
 * budzi Keystore. Robienie tego w trakcie wczytywania modułu opóźniałoby
 * start aplikacji o operację, która na ekranie głównym nie jest do niczego
 * potrzebna — konto interesuje nas dopiero na ekranie konta.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { readSupabaseConfig } from './config';
import { platformSecureBackend } from './expo-adapter';
import { createChunkedStorage } from './session-storage';

/**
 * Zapis MUSI wyglądać dokładnie tak: `process.env.EXPO_PUBLIC_...` jako pełny
 * tekst. Metro podmienia go na wartość podczas budowania i nie rozpozna
 * odczytu przez zmienną ani przez pętlę. Patrz komentarz w `config.ts`.
 */
const config = readSupabaseConfig(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);

/** Czy projekt Supabase jest w ogóle podłączony. */
export function isSupabaseConfigured(): boolean {
  return config !== null;
}

let client: SupabaseClient | null = null;

/** Zwraca klienta albo `null`, gdy projekt nie został podłączony. */
export function getSupabaseClient(): SupabaseClient | null {
  if (config === null) return null;

  if (client === null) {
    client = createClient(config.url, config.publishableKey, {
      auth: {
        /** Sesja dzielona na kawałki i oddana Keychainowi — patrz `session-storage.ts`. */
        storage: createChunkedStorage(platformSecureBackend),

        /** Token wygasa po godzinie; biblioteka odnawia go sama w tle. */
        autoRefreshToken: true,

        /** Bez tego każde uruchomienie aplikacji pytałoby o hasło. */
        persistSession: true,

        /**
         * W telefonie nie ma paska adresu, z którego dałoby się odczytać
         * token po powrocie z przeglądarki. Włączone szukałoby go
         * bez końca przy każdym starcie.
         */
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
