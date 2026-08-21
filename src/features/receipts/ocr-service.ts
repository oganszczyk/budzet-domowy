/**
 * 8: „OCR — lokalna lub urządzeniowa usługa OCR opakowana interfejsem."
 * Etap 7: „Utworzyć interfejs ReceiptOcrService."
 *
 * ═══════════════════════════════════════════════════════════════════════
 * WAŻNE OGRANICZENIE — PRZECZYTAJ PRZED ZMIANAMI
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Prawdziwe rozpoznawanie tekstu na urządzeniu wymaga modułu natywnego
 * (ML Kit na Androidzie, Vision na iOS). Takie moduły NIE DZIAŁAJĄ w Expo Go —
 * potrzebny jest development build, czyli własna wersja aplikacji zbudowana
 * przez EAS Build.
 *
 * Dopóki testujemy w Expo Go, działa silnik demonstracyjny: zwraca przykładowy
 * paragon zamiast czytać zdjęcie. Pozwala to sprawdzić CAŁY przepływ — wybór
 * zdjęcia, rozpoznanie, weryfikację, zapis — i ocenić reguły z 5.6, ale
 * rozpoznany tekst nie pochodzi z Twojego zdjęcia. Ekran weryfikacji mówi
 * o tym wprost, żeby nie było wątpliwości.
 *
 * PODMIANA NA PRAWDZIWY SILNIK to zmiana wyłącznie w `createOcrService()`:
 * wystarczy zwrócić implementację wołającą np. @react-native-ml-kit/text-recognition.
 * Reguły z 5.6 (`parse-receipt.ts`) i cały ekran zostają bez zmian —
 * po to ten interfejs istnieje.
 */

import { parseReceiptText, type ReceiptFields } from './parse-receipt';

export type OcrOutcome =
  /** Rozpoznano tekst. */
  | { status: 'OK'; text: string }
  /** Zdjęcie odczytane, ale nie znaleziono żadnego tekstu (5.6: nieczytelne). */
  | { status: 'NO_TEXT' }
  /** Brak silnika OCR — Expo Go nie obsługuje modułów natywnych. */
  | { status: 'ENGINE_UNAVAILABLE' }
  /** 5.6: „Błąd OCR — użytkownik nadal może przejść do formularza ręcznego." */
  | { status: 'ERROR'; message: string };

export interface ReceiptOcrService {
  /** Krótka nazwa silnika — pokazujemy ją użytkownikowi przy weryfikacji. */
  readonly name: string;
  /** Czy wynik pochodzi z prawdziwego odczytu zdjęcia. */
  readonly readsImage: boolean;
  recognizeText(imageUri: string): Promise<OcrOutcome>;
}

/** Przykładowy paragon używany przez silnik demonstracyjny. */
const DEMO_RECEIPT_TEXT = `LIDL SP. Z O.O. SP.K.
UL. POZNAŃSKA 48
62-080 TARNOWO PODGÓRNE
NIP 781-18-97-358
${new Date().toISOString().slice(0, 10)} 14:32
PARAGON FISKALNY
Chleb razowy      1 x 4,99      4,99 A
Mleko 2%          2 x 3,49      6,98 A
Masło extra       1 x 8,49      8,49 A
SPRZEDAŻ OPODATKOWANA A        20,46
PTU A 23%                       3,83
SUMA PTU                        3,83
SUMA PLN                       20,46
Karta                          20,46`;

/**
 * Silnik demonstracyjny — NIE czyta zdjęcia.
 *
 * Zwraca stały, realistyczny paragon, żeby dało się przejść i ocenić cały
 * przepływ w Expo Go. Zdjęcie jest mimo to robione i zapisywane, więc
 * po podmianie na prawdziwy silnik nic w ekranie się nie zmieni.
 */
const demoOcrService: ReceiptOcrService = {
  name: 'Silnik demonstracyjny',
  readsImage: false,
  async recognizeText() {
    // Krótka pauza, żeby ekran pokazał stan „rozpoznaję" tak jak przy
    // prawdziwym OCR — inaczej nie dałoby się go zobaczyć ani sprawdzić.
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { status: 'OK', text: DEMO_RECEIPT_TEXT };
  },
};

/**
 * Silnik zgłaszający brak obsługi — implementacja gotowa, gdyby zamiast
 * trybu demonstracyjnego wybrać uczciwe „nie potrafię".
 */
export const unavailableOcrService: ReceiptOcrService = {
  name: 'Brak silnika OCR',
  readsImage: false,
  async recognizeText() {
    return { status: 'ENGINE_UNAVAILABLE' };
  },
};

/**
 * Wybiera aktywny silnik OCR.
 *
 * TO JEST MIEJSCE DO PODMIANY, gdy powstanie development build
 * z prawdziwym rozpoznawaniem tekstu.
 */
export function createOcrService(): ReceiptOcrService {
  return demoOcrService;
}

export type ScanOutcome =
  | { status: 'OK'; fields: ReceiptFields; text: string; readsImage: boolean; engine: string }
  | { status: 'NO_TEXT' | 'ENGINE_UNAVAILABLE' }
  | { status: 'ERROR'; message: string };

/**
 * Rozpoznaje paragon i wyciąga z niego trzy pola.
 *
 * BR-08: „OCR tworzy wyłącznie propozycję danych, a nie gotową płatność."
 * Ta funkcja NICZEGO nie zapisuje — zwraca propozycję do weryfikacji.
 */
export async function scanReceipt(
  imageUri: string,
  service: ReceiptOcrService = createOcrService()
): Promise<ScanOutcome> {
  try {
    const outcome = await service.recognizeText(imageUri);

    if (outcome.status !== 'OK') return outcome;

    return {
      status: 'OK',
      fields: parseReceiptText(outcome.text),
      text: outcome.text,
      readsImage: service.readsImage,
      engine: service.name,
    };
  } catch (error) {
    // 5.6: błąd OCR nie może zablokować użytkownika — wraca jako stan,
    // z którego ekran pozwala przejść do ręcznego uzupełnienia.
    return {
      status: 'ERROR',
      message: error instanceof Error ? error.message : 'Nieznany błąd rozpoznawania.',
    };
  }
}
