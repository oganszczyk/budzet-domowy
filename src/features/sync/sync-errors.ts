/**
 * Etap 14c: DLACZEGO SYNCHRONIZACJA SIĘ NIE UDAŁA.
 *
 * Ten plik zamienia odpowiedź serwera na jeden z kilku POWODÓW, które ekran
 * potrafi wytłumaczyć po polsku. Nie dotyka sieci ani ekranu, więc każdy
 * przypadek da się sprawdzić w Node.
 *
 * DLACZEGO NIE POKAZUJEMY KOMUNIKATU Z SERWERA WPROST
 *
 * Supabase odpowiada po angielsku i w kategoriach bazy danych. Zdanie
 * „relation \\"public.payments\\" does not exist" jest dla programisty pełną
 * diagnozą, a dla właściciela aplikacji szumem, po którym zostaje wrażenie,
 * że coś się zepsuło. Tymczasem znaczy ono coś prostego i naprawialnego:
 * nie uruchomiłeś jeszcze pliku SQL w panelu Supabase.
 *
 * Każdy powód niżej istnieje dlatego, że prowadzi do INNEGO działania
 * użytkownika. Gdyby dwa powody kończyły się tą samą radą, byłby to jeden
 * powód z dwiema nazwami.
 */

export type SyncFailureReason =
  /** Aplikacja zbudowana bez pliku `.env` — nie ma się z czym łączyć. */
  | 'NOT_CONFIGURED'
  /** Nikt nie jest zalogowany. Bez konta serwer nie wie, czyje to dane. */
  | 'NOT_SIGNED_IN'
  /** Telefon bez internetu albo serwer nieosiągalny. */
  | 'OFFLINE'
  /**
   * Tabel nie ma na serwerze. Znaczy to, że plik
   * `docs/supabase/01-schemat-i-reguly.sql` nie został jeszcze uruchomiony
   * w panelu Supabase. To jedyny powód, którego nie da się naprawić
   * z telefonu — i dlatego ma własny komunikat.
   */
  | 'SCHEMA_MISSING'
  /**
   * Serwer odmówił zapisu. Prawie zawsze znaczy to, że reguły RLS nie zostały
   * założone albo zostały założone inaczej, niż zakłada aplikacja.
   */
  | 'PERMISSION_DENIED'
  /** Coś, czego nie przewidzieliśmy. */
  | 'UNKNOWN';

/**
 * Kształt błędu, jaki oddaje biblioteka Supabase.
 *
 * Opisujemy go własnym typem zamiast importować, bo interesują nas trzy pola
 * i chcemy, żeby ta funkcja przyjmowała też zwykły wyjątek z sieci —
 * a ten nie ma z tamtym typem nic wspólnego.
 */
export type ServerErrorLike = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** Kody Postgresa i PostgREST, które znaczą „nie ma takiej tabeli". */
const BRAK_TABELI = new Set([
  // Postgres: undefined_table.
  '42P01',
  // Postgres: undefined_column — wychodzi, gdy tabela istnieje, ale powstała
  // ze starszej wersji pliku SQL. Rada dla użytkownika jest ta sama:
  // uruchom aktualny plik.
  '42703',
  // PostgREST nie znalazł tabeli w swojej pamięci podręcznej schematu.
  'PGRST205',
  'PGRST204',
]);

/** Kody znaczące „reguły dostępu nie przepuściły tego zapisu". */
const BRAK_UPRAWNIEN = new Set([
  // Postgres: insufficient_privilege — tak wygląda odbicie od reguły RLS.
  '42501',
  'PGRST301',
]);

const zawiera = (tekst: string, fragment: string) => tekst.includes(fragment);

/**
 * Ustala powód niepowodzenia.
 *
 * Kolejność sprawdzeń nie jest przypadkowa: kod błędu jest pewniejszy niż
 * treść komunikatu, bo treść bywa tłumaczona i zmieniana między wersjami
 * biblioteki. Do tekstu schodzimy dopiero wtedy, gdy kodu nie ma — a nie ma
 * go przy zwykłym braku internetu, bo to wyjątek z warstwy sieciowej,
 * nie odpowiedź bazy.
 */
export function describeSyncError(error: unknown): SyncFailureReason {
  if (error === null || error === undefined) return 'UNKNOWN';

  const kandydat = error as ServerErrorLike;
  const kod = typeof kandydat.code === 'string' ? kandydat.code : '';

  if (BRAK_TABELI.has(kod)) return 'SCHEMA_MISSING';
  if (BRAK_UPRAWNIEN.has(kod)) return 'PERMISSION_DENIED';

  const tekst = [kandydat.message, kandydat.details, kandydat.hint]
    .filter((czesc): czesc is string => typeof czesc === 'string')
    .join(' ')
    .toLowerCase();

  if (tekst === '') return 'UNKNOWN';

  // Brak internetu na telefonie objawia się wyjątkiem z warstwy sieciowej,
  // bez kodu bazy. „Network request failed" to komunikat React Native.
  if (
    zawiera(tekst, 'network request failed') ||
    zawiera(tekst, 'failed to fetch') ||
    zawiera(tekst, 'network error') ||
    zawiera(tekst, 'timeout') ||
    zawiera(tekst, 'unable to resolve host')
  ) {
    return 'OFFLINE';
  }

  if (
    zawiera(tekst, 'does not exist') ||
    zawiera(tekst, 'could not find the table') ||
    zawiera(tekst, 'schema cache')
  ) {
    return 'SCHEMA_MISSING';
  }

  if (
    zawiera(tekst, 'row-level security') ||
    zawiera(tekst, 'row level security') ||
    zawiera(tekst, 'permission denied') ||
    zawiera(tekst, 'violates row-level')
  ) {
    return 'PERMISSION_DENIED';
  }

  if (zawiera(tekst, 'jwt') || zawiera(tekst, 'not authenticated')) {
    return 'NOT_SIGNED_IN';
  }

  return 'UNKNOWN';
}
