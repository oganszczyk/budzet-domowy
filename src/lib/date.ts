/**
 * Obsługa dat i miesięcy.
 *
 * Zasada: daty przechowujemy jako tekst ISO "RRRR-MM-DD" (np. "2026-07-28").
 *
 * Dlaczego tekst, a nie obiekt Date?
 *  - tekst ISO sortuje się alfabetycznie tak samo jak chronologicznie,
 *    więc SQLite sortuje historię (5.7) bez żadnych konwersji;
 *  - nie ma strefy czasowej, więc termin "5 dzień miesiąca" nigdy nie przesunie
 *    się na 4. dzień, gdy telefon jest w innej strefie;
 *  - to samo, co zapisaliśmy, odczytujemy z powrotem — bez niespodzianek.
 */

/** Data w formacie ISO "RRRR-MM-DD". */
export type IsoDate = string;

/** Miesiąc kalendarzowy. `month` liczony od 1 (styczeń) do 12 (grudzień). */
export type YearMonth = {
  year: number;
  month: number;
};

/** 6.2: pełne polskie nazwy miesięcy (mianownik) — do nagłówka "Lipiec 2026". */
export const MONTH_NAMES = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
] as const;

/**
 * Skróty miesięcy do podpisów osi wykresu (Etap 12).
 *
 * Pełna nazwa („Październik") nie mieści się pod słupkiem o szerokości
 * dwudziestu kilku pikseli, a ucięta w połowie („Paździer…") czyta się
 * gorzej niż trzyliterowy skrót.
 */
export const MONTH_SHORT_NAMES = [
  'sty',
  'lut',
  'mar',
  'kwi',
  'maj',
  'cze',
  'lip',
  'sie',
  'wrz',
  'paź',
  'lis',
  'gru',
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** 4.3: domyślnie pokazujemy aktualny miesiąc i rok urządzenia. */
export function currentYearMonth(): YearMonth {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Dzisiejsza data jako ISO — domyślna wartość w formularzu wydatku (5.5). */
export function todayIso(): IsoDate {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/**
 * 4.3: przejście do poprzedniego / następnego miesiąca.
 * `offset` może być dowolną liczbą całkowitą, także ujemną.
 */
export function addMonths({ year, month }: YearMonth, offset: number): YearMonth {
  // Liczymy na "numerze miesiąca od roku 0", żeby ręcznie nie obsługiwać przełomu roku.
  const total = year * 12 + (month - 1) + offset;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** 5.1: nagłówek ekranu głównego, np. "Lipiec 2026". */
export function formatMonthYear({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** 6.2: data w interfejsie w formacie dd.MM.yyyy, np. "28.07.2026". */
export function formatDate(iso: IsoDate): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

/** Liczba dni w miesiącu — dzień 0 kolejnego miesiąca to ostatni dzień bieżącego. */
export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Pierwszy i ostatni dzień miesiąca jako ISO.
 * Używane w zapytaniach SQL: `WHERE effectiveDate BETWEEN start AND end` (BR-09).
 */
export function monthRange(ym: YearMonth): { start: IsoDate; end: IsoDate } {
  return {
    start: `${ym.year}-${pad2(ym.month)}-01`,
    end: `${ym.year}-${pad2(ym.month)}-${pad2(daysInMonth(ym))}`,
  };
}

/**
 * Miesiąc jako tekst „RRRR-MM" — klucz rekordów przypisanych do miesiąca,
 * a nie do konkretnego dnia (Etap 11: dochody domowników).
 *
 * Ten sam zapis, co pierwsze siedem znaków daty ISO, więc SQL porównuje go
 * z `substr(effectiveDate, 1, 7)` bez żadnej konwersji, a sortowanie
 * alfabetyczne jest jednocześnie sortowaniem chronologicznym.
 */
export function yearMonthKey({ year, month }: YearMonth): string {
  return `${year}-${pad2(month)}`;
}

/** Odwrotność `yearMonthKey`. */
export function yearMonthFromKey(key: string): YearMonth {
  const [year, month] = key.split('-');
  return { year: Number(year), month: Number(month) };
}

/** Miesiąc, do którego należy dana data. */
export function yearMonthOf(iso: IsoDate): YearMonth {
  const [year, month] = iso.split('-');
  return { year: Number(year), month: Number(month) };
}

/** Czy dwa miesiące są tym samym miesiącem? */
export function isSameMonth(a: YearMonth, b: YearMonth): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * Buduje datę terminu rachunku w danym miesiącu (5.2: defaultDueDay).
 * Jeśli szablon ma termin 31, a miesiąc ma 30 dni, używamy ostatniego dnia miesiąca.
 */
export function dueDateFor(ym: YearMonth, dayOfMonth: number): IsoDate {
  const day = Math.min(Math.max(dayOfMonth, 1), daysInMonth(ym));
  return `${ym.year}-${pad2(ym.month)}-${pad2(day)}`;
}

/**
 * Porównanie chronologiczne dwóch miesięcy.
 * Ujemne, gdy `a` jest wcześniejszy; zero, gdy to ten sam miesiąc.
 */
export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year - b.year || a.month - b.month;
}

/**
 * Pierwszy i ostatni dzień CIĄGU miesięcy (Etap 12: analiza).
 *
 * Odpowiednik `monthRange`, tylko rozciągnięty na zakres. Używane w SQL:
 * `WHERE effectiveDate BETWEEN start AND end`. Zakres jest domknięty —
 * miesiąc początkowy i końcowy wchodzą do wyniku.
 *
 * Gdy zakres podano „na opak" (koniec przed początkiem), zamieniamy końce
 * miejscami zamiast zwracać pustkę. Użytkownik przestawiający miesiące
 * strzałkami przechodzi przez taki stan po drodze i nie chcemy, żeby ekran
 * migał wtedy pustym wykresem.
 */
export function monthSpan(from: YearMonth, to: YearMonth): { start: IsoDate; end: IsoDate } {
  const [first, last] = compareYearMonth(from, to) <= 0 ? [from, to] : [to, from];
  return { start: monthRange(first).start, end: monthRange(last).end };
}

/** Lista kolejnych miesięcy od `from` do `to` włącznie, chronologicznie. */
export function monthsBetween(from: YearMonth, to: YearMonth): YearMonth[] {
  const [first, last] = compareYearMonth(from, to) <= 0 ? [from, to] : [to, from];
  const count = (last.year - first.year) * 12 + (last.month - first.month);

  return Array.from({ length: count + 1 }, (_, index) => addMonths(first, index));
}
