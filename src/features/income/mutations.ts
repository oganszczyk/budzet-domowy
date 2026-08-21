/**
 * Etap 11: zapisywanie dochodów — warstwa Application (8.1).
 *
 * Jak przy wydatkach, po każdym zapisie unieważniamy całą gałąź
 * `['expenses']`. Dochód wpływa na budżet, ten na wykres ekranu głównego —
 * a wyliczanie, które dokładnie klucze ucierpiały, byłoby łatwe do pomylenia
 * przy znikomym zysku (dane są lokalne).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getRepository } from '@/data';
import type { IncomePatch, NewIncome } from '@/data/repository';
import { queryKeys } from '@/features/expenses/queries';
import { useMonth } from '@/features/month/month-context';
import { addMonths, yearMonthKey } from '@/lib/date';

/** Unieważnia dane finansowe po zapisie dochodu. */
function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.all });
}

export function useCreateIncome() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: async (input: NewIncome) => (await getRepository()).createIncome(input),
    onSuccess: invalidate,
  });
}

export function useUpdateIncome() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: IncomePatch }) =>
      (await getRepository()).updateIncome(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteIncome() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: async (id: number) => (await getRepository()).deleteIncome(id),
    onSuccess: invalidate,
  });
}

/**
 * Przepisuje dochody z poprzedniego miesiąca na wybrany.
 *
 * Wypłaty w większości domów powtarzają się co miesiąc z tymi samymi
 * nazwiskami i podobnymi kwotami. Bez tej funkcji każdy pierwszy dzień
 * miesiąca zaczynałby się od przepisywania tej samej listy ręcznie —
 * a funkcja, która wymaga żmudnej obsługi, przestaje być używana
 * i wykres budżetu robi się bezużyteczny.
 *
 * Kopiujemy kwoty, bo są punktem wyjścia; poprawienie jednej liczby jest
 * szybsze niż wpisanie wszystkiego od nowa.
 *
 * Zwraca liczbę przepisanych pozycji — ekran ma powiedzieć, co się stało.
 */
export function useCopyIncomesFromPreviousMonth() {
  const invalidate = useInvalidateExpenses();
  const { month } = useMonth();

  return useMutation({
    mutationFn: async (): Promise<number> => {
      const repository = await getRepository();

      // Nie dokładamy do niepustej listy — użytkownik dostałby duplikaty
      // każdego domownika i musiałby je kasować pojedynczo.
      const existing = await repository.listIncomes(month);
      if (existing.length > 0) return 0;

      const previous = await repository.listIncomes(addMonths(month, -1));
      const targetMonth = yearMonthKey(month);

      for (const income of previous) {
        await repository.createIncome({
          personName: income.personName,
          amountGrosze: income.amountGrosze,
          month: targetMonth,
        });
      }

      return previous.length;
    },
    onSuccess: invalidate,
  });
}
