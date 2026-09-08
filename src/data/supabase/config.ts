/**
 * Etap 14a: ODCZYT KONFIGURACJI PROJEKTU SUPABASE.
 *
 * Dwie wartości — adres projektu i klucz publiczny — przychodzą z pliku `.env`,
 * którego git nie śledzi. Metro wstawia je do kodu w momencie budowania,
 * i wyłącznie te z przedrostkiem `EXPO_PUBLIC_`.
 *
 * DLACZEGO KLUCZ MOŻE BYĆ JAWNY
 *
 * Klucz `publishable` jest z założenia widoczny w każdej zainstalowanej
 * aplikacji — nie da się go ukryć przed kimś, kto ma telefon w ręku. Nie jest
 * hasłem, tylko wskazaniem, o który projekt chodzi. Danych pilnują reguły RLS
 * po stronie serwera (Etap 14c): bez zalogowania nie przepuszczą niczego,
 * a po zalogowaniu wyłącznie wiersze należące do tego konta.
 *
 * W `.env` trzymamy go mimo to, bo `.env` jest też miejscem na wartości,
 * które sekretami BĘDĄ, i nie chcemy dwóch różnych zwyczajów.
 *
 * DLACZEGO BRAK KONFIGURACJI NIE JEST BŁĘDEM
 *
 * Repozytorium jest publiczne. Ktoś, kto je sklonuje, nie dostanie `.env`
 * i nie ma własnego projektu Supabase — a aplikacja ma mu się uruchomić
 * i działać na lokalnej bazie, tak jak działała przez trzynaście etapów.
 * Dlatego `readSupabaseConfig` zwraca `null` zamiast rzucać wyjątkiem.
 */

export type SupabaseConfig = {
  /** Adres projektu, bez ukośnika na końcu. */
  url: string;
  /** Klucz publiczny (`publishable`, dawniej `anon`). */
  publishableKey: string;
};

/**
 * Końcówki, które Supabase pokazuje w panelu i które łatwo skopiować zamiast
 * samego adresu projektu.
 *
 * To nie jest nadgorliwość. Panel Supabase pokazuje w kilku miejscach adres
 * zakończony `/rest/v1/` i jest on równie widoczny, co właściwy adres projektu.
 * Biblioteka doklei sobie tę część sama, więc adres z gotową końcówką dałby
 * zapytania pod `/rest/v1/rest/v1/...` — czyli błąd 404 przy każdej operacji,
 * z komunikatem nieprowadzącym do przyczyny.
 *
 * Obcięcie jest bezpieczne, bo żaden projekt Supabase nie mieszka pod
 * ścieżką — adres projektu to zawsze sama nazwa hosta.
 */
const KNOWN_SUFFIXES = ['/rest/v1', '/auth/v1', '/storage/v1', '/realtime/v1'];

/** Sprowadza adres do samego projektu: bez ukośników na końcu i bez końcówek API. */
export function normalizeProjectUrl(rawUrl: string): string {
  let url = rawUrl.trim().replace(/\/+$/, '');

  for (const suffix of KNOWN_SUFFIXES) {
    if (url.toLowerCase().endsWith(suffix)) {
      url = url.slice(0, -suffix.length);
      break;
    }
  }

  return url.replace(/\/+$/, '');
}

/**
 * Zwraca konfigurację albo `null`, gdy projekt nie został podłączony.
 *
 * Wartości przyjmuje parametrami zamiast czytać `process.env` samodzielnie,
 * bo Metro podmienia `process.env.EXPO_PUBLIC_*` na tekst dopiero wtedy, gdy
 * zapis wygląda dokładnie tak w kodzie. Odczyt „przez zmienną" zwróciłby
 * `undefined` w zbudowanej aplikacji, działając poprawnie w testach — czyli
 * najgorszy możliwy rodzaj usterki.
 */
export function readSupabaseConfig(
  rawUrl: string | undefined,
  rawKey: string | undefined
): SupabaseConfig | null {
  const url = normalizeProjectUrl(rawUrl ?? '');
  const publishableKey = (rawKey ?? '').trim();

  if (url === '' || publishableKey === '') return null;

  // Adres bez `https://` to zwykle wklejona sama nazwa hosta. Supabase nie
  // obsługuje połączeń nieszyfrowanych, więc taki adres i tak by nie zadziałał.
  if (!url.startsWith('https://')) return null;

  return { url, publishableKey };
}
