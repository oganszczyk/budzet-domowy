import { InMemoryExpensesRepository } from '@/data/in-memory-repository';
import { FrequencyType, MainType } from '@/domain/enums';
import { addMonths, currentYearMonth } from '@/lib/date';

import { generateSubscriptionPayments } from './generate-subscription-payments';

const THIS_MONTH = currentYearMonth();
const NEXT_MONTH = addMonths(THIS_MONTH, 1);

function repo() {
  return new InMemoryExpensesRepository();
}

describe('generateSubscriptionPayments (5.3)', () => {
  it('T-09: subskrypcja miesięczna tworzy dokładnie jedną płatność w miesiącu', async () => {
    const r = repo();
    await generateSubscriptionPayments(r, NEXT_MONTH);

    const payments = await r.listPaymentsForMonth(NEXT_MONTH, MainType.SUBSCRIPTION);
    const netflix = payments.filter((p) => p.title === 'Netflix');

    expect(netflix).toHaveLength(1);
    expect(netflix[0].amountGrosze).toBe(4300);
  });

  it('BR-12: ponowne wywołanie nie tworzy duplikatów', async () => {
    const r = repo();

    const first = await generateSubscriptionPayments(r, NEXT_MONTH);
    const second = await generateSubscriptionPayments(r, NEXT_MONTH);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toHaveLength(0);

    const payments = await r.listPaymentsForMonth(NEXT_MONTH, MainType.SUBSCRIPTION);
    const ids = payments.map((p) => p.subscriptionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('usunięta płatność subskrypcji nie wraca (5.8)', async () => {
    const r = repo();
    await generateSubscriptionPayments(r, NEXT_MONTH);

    const payments = await r.listPaymentsForMonth(NEXT_MONTH, MainType.SUBSCRIPTION);
    const victim = payments[0];
    await r.deletePayment(victim.id);

    await generateSubscriptionPayments(r, NEXT_MONTH);
    await generateSubscriptionPayments(r, NEXT_MONTH);

    const after = await r.listPaymentsForMonth(NEXT_MONTH, MainType.SUBSCRIPTION);
    expect(after.map((p) => p.id)).not.toContain(victim.id);
  });

  it('T-11: zakończona subskrypcja nie generuje nowych płatności', async () => {
    const r = repo();
    const [netflix] = await r.listSubscriptions();

    await r.updateSubscription(netflix.id, { isActive: false });
    await generateSubscriptionPayments(r, NEXT_MONTH);

    const payments = await r.listPaymentsForMonth(NEXT_MONTH, MainType.SUBSCRIPTION);
    expect(payments.map((p) => p.subscriptionId)).not.toContain(netflix.id);
  });

  it('T-11: zakończenie subskrypcji zachowuje wcześniejsze płatności w historii', async () => {
    const r = repo();
    const [netflix] = await r.listSubscriptions();

    const before = (await r.listHistory()).filter((p) => p.subscriptionId === netflix.id);
    expect(before.length).toBeGreaterThan(0);

    await r.updateSubscription(netflix.id, { isActive: false });

    const after = (await r.listHistory()).filter((p) => p.subscriptionId === netflix.id);
    expect(after).toHaveLength(before.length);
  });

  it('T-10: subskrypcja roczna zwiększa sumę tylko w miesiącu płatności', async () => {
    const r = repo();
    const anniversary = addMonths(THIS_MONTH, 2);

    await r.createSubscription({
      name: 'Domena',
      amountGrosze: 8900,
      frequencyType: FrequencyType.YEARLY,
      customIntervalMonths: null,
      startDate: `${anniversary.year}-${String(anniversary.month).padStart(2, '0')}-10`,
      nextPaymentDate: `${anniversary.year}-${String(anniversary.month).padStart(2, '0')}-10`,
      categoryId: (await r.listCategories(MainType.SUBSCRIPTION))[0].id,
      isActive: true,
      lastUsageConfirmationDate: null,
      confirmationIntervalMonths: 3,
    });

    // Miesiąc rocznicy — płatność powstaje.
    await generateSubscriptionPayments(r, anniversary);
    const onAnniversary = await r.listPaymentsForMonth(anniversary, MainType.SUBSCRIPTION);
    expect(onAnniversary.map((p) => p.title)).toContain('Domena');

    // Miesiąc obok — nie powstaje.
    const monthAfter = addMonths(anniversary, 1);
    await generateSubscriptionPayments(r, monthAfter);
    const after = await r.listPaymentsForMonth(monthAfter, MainType.SUBSCRIPTION);
    expect(after.map((p) => p.title)).not.toContain('Domena');
  });

  it('AC 5.3: zmiana kwoty wpływa tylko na przyszłe płatności (BR-07)', async () => {
    const r = repo();
    const [netflix] = await r.listSubscriptions();

    // Płatność po starej cenie.
    await generateSubscriptionPayments(r, NEXT_MONTH);
    const oldPayment = (await r.listPaymentsForMonth(NEXT_MONTH, MainType.SUBSCRIPTION)).find(
      (p) => p.subscriptionId === netflix.id
    );
    expect(oldPayment?.amountGrosze).toBe(4300);

    // Podwyżka ceny.
    await r.updateSubscription(netflix.id, { amountGrosze: 5300 });

    // Kolejny miesiąc dostaje nową cenę...
    const later = addMonths(NEXT_MONTH, 1);
    await generateSubscriptionPayments(r, later);
    const newPayment = (await r.listPaymentsForMonth(later, MainType.SUBSCRIPTION)).find(
      (p) => p.subscriptionId === netflix.id
    );
    expect(newPayment?.amountGrosze).toBe(5300);

    // ...a zapisana wcześniej płatność zostaje nietknięta.
    const unchanged = await r.getPayment(oldPayment!.id);
    expect(unchanged?.amountGrosze).toBe(4300);
  });
});
