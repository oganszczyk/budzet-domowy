/**
 * Prawdziwe rozpoznawanie tekstu na urządzeniu — ML Kit (Android) / Vision (iOS).
 *
 * 8: „OCR — lokalna lub urządzeniowa usługa OCR." Rozpoznawanie odbywa się
 * w całości na telefonie, bez wysyłania zdjęcia gdziekolwiek. Spełnia to
 * 8.2: „Dane użytkownika nie opuszczają urządzenia w MVP."
 *
 * Ten silnik działa TYLKO we własnej wersji aplikacji (development build).
 * Expo Go nie ładuje modułów natywnych, więc tam `NativeModules.TextRecognition`
 * nie istnieje — `isMlKitAvailable()` to wykrywa i aplikacja sama wraca
 * do silnika demonstracyjnego. Nic nie trzeba przełączać ręcznie.
 */

import { NativeModules } from 'react-native';

import type { OcrOutcome, ReceiptOcrService } from './ocr-service';

/**
 * Czy moduł natywny jest podłączony?
 *
 * Biblioteka sama sprawdza `NativeModules.TextRecognition` i podstawia
 * obiekt rzucający wyjątkiem, gdy go nie ma. Pytamy więc o to samo,
 * ale ZANIM cokolwiek wywołamy — dzięki temu w Expo Go nie dochodzi
 * do żadnego błędu, tylko do cichego wyboru innego silnika.
 */
export function isMlKitAvailable(): boolean {
  return NativeModules?.TextRecognition != null;
}

type TextRecognitionModule = {
  recognize: (imageUri: string) => Promise<{ text: string }>;
};

/** Wczytuje bibliotekę dopiero przy pierwszym użyciu. */
function loadTextRecognition(): TextRecognitionModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const imported = require('@react-native-ml-kit/text-recognition');
    const engine = (imported?.default ?? imported) as TextRecognitionModule | undefined;
    return typeof engine?.recognize === 'function' ? engine : null;
  } catch {
    return null;
  }
}

export const mlKitOcrService: ReceiptOcrService = {
  name: 'ML Kit (na urządzeniu)',
  readsImage: true,

  async recognizeText(imageUri: string): Promise<OcrOutcome> {
    /**
     * Sprawdzamy moduł natywny PRZED wywołaniem.
     *
     * Biblioteka podstawia obiekt, który wygląda na sprawny, a wyjątek rzuca
     * dopiero w środku `recognize`. Bez tego sprawdzenia użytkownik w Expo Go
     * zobaczyłby techniczny komunikat o linkowaniu paczki zamiast zrozumiałej
     * informacji, że rozpoznawanie jest niedostępne.
     */
    if (!isMlKitAvailable()) return { status: 'ENGINE_UNAVAILABLE' };

    const engine = loadTextRecognition();
    if (!engine) return { status: 'ENGINE_UNAVAILABLE' };

    const result = await engine.recognize(imageUri);
    const text = result?.text?.trim() ?? '';

    // 5.6, stany błędów: „Nieczytelne zdjęcie — pokazać możliwość
    // ponowienia skanu." Puste rozpoznanie to właśnie ten przypadek.
    if (text === '') return { status: 'NO_TEXT' };

    return { status: 'OK', text };
  },
};
