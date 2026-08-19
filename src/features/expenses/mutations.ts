/**
 * Zapisywanie zmian — warstwa Application (8.1).
 *
 * AC 5.1: „Po dodaniu wydatku suma odpowiedniej karty zmienia się
 * bez restartu aplikacji."
 * AC 5.7: „Po edycji historia pokazuje zmienione dane bez ponownego
 * uruchomienia."
 *
 * Realizuje to `invalidateQueries`. Po udanym zapisie mówimy TanStack Query:
 * „dane, które trzymasz, są nieaktualne". Biblioteka sama pobiera je ponownie
 * dla każdego widocznego ekranu — nie musimy ręcznie przekazywać zmian
 * między ekranem szczegółów a ekranem głównym.
 *
 * Unieważniamy CAŁĄ gałąź `['expenses']`, a nie pojedyncze klucze.
 * Jedna zmiana kwoty rachunku wpływa na sumę na ekranie głównym, listę
 * rachunków, historię i sumy podkategorii — wyliczanie za każdym razem,
 * które dokładnie klucze ucierpiały, byłoby łatwe do pomylenia,
 * a koszt ponownego zapytania do lokalnych danych jest znikomy.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getRepository } from '@/data';
import type { NewPayment, PaymentPatch } from '@/data/repository';
import { MainType } from '@/domain/enums';
import { todayIso } from '@/lib/date';

import { queryKeys } from './queries';

/** Unieważnia wszystkie dane finansowe po zapisie. */
function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.all });
}

/**
 * Tworzy własną podkategorię (decyzja do 12.1).
 *
 * Nowa podkategoria od razu obsługuje subskrypcje I zakupy — wspólna lista
 * jest warunkiem tego, żeby przyszła analiza mogła je zsumować.
 */
export function useCreateCategory() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: (name: string) =>
      getRepository().createCategory({
        name,
        usedBy: [MainType.SUBSCRIPTION, MainType.PURCHASE],
        iconKey: 'pricetag-outline',
        isActive: true,
      }),
    onSuccess: invalidate,
  });
}

/** Tworzy nową płatność (5.5: ręczne dodanie wydatku). */
export function useCreatePayment() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: (input: NewPayment) => getRepository().createPayment(input),
    onSuccess: invalidate,
  });
}

/** Zmienia istniejącą płatność — np. uzupełnienie kwoty rachunku (5.2). */
export function useUpdatePayment() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: PaymentPatch }) =>
      getRepository().updatePayment(id, patch),
    onSuccess: invalidate,
  });
}

/**
 * 5.2: „Oznacz jako opłacony".
 * AC 5.2: „Rachunek oznaczony jako opłacony zachowuje datę opłacenia."
 * Status wyliczy się sam z obecności paidDate (BR-11).
 */
export function useMarkBillAsPaid() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: (id: number) => getRepository().updatePayment(id, { paidDate: todayIso() }),
    onSuccess: invalidate,
  });
}

/** Cofa oznaczenie rachunku jako opłaconego. */
export function useMarkBillAsUnpaid() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: (id: number) => getRepository().updatePayment(id, { paidDate: null }),
    onSuccess: invalidate,
  });
}

/**
 * 5.8: usunięcie płatności.
 * AC 5.7: „Usunięta płatność znika z historii i wszystkich sum."
 */
export function useDeletePayment() {
  const invalidate = useInvalidateExpenses();

  return useMutation({
    mutationFn: (id: number) => getRepository().deletePayment(id),
    onSuccess: invalidate,
  });
}
