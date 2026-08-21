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
      const repository = await getRepository();
      await generateMonthlyBills(repository, month);
      return repository.listPaymentsForMonth(month, MainType.BILL);
    },
  });
}

/** Pojedynczy rachunek — ekran szczegółów (5.2). */
export function useBill(id: number) {
  return useQuery({
    queryKey: queryKeys.payment(id),
    queryFn: async () => (await getRepository()).getPayment(id),
  });
}

/** 5.2: historia wcześniejszych kwot tego samego rachunku. */
export function useBillAmountHistory(billTemplateId: number | null) {
  return useQuery({
    queryKey: ['expenses', 'billAmountHistory', billTemplateId ?? 'none'] as const,
    queryFn: async () => {
      if (billTemplateId === null) return [];
      return (await getRepository()).listBillAmountHistory(billTemplateId);
    },
  });
}

/** Lista aktywnych szablonów rachunków (7.3). */
export function useBillTemplates() {
  return useQuery({
    queryKey: queryKeys.billTemplates(),
    queryFn: async () => (await getRepository()).listBillTemplates(),
  });
}

/** Wszystkie szablony, także wyłączone — ekran zarządzania (7.5). */
export function useAllBillTemplates() {
  return useQuery({
    queryKey: [...queryKeys.billTemplates(), 'all'] as const,
    queryFn: async () => (await getRepository()).listBillTemplates(true),
  });
}

/**
 * Włącza lub wyłącza rachunek cykliczny.
 *
 * 7.5 / BR-07: wyłączenie NIE kasuje szablonu ani zapisanych płatności —
 * historia poprzednich miesięcy zostaje nietknięta, przestają tylko
 * powstawać nowe rekordy.
 */
export function useSetBillTemplateActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await getRepository()).updateBillTemplate(id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

/** 5.2: „Przycisk dodawania pozwala utworzyć nowy typ rachunku cyklicznego." */
export function useCreateBillTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewBillTemplate) => (await getRepository()).createBillTemplate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
  });
}
