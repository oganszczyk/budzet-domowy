/**
 * Etap 11: budżet miesiąca — ile wpłynęło, ile wyszło, ile zostało.
 *
 * Czyste wyliczenie: dostaje liczby, zwraca liczby. Nie zna bazy, nie zna
 * Reacta, nie rysuje. Dzięki temu reguły „co znaczy zostało" i „jak dzieli
 * się pierścień wykresu" da się przetestować bez uruchamiania aplikacji —
 * a to są dokładnie te reguły, w których łatwo o cichy błąd.
 *
 * BR-03 obowiązuje tak samo jak wszędzie: wszystko w groszach, liczby
 * całkowite. Jedynym ułamkiem jest udział wycinka pierścienia, który nie
 * jest kwotą i nigdy nie wraca do bazy.
 */

import type { MonthlyTotals } from '@/domain/models';

/** Co składa się na pierścień wykresu. */
export const BudgetSliceKey = {
  BILLS: 'BILLS',
  SUBSCRIPTIONS: 'SUBSCRIPTIONS',
  PURCHASES: 'PURCHASES',
  /** Niewydana część dochodu. */
  REMAINING: 'REMAINING',
} as const;
// Ta sama nazwa jako wartość i jako typ — wzorzec z `src/domain/enums.ts`.
// TypeScript trzyma jedno i drugie w osobnych przestrzeniach nazw, więc to
// nie jest kolizja; ESLint tego nie rozróżnia i zgłasza fałszywy alarm.
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type BudgetSliceKey = (typeof BudgetSliceKey)[keyof typeof BudgetSliceKey];

export type MonthlyBudget = {
  incomeGrosze: number;
  billsGrosze: number;
  subscriptionsGrosze: number;
  purchasesGrosze: number;
  /** Suma trzech kategorii głównych (BR-01). */
  spentGrosze: number;
  /** Dochód minus wydatki. Ujemne, gdy wydano więcej, niż wpłynęło. */
  remainingGrosze: number;
  /** Czy użytkownik wpisał jakikolwiek dochód na ten miesiąc. */
  hasIncome: boolean;
  /** Czy wydatki przekroczyły dochód. */
  isOverspent: boolean;
};

/** Jeden wycinek pierścienia: co to jest i jaką część obwodu zajmuje. */
export type BudgetSlice = {
  key: BudgetSliceKey;
  amountGrosze: number;
  /** Udział w pełnym pierścieniu, od 0 do 1. */
  fraction: number;
};

export function computeMonthlyBudget(totals: MonthlyTotals, incomeGrosze: number): MonthlyBudget {
  const spentGrosze = totals.billsGrosze + totals.subscriptionsGrosze + totals.purchasesGrosze;

  return {
    incomeGrosze,
    billsGrosze: totals.billsGrosze,
    subscriptionsGrosze: totals.subscriptionsGrosze,
    purchasesGrosze: totals.purchasesGrosze,
    spentGrosze,
    remainingGrosze: incomeGrosze - spentGrosze,
    hasIncome: incomeGrosze > 0,
    isOverspent: spentGrosze > incomeGrosze,
  };
}

/**
 * Dzieli pierścień wykresu na wycinki.
 *
 * PODSTAWĄ PIERŚCIENIA JEST WIĘKSZA Z DWÓCH LICZB: dochód albo wydatki.
 *
 * Gdyby podstawą był zawsze dochód, przekroczenie budżetu dałoby wycinki
 * sumujące się do więcej niż pełny okrąg — wykres zacząłby rysować drugą
 * warstwę na pierwszej i pokazywałby nieprawdę. Gdyby podstawą były zawsze
 * wydatki, zniknęłaby informacja „ile jeszcze zostało", czyli to, po co
 * ten wykres w ogóle powstał.
 *
 * Przy takim wyborze pierścień czyta się jednoznacznie w obu sytuacjach:
 *  - mieścisz się w budżecie → widać kolorowe wydatki i szarą resztę,
 *  - przekroczyłeś → pierścień jest w całości wypełniony wydatkami.
 *
 * Wycinki zerowe są pomijane — wycinek o zerowej długości nie jest widoczny,
 * a zaśmiecałby legendę.
 */
export function budgetSlices(budget: MonthlyBudget): BudgetSlice[] {
  const base = Math.max(budget.incomeGrosze, budget.spentGrosze);

  // Pusty miesiąc: brak dochodu i brak wydatków. Nie ma czego dzielić,
  // a dzielenie przez zero dałoby NaN w każdym wycinku.
  if (base <= 0) return [];

  const entries: { key: BudgetSliceKey; amountGrosze: number }[] = [
    { key: BudgetSliceKey.BILLS, amountGrosze: budget.billsGrosze },
    { key: BudgetSliceKey.SUBSCRIPTIONS, amountGrosze: budget.subscriptionsGrosze },
    { key: BudgetSliceKey.PURCHASES, amountGrosze: budget.purchasesGrosze },
    // Przy przekroczeniu budżetu reszta jest ujemna — wtedy nie ma wycinka.
    { key: BudgetSliceKey.REMAINING, amountGrosze: Math.max(budget.remainingGrosze, 0) },
  ];

  return entries
    .filter((entry) => entry.amountGrosze > 0)
    .map((entry) => ({ ...entry, fraction: entry.amountGrosze / base }));
}
