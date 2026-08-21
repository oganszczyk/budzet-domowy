import { isMlKitAvailable, mlKitOcrService } from './mlkit-ocr-service';
import { createOcrService, scanReceipt, unavailableOcrService } from './ocr-service';
import type { ReceiptOcrService } from './ocr-service';

describe('scanReceipt (5.6, BR-08)', () => {
  it('zamienia odczytany tekst na trzy pola propozycji', async () => {
    const fake: ReceiptOcrService = {
      name: 'Test',
      readsImage: true,
      async recognizeText() {
        return {
          status: 'OK',
          text: 'ROSSMANN\n2026-08-11\nSUMA PLN 45,20',
        };
      },
    };

    const result = await scanReceipt('plik.jpg', fake);

    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    expect(result.fields).toEqual({
      merchant: 'ROSSMANN',
      date: '2026-08-11',
      amountGrosze: 4520,
      amountSource: 'SUMA',
    });
    expect(result.readsImage).toBe(true);
  });

  it('5.6: brak tekstu wraca jako stan, nie jako wyjątek', async () => {
    const blind: ReceiptOcrService = {
      name: 'Test',
      readsImage: true,
      async recognizeText() {
        return { status: 'NO_TEXT' };
      },
    };

    expect(await scanReceipt('plik.jpg', blind)).toEqual({ status: 'NO_TEXT' });
  });

  it('5.6: błąd silnika nie blokuje użytkownika', async () => {
    const broken: ReceiptOcrService = {
      name: 'Test',
      readsImage: true,
      async recognizeText() {
        throw new Error('Silnik padł');
      },
    };

    const result = await scanReceipt('plik.jpg', broken);

    // Użytkownik ma dostać komunikat i móc uzupełnić dane ręcznie,
    // a nie zobaczyć zerwany ekran.
    expect(result.status).toBe('ERROR');
    if (result.status === 'ERROR') expect(result.message).toBe('Silnik padł');
  });

  it('silnik zgłaszający brak obsługi zwraca czytelny stan', async () => {
    expect(await scanReceipt('plik.jpg', unavailableOcrService)).toEqual({
      status: 'ENGINE_UNAVAILABLE',
    });
  });
});

describe('wybór silnika zależny od środowiska', () => {
  it('bez modułu natywnego wybiera silnik demonstracyjny', () => {
    // Testy działają bez React Native, więc ML Kit jest niedostępny —
    // dokładnie jak w Expo Go.
    expect(isMlKitAvailable()).toBe(false);
    expect(createOcrService().readsImage).toBe(false);
  });

  it('silnik demonstracyjny przechodzi cały przepływ i zwraca komplet pól', async () => {
    const result = await scanReceipt('plik.jpg', createOcrService());

    expect(result.status).toBe('OK');
    if (result.status !== 'OK') return;

    expect(result.fields.merchant).toBe('LIDL SP. Z O.O. SP.K.');
    expect(result.fields.amountGrosze).toBe(2046);
    expect(result.fields.amountSource).toBe('SUMA');
    // Ta flaga steruje ostrzeżeniem na ekranie weryfikacji. Bez niej dane
    // wyglądałyby na odczytane z prawdziwego paragonu użytkownika.
    expect(result.readsImage).toBe(false);
  });

  it('silnik ML Kit deklaruje, że czyta zdjęcie', () => {
    // We własnej wersji aplikacji to on zostanie wybrany, a ostrzeżenie zniknie.
    expect(mlKitOcrService.readsImage).toBe(true);
  });

  it('ML Kit bez modułu natywnego zgłasza brak silnika, zamiast rzucać wyjątkiem', async () => {
    expect(await scanReceipt('plik.jpg', mlKitOcrService)).toEqual({
      status: 'ENGINE_UNAVAILABLE',
    });
  });
});
