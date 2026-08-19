import { BillStatus, MainType, PaymentSource } from '@/domain/enums';
import { addMonths, currentYearMonth, todayIso } from '@/lib/date';

import { InMemoryExpensesRepository } from './in-memory-repository';

const THIS_MONTH = currentYearMonth();
const LAST_MONTH = addMonths(THIS_MONTH, -1);

function repo() {
  return new InMemoryExpensesRepository();
}

describe('T-01: pierwsze uruchomienie', () => {
  it('domyślne kategorie istnieją dla wszystkich trzech typów', async () => {
    const r = repo();
    expect((await r.listCategories(MainType.BILL)).length).toBeGreaterThan(0);
    expect((await r.listCategories(MainType.SUBSCRIPTION)).length).toBeGreaterThan(0);
    expect((await r.listCategories(MainType.PURCHASE)).length).toBeGreaterThan(0);
  });

  it('subskrypcje i zakupy dzielą TE SAME podkategorie', async () => {
    const r = repo();
    const forSubscriptions = await r.listCategories(MainType.SUBSCRIPTION);
    const forPurchases = await r.listCategories(MainType.PURCHASE);

    // Ten sam identyfikator, nie tylko ta sama nazwa — dzięki temu przyszła
    // analiza zsumuje np. „Rozrywkę" z obu źródeł bez porównywania tekstu.
    expect(forSubscriptions.map((c) => c.id)).toEqual(forPurchases.map((c) => c.id));

    const entertainment = forSubscriptions.find((c) => c.name === 'Rozrywka');
    expect(entertainment).toBeDefined();
    expect(entertainment?.usedBy).toEqual([MainType.SUBSCRIPTION, MainType.PURCHASE]);
  });

  it('AI i chmura są scalone w jedną podkategorię „Komputerowe"', async () => {
    const categories = await repo().listCategories(MainType.SUBSCRIPTION);
    const names = categories.map((c) => c.name);

    expect(names).toContain('Komputerowe');
    expect(names).not.toContain('AI');
    expect(names).not.toContain('Chmura');
  });

  it('rachunki nie mają podkategorii — jedna kategoria na wszystkie', async () => {
    const bills = await repo().listCategories(MainType.BILL);
    expect(bills).toHaveLength(1);
  });

  it('kategoria rachunków nie jest współdzielona z zakupami', async () => {
    const r = repo();
    const bills = await r.listCategories(MainType.BILL);
    const purchases = await r.listCategories(MainType.PURCHASE);
    expect(purchases.map((c) => c.id)).not.toContain(bills[0].id);
  });

  it('miesiąc bez żadnych danych ma sumy zerowe, a nie błąd (5.1)', async () => {
    const totals = await repo().getMonthlyTotals(addMonths(THIS_MONTH, 24));
    expect(totals).toEqual({
      billsGrosze: 0,
      subscriptionsGrosze: 0,
      purchasesGrosze: 0,
    });
  });
});

describe('createCategory — własne podkategorie (12.1)', () => {
  it('nowa podkategoria pojawia się w zakupach I w subskrypcjach', async () => {
    const r = repo();
    const created = await r.createCategory({
      name: 'Zwierzęta',
      usedBy: [MainType.SUBSCRIPTION, MainType.PURCHASE],
      iconKey: 'pricetag-outline',
      isActive: true,
    });

    const forPurchases = await r.listCategories(MainType.PURCHASE);
    const forSubscriptions = await r.listCategories(MainType.SUBSCRIPTION);

    // Ten sam identyfikator w obu — inaczej analiza nie mogłaby ich zsumować.
    expect(forPurchases.map((c) => c.id)).toContain(created.id);
    expect(forSubscriptions.map((c) => c.id)).toContain(created.id);
  });

  it('nowa podkategoria trafia na koniec listy', async () => {
    const r = repo();
    const before = await r.listCategories(MainType.PURCHASE);
    const created = await r.createCategory({
      name: 'Zwierzęta',
      usedBy: [MainType.PURCHASE],
      iconKey: 'pricetag-outline',
      isActive: true,
    });

    const after = await r.listCategories(MainType.PURCHASE);
    expect(after).toHaveLength(before.length + 1);
    expect(after[after.length - 1].id).toBe(created.id);
  });

  it('nie nadpisuje identyfikatorów istniejących kategorii', async () => {
    const r = repo();
    const before = await r.listCategories();
    const created = await r.createCategory({
      name: 'Zwierzęta',
      usedBy: [MainType.PURCHASE],
      iconKey: 'pricetag-outline',
      isActive: true,
    });

    expect(before.map((c) => c.id)).not.toContain(created.id);
  });

  it('nowa podkategoria od razu przyjmuje wydatki i liczy sumę', async () => {
    const r = repo();
    const created = await r.createCategory({
      name: 'Zwierzęta',
      usedBy: [MainType.PURCHASE],
      iconKey: 'pricetag-outline',
      isActive: true,
    });

    await r.createPayment({
      mainType: MainType.PURCHASE,
      categoryId: created.id,
      title: 'Karma',
      amountGrosze: 8900,
      effectiveDate: todayIso(),
      dueDate: null,
      paidDate: null,
      status: null,
      source: PaymentSource.MANUAL,
      merchant: 'Zoo Karina',
      description: null,
      paymentMethod: null,
      billTemplateId: null,
      subscriptionId: null,
      receiptImagePath: null,
    });

    const totals = await r.getCategoryTotals(THIS_MONTH, MainType.PURCHASE);
    const entry = totals.find((t) => t.category.id === created.id);
    expect(entry?.totalGrosze).toBe(8900);
  });
});

describe('getMonthlyTotals (6.1, BR-05, BR-09)', () => {
  it('BR-05: rachunek bez kwoty nie zwiększa sumy', async () => {
    const r = repo();
    const bills = await r.listPaymentsForMonth(THIS_MONTH, MainType.BILL);
    const waiting = bills.filter((b) => b.amountGrosze === null);
    const withAmount = bills.filter((b) => b.amountGrosze !== null);

    // Dane demonstracyjne zawierają rachunek oczekujący na kwotę (Woda).
    expect(waiting.length).toBeGreaterThan(0);

    const totals = await r.getMonthlyTotals(THIS_MONTH);
    const expected = withAmount.reduce((sum, b) => sum + (b.amountGrosze ?? 0), 0);
    expect(totals.billsGrosze).toBe(expected);
  });

  it('6.1: suma rachunków obejmuje opłacone i nieopłacone', async () => {
    const r = repo();
    const bills = await r.listPaymentsForMonth(THIS_MONTH, MainType.BILL);
    const paid = bills.filter((b) => b.status === BillStatus.PAID);
    const unpaid = bills.filter(
      (b) => b.status === BillStatus.TO_PAY || b.status === BillStatus.OVERDUE
    );

    expect(paid.length).toBeGreaterThan(0);
    expect(unpaid.length).toBeGreaterThan(0);

    const totals = await r.getMonthlyTotals(THIS_MONTH);
    const both = [...paid, ...unpaid].reduce((sum, b) => sum + (b.amountGrosze ?? 0), 0);
    expect(totals.billsGrosze).toBe(both);
  });

  it('T-15 / BR-09: różne miesiące mają niezależne sumy', async () => {
    const r = repo();
    const now = await r.getMonthlyTotals(THIS_MONTH);
    const before = await r.getMonthlyTotals(LAST_MONTH);

    expect(now.purchasesGrosze).not.toBe(before.purchasesGrosze);
    expect(now.subscriptionsGrosze).not.toBe(before.subscriptionsGrosze);
  });
});

describe('T-02 / T-03 / T-04: dodanie, edycja i usunięcie zakupu', () => {
  async function addFoodPurchase(r: InMemoryExpensesRepository, amountGrosze: number) {
    const [food] = await r.listCategories(MainType.PURCHASE);
    return r.createPayment({
      mainType: MainType.PURCHASE,
      categoryId: food.id,
      title: 'Test',
      amountGrosze,
      effectiveDate: todayIso(),
      dueDate: null,
      paidDate: null,
      status: null,
      source: PaymentSource.MANUAL,
      merchant: 'Test',
      description: null,
      paymentMethod: null,
      billTemplateId: null,
      subscriptionId: null,
      receiptImagePath: null,
    });
  }

  it('T-02: dodanie zakupu 125,50 zł zwiększa sumę o 125,50 zł', async () => {
    const r = repo();
    const before = (await r.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;

    await addFoodPurchase(r, 12550);

    const after = (await r.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;
    expect(after - before).toBe(12550);
  });

  it('T-02: nowy wydatek natychmiast pojawia się w historii', async () => {
    const r = repo();
    const created = await addFoodPurchase(r, 12550);
    const history = await r.listHistory();
    expect(history.map((p) => p.id)).toContain(created.id);
  });

  it('T-03: edycja z 125,50 zł na 100,00 zł zmniejsza sumę o 25,50 zł', async () => {
    const r = repo();
    const created = await addFoodPurchase(r, 12550);
    const before = (await r.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;

    await r.updatePayment(created.id, { amountGrosze: 10000 });

    const after = (await r.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;
    expect(before - after).toBe(2550);
  });

  it('T-04: usunięcie zakupu wycofuje go z sum i z historii', async () => {
    const r = repo();
    const before = (await r.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;
    const created = await addFoodPurchase(r, 12550);

    await r.deletePayment(created.id);

    const after = (await r.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;
    expect(after).toBe(before);

    const history = await r.listHistory();
    expect(history.map((p) => p.id)).not.toContain(created.id);
  });
});

describe('listHistory (5.7)', () => {
  it('nie pokazuje rachunków oczekujących na kwotę (BR-05)', async () => {
    const history = await repo().listHistory();
    expect(history.every((p) => p.amountGrosze !== null)).toBe(true);
  });

  it('sortuje od najnowszych do najstarszych', async () => {
    const history = await repo().listHistory();
    for (let i = 1; i < history.length; i++) {
      expect(history[i - 1].effectiveDate >= history[i].effectiveDate).toBe(true);
    }
  });

  it('zawiera wszystkie trzy typy płatności', async () => {
    const history = await repo().listHistory();
    const types = new Set(history.map((p) => p.mainType));
    expect(types).toEqual(new Set([MainType.BILL, MainType.SUBSCRIPTION, MainType.PURCHASE]));
  });
});

describe('status rachunku jest wyliczany przy odczycie (BR-11)', () => {
  it('rachunki mają nadany status, mimo że nie jest zapisany w danych', async () => {
    const bills = await repo().listPaymentsForMonth(THIS_MONTH, MainType.BILL);
    expect(bills.length).toBeGreaterThan(0);
    expect(bills.every((b) => b.status !== null)).toBe(true);
  });

  it('dane demonstracyjne pokazują rachunek oczekujący na kwotę', async () => {
    const bills = await repo().listPaymentsForMonth(THIS_MONTH, MainType.BILL);
    expect(bills.some((b) => b.status === BillStatus.WAITING_AMOUNT)).toBe(true);
  });

  it('płatności inne niż rachunki nie dostają statusu rachunku', async () => {
    const purchases = await repo().listPaymentsForMonth(THIS_MONTH, MainType.PURCHASE);
    expect(purchases.every((p) => p.status === null)).toBe(true);
  });
});

describe('getCategoryTotals (5.4)', () => {
  it('suma podkategorii zgadza się z sumą całej kategorii głównej', async () => {
    const r = repo();
    const perCategory = await r.getCategoryTotals(THIS_MONTH, MainType.PURCHASE);
    const totals = await r.getMonthlyTotals(THIS_MONTH);

    const sum = perCategory.reduce((total, c) => total + c.totalGrosze, 0);
    expect(sum).toBe(totals.purchasesGrosze);
  });
});
