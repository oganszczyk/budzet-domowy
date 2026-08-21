/**
 * ROZDZIAŁ 10: SCENARIUSZE TESTOWE — pełne przejście T-01…T-16.
 *
 * Etap 9 wymaga wykonania wszystkich scenariuszy z rozdziału 10 przed
 * wydaniem. Ten plik odwzorowuje je jeden do jednego, na PRAWDZIWEJ bazie
 * SQLite, przez te same przypadki użycia, których używają ekrany.
 *
 * Trzy scenariusze wymagają telefonu i nie da się ich tu odtworzyć —
 * T-12, T-13 i T-14 dotyczą aparatu i zgód systemowych. Ich logika
 * (reguły odczytu, blokada zapisu bez kwoty) jest pokryta osobno
 * w `features/receipts`; tutaj odnotowujemy, co zostaje do sprawdzenia ręcznie.
 */

import { InMemoryExpensesRepository } from '@/data/in-memory-repository';
import type { ExpensesRepository } from '@/data/repository';
import { migrate } from '@/data/sqlite/migrations';
import { openNodeDatabase } from '@/data/sqlite/node-adapter';
import { seedDefaults } from '@/data/sqlite/seed';
import { SqliteExpensesRepository } from '@/data/sqlite/sqlite-repository';
import { BillStatus, FrequencyType, MainType, PaymentSource } from '@/domain/enums';
import { generateMonthlyBills } from '@/features/bills/generate-monthly-bills';
import { generateSubscriptionPayments } from '@/features/subscriptions/generate-subscription-payments';
import { addMonths, currentYearMonth, dueDateFor, todayIso } from '@/lib/date';
import { formatGrosze, NBSP } from '@/lib/money';

const THIS_MONTH = currentYearMonth();
const NEXT_MONTH = addMonths(THIS_MONTH, 1);

/** Świeża instalacja: pusta baza + zasiew, dokładnie jak pierwsze uruchomienie. */
async function freshInstall(): Promise<ExpensesRepository> {
  const db = openNodeDatabase();
  await migrate(db);
  await seedDefaults(db);
  return new SqliteExpensesRepository(db);
}

async function addFoodPurchase(repo: ExpensesRepository, amountGrosze: number) {
  const categories = await repo.listCategories(MainType.PURCHASE);
  const food = categories.find((c) => c.name === 'Jedzenie') ?? categories[0];

  return repo.createPayment({
    mainType: MainType.PURCHASE,
    categoryId: food.id,
    title: 'Lidl',
    amountGrosze,
    effectiveDate: dueDateFor(THIS_MONTH, 3),
    dueDate: null,
    paidDate: null,
    status: null,
    source: PaymentSource.MANUAL,
    merchant: 'Lidl',
    description: null,
    paymentMethod: 'CARD',
    billTemplateId: null,
    subscriptionId: null,
    receiptImagePath: null,
  });
}

describe('T-01: pierwsze uruchomienie', () => {
  it('domyślne kategorie istnieją, sumy wynoszą 0,00 zł', async () => {
    const repo = await freshInstall();

    expect((await repo.listCategories(MainType.BILL)).length).toBeGreaterThan(0);
    expect((await repo.listCategories(MainType.PURCHASE)).length).toBeGreaterThan(0);
    expect((await repo.listCategories(MainType.SUBSCRIPTION)).length).toBeGreaterThan(0);

    const totals = await repo.getMonthlyTotals(THIS_MONTH);
    expect(formatGrosze(totals.billsGrosze)).toBe(`0,00${NBSP}zł`);
    expect(formatGrosze(totals.subscriptionsGrosze)).toBe(`0,00${NBSP}zł`);
    expect(formatGrosze(totals.purchasesGrosze)).toBe(`0,00${NBSP}zł`);
  });

  it('nawet po wygenerowaniu rachunków sumy zostają zerowe (BR-05)', async () => {
    const repo = await freshInstall();

    // Otwarcie listy rachunków tworzy rekordy z domyślnych szablonów.
    const created = await generateMonthlyBills(repo, THIS_MONTH);
    expect(created.length).toBeGreaterThan(0);

    // Wszystkie czekają na kwotę, więc nie wchodzą do sum.
    expect((await repo.getMonthlyTotals(THIS_MONTH)).billsGrosze).toBe(0);
  });
});

describe('T-02: dodanie zakupu 125,50 zł w Jedzeniu', () => {
  it('karta zakupów i podkategoria rosną o 125,50 zł, pozycja trafia do historii', async () => {
    const repo = await freshInstall();
    const created = await addFoodPurchase(repo, 12550);

    expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(12550);

    const perCategory = await repo.getCategoryTotals(THIS_MONTH, MainType.PURCHASE);
    const food = perCategory.find((entry) => entry.category.id === created.categoryId);
    expect(food?.totalGrosze).toBe(12550);

    expect((await repo.listHistory()).map((p) => p.id)).toContain(created.id);
  });
});

describe('T-03: edycja zakupu z 125,50 zł na 100,00 zł', () => {
  it('sumy zmniejszają się o 25,50 zł', async () => {
    const repo = await freshInstall();
    const created = await addFoodPurchase(repo, 12550);

    await repo.updatePayment(created.id, { amountGrosze: 10000 });

    expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(10000);
    // Spacja przed "zł" jest nierozdzielająca (standard pl-PL) — stąd NBSP.
    expect(formatGrosze(12550 - 10000)).toBe(`25,50${NBSP}zł`);
  });
});

describe('T-04: usunięcie zakupu', () => {
  it('pozycja znika z historii i przestaje wpływać na sumy', async () => {
    const repo = await freshInstall();
    const created = await addFoodPurchase(repo, 12550);

    await repo.deletePayment(created.id);

    expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(0);
    expect((await repo.listHistory()).map((p) => p.id)).not.toContain(created.id);
  });
});

describe('T-05: nowy miesiąc z aktywnym rachunkiem Prąd', () => {
  it('powstaje jedna pozycja „Oczekuje na kwotę"', async () => {
    const repo = await freshInstall();

    await generateMonthlyBills(repo, THIS_MONTH);
    await generateMonthlyBills(repo, NEXT_MONTH);

    const bills = await repo.listPaymentsForMonth(NEXT_MONTH, MainType.BILL);
    const power = bills.filter((b) => b.title === 'Prąd');

    expect(power).toHaveLength(1);
    expect(power[0].status).toBe(BillStatus.WAITING_AMOUNT);
    expect(power[0].amountGrosze).toBeNull();
  });
});

describe('T-06: wpisanie kwoty rachunku 180,40 zł', () => {
  it('rachunek trafia do sumy i historii ze statusem „Do zapłaty"', async () => {
    const repo = await freshInstall();
    await generateMonthlyBills(repo, NEXT_MONTH);

    const bills = await repo.listPaymentsForMonth(NEXT_MONTH, MainType.BILL);
    const power = bills.find((b) => b.title === 'Prąd');
    expect(power).toBeDefined();

    const updated = await repo.updatePayment(power!.id, { amountGrosze: 18040 });

    // Termin w przyszłym miesiącu jeszcze nie minął.
    expect(updated.status).toBe(BillStatus.TO_PAY);
    expect((await repo.getMonthlyTotals(NEXT_MONTH)).billsGrosze).toBe(18040);
    expect((await repo.listHistory()).map((p) => p.id)).toContain(power!.id);
  });
});

describe('T-07: oznaczenie rachunku jako opłacony', () => {
  it('status i data opłacenia są zapisane', async () => {
    const repo = await freshInstall();
    await generateMonthlyBills(repo, NEXT_MONTH);

    const bills = await repo.listPaymentsForMonth(NEXT_MONTH, MainType.BILL);
    const power = bills.find((b) => b.title === 'Prąd')!;
    await repo.updatePayment(power.id, { amountGrosze: 18040 });

    const paid = await repo.updatePayment(power.id, { paidDate: todayIso() });

    expect(paid.status).toBe(BillStatus.PAID);
    expect(paid.paidDate).toBe(todayIso());

    // Zapisane trwale, nie tylko w zwróconym obiekcie.
    expect((await repo.getPayment(power.id))?.paidDate).toBe(todayIso());
  });
});

describe('T-08: nieopłacony rachunek po terminie', () => {
  it('status zmienia się na „Po terminie" bez żadnej aktualizacji danych', async () => {
    const repo = await freshInstall();
    const [billCategory] = await repo.listCategories(MainType.BILL);

    const overdue = await repo.createPayment({
      mainType: MainType.BILL,
      categoryId: billCategory.id,
      title: 'Prąd',
      amountGrosze: 18040,
      effectiveDate: dueDateFor(THIS_MONTH, 1),
      dueDate: '2020-01-15',
      paidDate: null,
      status: null,
      source: PaymentSource.AUTO_BILL,
      merchant: null,
      description: null,
      paymentMethod: null,
      billTemplateId: null,
      subscriptionId: null,
      receiptImagePath: null,
    });

    expect(overdue.status).toBe(BillStatus.OVERDUE);
  });
});

describe('T-09: subskrypcja miesięczna 43,00 zł', () => {
  it('każdego miesiąca powstaje dokładnie jedna płatność 43,00 zł', async () => {
    const repo = await freshInstall();
    const [category] = await repo.listCategories(MainType.SUBSCRIPTION);

    await repo.createSubscription({
      name: 'Netflix',
      amountGrosze: 4300,
      frequencyType: FrequencyType.MONTHLY,
      customIntervalMonths: null,
      startDate: dueDateFor(THIS_MONTH, 8),
      nextPaymentDate: dueDateFor(THIS_MONTH, 8),
      categoryId: category.id,
      isActive: true,
      lastUsageConfirmationDate: null,
      confirmationIntervalMonths: 3,
    });

    for (const month of [THIS_MONTH, NEXT_MONTH, addMonths(THIS_MONTH, 2)]) {
      await generateSubscriptionPayments(repo, month);
      const payments = await repo.listPaymentsForMonth(month, MainType.SUBSCRIPTION);
      const netflix = payments.filter((p) => p.title === 'Netflix');

      expect(netflix).toHaveLength(1);
      expect(netflix[0].amountGrosze).toBe(4300);
    }
  });
});

describe('T-10: subskrypcja roczna', () => {
  it('płatność pojawia się tylko w miesiącu terminu', async () => {
    const repo = await freshInstall();
    const [category] = await repo.listCategories(MainType.SUBSCRIPTION);

    await repo.createSubscription({
      name: 'Domena',
      amountGrosze: 8900,
      frequencyType: FrequencyType.YEARLY,
      customIntervalMonths: null,
      startDate: dueDateFor(THIS_MONTH, 10),
      nextPaymentDate: dueDateFor(THIS_MONTH, 10),
      categoryId: category.id,
      isActive: true,
      lastUsageConfirmationDate: null,
      confirmationIntervalMonths: 3,
    });

    // Miesiąc rocznicy.
    await generateSubscriptionPayments(repo, THIS_MONTH);
    expect((await repo.getMonthlyTotals(THIS_MONTH)).subscriptionsGrosze).toBe(8900);

    // Jedenaście kolejnych miesięcy: nic.
    for (let offset = 1; offset <= 11; offset++) {
      const month = addMonths(THIS_MONTH, offset);
      await generateSubscriptionPayments(repo, month);
      expect((await repo.getMonthlyTotals(month)).subscriptionsGrosze).toBe(0);
    }

    // Rok później znowu.
    const anniversary = addMonths(THIS_MONTH, 12);
    await generateSubscriptionPayments(repo, anniversary);
    expect((await repo.getMonthlyTotals(anniversary)).subscriptionsGrosze).toBe(8900);
  });
});

describe('T-11: zakończenie subskrypcji', () => {
  it('nie powstają przyszłe płatności, historia pozostaje', async () => {
    const repo = await freshInstall();
    const [category] = await repo.listCategories(MainType.SUBSCRIPTION);

    const subscription = await repo.createSubscription({
      name: 'Netflix',
      amountGrosze: 4300,
      frequencyType: FrequencyType.MONTHLY,
      customIntervalMonths: null,
      startDate: dueDateFor(THIS_MONTH, 8),
      nextPaymentDate: dueDateFor(THIS_MONTH, 8),
      categoryId: category.id,
      isActive: true,
      lastUsageConfirmationDate: null,
      confirmationIntervalMonths: 3,
    });

    await generateSubscriptionPayments(repo, THIS_MONTH);
    const historyBefore = (await repo.listHistory()).filter(
      (p) => p.subscriptionId === subscription.id
    );
    expect(historyBefore).toHaveLength(1);

    await repo.updateSubscription(subscription.id, { isActive: false });
    await generateSubscriptionPayments(repo, NEXT_MONTH);

    // Przyszłość: nic nowego.
    expect((await repo.getMonthlyTotals(NEXT_MONTH)).subscriptionsGrosze).toBe(0);
    // Przeszłość: nietknięta.
    const historyAfter = (await repo.listHistory()).filter(
      (p) => p.subscriptionId === subscription.id
    );
    expect(historyAfter).toHaveLength(1);
  });
});

describe('T-15: przełączenie miesiąca', () => {
  it('sumy i listy odpowiadają wybranemu miesiącowi', async () => {
    const repo = await freshInstall();
    const categories = await repo.listCategories(MainType.PURCHASE);

    const addIn = (month: typeof THIS_MONTH, amountGrosze: number) =>
      repo.createPayment({
        mainType: MainType.PURCHASE,
        categoryId: categories[0].id,
        title: 'Zakup',
        amountGrosze,
        effectiveDate: dueDateFor(month, 5),
        dueDate: null,
        paidDate: null,
        status: null,
        source: PaymentSource.MANUAL,
        merchant: 'Sklep',
        description: null,
        paymentMethod: null,
        billTemplateId: null,
        subscriptionId: null,
        receiptImagePath: null,
      });

    await addIn(THIS_MONTH, 10000);
    await addIn(NEXT_MONTH, 25000);

    expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(10000);
    expect((await repo.getMonthlyTotals(NEXT_MONTH)).purchasesGrosze).toBe(25000);
    expect(await repo.listPaymentsForMonth(THIS_MONTH, MainType.PURCHASE)).toHaveLength(1);
    expect(await repo.listPaymentsForMonth(NEXT_MONTH, MainType.PURCHASE)).toHaveLength(1);
  });
});

/**
 * T-16 sprawdzamy na prawdziwym pliku bazy w `data/sqlite/migrations.test.ts`,
 * bo wymaga zamknięcia i ponownego otwarcia połączenia. Tutaj potwierdzamy
 * powiązaną gwarancję: migracja na ISTNIEJĄCYCH danych niczego nie gubi
 * (Etap 9: „Sprawdzić migrację bazy na danych istniejących").
 */
describe('Etap 9: migracja na istniejących danych', () => {
  it('ponowna migracja nie rusza zapisanych rekordów', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);
    const repo = new SqliteExpensesRepository(db);

    const created = await addFoodPurchase(repo, 12550);
    const categoriesBefore = (await repo.listCategories()).length;

    // Kolejny start aplikacji: migracja i zasiew wołane są zawsze.
    await migrate(db);
    await seedDefaults(db);

    expect((await repo.getPayment(created.id))?.amountGrosze).toBe(12550);
    expect((await repo.listCategories()).length).toBe(categoriesBefore);
    expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(12550);
  });
});

/**
 * Etap 9: „Usunąć dane demonstracyjne lub oznaczyć je jako opcjonalne."
 *
 * Dane demonstracyjne nie trafiają do aplikacji: zasiew bazy tworzy wyłącznie
 * kategorie i szablony rachunków. Generator danych demo pozostał wyłącznie
 * jako narzędzie testowe (repozytorium pamięciowe).
 */
describe('Etap 9: dane demonstracyjne poza wydaniem', () => {
  it('świeża instalacja nie zawiera ani jednej płatności', async () => {
    const repo = await freshInstall();
    expect(await repo.listHistory()).toHaveLength(0);
  });

  it('repozytorium demonstracyjne nadal działa — służy testom, nie aplikacji', async () => {
    const demo = new InMemoryExpensesRepository();
    expect((await demo.listHistory()).length).toBeGreaterThan(0);
  });
});
