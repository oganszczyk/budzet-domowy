/**
 * 8: „Zdjęcia — lokalny katalog aplikacji; baza przechowuje wyłącznie ścieżkę."
 * 5.6: „Zdjęcie paragonu może zostać zapisane lokalnie jako opcjonalny załącznik."
 *
 * Wybrane zdjęcie ląduje najpierw w katalogu tymczasowym, który system może
 * wyczyścić w dowolnym momencie. Dlatego kopiujemy je do katalogu dokumentów
 * aplikacji — inaczej ścieżka w bazie po jakimś czasie prowadziłaby donikąd.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const RECEIPTS_DIRECTORY = `${FileSystem.documentDirectory ?? ''}paragony/`;

/**
 * Kopiuje zdjęcie paragonu do trwałego katalogu aplikacji i zwraca nową ścieżkę.
 * Zwraca `null`, gdy zapis się nie uda — zdjęcie jest opcjonalne, więc jego
 * brak nie może przerwać zapisywania wydatku.
 */
export async function saveReceiptImage(sourceUri: string): Promise<string | null> {
  // W przeglądarce nie ma katalogu dokumentów; zdjęcie zostaje tam,
  // gdzie umieściła je przeglądarka (blob URL).
  if (Platform.OS === 'web') return sourceUri;

  try {
    const directory = await FileSystem.getInfoAsync(RECEIPTS_DIRECTORY);
    if (!directory.exists) {
      await FileSystem.makeDirectoryAsync(RECEIPTS_DIRECTORY, { intermediates: true });
    }

    const extension = sourceUri.split('.').pop()?.split('?')[0] ?? 'jpg';
    const target = `${RECEIPTS_DIRECTORY}paragon-${Date.now()}.${extension}`;

    await FileSystem.copyAsync({ from: sourceUri, to: target });
    return target;
  } catch {
    return null;
  }
}

/** Usuwa zdjęcie paragonu, gdy płatność zostaje skasowana. */
export async function deleteReceiptImage(path: string | null): Promise<void> {
  if (!path || Platform.OS === 'web') return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    // Brak zdjęcia nie jest błędem, który użytkownik miałby naprawiać.
  }
}
