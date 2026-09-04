import { AnalysisSubjectKind, type AnalysisSubject } from '@/domain/analysis';
import { MainType, PaymentSource } from '@/domain/enums';
import type { Income, Payment } from '@/domain/models';

import { buildSeries, compareYears, matchesSubject, summarizeSeries } from './series';

/** Płatność z minimum pól — testy nadpisują tylko to, co bada dany przypadek. */
function payment(overrides: Partial<Payment> & Pick<Payment, 'effectiveDate'>): Payment {
  return {
    id: 1,
    mainType: MainType.BILL,
    categoryId: 1,
    title: 'Gaz',
    amountGrosze: 10000,
    dueDate: null,
    paidDate: null,
    status: null,
    source: PaymentSource.AUTO_BILL,
    merchant: null,
    description: null,
    paymentMethod: null,
    billTemplateId: null,
    subscriptionId: null,
    receiptImagePath: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function income(month: string, amountGrosze: number, id = 1): Income {
  return {
    id,
    personName: 'Ola',
    amountGrosze,
    month,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const GAS: AnalysisSubject = { kind: AnalysisSubjectKind.BILL_TEMPLATE, billTemplateId: 3 };
const ALL: AnalysisSubject = { kind: AnalysisSubjectKind.ALL_EXPENSES };
const INCOME: AnalysisSubject = { kind: AnalysisSubjectKind.INCOME };

describe('matchesSubject', () => {
  it('rozróżnia rachunki po szablonie, a nie po kategorii', () => {
    // Sedno Etapu 12: Gaz i Prąd dzielą kategorię „Rachunki domowe",
    // więc filtrowanie po categoryId zsumowałoby je razem.
    const gas = payment({ effectiveDate: '2026-03-10', billTemplateId: 3, categoryId: 1 });
    const power = payment({ effectiveDate: '2026-03-10', billTemplateId: 2, categoryId: 1 });

    expect(matchesSubject(gas, GAS)).toBe(true);
    expect(matchesSubject(power, GAS)).toBe(false);
  });

  it('kategoria główna łapie wszystkie płatności swojego typu', () => {
    const subject: AnalysisSubject = {
      kind: AnalysisSubjectKind.MAIN_TYPE,
      mainType: MainType.PURCHASE,
    };
    const purchase = payment({ effectiveDate: '2026-03-10', mainType: MainType.PURCHASE });
    const bill = payment({ effectiveDate: '2026-03-10', mainType: MainType.BILL });

    expect(matchesSubject(purchase, subject)).toBe(true);
    expect(matchesSubject(bill, subject)).toBe(false);
  });

  it('dochód nigdy nie pasuje do płatności', () => {
    expect(matchesSubject(payment({ effectiveDate: '2026-03-10' }), INCOME)).toBe(false);
  });
});

describe('buildSeries', () => {
  const from = { year: 2026, month: 1 };
  const to = { year: 2026, month: 4 };

  it('daje jeden punkt na każdy miesiąc zakresu, także pusty', () => {
    const points = buildSeries({
      from,
      to,
      subject: GAS,
      payments: [payment({ effectiveDate: '2026-02-10', billTemplateId: 3 })],
      incomes: [],
    });

    // Cztery miesiące zakresu, mimo że dane są tylko w jednym.
    expect(points.map((p) => p.key)).toEqual(['2026-01', '2026-02', '2026-03', '2026-04']);
    expect(points.map((p) => p.totalGrosze)).toEqual([0, 10000, 0, 0]);
  });

  it('pusty miesiąc odróżnia się od miesiąca z zerową kwotą', () => {
    const points = buildSeries({
      from,
      to,
      subject: GAS,
      payments: [payment({ effectiveDate: '2026-01-10', billTemplateId: 3 })],
      incomes: [],
    });

    expect(points[0].entryCount).toBe(1);
    expect(points[1].entryCount).toBe(0);
  });

  it('BR-05: rachunek bez kwoty nie wchodzi do sumy, ale jest policzony osobno', () => {
    const points = buildSeries({
      from,
      to,
      subject: GAS,
      payments: [
        payment({ id: 1, effectiveDate: '2026-01-10', billTemplateId: 3, amountGrosze: 12000 }),
        payment({ id: 2, effectiveDate: '2026-01-20', billTemplateId: 3, amountGrosze: null }),
      ],
      incomes: [],
    });

    expect(points[0].totalGrosze).toBe(12000);
    expect(points[0].entryCount).toBe(1);
    expect(points[0].missingAmountCount).toBe(1);
  });

  it('sumuje w groszach, bez błędów zmiennoprzecinkowych (BR-03)', () => {
    const points = buildSeries({
      from,
      to,
      subject: ALL,
      payments: [
        payment({ id: 1, effectiveDate: '2026-01-05', amountGrosze: 1999 }),
        payment({ id: 2, effectiveDate: '2026-01-06', amountGrosze: 1999 }),
        payment({ id: 3, effectiveDate: '2026-01-07', amountGrosze: 1999 }),
      ],
      incomes: [],
    });

    expect(points[0].totalGrosze).toBe(5997);
  });

  it('pomija płatności spoza zakresu, nawet gdy pasują do przedmiotu', () => {
    const points = buildSeries({
      from,
      to,
      subject: GAS,
      payments: [
        payment({ id: 1, effectiveDate: '2025-12-31', billTemplateId: 3 }),
        payment({ id: 2, effectiveDate: '2026-05-01', billTemplateId: 3 }),
      ],
      incomes: [],
    });

    expect(points.every((p) => p.entryCount === 0)).toBe(true);
  });

  it('dochody czyta z listy dochodów, a nie z płatności', () => {
    const points = buildSeries({
      from,
      to,
      subject: INCOME,
      payments: [payment({ effectiveDate: '2026-01-10', amountGrosze: 999999 })],
      incomes: [income('2026-01', 500000), income('2026-01', 400000, 2)],
    });

    expect(points[0].totalGrosze).toBe(900000);
    expect(points[0].entryCount).toBe(2);
  });
});

describe('summarizeSeries', () => {
  const from = { year: 2026, month: 1 };
  const to = { year: 2026, month: 6 };

  function gasSeries(amountsByMonth: (number | null)[]) {
    const payments = amountsByMonth.flatMap((amount, index) =>
      amount === null
        ? []
        : [
            payment({
              id: index + 1,
              effectiveDate: `2026-0${index + 1}-15`,
              billTemplateId: 3,
              amountGrosze: amount,
            }),
          ]
    );
    return buildSeries({ from, to, subject: GAS, payments, incomes: [] });
  }

  it('średnia dzieli przez miesiące Z DANYMI, a nie przez długość zakresu', () => {
    // Trzy rachunki po 300 zł w sześciomiesięcznym zakresie.
    // Dzielenie przez 6 dałoby 150 zł i użytkownik przeczytałby to
    // jako miesięczny koszt gazu — dwa razy za mało.
    const points = gasSeries([30000, 30000, 30000, null, null, null]);
    const summary = summarizeSeries(points);

    expect(summary.totalGrosze).toBe(90000);
    expect(summary.monthsWithData).toBe(3);
    expect(summary.monthCount).toBe(6);
    expect(summary.averageGrosze).toBe(30000);
  });

  it('najtaniej NIE wskazuje pustego miesiąca', () => {
    const points = gasSeries([30000, null, 25000, null, null, null]);
    const summary = summarizeSeries(points);

    expect(summary.lowest?.key).toBe('2026-03');
    expect(summary.highest?.key).toBe('2026-01');
  });

  it('pusty zakres nie dzieli przez zero', () => {
    const summary = summarizeSeries(gasSeries([null, null, null, null, null, null]));

    expect(summary.averageGrosze).toBe(0);
    expect(summary.totalGrosze).toBe(0);
    expect(summary.highest).toBeNull();
    expect(summary.lowest).toBeNull();
  });

  it('zlicza rachunki czekające na kwotę z całego zakresu', () => {
    const points = buildSeries({
      from,
      to,
      subject: GAS,
      payments: [
        payment({ id: 1, effectiveDate: '2026-01-15', billTemplateId: 3, amountGrosze: null }),
        payment({ id: 2, effectiveDate: '2026-04-15', billTemplateId: 3, amountGrosze: null }),
      ],
      incomes: [],
    });

    expect(summarizeSeries(points).missingAmountCount).toBe(2);
  });
});

describe('compareYears', () => {
  /** Ten sam rachunek co miesiąc, przez dwa lata, o zadanych kwotach. */
  function twoYears(previous: number[], current: number[]) {
    const payments = [
      ...previous.map((amount, index) =>
        payment({
          id: 100 + index,
          effectiveDate: `2025-${String(index + 1).padStart(2, '0')}-15`,
          billTemplateId: 3,
          amountGrosze: amount,
        })
      ),
      ...current.map((amount, index) =>
        payment({
          id: 200 + index,
          effectiveDate: `2026-${String(index + 1).padStart(2, '0')}-15`,
          billTemplateId: 3,
          amountGrosze: amount,
        })
      ),
    ];

    return buildSeries({
      from: { year: 2025, month: 1 },
      to: { year: 2026, month: 12 },
      subject: GAS,
      payments,
      incomes: [],
    });
  }

  it('obcina poprzedni rok do tylu samo miesięcy, ile ma bieżący', () => {
    // Poprzedni rok: 12 x 100 zł. Bieżący: 3 x 100 zł, bo mamy marzec.
    // Bez obcięcia wyszłoby "spadek o 75%", czyli nieprawda.
    const comparison = compareYears(twoYears(Array(12).fill(10000), Array(3).fill(10000)), 2026, 3);

    expect(comparison.previous.totalGrosze).toBe(30000);
    expect(comparison.current.totalGrosze).toBe(30000);
    expect(comparison.differenceGrosze).toBe(0);
    expect(comparison.percentChange).toBe(0);
  });

  it('wykrywa wzrost w tych samych miesiącach', () => {
    const comparison = compareYears(
      twoYears(Array(12).fill(10000), [12000, 12000, 12000]),
      2026,
      3
    );

    expect(comparison.differenceGrosze).toBe(6000);
    expect(comparison.percentChange).toBeCloseTo(20);
  });

  it('brak danych z poprzedniego roku oznacza brak porównania, a nie zero', () => {
    const comparison = compareYears(twoYears([], [10000, 10000]), 2026, 2);

    expect(comparison.comparable).toBe(false);
    expect(comparison.percentChange).toBeNull();
    expect(comparison.current.totalGrosze).toBe(20000);
  });

  it('grudzień porównuje pełne dwanaście miesięcy', () => {
    const comparison = compareYears(
      twoYears(Array(12).fill(10000), Array(12).fill(11000)),
      2026,
      12
    );

    expect(comparison.monthsCompared).toBe(12);
    expect(comparison.previous.totalGrosze).toBe(120000);
    expect(comparison.current.totalGrosze).toBe(132000);
  });
});
