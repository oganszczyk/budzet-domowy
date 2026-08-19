import type { Subscription } from './models';
import { FrequencyType } from './enums';
import {
  needsUsageConfirmation,
  nextPaymentDate,
  occursInMonth,
  paymentDateInMonth,
  yearlyCostGrosze,
} from './subscription-schedule';

function makeSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 1,
    name: 'Netflix',
    amountGrosze: 4300,
    frequencyType: FrequencyType.MONTHLY,
    customIntervalMonths: null,
    startDate: '2026-01-08',
    nextPaymentDate: '2026-02-08',
    categoryId: 1,
    isActive: true,
    lastUsageConfirmationDate: null,
    confirmationIntervalMonths: 3,
    createdAt: '2026-01-08T00:00:00.000Z',
    updatedAt: '2026-01-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('occursInMonth — subskrypcja miesięczna (AC 5.3)', () => {
  const monthly = makeSubscription();

  it('pojawia się dokładnie raz w każdym miesiącu od rozpoczęcia', () => {
    for (let month = 1; month <= 12; month++) {
      expect(occursInMonth(monthly, { year: 2026, month })).toBe(true);
    }
  });

  it('nie pojawia się przed datą rozpoczęcia', () => {
    expect(occursInMonth(monthly, { year: 2025, month: 12 })).toBe(false);
    expect(occursInMonth(monthly, { year: 2025, month: 1 })).toBe(false);
  });
});

describe('occursInMonth — subskrypcja roczna (T-10)', () => {
  const yearly = makeSubscription({
    frequencyType: FrequencyType.YEARLY,
    startDate: '2026-03-15',
  });

  it('pojawia się tylko w miesiącu płatności', () => {
    expect(occursInMonth(yearly, { year: 2026, month: 3 })).toBe(true);
    expect(occursInMonth(yearly, { year: 2027, month: 3 })).toBe(true);
    expect(occursInMonth(yearly, { year: 2028, month: 3 })).toBe(true);
  });

  it('nie pojawia się w pozostałych miesiącach', () => {
    for (const month of [1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      expect(occursInMonth(yearly, { year: 2026, month })).toBe(false);
    }
  });
});

describe('occursInMonth — pozostałe częstotliwości', () => {
  it('kwartalna wypada co trzeci miesiąc', () => {
    const quarterly = makeSubscription({
      frequencyType: FrequencyType.QUARTERLY,
      startDate: '2026-02-01',
    });
    expect(occursInMonth(quarterly, { year: 2026, month: 2 })).toBe(true);
    expect(occursInMonth(quarterly, { year: 2026, month: 5 })).toBe(true);
    expect(occursInMonth(quarterly, { year: 2026, month: 8 })).toBe(true);
    expect(occursInMonth(quarterly, { year: 2026, month: 3 })).toBe(false);
    expect(occursInMonth(quarterly, { year: 2026, month: 4 })).toBe(false);
  });

  it('półroczna wypada co sześć miesięcy, także przez przełom roku', () => {
    const half = makeSubscription({
      frequencyType: FrequencyType.HALF_YEARLY,
      startDate: '2026-10-05',
    });
    expect(occursInMonth(half, { year: 2026, month: 10 })).toBe(true);
    expect(occursInMonth(half, { year: 2027, month: 4 })).toBe(true);
    expect(occursInMonth(half, { year: 2027, month: 10 })).toBe(true);
    expect(occursInMonth(half, { year: 2027, month: 1 })).toBe(false);
  });

  it('własna częstotliwość używa customIntervalMonths', () => {
    const custom = makeSubscription({
      frequencyType: FrequencyType.CUSTOM,
      customIntervalMonths: 4,
      startDate: '2026-01-20',
    });
    expect(occursInMonth(custom, { year: 2026, month: 1 })).toBe(true);
    expect(occursInMonth(custom, { year: 2026, month: 5 })).toBe(true);
    expect(occursInMonth(custom, { year: 2026, month: 9 })).toBe(true);
    expect(occursInMonth(custom, { year: 2026, month: 3 })).toBe(false);
  });
});

describe('paymentDateInMonth', () => {
  it('zachowuje dzień z daty rozpoczęcia', () => {
    const sub = makeSubscription({ startDate: '2026-01-08' });
    expect(paymentDateInMonth(sub, { year: 2026, month: 5 })).toBe('2026-05-08');
  });

  it('przycina dzień do długości krótszego miesiąca', () => {
    const sub = makeSubscription({ startDate: '2026-01-31' });
    expect(paymentDateInMonth(sub, { year: 2026, month: 2 })).toBe('2026-02-28');
    expect(paymentDateInMonth(sub, { year: 2026, month: 4 })).toBe('2026-04-30');
  });
});

describe('nextPaymentDate (5.3)', () => {
  it('miesięczna: płatność wypada w bieżącym miesiącu', () => {
    const sub = makeSubscription({ startDate: '2026-01-08' });
    expect(nextPaymentDate(sub, { year: 2026, month: 8 })).toBe('2026-08-08');
  });

  it('roczna: wskazuje miesiąc rocznicy', () => {
    const sub = makeSubscription({
      frequencyType: FrequencyType.YEARLY,
      startDate: '2026-03-15',
    });
    expect(nextPaymentDate(sub, { year: 2026, month: 5 })).toBe('2027-03-15');
  });

  it('kwartalna: wskazuje najbliższy kwartał', () => {
    const sub = makeSubscription({
      frequencyType: FrequencyType.QUARTERLY,
      startDate: '2026-02-01',
    });
    expect(nextPaymentDate(sub, { year: 2026, month: 3 })).toBe('2026-05-01');
  });

  it('zakończona subskrypcja nie ma kolejnej płatności (AC 5.3)', () => {
    const sub = makeSubscription({ isActive: false });
    expect(nextPaymentDate(sub, { year: 2026, month: 8 })).toBeNull();
  });
});

describe('yearlyCostGrosze (5.3 P1)', () => {
  it('miesięczna kosztuje dwunastokrotność', () => {
    expect(yearlyCostGrosze(makeSubscription({ amountGrosze: 4300 }))).toBe(51600);
  });

  it('kwartalna kosztuje czterokrotność', () => {
    expect(
      yearlyCostGrosze(
        makeSubscription({ frequencyType: FrequencyType.QUARTERLY, amountGrosze: 12000 })
      )
    ).toBe(48000);
  });

  it('roczna kosztuje tyle, ile wynosi kwota', () => {
    expect(
      yearlyCostGrosze(
        makeSubscription({ frequencyType: FrequencyType.YEARLY, amountGrosze: 29900 })
      )
    ).toBe(29900);
  });

  it('zakończona subskrypcja nie wchodzi do prognozy', () => {
    expect(yearlyCostGrosze(makeSubscription({ isActive: false }))).toBe(0);
  });
});

describe('needsUsageConfirmation (5.3)', () => {
  it('pyta po upływie domyślnych trzech miesięcy', () => {
    const sub = makeSubscription({
      startDate: '2026-01-08',
      lastUsageConfirmationDate: null,
    });
    expect(needsUsageConfirmation(sub, '2026-03-01')).toBe(false);
    expect(needsUsageConfirmation(sub, '2026-04-01')).toBe(true);
  });

  it('nie pyta zaraz po potwierdzeniu', () => {
    const sub = makeSubscription({ lastUsageConfirmationDate: '2026-08-01' });
    expect(needsUsageConfirmation(sub, '2026-08-19')).toBe(false);
  });

  it('pyta ponownie po kolejnym okresie', () => {
    const sub = makeSubscription({ lastUsageConfirmationDate: '2026-05-01' });
    expect(needsUsageConfirmation(sub, '2026-08-19')).toBe(true);
  });

  it('nie pyta o zakończoną subskrypcję', () => {
    const sub = makeSubscription({ isActive: false, lastUsageConfirmationDate: null });
    expect(needsUsageConfirmation(sub, '2027-01-01')).toBe(false);
  });

  it('respektuje własny okres potwierdzania', () => {
    const sub = makeSubscription({
      startDate: '2026-01-08',
      confirmationIntervalMonths: 6,
      lastUsageConfirmationDate: null,
    });
    expect(needsUsageConfirmation(sub, '2026-04-01')).toBe(false);
    expect(needsUsageConfirmation(sub, '2026-07-01')).toBe(true);
  });
});
