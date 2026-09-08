/**
 * Etap 12: przedmiot analizy i zakres czasu.
 *
 * Specyfikacja (5.9) celowo nie opisała tego ekranu — wymagała jedynie,
 * żeby architektura zostawiła miejsce „na filtrowanie analiz po miesiącu
 * i kategorii". Ten plik jest tym miejscem.
 *
 * DLACZEGO OSOBNY TYP, A NIE PO PROSTU `categoryId`
 *
 * „Gaz", „Prąd" i „Woda" NIE są kategoriami. Wszystkie trzy należą do jednej
 * kategorii „Rachunki domowe" (BR-02 wymaga podkategorii wyłącznie dla
 * zakupów), a rozróżnia je `billTemplateId`. Gdyby analiza filtrowała po
 * samym `categoryId`, zapytanie „ile płacę za gaz" byłoby niewykonalne —
 * a to jest dokładnie pytanie, od którego ten ekran się zaczął.
 *
 * Stąd `AnalysisSubject`: typ, który mówi, PO KTÓRYM POLU filtrujemy.
 * Każdy wariant odpowiada innej kolumnie w tabeli płatności.
 */

import type { MainType } from './enums';

/** Po czym filtrujemy płatności przy budowaniu zestawienia. */
export const AnalysisSubjectKind = {
  /** Suma wszystkich trzech kategorii głównych (BR-01). */
  ALL_EXPENSES: 'ALL_EXPENSES',
  /** Jedna kategoria główna: rachunki, subskrypcje albo zakupy. */
  MAIN_TYPE: 'MAIN_TYPE',
  /** Jeden rachunek cykliczny — „Gaz", „Prąd", „Woda". */
  BILL_TEMPLATE: 'BILL_TEMPLATE',
  /** Jedna subskrypcja — „Netflix". */
  SUBSCRIPTION: 'SUBSCRIPTION',
  /** Jedna podkategoria zakupów lub subskrypcji — „Jedzenie". */
  CATEGORY: 'CATEGORY',
  /** Dochody domowników (Etap 11) — jedyny przedmiot, który nie jest wydatkiem. */
  INCOME: 'INCOME',
} as const;
// Ta sama nazwa jako wartość i jako typ — wzorzec z `src/domain/enums.ts`.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type AnalysisSubjectKind = (typeof AnalysisSubjectKind)[keyof typeof AnalysisSubjectKind];

/**
 * Co dokładnie analizujemy.
 *
 * Typ rozłączny (każdy wariant ma inne pole), więc TypeScript wymusza
 * obsłużenie wszystkich przypadków i nie da się przez pomyłkę zapytać
 * o `billTemplateId` przy analizie dochodów.
 */
export type AnalysisSubject =
  | { kind: typeof AnalysisSubjectKind.ALL_EXPENSES }
  | { kind: typeof AnalysisSubjectKind.MAIN_TYPE; mainType: MainType }
  | { kind: typeof AnalysisSubjectKind.BILL_TEMPLATE; billTemplateId: number }
  | { kind: typeof AnalysisSubjectKind.SUBSCRIPTION; subscriptionId: number }
  | { kind: typeof AnalysisSubjectKind.CATEGORY; categoryId: number }
  | { kind: typeof AnalysisSubjectKind.INCOME };

/**
 * Tryb porównania czasu.
 *
 * Decyzja właściciela projektu (27.08.2026): tylko te dwa. Świadomie NIE ma
 * gotowych przycisków „ostatnie 6 miesięcy" ani „ostatnie 12 miesięcy" —
 * własny zakres obejmuje oba, a każdy dodatkowy przycisk to kolejna rzecz
 * do przeczytania na ekranie, który ma być czysty.
 */
export const AnalysisRangeMode = {
  /** Ten rok kalendarzowy zestawiony z poprzednim. */
  YEAR_OVER_YEAR: 'YEAR_OVER_YEAR',
  /** Dowolny ciąg miesięcy wskazany przez użytkownika. */
  CUSTOM: 'CUSTOM',
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type AnalysisRangeMode = (typeof AnalysisRangeMode)[keyof typeof AnalysisRangeMode];

/**
 * Etap 13: zestawienie zapisane pod własną nazwą.
 *
 * ZAPISUJEMY DŁUGOŚĆ OKNA, NIE KONKRETNE MIESIĄCE.
 *
 * Decyzja właściciela projektu (04.09.2026). Gdyby zestawienie pamiętało
 * „marzec–sierpień 2026", to za miesiąc pokazywałoby dokładnie to samo —
 * migawkę z przeszłości. Użytkownik zakłada je raz i chce zaglądać co
 * miesiąc, więc okno musi przesuwać się razem z kalendarzem: sześć miesięcy
 * wstecz od dzisiaj, cokolwiek dzisiaj znaczy.
 *
 * Przedmiot analizy trzymamy jako `subjectKey` — ten sam tekst, którym
 * posługuje się adres ekranu („BILL_TEMPLATE:3"). Rozbicie go na kolumny
 * kusiło, ale nie da się tego zrobić jedną kolumną liczbową: wariant
 * MAIN_TYPE niesie napis („BILL"), a nie identyfikator. Dwie kolumny
 * o zmiennym znaczeniu byłyby gorsze niż jeden tekst, który ma już
 * funkcje zapisu i odczytu wraz z testami.
 */
export type SavedReport = {
  id: number;
  /** Nazwa nadana przez użytkownika, np. „Gaz w czasie". */
  name: string;
  /** Przedmiot analizy w zapisie `subjectKey`. */
  subjectKey: string;
  rangeMode: AnalysisRangeMode;
  /**
   * Ile miesięcy obejmuje przesuwające się okno.
   * `null` dla trybu „rok do roku", który sam wie, co porównuje.
   */
  windowMonths: number | null;
  /** Kolejność na liście; nowe trafiają na koniec. */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Najkrótsze i najdłuższe sensowne okno zestawienia. */
export const MIN_WINDOW_MONTHS = 2;
export const MAX_WINDOW_MONTHS = 36;
