/**
 * Zapytania i zapisy dotyczące rachunków (5.2).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRepository } from '@/data';
import type { NewBillTemplate } from '@/data/repository';
import { MainType } from '@/domain/enums';
import { queryKeys } from '@/features/expenses/queries';
import { useMonth } from '@/features/month/month-context';

import { generateMonthlyBills } from './generate-monthly-bills';

/**
 * 5.2: lista rachunków wybranego miesiąca.
 *
 * Przed pobraniem listy uzupełniamy brakujące rachunki z aktywnych szablonów.
 * Dzięki temu AC 5.2 („po wejściu w nowy miesiąc aktywne rachunki pojawiają się
 * bez ręcznego kopiowania") działa bez żadnego zadania działającego w tle:
 * samo otwarcie ekranu wystarczy, a BR-12 pilnuje, żeby nie powstał duplikat.
 */
export function useBillsForMonth() {
  const { month } = useMonth();

  return useQuery({
    queryKey: queryKeys.paymentsForMonth(month, MainType.BILL),
    queryFn: async () => {
      const repository = getRepository();
      await generateMonthlyBills(repository, month);
      return repository.listPaymentsForMonth(month, MainType.BILL);
    },
  });
}

/** Pojedynczy rachunek — ekran szczegółów (5.2). */
export function useBill(id: number) {
  return useQuery({
    queryKey: queryKeys.payment(id),
    queryFn: () => getRepository().getPayment(id),
  });
}

/** 5.2: historia wcześniejszych kwot tego samego rachunku. */
export function useBillAmountHistory(billTemplateId: number | null) {
  return useQuery({
    queryKey: ['expenses', 'billAmountHistory', billTemplateId ?? 'none'] as const,
    queryFn: () =>
      billTemplateId === null
        ? Promise.resolve([])
        : getRepository().listBillAmountHistory(billTemplateId),
  });
}

/** Lista aktywnych szablonów rachunków (7.3). */
export function useBillTemplates() {
  return useQuery({
    queryKey: queryKeys.billTemplates(),
    queryFn: () => getRepository().listBillTemplates(),
  });
}

/** 5.2: „Przycisk dodawania pozwala utworzyć nowy typ rachunku cyklicznego." */
export function useCreateBillTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NewBillTemplate) => getRepository().createBillTemplate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
  });
}
