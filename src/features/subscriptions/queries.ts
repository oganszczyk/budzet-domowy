/**
 * Zapytania i zapisy dotyczące subskrypcji (5.3).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRepository } from '@/data';
import type { NewSubscription, SubscriptionPatch } from '@/data/repository';
import { MainType } from '@/domain/enums';
import { queryKeys } from '@/features/expenses/queries';
import { useMonth } from '@/features/month/month-context';
import { todayIso } from '@/lib/date';

import { generateSubscriptionPayments } from './generate-subscription-payments';

/**
 * Lista subskrypcji wraz z płatnościami wybranego miesiąca.
 *
 * Tak jak przy rachunkach, generator uruchamiamy przy otwarciu ekranu —
 * dzięki temu wejście w kolejny miesiąc od razu pokazuje należne płatności,
 * a rejestr wygenerowanych rekordów chroni przed duplikatami (BR-12).
 */
export function useSubscriptionsScreen() {
  const { month } = useMonth();

  return useQuery({
    queryKey: ['expenses', 'subscriptionsScreen', month.year, month.month] as const,
    queryFn: async () => {
      const repository = await getRepository();
      await generateSubscriptionPayments(repository, month);

      const [subscriptions, payments] = await Promise.all([
        repository.listSubscriptions(),
        repository.listPaymentsForMonth(month, MainType.SUBSCRIPTION),
      ]);

      return { subscriptions, payments };
    },
  });
}

/** Pojedyncza subskrypcja — ekran szczegółów. */
export function useSubscription(id: number) {
  return useQuery({
    queryKey: ['expenses', 'subscription', id] as const,
    queryFn: async () => (await getRepository()).getSubscription(id),
  });
}

function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.all });
}

/** 5.3: „Przycisk dodawania otwiera formularz nowej subskrypcji." */
export function useCreateSubscription() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: async (input: NewSubscription) => (await getRepository()).createSubscription(input),
    onSuccess: invalidate,
  });
}

/**
 * Zmiana danych subskrypcji.
 *
 * BR-07: dotyczy wyłącznie przyszłych płatności. Zapisane rekordy mają
 * własną kopię kwoty i pozostają nietknięte (AC 5.3).
 */
export function useUpdateSubscription() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: SubscriptionPatch }) =>
      (await getRepository()).updateSubscription(id, patch),
    onSuccess: invalidate,
  });
}

/**
 * 5.3: „Zakończenie subskrypcji nie usuwa wcześniejszych płatności z historii."
 * Dlatego ustawiamy isActive=false, a nie kasujemy rekordu.
 */
export function useEndSubscription() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: async (id: number) =>
      (await getRepository()).updateSubscription(id, { isActive: false }),
    onSuccess: invalidate,
  });
}

/** Wznowienie zakończonej subskrypcji. */
export function useResumeSubscription() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: async (id: number) =>
      (await getRepository()).updateSubscription(id, {
        isActive: true,
        lastUsageConfirmationDate: todayIso(),
      }),
    onSuccess: invalidate,
  });
}

/**
 * 5.3: odpowiedź „Tak" na pytanie kontrolne.
 * Zapisujemy datę potwierdzenia, więc pytanie wróci dopiero po kolejnym okresie.
 */
export function useConfirmSubscriptionUsage() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: async (id: number) =>
      (await getRepository()).updateSubscription(id, { lastUsageConfirmationDate: todayIso() }),
    onSuccess: invalidate,
  });
}
