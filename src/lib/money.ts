/**
 * Obsługa kwot pieniężnych.
 *
 * BR-03: kwoty są przechowywane WYŁĄCZNIE jako całkowita liczba groszy.
 * 125,50 zł  ->  12550
 *
 * Dlaczego nie liczby zmiennoprzecinkowe?
 * W JavaScripcie 19.99 * 100 === 1998.9999999999998, a nie 1999.
 * Na jednej kwocie tego nie widać, ale przy sumowaniu setek wydatków
 * błędy się kumulują i suma miesięczna przestaje się zgadzać.
 * Liczby całkowite nie mają tego problemu.
 */

/** Nierozdzielająca spacja (U+00A0) — separator tysięcy w formacie pl-PL. */
export const NBSP = ' ';

/** 6.2: kwota nie większa niż 99 999 999,99 zł. */
export const MAX_AMOUNT_GROSZE = 9_999_999_999;

/** 6.2: kwota musi być większa od zera (BR-10: 0,00 zł nie może zostać zapisane). */
export const MIN_AMOUNT_GROSZE = 1;

/**
 * Formatuje grosze do postaci widocznej w interfejsie: 125050 -> "1 250,50 zł".
 *
 * Format pl-PL wg 6.2: separator tysięcy spacją, separator dziesiętny przecinkiem.
 * Formatujemy ręcznie, a nie przez Intl.NumberFormat, ponieważ wynik Intl
 * zależy od danych ICU dostępnych na urządzeniu — na starszych Androidach
 * potrafi się różnić. Tutaj wynik jest zawsze identyczny i łatwo go przetestować.
 */
export function formatGrosze(grosze: number, options?: { withCurrency?: boolean }): string {
  const withCurrency = options?.withCurrency ?? true;

  const negative = grosze < 0;
  const absolute = Math.abs(Math.trunc(grosze));

  const zlote = Math.floor(absolute / 100);
  const reszta = absolute % 100;

  // Separator tysięcy co trzy cyfry, licząc od prawej strony.
  const zloteText = String(zlote).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const resztaText = String(reszta).padStart(2, '0');

  const sign = negative ? '-' : '';
  const amount = `${sign}${zloteText},${resztaText}`;

  return withCurrency ? `${amount}${NBSP}zł` : amount;
}

/** 5.1: brak danych prezentujemy jako 0,00 zł, nigdy jako pusty tekst ani błąd. */
export const ZERO_AMOUNT_TEXT = formatGrosze(0);

/**
 * Zamienia tekst wpisany przez użytkownika na grosze.
 * Zwraca `null`, gdy tekstu nie da się zinterpretować jako kwoty.
 *
 * 5.5: przecinek i kropka są akceptowane przy wpisywaniu,
 *      ale zapis w bazie jest jednolity (grosze).
 *
 * Konwersję robimy na tekście, a nie przez parseFloat(x) * 100,
 * właśnie po to, żeby ominąć błędy zmiennoprzecinkowe opisane na górze pliku.
 */
export function parseAmountToGrosze(input: string): number | null {
  if (typeof input !== 'string') return null;

  const cleaned = input
    .replace(/\s| /g, '') // spacje zwykłe i nierozdzielające
    .replace(/zł/gi, '')
    .replace(',', '.')
    .trim();

  if (cleaned === '') return null;

  // Dozwolone: "125", "125.5", "125.50". Niedozwolone: "12.5.5", "abc", "-5", "125.505".
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const [zloteText, resztaText = ''] = cleaned.split('.');
  const zlote = Number(zloteText);
  const reszta = Number(resztaText.padEnd(2, '0'));

  if (!Number.isSafeInteger(zlote)) return null;

  return zlote * 100 + reszta;
}

export type AmountValidation =
  { ok: true } | { ok: false; reason: 'EMPTY' | 'TOO_LOW' | 'TOO_HIGH' };

/**
 * 5.5 / 6.2 / BR-10: waliduje kwotę przed zapisem.
 * Kwota pusta, zerowa lub ujemna nie może zostać zapisana jako wydatek.
 */
export function validateAmountGrosze(grosze: number | null | undefined): AmountValidation {
  if (grosze === null || grosze === undefined || Number.isNaN(grosze)) {
    return { ok: false, reason: 'EMPTY' };
  }
  if (grosze < MIN_AMOUNT_GROSZE) return { ok: false, reason: 'TOO_LOW' };
  if (grosze > MAX_AMOUNT_GROSZE) return { ok: false, reason: 'TOO_HIGH' };
  return { ok: true };
}
