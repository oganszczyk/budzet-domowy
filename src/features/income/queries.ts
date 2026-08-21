/**
 * Etap 11: odczyt dochodów i wyliczonego budżetu — warstwa Application (8.1).
 *
 * BR-09 obowiązuje tak samo jak przy wydatkach: wszystko dotyczy wybranego
 * miesiąca, więc miesiąc jest częścią klucza pamięci podręcznej i przełączenie
 * go pobiera inne dane bez żadnej dodatkowej logiki.
 */

import { useQuery } from '@tanstack/react-query';

import { getRepository } from '@/data';
import { computeMonthlyBudget, type MonthlyBudget } from '@/features/budget/monthly-budget';
import { queryKeys } from '@/features/expenses/queries';
import { useMonth } from '@/features/month/month-context';

/** Lista dochodów wpisanych na wybrany miesiąc. */
export function useIncomes() {
  const { month } = useMonth();

  return useQuery({
    queryKey: queryKeys.incomes(month),
    queryFn: async () => (await getRepository()).listIncomes(month),
  });
}

/**
 * Budżet wybranego miesiąca: dochody, wydatki i to, co zostało.
 *
 * Łączymy dwa zapytania w jednym haku, zamiast wołać je osobno w ekranie.
 * Powód jest praktyczny: ekran główny rysuje z tego JEDEN wykres, a wykres
 * narysowany z połowy danych — na przykład z wydatkami, ale jeszcze bez
 * dochodu — pokazałby na moment przekroczony budżet, którego nie ma.
 *
 * 5.1: „Brak danych jest prezentowany jako 0,00 zł, bez komunikatu błędu."
 * Dlatego zanim dane dojdą, zwracamy budżet zerowy, a nie `undefined`.
 */
export function useMonthlyBudget(): { data: MonthlyBudget; isLoaded: boolean } {
  const { month } = useMonth();

  const totals = useQuery({
    queryKey: queryKeys.monthlyTotals(month),
    queryFn: async () => (await getRepository()).getMonthlyTotals(month),
  });

  const income = useQuery({
    queryKey: queryKeys.incomeTotal(month),
    queryFn: async () => (await getRepository()).getMonthlyIncomeTotal(month),
  });

  const budget = computeMonthlyBudget(
    totals.data ?? { billsGrosze: 0, subscriptionsGrosze: 0, purchasesGrosze: 0 },
    income.data ?? 0
  );

  return { data: budget, isLoaded: totals.isSuccess && income.isSuccess };
}
