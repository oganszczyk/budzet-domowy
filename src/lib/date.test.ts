import {
  addMonths,
  daysInMonth,
  dueDateFor,
  formatDate,
  formatMonthYear,
  isSameMonth,
  monthRange,
  yearMonthOf,
} from './date';

describe('formatMonthYear', () => {
  it('buduje nagłówek ekranu głównego (5.1)', () => {
    expect(formatMonthYear({ year: 2026, month: 7 })).toBe('Lipiec 2026');
    expect(formatMonthYear({ year: 2026, month: 1 })).toBe('Styczeń 2026');
    expect(formatMonthYear({ year: 2026, month: 12 })).toBe('Grudzień 2026');
  });
});

describe('formatDate', () => {
  it('formatuje datę jako dd.MM.yyyy (6.2)', () => {
    expect(formatDate('2026-07-28')).toBe('28.07.2026');
    expect(formatDate('2026-01-05')).toBe('05.01.2026');
  });
});

describe('addMonths', () => {
  it('przechodzi do następnego i poprzedniego miesiąca (4.3)', () => {
    expect(addMonths({ year: 2026, month: 7 }, 1)).toEqual({ year: 2026, month: 8 });
    expect(addMonths({ year: 2026, month: 7 }, -1)).toEqual({ year: 2026, month: 6 });
  });

  it('poprawnie przechodzi przez przełom roku', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('obsługuje przeskok o wiele miesięcy', () => {
    expect(addMonths({ year: 2026, month: 7 }, 12)).toEqual({ year: 2027, month: 7 });
    expect(addMonths({ year: 2026, month: 7 }, -18)).toEqual({ year: 2025, month: 1 });
  });
});

describe('daysInMonth', () => {
  it('zna długość miesięcy', () => {
    expect(daysInMonth({ year: 2026, month: 1 })).toBe(31);
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
  });

  it('obsługuje rok przestępny', () => {
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
  });
});

describe('monthRange', () => {
  it('zwraca zakres do zapytań SQL (BR-09)', () => {
    expect(monthRange({ year: 2026, month: 7 })).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    });
    expect(monthRange({ year: 2026, month: 2 })).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });
});

describe('dueDateFor', () => {
  it('buduje termin płatności z dnia szablonu (5.2)', () => {
    expect(dueDateFor({ year: 2026, month: 7 }, 10)).toBe('2026-07-10');
  });

  it('przycina termin do ostatniego dnia krótszego miesiąca', () => {
    expect(dueDateFor({ year: 2026, month: 2 }, 31)).toBe('2026-02-28');
    expect(dueDateFor({ year: 2026, month: 4 }, 31)).toBe('2026-04-30');
  });
});

describe('yearMonthOf / isSameMonth', () => {
  it('wyznacza miesiąc daty', () => {
    expect(yearMonthOf('2026-07-28')).toEqual({ year: 2026, month: 7 });
  });

  it('porównuje miesiące', () => {
    expect(isSameMonth({ year: 2026, month: 7 }, { year: 2026, month: 7 })).toBe(true);
    expect(isSameMonth({ year: 2026, month: 7 }, { year: 2025, month: 7 })).toBe(false);
  });
});
