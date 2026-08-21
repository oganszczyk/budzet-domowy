/**
 * Zapytania o dane — warstwa Application (8.1).
 *
 * Ekrany nie wołają repozytorium bezpośrednio. Używają tych hooków,
 * a TanStack Query zajmuje się pamięcią podręczną i ponownym pobraniem
 * danych, gdy coś się zmieni.
 *
 * Klucze zapytań (`queryKeys`) zawierają wybrany miesiąc. To dzięki temu
 * przełączenie miesiąca automatycznie pobiera inne sumy (BR-09), a my
 * nie musimy pisać żadnej logiki odświeżania.
 */

import { useQuery } from '@tanstack/react-query';

import { getRepository } from '@/data';
import type { MainType } from '@/domain/enums';
import { useMonth } from '@/features/month/month-context';
import type { YearMonth } from '@/lib/date';

/**
 * Klucze pamięci podręcznej.
 *
 * Trzymamy je w jednym miejscu, bo przy zapisie danych będziemy musieli
 * powiedzieć „unieważnij te zapytania" — a literówka w kluczu oznaczałaby,
 * że suma na ekranie się nie odświeży.
 */
export const queryKeys = {
  all: ['expenses'] as const,
  categories: (mainType?: MainType) => ['expenses', 'categories', mainType ?? 'all'] as const,
  monthlyTotals: (month: YearMonth) =>
    ['expenses', 'monthlyTotals', month.year, month.month] as const,
  categoryTotals: (month: YearMonth, mainType: MainType) =>
    ['expenses', 'categoryTotals', month.year, month.month, mainType] as const,
  paymentsForMonth: (month: YearMonth, mainType?: MainType) =>
    ['expenses', 'payments', month.year, month.month, mainType ?? 'all'] as const,
  history: () => ['expenses', 'history'] as const,
  payment: (id: number) => ['expenses', 'payment', id] as const,
  billTemplates: () => ['expenses', 'billTemplates'] as const,
  subscriptions: () => ['expenses', 'subscriptions'] as const,
};

/** 5.1: trzy sumy na karty ekranu głównego, dla aktualnie wybranego miesiąca. */
export function useMonthlyTotals() {
  const { month } = useMonth();

  return useQuery({
    queryKey: queryKeys.monthlyTotals(month),
    queryFn: async () => (await getRepository()).getMonthlyTotals(month),
  });
}

/** 5.4: sumy podkategorii w wybranym miesiącu. */
export function useCategoryTotals(mainType: MainType) {
  const { month } = useMonth();

  return useQuery({
    queryKey: queryKeys.categoryTotals(month, mainType),
    queryFn: async () => (await getRepository()).getCategoryTotals(month, mainType),
  });
}

/** Płatności wybranego miesiąca, opcjonalnie jednego typu. */
export function usePaymentsForMonth(mainType?: MainType) {
  const { month } = useMonth();

  return useQuery({
    queryKey: queryKeys.paymentsForMonth(month, mainType),
    queryFn: async () => (await getRepository()).listPaymentsForMonth(month, mainType),
  });
}

/** 5.7: wspólna historia wszystkich płatności. */
export function useHistory() {
  return useQuery({
    queryKey: queryKeys.history(),
    queryFn: async () => (await getRepository()).listHistory(),
  });
}

/** Lista kategorii, opcjonalnie tylko jednej kategorii głównej. */
export function useCategories(mainType?: MainType) {
  return useQuery({
    queryKey: queryKeys.categories(mainType),
    queryFn: async () => (await getRepository()).listCategories(mainType),
  });
}
