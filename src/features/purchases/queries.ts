/**
 * Zapytania dotyczące zakupów (5.4, 5.5).
 */

import { useQuery } from '@tanstack/react-query';

import { getRepository } from '@/data';
import { MainType } from '@/domain/enums';
import { queryKeys } from '@/features/expenses/queries';
import { useMonth } from '@/features/month/month-context';

/** 5.4: podkategorie zakupów wraz z ich miesięcznymi sumami. */
export function usePurchaseCategoryTotals() {
  const { month } = useMonth();

  return useQuery({
    queryKey: queryKeys.categoryTotals(month, MainType.PURCHASE),
    queryFn: () => getRepository().getCategoryTotals(month, MainType.PURCHASE),
  });
}

/** 5.4: lista zakupów przypisanych do jednej podkategorii. */
export function usePurchasesInCategory(categoryId: number) {
  const { month } = useMonth();

  return useQuery({
    queryKey: ['expenses', 'purchasesInCategory', month.year, month.month, categoryId] as const,
    queryFn: async () => {
      const repository = getRepository();
      const [category, payments] = await Promise.all([
        repository.getCategory(categoryId),
        repository.listPaymentsForCategory(month, categoryId, MainType.PURCHASE),
      ]);
      return { category, payments };
    },
  });
}

/** Pojedyncza płatność — ekran szczegółów (5.8). */
export function usePayment(id: number) {
  return useQuery({
    queryKey: queryKeys.payment(id),
    queryFn: () => getRepository().getPayment(id),
  });
}
