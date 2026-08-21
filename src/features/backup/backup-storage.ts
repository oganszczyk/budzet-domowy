/**
 * Zapis kopii do pliku i odczyt wskazanego pliku z powrotem.
 *
 * Cała wiedza o systemie plików, oknie „Udostępnij" i wyborze pliku siedzi
 * w tym jednym miejscu — tak samo jak wiedza o SQLite siedzi w adapterze
 * bazy. Ekran ustawień wywołuje dwie funkcje i nie wie, jak Android
 * przekazuje pliki między aplikacjami.
 *
 * DLACZEGO KATALOG TYMCZASOWY, A NIE DOKUMENTY:
 * Plik kopii jest przystankiem, nie miejscem docelowym. Prawdziwą kopią
 * staje się dopiero to, co użytkownik z nim zrobi — wyśle mailem, wrzuci
 * na dysk, zapisze w „Pliki". Trzymanie go dodatkowo w pamięci aplikacji
 * niczego nie chroni: gdy aplikacja zniknie, zniknie razem z nią.
 * Katalog tymczasowy system może posprzątać i to jest w porządku.
 */

import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

/** Wynik próby wyniesienia kopii na zewnątrz. */
export type ShareBackupResult =
  | { ok: true }
  /** Urządzenie nie potrafi udostępniać plików (dotyczy głównie przeglądarki). */
  | { ok: false; reason: 'SHARING_UNAVAILABLE' }
  | { ok: false; reason: 'WRITE_FAILED' };

/**
 * Zapisuje tekst kopii do pliku i otwiera systemowe okno „Udostępnij".
 *
 * Nie zapisujemy w wybrane przez siebie miejsce w pamięci telefonu, bo
 * aplikacja nie ma tam dostępu bez dodatkowych uprawnień — a przede wszystkim
 * dlatego, że kopia leżąca na tym samym telefonie nie chroni przed jego
 * utratą. Okno „Udostępnij" pozwala wysłać plik POZA urządzenie.
 */
export async function writeAndShareBackup(
  text: string,
  fileName: string
): Promise<ShareBackupResult> {
  const directory = FileSystem.cacheDirectory;

  if (Platform.OS === 'web' || !directory) {
    return { ok: false, reason: 'SHARING_UNAVAILABLE' };
  }

  const uri = `${directory}${fileName}`;

  try {
    await FileSystem.writeAsStringAsync(uri, text);
  } catch {
    return { ok: false, reason: 'WRITE_FAILED' };
  }

  if (!(await Sharing.isAvailableAsync())) {
    return { ok: false, reason: 'SHARING_UNAVAILABLE' };
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: fileName,
    UTI: 'public.json',
  });

  return { ok: true };
}

export type PickBackupResult =
  | { ok: true; text: string; fileName: string }
  /** Użytkownik zamknął okno wyboru — to nie jest błąd. */
  | { ok: false; reason: 'CANCELLED' }
  | { ok: false; reason: 'READ_FAILED' };

/**
 * Prosi użytkownika o wskazanie pliku kopii i zwraca jego zawartość.
 *
 * Celowo NIE zawężamy okna wyboru do typu `application/json`. Plik, który
 * przeszedł przez pocztę, komunikator albo dysk w chmurze, wraca na telefon
 * z typem `application/octet-stream` albo bez typu w ogóle — filtr wyszarzyłby
 * wtedy właściwą kopię i użytkownik nie mógłby jej wskazać. Zawartość i tak
 * sprawdza `parseBackup`, więc wskazanie zdjęcia kończy się czytelnym
 * komunikatem, a nie uszkodzeniem danych.
 */
export async function pickBackupFile(): Promise<PickBackupResult> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return { ok: false, reason: 'CANCELLED' };

    const asset = result.assets[0];
    if (!asset) return { ok: false, reason: 'READ_FAILED' };

    const text = await FileSystem.readAsStringAsync(asset.uri);
    return { ok: true, text, fileName: asset.name };
  } catch {
    return { ok: false, reason: 'READ_FAILED' };
  }
}
