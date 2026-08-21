import { InMemoryExpensesRepository } from '@/data/in-memory-repository';
import { MainType, PaymentSource } from '@/domain/enums';
import type { Payment } from '@/domain/models';

import { groupPaymentsByMonth } from './group-by-month';

function makePayment(id: number, effectiveDate: string, amountGrosze: number): Payment {
  return {
    id,
    mainType: MainType.PURCHASE,
    categoryId: 1,
    title: `Zakup ${id}`,
    amountGrosze,
    effectiveDate,
    dueDate: null,
    paidDate: null,
    status: null,
    source: PaymentSource.MANUAL,
    merchant: null,
    description: null,
    paymentMethod: null,
    billTemplateId: null,
    subscriptionId: null,
    receiptImagePath: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('groupPaymentsByMonth (5.7)', () => {
  it('pusta lista daje brak grup', () => {
    expect(groupPaymentsByMonth([])).toEqual([]);
  });

  it('dzieli płatności na miesiące i sumuje każdy z osobna', () => {
    const groups = groupPaymentsByMonth([
      makePayment(3, '2026-08-19', 10000),
      makePayment(2, '2026-08-03', 5000),
      makePayment(1, '2026-07-28', 2500),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].month).toEqual({ year: 2026, month: 8 });
    expect(groups[0].payments).toHaveLength(2);
    expect(groups[0].totalGrosze).toBe(15000);
    expect(groups[1].month).toEqual({ year: 2026, month: 7 });
    expect(groups[1].totalGrosze).toBe(2500);
  });

  it('zachowuje kolejność od najnowszych do najstarszych', () => {
    const groups = groupPaymentsByMonth([
      makePayment(4, '2026-08-19', 100),
      makePayment(3, '2026-08-10', 100),
      makePayment(2, '2026-06-05', 100),
      makePayment(1, '2025-12-31', 100),
    ]);

    expect(groups.map((g) => `${g.month.year}-${g.month.month}`)).toEqual([
      '2026-8',
      '2026-6',
      '2025-12',
    ]);
  });

  it('AC 5.7: zachowuje kolejność wielu płatności tego samego dnia', () => {
    const groups = groupPaymentsByMonth([
      makePayment(9, '2026-08-19', 100),
      makePayment(8, '2026-08-19', 200),
      makePayment(7, '2026-08-19', 300),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].payments.map((p) => p.id)).toEqual([9, 8, 7]);
  });

  it('nie łączy tego samego miesiąca z różnych lat', () => {
    const groups = groupPaymentsByMonth([
      makePayment(2, '2026-08-19', 100),
      makePayment(1, '2025-08-19', 100),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0].month.year).toBe(2026);
    expect(groups[1].month.year).toBe(2025);
  });
});

describe('grupowanie prawdziwej historii', () => {
  it('suma grupy miesiąca zgadza się z sumami z ekranu głównego (6.1)', async () => {
    const r = new InMemoryExpensesRepository();
    const history = await r.listHistory();
    const groups = groupPaymentsByMonth(history);

    expect(groups.length).toBeGreaterThan(0);

    for (const group of groups) {
      const totals = await r.getMonthlyTotals(group.month);
      const fromCards = totals.billsGrosze + totals.subscriptionsGrosze + totals.purchasesGrosze;

      // Historia i karty ekranu głównego liczą ten sam zbiór rekordów,
      // więc muszą dać ten sam wynik. Rozjazd oznaczałby, że któraś
      // z reguł BR-05 działa tylko w jednym miejscu.
      expect(group.totalGrosze).toBe(fromCards);
    }
  });
});
