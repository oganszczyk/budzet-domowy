import { AnalysisSubjectKind } from '@/domain/analysis';
import { FrequencyType, MainType, PaymentSource } from '@/domain/enums';
import type { BillTemplate, Category, Income, Payment, Subscription } from '@/domain/models';

import {
  buildProposals,
  MAX_PROPOSALS,
  ProposalTone,
  type ProposalInput,
  type ProposalTexts,
} from './proposals';
import { subjectKey } from './subject';

const label = (m: { year: number; month: number }) =>
  `${m.year}-${String(m.month).padStart(2, '0')}`;

/** Teksty zastępcze — testujemy reguły wyboru, nie brzmienie zdań. */
const TEXTS: ProposalTexts = {
  higher: (percent, m) => `drozej ${percent}% ${label(m)}`,
  lower: (percent, m) => `taniej ${percent}% ${label(m)}`,
  overspent: (m) => `ponad budzet ${label(m)}`,
  biggestBill: (months) => `najwiekszy rachunek ${months}`,
  allExpenses: (months) => `wszystkie wydatki ${months}`,
  bills: (months) => `rachunki ${months}`,
  incomeVsSpending: (months) => `dochody ${months}`,
};

const MONTH = { year: 2026, month: 8 };

const GAS_TEMPLATE: BillTemplate = {
  id: 3,
  name: 'Gaz',
  categoryId: 1,
  defaultDueDay: 28,
  isActive: true,
  useFixedAmount: false,
  fixedAmountGrosze: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const POWER_TEMPLATE: BillTemplate = { ...GAS_TEMPLATE, id: 2, name: 'Prąd', defaultDueDay: 15 };

const FOOD_CATEGORY: Category = {
  id: 10,
  usedBy: [MainType.SUBSCRIPTION, MainType.PURCHASE],
  name: 'Jedzenie',
  iconKey: 'restaurant-outline',
  isActive: true,
  sortOrder: 1,
};

const NETFLIX: Subscription = {
  id: 7,
  name: 'Netflix',
  amountGrosze: 4300,
  frequencyType: FrequencyType.MONTHLY,
  customIntervalMonths: null,
  startDate: '2026-01-01',
  nextPaymentDate: '2026-09-01',
  categoryId: 10,
  isActive: true,
  lastUsageConfirmationDate: null,
  confirmationIntervalMonths: 3,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

let nextId = 1;

function bill(month: number, amountGrosze: number | null, billTemplateId = 3): Payment {
  return {
    id: nextId++,
    mainType: MainType.BILL,
    categoryId: 1,
    title: 'Rachunek',
    amountGrosze,
    effectiveDate: `2026-${String(month).padStart(2, '0')}-15`,
    dueDate: null,
    paidDate: null,
    status: null,
    source: PaymentSource.AUTO_BILL,
    merchant: null,
    description: null,
    paymentMethod: null,
    billTemplateId,
    subscriptionId: null,
    receiptImagePath: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function purchase(month: number, day: number, amountGrosze: number, categoryId = 10): Payment {
  return {
    ...bill(month, amountGrosze, 3),
    mainType: MainType.PURCHASE,
    categoryId,
    billTemplateId: null,
    source: PaymentSource.MANUAL,
    effectiveDate: `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

function salary(month: number, amountGrosze: number): Income {
  return {
    id: nextId++,
    personName: 'Ola',
    amountGrosze,
    month: `2026-${String(month).padStart(2, '0')}`,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function input(overrides: Partial<ProposalInput> = {}): ProposalInput {
  return {
    month: MONTH,
    payments: [],
    incomes: [],
    billTemplates: [GAS_TEMPLATE, POWER_TEMPLATE],
    categories: [FOOD_CATEGORY],
    subscriptions: [NETFLIX],
    ...overrides,
  };
}

beforeEach(() => {
  nextId = 1;
});

describe('buildProposals', () => {
  it('nigdy nie zwraca więcej niż trzy karty', () => {
    // Cztery rachunki, każdy ze skokiem — kandydatów jest więcej niż miejsc.
    const payments = [3, 4, 5, 6, 7].flatMap((month) => [
      bill(month, 10000, 3),
      bill(month, 10000, 2),
    ]);
    payments.push(bill(8, 30000, 3), bill(8, 30000, 2));

    const proposals = buildProposals(input({ payments }), TEXTS);

    expect(proposals.length).toBe(MAX_PROPOSALS);
  });

  it('pusta aplikacja też dostaje trzy propozycje', () => {
    const proposals = buildProposals(input(), TEXTS);

    expect(proposals).toHaveLength(MAX_PROPOSALS);
    expect(proposals.every((p) => p.tone === ProposalTone.NEUTRAL)).toBe(true);
  });

  it('wskazuje rachunek, który podrożał względem swojej średniej', () => {
    const payments = [
      bill(5, 10000),
      bill(6, 10000),
      bill(7, 10000),
      // Sierpień: 200 zł zamiast zwykłych 100 zł.
      bill(8, 20000),
    ];

    const [first] = buildProposals(input({ payments }), TEXTS);

    expect(first.subject).toEqual({ kind: AnalysisSubjectKind.BILL_TEMPLATE, billTemplateId: 3 });
    expect(first.tone).toBe(ProposalTone.ALERT);
    expect(first.reason).toBe('drozej 100% 2026-08');
  });

  it('spadek kosztu jest dobrą wiadomością, nie alarmem', () => {
    const payments = [bill(5, 20000), bill(6, 20000), bill(7, 20000), bill(8, 10000)];

    const [first] = buildProposals(input({ payments }), TEXTS);

    expect(first.tone).toBe(ProposalTone.GOOD);
    expect(first.reason).toBe('taniej 50% 2026-08');
  });

  it('sortuje po ZŁOTÓWKACH, a nie po procentach', () => {
    const payments = [
      // Czynsz: +20% z 2 500 zł, czyli 500 zł.
      ...[5, 6, 7].map((m) => bill(m, 250000, 2)),
      bill(8, 300000, 2),
      // Gaz: +100% z 50 zł, czyli 50 zł. Większy procent, mniejszy skutek.
      ...[5, 6, 7].map((m) => bill(m, 5000, 3)),
      bill(8, 10000, 3),
    ];

    const proposals = buildProposals(input({ payments }), TEXTS);

    expect(proposals[0].subject).toEqual({
      kind: AnalysisSubjectKind.BILL_TEMPLATE,
      billTemplateId: 2,
    });
    expect(proposals[1].subject).toEqual({
      kind: AnalysisSubjectKind.BILL_TEMPLATE,
      billTemplateId: 3,
    });
  });

  it('drobna zmiana kwotowa nie zasługuje na kartę, choćby procent był duży', () => {
    // Z 10 zł na 15 zł to +50%, ale tylko 5 zł — poniżej progu 20 zł.
    const payments = [bill(5, 1000), bill(6, 1000), bill(7, 1000), bill(8, 1500)];

    const proposals = buildProposals(input({ payments }), TEXTS);

    expect(proposals.every((p) => p.reason.startsWith('drozej'))).toBe(false);
  });

  it('duża kwota przy małym procencie też nie zasługuje na kartę', () => {
    // +100 zł na 2 500 zł to zaledwie 4%.
    const payments = [
      bill(5, 250000, 2),
      bill(6, 250000, 2),
      bill(7, 250000, 2),
      bill(8, 260000, 2),
    ];

    const proposals = buildProposals(input({ payments }), TEXTS);

    expect(proposals.every((p) => p.reason.startsWith('drozej'))).toBe(false);
  });

  it('dwa miesiące historii to za mało, żeby mówić o odchyleniu', () => {
    const payments = [bill(7, 10000), bill(8, 40000)];

    const proposals = buildProposals(input({ payments }), TEXTS);

    expect(proposals.every((p) => p.tone === ProposalTone.NEUTRAL)).toBe(true);
  });

  it('zakupy porównuje do OSTATNIEGO ZAMKNIĘTEGO miesiąca, nie do trwającego', () => {
    // Jedzenie: 500 zł miesięcznie przez pół roku, a w sierpniu (miesiąc
    // bieżący) dopiero 50 zł, bo miesiąc się nie skończył. To NIE jest
    // oszczędność i nie wolno tego zgłosić jako dobrej wiadomości.
    const payments = [...[4, 5, 6, 7].map((m) => purchase(m, 10, 50000)), purchase(8, 3, 5000)];

    const proposals = buildProposals(input({ payments }), TEXTS);

    const food = proposals.find(
      (p) => subjectKey(p.subject) === `${AnalysisSubjectKind.CATEGORY}:10`
    );
    expect(food).toBeUndefined();
  });

  it('zakupy zgłasza, gdy skoczyły w ostatnim ZAMKNIĘTYM miesiącu', () => {
    const payments = [
      ...[4, 5, 6].map((m) => purchase(m, 10, 50000)),
      // Lipiec — ostatni zamknięty miesiąc: dwa razy więcej niż zwykle.
      purchase(7, 10, 100000),
    ];

    const [first] = buildProposals(input({ payments }), TEXTS);

    expect(subjectKey(first.subject)).toBe(`${AnalysisSubjectKind.CATEGORY}:10`);
    expect(first.reason).toBe('drozej 100% 2026-07');
  });

  it('zgłasza przekroczenie budżetu w ostatnim zamkniętym miesiącu', () => {
    const proposals = buildProposals(
      input({
        payments: [purchase(7, 10, 600000)],
        incomes: [salary(7, 500000)],
      }),
      TEXTS
    );

    const overspend = proposals.find((p) => p.key === 'overspend');
    expect(overspend?.tone).toBe(ProposalTone.ALERT);
    expect(overspend?.reason).toBe('ponad budzet 2026-07');
  });

  it('bez wpisanych dochodów nie ma czego przekraczać', () => {
    const proposals = buildProposals(input({ payments: [purchase(7, 10, 600000)] }), TEXTS);

    expect(proposals.find((p) => p.key === 'overspend')).toBeUndefined();
  });

  it('ta sama pozycja nie pojawia się dwa razy', () => {
    const payments = [bill(5, 10000), bill(6, 10000), bill(7, 10000), bill(8, 20000)];

    const proposals = buildProposals(input({ payments }), TEXTS);
    const identities = proposals.map((p) => subjectKey(p.subject));

    expect(new Set(identities).size).toBe(identities.length);
  });

  it('każda propozycja niesie gotowy zakres sześciu miesięcy', () => {
    const [first] = buildProposals(input(), TEXTS);

    expect(first.from).toEqual({ year: 2026, month: 3 });
    expect(first.to).toEqual({ year: 2026, month: 8 });
  });
});
