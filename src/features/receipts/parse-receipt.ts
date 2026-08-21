/**
 * 5.6: REGUŁY ROZPOZNAWANIA PARAGONU
 *
 * Zakres OCR w MVP: „Jeden paragon jest zapisywany jako jedna transakcja.
 * System odczytuje wyłącznie nazwę sklepu, datę i końcową kwotę.
 * Nie odczytuje listy produktów ani ich kategorii."
 *
 * Ten plik NIE czyta zdjęcia. Dostaje gotowy tekst z silnika OCR i wyciąga
 * z niego trzy pola. Dzięki takiemu rozdzieleniu całą — najtrudniejszą —
 * część da się przetestować na prawdziwych paragonach bez aparatu.
 */

import type { IsoDate } from '@/lib/date';

export type ReceiptFields = {
  /** 5.6: „Nazwa sklepu jest sugestią i może pozostać pusta." */
  merchant: string | null;
  /** Data z paragonu albo `null`, gdy nie znaleziono prawidłowej. */
  date: IsoDate | null;
  /** Kwota w groszach (BR-03) albo `null`, gdy nie rozpoznano. */
  amountGrosze: number | null;
  /** Skąd wzięła się kwota — pokazujemy to użytkownikowi przy weryfikacji. */
  amountSource: 'DO_ZAPLATY' | 'SUMA' | 'RAZEM' | 'NAJWIEKSZA' | null;
};

/**
 * Wiersze, w których liczba NIE jest kwotą do zapłaty.
 *
 * „SUMA PTU" to suma podatku, nie należność — a zaczyna się od słowa SUMA,
 * więc bez tego wykluczenia paragon na 11,97 zł zapisałby się jako 2,24 zł.
 * „RESZTA" i „GOTÓWKA" dotyczą rozliczenia z klientem, nie wartości zakupu.
 */
const EXCLUDED_LINE = /PTU|VAT|PODATEK|RESZTA|SPRZEDA[ŻZ]\s+OPODATKOWANA|NIP|RABAT/i;

/**
 * 5.6: „Kwoty oznaczone jako SUMA, RAZEM, DO ZAPŁATY lub podobne mają
 * wyższy priorytet niż sumy częściowe."
 *
 * Wyższa liczba = mocniejsza wskazówka.
 */
const AMOUNT_MARKERS: { pattern: RegExp; source: ReceiptFields['amountSource']; rank: number }[] = [
  { pattern: /DO\s*ZAP[ŁL]ATY/i, source: 'DO_ZAPLATY', rank: 3 },
  { pattern: /\bSUMA\b/i, source: 'SUMA', rank: 2 },
  { pattern: /\bRAZEM\b|\b[ŁL][ĄA]CZNIE\b/i, source: 'RAZEM', rank: 1 },
];

/** Kwota w formacie polskim: 1 234,56 albo 1234.56 — z dokładnie dwoma groszami. */
const AMOUNT_PATTERN = /(\d{1,3}(?:[  ]\d{3})+|\d+)[,.](\d{2})(?!\d)/g;

/** Zamienia dopasowanie na grosze bez użycia liczb zmiennoprzecinkowych (BR-03). */
function matchToGrosze(whole: string, cents: string): number {
  const zlote = Number(whole.replace(/[  ]/g, ''));
  if (!Number.isSafeInteger(zlote)) return Number.NaN;
  return zlote * 100 + Number(cents);
}

/** Wszystkie kwoty w jednym wierszu. */
function amountsInLine(line: string): number[] {
  const amounts: number[] = [];
  for (const match of line.matchAll(AMOUNT_PATTERN)) {
    const grosze = matchToGrosze(match[1], match[2]);
    if (Number.isSafeInteger(grosze)) amounts.push(grosze);
  }
  return amounts;
}

/**
 * 5.6: „Gdy znaleziono kilka możliwych kwot, wybrać najbardziej
 * prawdopodobną, ale zawsze umożliwić zmianę."
 *
 * Najpierw szukamy wierszy z oznaczeniem należności. Gdy takich nie ma,
 * bierzemy największą kwotę na paragonie — na paragonie fiskalnym suma
 * jest z definicji nie mniejsza niż każda pozycja.
 */
function findAmount(lines: string[]): Pick<ReceiptFields, 'amountGrosze' | 'amountSource'> {
  let best: { grosze: number; rank: number; source: ReceiptFields['amountSource'] } | null = null;

  for (const line of lines) {
    if (EXCLUDED_LINE.test(line)) continue;

    const amounts = amountsInLine(line);
    if (amounts.length === 0) continue;

    const marker = AMOUNT_MARKERS.find((m) => m.pattern.test(line));
    if (!marker) continue;

    // W obrębie wiersza z oznaczeniem bierzemy największą liczbę —
    // np. „SUMA PLN 2 x 11,97" nie zdarza się, ale ochrona nic nie kosztuje.
    const grosze = Math.max(...amounts);

    if (best === null || marker.rank > best.rank) {
      best = { grosze, rank: marker.rank, source: marker.source };
    }
  }

  if (best) return { amountGrosze: best.grosze, amountSource: best.source };

  // Brak oznaczeń — bierzemy największą kwotę spoza wykluczonych wierszy.
  const fallback = lines
    .filter((line) => !EXCLUDED_LINE.test(line))
    .flatMap((line) => amountsInLine(line));

  if (fallback.length === 0) return { amountGrosze: null, amountSource: null };

  return { amountGrosze: Math.max(...fallback), amountSource: 'NAJWIEKSZA' };
}

/** Czy taka data istnieje w kalendarzu? */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

const pad2 = (value: number) => String(value).padStart(2, '0');

/**
 * 5.6: „Data musi być prawidłową datą kalendarzową; w razie braku pozostawić
 * pole puste."
 *
 * Obsługujemy dwa zapisy spotykane na polskich paragonach: RRRR-MM-DD
 * (fiskalny) oraz DD.MM.RRRR. Data 31.02 zostaje odrzucona, mimo że pasuje
 * do wzorca — dlatego sprawdzamy kalendarz, a nie tylko kształt tekstu.
 */
function findDate(text: string): IsoDate | null {
  const isoMatches = text.matchAll(/(\d{4})-(\d{1,2})-(\d{1,2})/g);
  for (const match of isoMatches) {
    const [, y, m, d] = match.map(Number);
    if (isRealDate(y, m, d)) return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  const localMatches = text.matchAll(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/g);
  for (const match of localMatches) {
    const [, d, m, y] = match.map(Number);
    if (isRealDate(y, m, d)) return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  return null;
}

/** Wiersze, które na pewno nie są nazwą sklepu. */
const NOT_A_MERCHANT =
  /^\s*$|NIP|REGON|PARAGON|FISKALNY|^\s*UL\.|^\s*AL\.|^\s*\d|\d{2}-\d{3}|KASA|KASJER|^\s*[\d\s,.:-]+$/i;

/**
 * 5.6: nazwa sklepu to SUGESTIA. Bierzemy pierwszy wiersz, który wygląda
 * na nazwę firmy — paragony fiskalne zaczynają się od nagłówka sprzedawcy.
 * Gdy nic nie pasuje, zwracamy `null` i pole zostaje puste do uzupełnienia.
 */
function findMerchant(lines: string[]): string | null {
  for (const line of lines.slice(0, 6)) {
    const trimmed = line.trim();
    if (NOT_A_MERCHANT.test(trimmed)) continue;

    // Nazwa musi mieć trochę liter — sam ciąg znaków specjalnych to szum OCR.
    const letters = trimmed.replace(/[^\p{L}]/gu, '');
    if (letters.length < 3) continue;

    // 6.2: nazwa pozycji ma najwyżej 80 znaków.
    return trimmed.slice(0, 80);
  }

  return null;
}

/**
 * Wyciąga sklep, datę i kwotę z tekstu odczytanego przez OCR.
 *
 * BR-08: „OCR tworzy wyłącznie propozycję danych, a nie gotową płatność."
 * Ta funkcja niczego nie zapisuje — zwraca propozycję do weryfikacji.
 */
export function parseReceiptText(text: string): ReceiptFields {
  const lines = text.split(/\r?\n/);

  return {
    merchant: findMerchant(lines),
    date: findDate(text),
    ...findAmount(lines),
  };
}
