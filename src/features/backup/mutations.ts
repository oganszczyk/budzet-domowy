/**
 * Tworzenie i odtwarzanie kopii zapasowej — warstwa Application (8.1).
 *
 * Ekran ustawień wywołuje te dwa haki i dostaje z powrotem wynik opisany
 * własnym typem, a nie wyjątek. Kopia zapasowa jest operacją, w której
 * „nie udało się" ma kilka RÓŻNYCH znaczeń — inny plik, nowsza wersja,
 * anulowanie przez użytkownika — i każde wymaga innego komunikatu.
 * Zwykły `throw` sprowadziłby je wszystkie do jednego „coś poszło nie tak".
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getRepository } from '@/data';
import { countSnapshot, type BackupCounts } from '@/domain/backup';
import { queryKeys } from '@/features/expenses/queries';

import { backupFileName, parseBackup, serializeBackup, type BackupParseError } from './backup-file';
import { pickBackupFile, writeAndShareBackup } from './backup-storage';

export type CreateBackupOutcome =
  | { ok: true; fileName: string; counts: BackupCounts }
  | { ok: false; reason: 'SHARING_UNAVAILABLE' | 'WRITE_FAILED' };

/**
 * Zbiera dane, zapisuje plik i otwiera okno „Udostępnij".
 *
 * Nie unieważnia żadnych zapytań — tworzenie kopii niczego nie zmienia.
 */
export function useCreateBackup() {
  return useMutation<CreateBackupOutcome>({
    mutationFn: async () => {
      const snapshot = await (await getRepository()).exportSnapshot();

      const createdAt = new Date().toISOString();
      const fileName = backupFileName(createdAt);
      const text = serializeBackup(snapshot, createdAt);

      const shared = await writeAndShareBackup(text, fileName);
      if (!shared.ok) return { ok: false, reason: shared.reason };

      return { ok: true, fileName, counts: countSnapshot(snapshot) };
    },
  });
}

export type RestoreBackupOutcome =
  | { ok: true; fileName: string; createdAt: string; counts: BackupCounts }
  /** Użytkownik zamknął okno wyboru pliku. */
  | { ok: false; reason: 'CANCELLED' }
  | { ok: false; reason: 'READ_FAILED' }
  /** Plik wskazany, ale nie nadaje się do odtworzenia — powód z `parseBackup`. */
  | { ok: false; reason: BackupParseError };

/**
 * Wczytuje wskazany plik i ZASTĘPUJE nim całą zawartość aplikacji.
 *
 * Kolejność jest tu istotna: najpierw pełne sprawdzenie pliku, dopiero potem
 * dotknięcie bazy. Gdyby było odwrotnie, wskazanie uszkodzonego pliku
 * skasowałoby dotychczasowe dane i nie dało nic w zamian.
 */
export function useRestoreBackup() {
  const queryClient = useQueryClient();

  return useMutation<RestoreBackupOutcome>({
    mutationFn: async () => {
      const picked = await pickBackupFile();
      if (!picked.ok) return { ok: false, reason: picked.reason };

      const parsed = parseBackup(picked.text);
      if (!parsed.ok) return { ok: false, reason: parsed.reason };

      await (await getRepository()).importSnapshot(parsed.file.snapshot);

      return {
        ok: true,
        fileName: picked.fileName,
        createdAt: parsed.file.createdAt,
        counts: countSnapshot(parsed.file.snapshot),
      };
    },
    /**
     * Odtworzenie zmienia dosłownie wszystko, więc unieważniamy całą gałąź
     * `['expenses']` — ekran główny, historia i listy muszą pokazać nowe dane
     * bez restartu aplikacji, dokładnie jak po zwykłym zapisie (AC 5.1).
     *
     * Unieważniamy także wtedy, gdy odtwarzanie się nie powiodło. To celowe:
     * `importSnapshot` mógł już zacząć pracę, zanim coś poszło nie tak,
     * a odświeżenie danych z bazy jest zawsze bezpieczne.
     */
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
  });
}
