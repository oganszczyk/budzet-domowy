import { months, plural } from './plural';

describe('months', () => {
  it('jeden miesiąc', () => {
    expect(months(1)).toBe('miesiąc');
  });

  it('końcówki 2-4 dostają formę „miesiące"', () => {
    expect(months(2)).toBe('miesiące');
    expect(months(3)).toBe('miesiące');
    expect(months(4)).toBe('miesiące');
    expect(months(22)).toBe('miesiące');
    expect(months(34)).toBe('miesiące');
  });

  it('NASTOLATKI są wyjątkiem, mimo końcówki 2-4', () => {
    // Bez tego wyjątku „12 miesiące" przechodzi przez regułę końcówki.
    expect(months(12)).toBe('miesięcy');
    expect(months(13)).toBe('miesięcy');
    expect(months(14)).toBe('miesięcy');
  });

  it('reszta dostaje formę „miesięcy"', () => {
    expect(months(0)).toBe('miesięcy');
    expect(months(5)).toBe('miesięcy');
    expect(months(11)).toBe('miesięcy');
    expect(months(25)).toBe('miesięcy');
    expect(months(36)).toBe('miesięcy');
  });

  it('wszystkie długości okna z ekranu analizy brzmią poprawnie', () => {
    // Zakres dopuszczalnego okna to 2-36 miesięcy — żadna wartość nie może
    // wyprodukować niepoprawnej polszczyzny.
    const wrong = [];
    for (let n = 2; n <= 36; n++) {
      const form = months(n);
      if (form !== 'miesiące' && form !== 'miesięcy') wrong.push(n);
    }
    expect(wrong).toEqual([]);
  });
});

describe('plural', () => {
  it('działa dla dowolnego rzeczownika', () => {
    const forms = { one: 'zestawienie', few: 'zestawienia', many: 'zestawień' };

    expect(plural(1, forms)).toBe('zestawienie');
    expect(plural(3, forms)).toBe('zestawienia');
    expect(plural(7, forms)).toBe('zestawień');
    expect(plural(0, forms)).toBe('zestawień');
  });

  it('liczbę ujemną traktuje jak dodatnią', () => {
    expect(months(-3)).toBe('miesiące');
  });
});
