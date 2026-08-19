import {
  formatGrosze,
  MAX_AMOUNT_GROSZE,
  NBSP,
  parseAmountToGrosze,
  validateAmountGrosze,
} from './money';

describe('formatGrosze', () => {
  it('formatuje kwotę ze specyfikacji (T-02): 125,50 zł', () => {
    expect(formatGrosze(12550)).toBe(`125,50${NBSP}zł`);
  });

  it('dodaje separator tysięcy spacją nierozdzielającą (5.1)', () => {
    expect(formatGrosze(125050)).toBe(`1${NBSP}250,50${NBSP}zł`);
    expect(formatGrosze(123456789)).toBe(`1${NBSP}234${NBSP}567,89${NBSP}zł`);
  });

  it('pokazuje brak danych jako 0,00 zł, nie jako błąd (5.1)', () => {
    expect(formatGrosze(0)).toBe(`0,00${NBSP}zł`);
  });

  it('uzupełnia grosze zerem', () => {
    expect(formatGrosze(1005)).toBe(`10,05${NBSP}zł`);
    expect(formatGrosze(1050)).toBe(`10,50${NBSP}zł`);
  });

  it('obsługuje zakres wymagany w AC 5.1: od 0,01 zł do 999 999,99 zł', () => {
    expect(formatGrosze(1)).toBe(`0,01${NBSP}zł`);
    expect(formatGrosze(99999999)).toBe(`999${NBSP}999,99${NBSP}zł`);
  });

  it('potrafi pominąć symbol waluty', () => {
    expect(formatGrosze(12550, { withCurrency: false })).toBe('125,50');
  });
});

describe('parseAmountToGrosze', () => {
  it('przyjmuje przecinek i kropkę (5.5)', () => {
    expect(parseAmountToGrosze('125,50')).toBe(12550);
    expect(parseAmountToGrosze('125.50')).toBe(12550);
  });

  it('przyjmuje kwotę bez części dziesiętnej', () => {
    expect(parseAmountToGrosze('125')).toBe(12500);
  });

  it('przyjmuje kwotę z jedną cyfrą po separatorze', () => {
    expect(parseAmountToGrosze('125,5')).toBe(12550);
  });

  it('ignoruje spacje i symbol waluty', () => {
    expect(parseAmountToGrosze(` 1${NBSP}250,50 zł `)).toBe(125050);
  });

  it('nie gubi groszy przez błąd zmiennoprzecinkowy', () => {
    // parseFloat('19.99') * 100 === 1998.9999999999998 — dlatego nie używamy tej metody.
    expect(parseAmountToGrosze('19,99')).toBe(1999);
    expect(parseAmountToGrosze('0,07')).toBe(7);
    expect(parseAmountToGrosze('8,29')).toBe(829);
  });

  it('odrzuca tekst, który nie jest kwotą', () => {
    expect(parseAmountToGrosze('')).toBeNull();
    expect(parseAmountToGrosze('abc')).toBeNull();
    expect(parseAmountToGrosze('12,5,5')).toBeNull();
    expect(parseAmountToGrosze('-5')).toBeNull();
    expect(parseAmountToGrosze('125,505')).toBeNull(); // 5.5: maksymalnie 2 miejsca po przecinku
  });
});

describe('formatGrosze + parseAmountToGrosze', () => {
  it('są wzajemnie odwrotne (round-trip)', () => {
    for (const grosze of [1, 7, 100, 999, 12550, 125050, 99999999]) {
      expect(parseAmountToGrosze(formatGrosze(grosze))).toBe(grosze);
    }
  });
});

describe('validateAmountGrosze', () => {
  it('odrzuca pustą kwotę (5.5)', () => {
    expect(validateAmountGrosze(null)).toEqual({ ok: false, reason: 'EMPTY' });
  });

  it('odrzuca zero i wartości ujemne (BR-10)', () => {
    expect(validateAmountGrosze(0)).toEqual({ ok: false, reason: 'TOO_LOW' });
    expect(validateAmountGrosze(-1)).toEqual({ ok: false, reason: 'TOO_LOW' });
  });

  it('odrzuca kwotę powyżej 99 999 999,99 zł (6.2)', () => {
    expect(validateAmountGrosze(MAX_AMOUNT_GROSZE + 1)).toEqual({ ok: false, reason: 'TOO_HIGH' });
  });

  it('przyjmuje kwoty z dozwolonego zakresu', () => {
    expect(validateAmountGrosze(1)).toEqual({ ok: true });
    expect(validateAmountGrosze(12550)).toEqual({ ok: true });
    expect(validateAmountGrosze(MAX_AMOUNT_GROSZE)).toEqual({ ok: true });
  });
});
