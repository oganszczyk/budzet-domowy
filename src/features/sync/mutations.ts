/**
 * Etap 14c: haki ekranu konta — warstwa Application (8.1).
 *
 * Ekran nie zna ani Supabase, ani repozytorium. Pyta stąd „ile czeka" i mówi
 * „wyślij", a w odpowiedzi dostaje wynik opisany własnym typem, nie wyjątek.
 *
 * Tak samo, jak przy kopii zapasowej: „nie udało się" ma tu kilka RÓŻNYCH
 * znaczeń, a każde prowadzi użytkownika do czegoś innego. Brak internetu
 * znaczy „spróbuj później", brak tabel — „uruchom plik SQL na komputerze".
 * Zwykły `throw` sprowadziłby jedno i drugie do „coś poszło nie tak".
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRepository } from '@/data';

import { countPendingChanges, pushPendingChanges, type SyncOutcome } from './sync-service';

export const syncQueryKeys = {
  pendingCount: () => ['sync', 'pendingCount'] as const,
};

/**
 * Ile rekordów czeka na wysłanie.
 *
 * Liczba jest po to, żeby przycisk nie był ślepy. „Wyślij" bez niczego
 * obok każe zgadywać, czy w ogóle jest co wysyłać, a po naciśnięciu —
 * czy coś się w ogóle stało.
 */
export function usePendingSyncCount() {
  return useQuery({
    queryKey: syncQueryKeys.pendingCount(),
    queryFn: async () => countPendingChanges(await getRepository()),
  });
}

/**
 * Wysyła na serwer wszystko, czego jeszcze tam nie ma.
 *
 * Unieważnia wyłącznie licznik oczekujących. Wysyłka niczego nie zmienia
 * w danych — te same wydatki, te same sumy — więc odświeżanie ekranu
 * głównego byłoby pracą bez powodu.
 */
export function usePushToCloud() {
  const queryClient = useQueryClient();

  return useMutation<SyncOutcome>({
    mutationFn: async () => pushPendingChanges(await getRepository()),
    onSettled: () => {
      // Także po niepowodzeniu: część rekordów mogła dojechać przed awarią
      // i licznik musi to pokazać, zamiast straszyć starą liczbą.
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.pendingCount() });
    },
  });
}
