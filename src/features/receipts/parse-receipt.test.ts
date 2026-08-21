import { parseReceiptText } from './parse-receipt';

/** Realistyczny paragon z polskiego sklepu. */
const LIDL_RECEIPT = `LIDL SP. Z O.O. SP.K.
UL. POZNAŃSKA 48
62-080 TARNOWO PODGÓRNE
NIP 781-18-97-358
2026-08-19 14:32
PARAGON FISKALNY
Chleb razowy      1 x 4,99      4,99 A
Mleko 2%          2 x 3,49      6,98 A
SPRZEDAŻ OPODATKOWANA A        11,97
PTU A 23%                       2,24
SUMA PTU                        2,24
SUMA PLN                       11,97
Karta                          11,97`;

describe('parseReceiptText — kwota (5.6)', () => {
  it('wybiera sumę, a nie sumę podatku', () => {
    const result = parseReceiptText(LIDL_RECEIPT);

    // Gdyby „SUMA PTU" nie było wykluczone, wyszłoby 2,24 zł.
    expect(result.amountGrosze).toBe(1197);
    expect(result.amountSource).toBe('SUMA');
  });

  it('„DO ZAPŁATY" ma pierwszeństwo przed „SUMA"', () => {
    const result = parseReceiptText(`SKLEP TESTOWY
SUMA                 50,00
DO ZAPŁATY           45,00`);

    expect(result.amountGrosze).toBe(4500);
    expect(result.amountSource).toBe('DO_ZAPLATY');
  });

  it('„SUMA" ma pierwszeństwo przed „RAZEM"', () => {
    const result = parseReceiptText(`SKLEP TESTOWY
RAZEM                30,00
SUMA PLN             35,00`);

    expect(result.amountGrosze).toBe(3500);
    expect(result.amountSource).toBe('SUMA');
  });

  it('pomija pozycje na liście zakupów', () => {
    const result = parseReceiptText(`BIEDRONKA
Ser żółty         1 x 24,99    24,99 A
Masło             1 x 8,49      8,49 A
SUMA PLN                       33,48`);

    expect(result.amountGrosze).toBe(3348);
  });

  it('pomija resztę i kwotę wpłaconą', () => {
    const result = parseReceiptText(`SKLEP
DO ZAPŁATY           23,50
GOTÓWKA              50,00
RESZTA               26,50`);

    expect(result.amountGrosze).toBe(2350);
  });

  it('bez żadnego oznaczenia bierze największą kwotę', () => {
    const result = parseReceiptText(`SKLEPIK
Bułka        2,50
Kawa         9,90
             12,40`);

    expect(result.amountGrosze).toBe(1240);
    expect(result.amountSource).toBe('NAJWIEKSZA');
  });

  it('radzi sobie z separatorem tysięcy', () => {
    const result = parseReceiptText(`MEDIA EXPERT
SUMA PLN          1 249,99`);

    expect(result.amountGrosze).toBe(124999);
  });

  it('przyjmuje kropkę jako separator groszy', () => {
    expect(parseReceiptText('SKLEP\nSUMA 19.99').amountGrosze).toBe(1999);
  });

  it('nie gubi groszy przez błąd zmiennoprzecinkowy', () => {
    // 19.99 * 100 === 1998.9999999999998 przy liczeniu na float.
    expect(parseReceiptText('SKLEP\nSUMA 19,99').amountGrosze).toBe(1999);
    expect(parseReceiptText('SKLEP\nSUMA 0,07').amountGrosze).toBe(7);
  });

  it('5.6: brak rozpoznanej kwoty zwraca pustą wartość', () => {
    const result = parseReceiptText('ROZMAZANY TEKST BEZ LICZB');

    expect(result.amountGrosze).toBeNull();
    expect(result.amountSource).toBeNull();
  });

  it('ignoruje liczby, które nie są kwotami', () => {
    const result = parseReceiptText(`SKLEP
NIP 781-18-97-358
Kasa 12 Kasjer 3
SUMA PLN            8,00`);

    expect(result.amountGrosze).toBe(800);
  });
});

describe('parseReceiptText — data (5.6)', () => {
  it('czyta datę fiskalną RRRR-MM-DD', () => {
    expect(parseReceiptText(LIDL_RECEIPT).date).toBe('2026-08-19');
  });

  it('czyta datę w zapisie DD.MM.RRRR', () => {
    expect(parseReceiptText('SKLEP\n19.08.2026 14:32\nSUMA 10,00').date).toBe('2026-08-19');
  });

  it('odrzuca datę, która nie istnieje w kalendarzu', () => {
    // Wzorzec pasuje, ale 31 lutego nie ma.
    expect(parseReceiptText('SKLEP\n31.02.2026\nSUMA 10,00').date).toBeNull();
  });

  it('akceptuje 29 lutego w roku przestępnym', () => {
    expect(parseReceiptText('SKLEP\n29.02.2028\nSUMA 10,00').date).toBe('2028-02-29');
  });

  it('5.6: brak daty zostawia pole puste', () => {
    expect(parseReceiptText('SKLEP\nSUMA 10,00').date).toBeNull();
  });
});

describe('parseReceiptText — sklep (5.6)', () => {
  it('bierze nazwę z nagłówka paragonu', () => {
    expect(parseReceiptText(LIDL_RECEIPT).merchant).toBe('LIDL SP. Z O.O. SP.K.');
  });

  it('pomija adres, kod pocztowy i NIP', () => {
    const result = parseReceiptText(`62-080 TARNOWO PODGÓRNE
NIP 781-18-97-358
UL. POZNAŃSKA 48
ROSSMANN
SUMA 45,20`);

    expect(result.merchant).toBe('ROSSMANN');
  });

  it('5.6: nazwa sklepu może pozostać pusta', () => {
    expect(parseReceiptText('12345\n67,89').merchant).toBeNull();
  });

  it('skraca zbyt długą nazwę do 80 znaków (6.2)', () => {
    const longName = 'A'.repeat(120);
    const result = parseReceiptText(`${longName}\nSUMA 10,00`);

    expect(result.merchant).toHaveLength(80);
  });
});

describe('parseReceiptText — cały paragon', () => {
  it('wyciąga wszystkie trzy pola naraz', () => {
    expect(parseReceiptText(LIDL_RECEIPT)).toEqual({
      merchant: 'LIDL SP. Z O.O. SP.K.',
      date: '2026-08-19',
      amountGrosze: 1197,
      amountSource: 'SUMA',
    });
  });

  it('pusty tekst nie wysadza parsera', () => {
    expect(parseReceiptText('')).toEqual({
      merchant: null,
      date: null,
      amountGrosze: null,
      amountSource: null,
    });
  });
});
