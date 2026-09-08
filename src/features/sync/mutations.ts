/**
 * Etap 14c/14d: haki ekranu konta — warstwa Application (8.1).
 *
 * Ekran nie zna ani Supabase, ani repozytorium. Pyta stąd „ile czeka"
 * i mówi „synchronizuj", a w odpowiedzi dostaje wynik opisany własnym typem,
 * nie wyjątek.
 *
 * Tak samo, jak przy kopii zapasowej: „nie udało się" ma tu kilka RÓŻNYCH
 * znaczeń, a każde prowadzi użytkownika do czegoś innego. Brak internetu
 * znaczy „spróbuj później", brak tabel — „uruchom plik SQL na komputerze".
 * Zwykły `throw` sprowadziłby jedno i drugie do „coś poszło nie tak".
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getRepository } from '@/data';
import { queryKeys } from '@/features/expenses/queries';

import { countPendingChanges, synchronize, type SyncOutcomeFull } from './sync-service';

export const syncQueryKeys = {
  pendingCount: () => ['sync', 'pendingCount'] as const,
};

/**
 * Ile rekordów czeka na wysłanie.
 *
 * Liczba jest po to, żeby przycisk nie był ślepy. Sam „Synchronizuj" nie mówi
 * ani przed naciśnięciem, czy jest co wysyłać, ani po nim, czy cokolwiek się
 * stało.
 */
export function usePendingSyncCount() {
  return useQuery({
    queryKey: syncQueryKeys.pendingCount(),
    queryFn: async () => countPendingChanges(await getRepository()),
  });
}

/**
 * Pełna synchronizacja: wysyła własne zmiany, potem pobiera cudze.
 *
 * DLACZEGO UNIEWAŻNIAMY WSZYSTKIE ZAPYTANIA O DANE
 *
 * Do Etapu 14c synchronizacja tylko wysyłała i nie zmieniała niczego na
 * ekranie — odświeżanie byłoby pracą bez powodu. Od 14d POBIERA: po udanej
 * synchronizacji w bazie mogą być wydatki, których ekran główny jeszcze nie
 * widział, i sumy miesiąca mogą być inne. Bez unieważnienia użytkownik
 * zobaczyłby stare liczby aż do przełączenia miesiąca — i uznałby, że
 * synchronizacja nic nie przyniosła.
 */
export function useSynchronize() {
  const queryClient = useQueryClient();

  return useMutation<SyncOutcomeFull>({
    mutationFn: async () => synchronize(await getRepository()),
    onSettled: (outcome) => {
      // Także po niepowodzeniu: część zmian mogła dojechać w obie strony,
      // zanim połączenie padło.
      void queryClient.invalidateQueries({ queryKey: syncQueryKeys.pendingCount() });

      if (outcome && outcome.applied > 0) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.all });
      }
    },
  });
}
