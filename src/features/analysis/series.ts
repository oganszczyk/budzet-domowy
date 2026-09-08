/**
 * Etap 12: szereg miesięczny — serce ekranu analizy.
 *
 * Dostaje surowe płatności i dochody, oddaje jedną liczbę na miesiąc.
 * Nie zna bazy, nie zna Reacta, nie rysuje. Dzięki temu reguły „co wchodzi
 * do zestawienia" i „jak liczymy średnią" da się sprawdzić testem w kilka
 * milisekund, zamiast klikać po ekranie na telefonie.
 *
 * BR-03: wszystko w groszach, liczby całkowite. Jedynym ułamkiem jest
 * zmiana procentowa, która nie jest kwotą i nigdy nie wraca do bazy.
 */

import { AnalysisSubjectKind, type AnalysisSubject } from '@/domain/analysis';
import type { Income, Payment } from '@/domain/models';
import { monthsBetween, yearMonthKey, type YearMonth } from '@/lib/date';

/** Jeden słupek wykresu: miesiąc i to, co się na niego złożyło. */
export type SeriesPoint = {
  month: YearMonth;
  /** Miesiąc jako „RRRR-MM" — klucz listy Reacta i klucz porównań. */
  key: string;
  totalGrosze: number;
  /** Ile rekordów złożyło się na tę kwotę. Zero znaczy „pusty miesiąc". */
  entryCount: number;
  /**
   * Ile rachunków w tym miesiącu czeka na wpisanie kwoty (BR-05).
   *
   * Bez tej liczby zestawienie kłamie przez przemilczenie: miesiąc, w którym
   * użytkownik nie wpisał kwoty gazu, wyglądałby identycznie jak miesiąc,
   * w którym gazu nie było. Ekran pokazuje to jako ostrzeżenie pod wykresem.
   */
  missingAmountCount: number;
};

/**
 * Czy dana płatność należy do przedmiotu analizy.
 *
 * Każdy wariant filtruje po INNEJ kolumnie — to cały powód istnienia typu
 * `AnalysisSubject`. „Gaz" i „Prąd" siedzą w tej samej kategorii
 * „Rachunki domowe" i rozróżnia je wyłącznie `billTemplateId`.
 */
export function matchesSubject(payment: Payment, subject: AnalysisSubject): boolean {
  switch (subject.kind) {
    case AnalysisSubjectKind.ALL_EXPENSES:
      return true;
    case AnalysisSubjectKind.MAIN_TYPE:
      return payment.mainType === subject.mainType;
    case AnalysisSubjectKind.BILL_TEMPLATE:
      return payment.billTemplateId === subject.billTemplateId;
    case AnalysisSubjectKind.SUBSCRIPTION:
      return payment.subscriptionId === subject.subscriptionId;
    case AnalysisSubjectKind.CATEGORY:
      return payment.categoryId === subject.categoryId;
    case AnalysisSubjectKind.INCOME:
      // Dochód nie jest płatnością (Etap 11) — nigdy nie pasuje.
      return false;
  }
}

type BuildSeriesInput = {
  from: YearMonth;
  to: YearMonth;
  subject: AnalysisSubject;
  payments: Payment[];
  incomes: Income[];
};

/**
 * Buduje po jednym punkcie NA KAŻDY miesiąc zakresu, także pusty.
 *
 * Miesiące bez danych muszą się znaleźć w wyniku, inaczej wykres skleiłby
 * marzec z czerwcem i wyglądałoby to na trzy kolejne miesiące. Przerwa
 * w płaceniu jest informacją, a nie brakiem informacji.
 */
export function buildSeries({
  from,
  to,
  subject,
  payments,
  incomes,
}: BuildSeriesInput): SeriesPoint[] {
  const months = monthsBetween(from, to);
  const isIncome = subject.kind === AnalysisSubjectKind.INCOME;

  return months.map((month) => {
    const key = yearMonthKey(month);

    if (isIncome) {
      const inMonth = incomes.filter((i) => i.month === key);
      return {
        month,
        key,
        totalGrosze: inMonth.reduce((total, i) => total + i.amountGrosze, 0),
        entryCount: inMonth.length,
        missingAmountCount: 0,
      };
    }

    const inMonth = payments.filter(
      (p) => p.effectiveDate.slice(0, 7) === key && matchesSubject(p, subject)
    );

    return {
      month,
      key,
      // BR-05: rekord bez kwoty nie wchodzi do sumy. Liczymy go osobno.
      totalGrosze: inMonth.reduce((total, p) => total + (p.amountGrosze ?? 0), 0),
      entryCount: inMonth.filter((p) => p.amountGrosze !== null).length,
      missingAmountCount: inMonth.filter((p) => p.amountGrosze === null).length,
    };
  });
}

export type SeriesSummary = {
  totalGrosze: number;
  /** Średnia miesięczna — patrz komentarz w `summarizeSeries`. */
  averageGrosze: number;
  /** Ile miesięcy zakresu ma jakiekolwiek dane. */
  monthsWithData: number;
  /** Długość całego zakresu w miesiącach. */
  monthCount: number;
  highest: SeriesPoint | null;
  lowest: SeriesPoint | null;
  /** Ile rachunków w całym zakresie czeka na wpisanie kwoty. */
  missingAmountCount: number;
};

/**
 * Podsumowanie szeregu: suma, średnia, najdrożej, najtaniej.
 *
 * ŚREDNIĄ LICZYMY PO MIESIĄCACH Z DANYMI, NIE PO CAŁYM ZAKRESIE.
 *
 * Rachunek za gaz z trzech miesięcy podzielony przez sześć miesięcy zakresu
 * dałby liczbę o połowę za niską — a użytkownik przeczytałby ją jako
 * „tyle płacę miesięcznie" i podjąłby na jej podstawie decyzję. Miesiąc,
 * w którym rachunku po prostu nie było, nie jest miesiącem, w którym
 * rachunek wyniósł zero złotych.
 *
 * Ta sama zasada dotyczy „najtaniej": pusty miesiąc nie jest rekordem
 * oszczędności, więc do szukania minimum bierzemy tylko miesiące z danymi.
 */
export function summarizeSeries(points: SeriesPoint[]): SeriesSummary {
  const withData = points.filter((p) => p.entryCount > 0);
  const totalGrosze = points.reduce((total, p) => total + p.totalGrosze, 0);

  return {
    totalGrosze,
    // Zaokrąglamy do pełnych groszy — średnia też jest kwotą (BR-03).
    averageGrosze: withData.length === 0 ? 0 : Math.round(totalGrosze / withData.length),
    monthsWithData: withData.length,
    monthCount: points.length,
    highest: withData.reduce<SeriesPoint | null>(
      (best, p) => (best === null || p.totalGrosze > best.totalGrosze ? p : best),
      null
    ),
    lowest: withData.reduce<SeriesPoint | null>(
      (best, p) => (best === null || p.totalGrosze < best.totalGrosze ? p : best),
      null
    ),
    missingAmountCount: points.reduce((total, p) => total + p.missingAmountCount, 0),
  };
}

export type YearSide = {
  year: number;
  totalGrosze: number;
  monthsWithData: number;
};

export type YearComparison = {
  current: YearSide;
  previous: YearSide;
  /** Bieżący rok minus poprzedni. Dodatnie = drożej niż rok temu. */
  differenceGrosze: number;
  /** Zmiana w procentach; `null`, gdy poprzedni rok był zerowy. */
  percentChange: number | null;
  /** Ile miesięcy obejmuje KAŻDA ze stron porównania. */
  monthsCompared: number;
  /** Czy poprzedni rok ma cokolwiek do porównania. */
  comparable: boolean;
};

/**
 * Zestawia rok bieżący z poprzednim.
 *
 * PORÓWNUJEMY TYLE SAMO MIESIĘCY PO OBU STRONACH.
 *
 * W sierpniu bieżący rok ma osiem miesięcy, a poprzedni dwanaście. Zestawienie
 * ich wprost pokazałoby spadek o jedną trzecią w każdej kategorii — czyli
 * nieprawdę, i to nieprawdę wyglądającą na dobrą wiadomość. Dlatego poprzedni
 * rok obcinamy do tych samych miesięcy: styczeń–sierpień kontra styczeń–sierpień.
 *
 * `throughMonth` to numer ostatniego miesiąca wchodzącego do porównania
 * (1–12) — zwykle bieżący miesiąc urządzenia.
 */
export function compareYears(
  points: SeriesPoint[],
  currentYear: number,
  throughMonth: number
): YearComparison {
  const sideFor = (year: number): YearSide => {
    const inYear = points.filter((p) => p.month.year === year && p.month.month <= throughMonth);
    return {
      year,
      totalGrosze: inYear.reduce((total, p) => total + p.totalGrosze, 0),
      monthsWithData: inYear.filter((p) => p.entryCount > 0).length,
    };
  };

  const current = sideFor(currentYear);
  const previous = sideFor(currentYear - 1);
  const differenceGrosze = current.totalGrosze - previous.totalGrosze;

  return {
    current,
    previous,
    differenceGrosze,
    // Procent od zera nie istnieje. Zamiast rysować nieskończoność mówimy
    // wprost, że nie ma czego porównywać — ekran pokazuje wtedy same kwoty.
    percentChange:
      previous.totalGrosze === 0 ? null : (differenceGrosze / previous.totalGrosze) * 100,
    monthsCompared: throughMonth,
    comparable: previous.monthsWithData > 0,
  };
}
