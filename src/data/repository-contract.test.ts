/**
 * Kontrakt repozytorium — te same testy uruchamiane na OBU implementacjach.
 *
 * To jest dowód, że podmiana danych z pamięci na SQLite niczego nie zmienia
 * z punktu widzenia ekranów. Gdyby któraś reguła biznesowa działała tylko
 * w jednej wersji, ten plik by to wychwycił.
 */

import { MainType, PaymentSource } from '@/domain/enums';
import { addMonths, currentYearMonth, dueDateFor, todayIso } from '@/lib/date';

import { InMemoryExpensesRepository } from './in-memory-repository';
import type { ExpensesRepository } from './repository';
import { openNodeDatabase } from './sqlite/node-adapter';
import { migrate } from './sqlite/migrations';
import { seedDefaults } from './sqlite/seed';
import { SqliteExpensesRepository } from './sqlite/sqlite-repository';

const THIS_MONTH = currentYearMonth();
const NEXT_MONTH = addMonths(THIS_MONTH, 1);

async function createSqliteRepository(): Promise<ExpensesRepository> {
  const db = openNodeDatabase();
  await migrate(db);
  await seedDefaults(db);
  return new SqliteExpensesRepository(db);
}

async function createInMemoryRepository(): Promise<ExpensesRepository> {
  return new InMemoryExpensesRepository();
}

function runContract(name: string, createRepository: () => Promise<ExpensesRepository>) {
  describe(name, () => {
    /** Dodaje zakup do pierwszej dostępnej podkategorii. */
    async function addPurchase(
      repo: ExpensesRepository,
      amountGrosze: number | null,
      day = 15,
      month = THIS_MONTH
    ) {
      const [category] = await repo.listCategories(MainType.PURCHASE);
      return repo.createPayment({
        mainType: MainType.PURCHASE,
        categoryId: category.id,
        title: 'Test',
        amountGrosze,
        effectiveDate: dueDateFor(month, day),
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
    }

    it('T-01: istnieją domyślne kategorie dla wszystkich typów', async () => {
      const repo = await createRepository();
      expect((await repo.listCategories(MainType.BILL)).length).toBeGreaterThan(0);
      expect((await repo.listCategories(MainType.SUBSCRIPTION)).length).toBeGreaterThan(0);
      expect((await repo.listCategories(MainType.PURCHASE)).length).toBeGreaterThan(0);
    });

    it('subskrypcje i zakupy dzielą te same podkategorie', async () => {
      const repo = await createRepository();
      const forSubscriptions = await repo.listCategories(MainType.SUBSCRIPTION);
      const forPurchases = await repo.listCategories(MainType.PURCHASE);
      expect(forSubscriptions.map((c) => c.id)).toEqual(forPurchases.map((c) => c.id));
    });

    it('T-02: dodany zakup podnosi sumę o swoją kwotę', async () => {
      const repo = await createRepository();
      const before = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;

      await addPurchase(repo, 12550);

      const after = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;
      expect(after - before).toBe(12550);
    });

    it('T-03: edycja kwoty aktualizuje sumę', async () => {
      const repo = await createRepository();
      const created = await addPurchase(repo, 12550);
      const before = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;

      await repo.updatePayment(created.id, { amountGrosze: 10000 });

      const after = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;
      expect(before - after).toBe(2550);
    });

    it('T-04: usunięcie wycofuje zakup z sum i historii', async () => {
      const repo = await createRepository();
      const before = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;
      const created = await addPurchase(repo, 12550);

      await repo.deletePayment(created.id);

      expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(before);
      expect((await repo.listHistory()).map((p) => p.id)).not.toContain(created.id);
    });

    it('BR-05: płatność bez kwoty nie wchodzi do sum ani do historii', async () => {
      const repo = await createRepository();
      const before = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;

      const created = await addPurchase(repo, null);

      expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(before);
      expect((await repo.listHistory()).map((p) => p.id)).not.toContain(created.id);
    });

    it('BR-09: sumy dotyczą tylko wybranego miesiąca', async () => {
      const repo = await createRepository();
      const before = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;

      await addPurchase(repo, 9900, 10, NEXT_MONTH);

      expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(before);
      expect((await repo.getMonthlyTotals(NEXT_MONTH)).purchasesGrosze).toBeGreaterThanOrEqual(
        9900
      );
    });

    it('AC 5.7: historia jest posortowana od najnowszych, ze stabilnym remisem', async () => {
      const repo = await createRepository();
      const first = await addPurchase(repo, 100, 10);
      const second = await addPurchase(repo, 200, 10);
      const later = await addPurchase(repo, 300, 20);

      const history = await repo.listHistory();
      const ids = history.map((p) => p.id);

      // Późniejsza data przed wcześniejszą.
      expect(ids.indexOf(later.id)).toBeLessThan(ids.indexOf(second.id));
      // Ten sam dzień: nowszy rekord (wyższe id) jako pierwszy.
      expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    });

    it('BR-11: status rachunku jest wyliczany przy odczycie', async () => {
      const repo = await createRepository();
      const [billCategory] = await repo.listCategories(MainType.BILL);

      const overdue = await repo.createPayment({
        mainType: MainType.BILL,
        categoryId: billCategory.id,
        title: 'Prąd',
        amountGrosze: 18040,
        effectiveDate: dueDateFor(THIS_MONTH, 1),
        // Termin w przeszłości — status musi wyjść „po terminie".
        dueDate: '2020-01-10',
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

      expect(overdue.status).toBe('OVERDUE');
      expect((await repo.getPayment(overdue.id))?.status).toBe('OVERDUE');

      const paid = await repo.updatePayment(overdue.id, { paidDate: todayIso() });
      expect(paid.status).toBe('PAID');
    });

    it('rejestr wygenerowanych rekordów zapamiętuje utworzenie', async () => {
      const repo = await createRepository();
      const [template] = await repo.listBillTemplates();

      expect(await repo.hasGeneratedBill(template.id, NEXT_MONTH)).toBe(false);
      await repo.markBillGenerated(template.id, NEXT_MONTH);
      expect(await repo.hasGeneratedBill(template.id, NEXT_MONTH)).toBe(true);

      // Inny miesiąc to inny wpis.
      expect(await repo.hasGeneratedBill(template.id, addMonths(NEXT_MONTH, 1))).toBe(false);
    });

    it('rejestr przeżywa usunięcie płatności — usunięty rachunek nie wraca', async () => {
      const repo = await createRepository();
      const [template] = await repo.listBillTemplates();

      await repo.markBillGenerated(template.id, NEXT_MONTH);
      const [billCategory] = await repo.listCategories(MainType.BILL);
      const bill = await repo.createPayment({
        mainType: MainType.BILL,
        categoryId: billCategory.id,
        title: template.name,
        amountGrosze: null,
        effectiveDate: dueDateFor(NEXT_MONTH, 1),
        dueDate: dueDateFor(NEXT_MONTH, template.defaultDueDay),
        paidDate: null,
        status: null,
        source: PaymentSource.AUTO_BILL,
        merchant: null,
        description: null,
        paymentMethod: null,
        billTemplateId: template.id,
        subscriptionId: null,
        receiptImagePath: null,
      });

      await repo.deletePayment(bill.id);

      expect(await repo.hasGeneratedBill(template.id, NEXT_MONTH)).toBe(true);
    });

    it('7.5: wyłączony szablon znika z listy aktywnych, ale nie z bazy', async () => {
      const repo = await createRepository();
      const [template] = await repo.listBillTemplates();

      await repo.deactivateBillTemplate(template.id);

      expect((await repo.listBillTemplates()).map((t) => t.id)).not.toContain(template.id);
      expect((await repo.listBillTemplates(true)).map((t) => t.id)).toContain(template.id);
      expect((await repo.getBillTemplate(template.id))?.isActive).toBe(false);
    });

    it('subskrypcję da się utworzyć, zmienić i zakończyć', async () => {
      const repo = await createRepository();
      const [category] = await repo.listCategories(MainType.SUBSCRIPTION);

      const created = await repo.createSubscription({
        name: 'Netflix',
        amountGrosze: 4300,
        frequencyType: 'MONTHLY',
        customIntervalMonths: null,
        startDate: dueDateFor(THIS_MONTH, 8),
        nextPaymentDate: dueDateFor(NEXT_MONTH, 8),
        categoryId: category.id,
        isActive: true,
        lastUsageConfirmationDate: null,
        confirmationIntervalMonths: 3,
      });

      expect(created.amountGrosze).toBe(4300);
      expect(created.isActive).toBe(true);

      const raised = await repo.updateSubscription(created.id, { amountGrosze: 5300 });
      expect(raised.amountGrosze).toBe(5300);

      const ended = await repo.updateSubscription(created.id, { isActive: false });
      expect(ended.isActive).toBe(false);
      expect((await repo.getSubscription(created.id))?.isActive).toBe(false);
    });

    it('własna podkategoria trafia do zakupów i subskrypcji', async () => {
      const repo = await createRepository();
      const created = await repo.createCategory({
        name: 'Zwierzęta',
        usedBy: [MainType.SUBSCRIPTION, MainType.PURCHASE],
        iconKey: 'pricetag-outline',
        isActive: true,
      });

      expect((await repo.listCategories(MainType.PURCHASE)).map((c) => c.id)).toContain(created.id);
      expect((await repo.listCategories(MainType.SUBSCRIPTION)).map((c) => c.id)).toContain(
        created.id
      );
    });

    it('5.4: sumy podkategorii sumują się do sumy kategorii głównej', async () => {
      const repo = await createRepository();
      await addPurchase(repo, 12550);

      const perCategory = await repo.getCategoryTotals(THIS_MONTH, MainType.PURCHASE);
      const totals = await repo.getMonthlyTotals(THIS_MONTH);

      const sum = perCategory.reduce((total, entry) => total + entry.totalGrosze, 0);
      expect(sum).toBe(totals.purchasesGrosze);
    });

    it('5.2: historia kwot rachunku pomija miesiące bez kwoty', async () => {
      const repo = await createRepository();
      const [billCategory] = await repo.listCategories(MainType.BILL);

      // Własny szablon, żeby wynik nie zależał od tego, co repozytorium
      // miało w sobie na starcie.
      const template = await repo.createBillTemplate({
        name: 'Ogrzewanie',
        categoryId: billCategory.id,
        defaultDueDay: 12,
        isActive: true,
        useFixedAmount: false,
        fixedAmountGrosze: null,
      });

      const makeBill = (month: typeof THIS_MONTH, amountGrosze: number | null) =>
        repo.createPayment({
          mainType: MainType.BILL,
          categoryId: billCategory.id,
          title: template.name,
          amountGrosze,
          effectiveDate: dueDateFor(month, 1),
          dueDate: dueDateFor(month, template.defaultDueDay),
          paidDate: null,
          status: null,
          source: PaymentSource.AUTO_BILL,
          merchant: null,
          description: null,
          paymentMethod: null,
          billTemplateId: template.id,
          subscriptionId: null,
          receiptImagePath: null,
        });

      await makeBill(addMonths(THIS_MONTH, -2), 16580);
      await makeBill(addMonths(THIS_MONTH, -1), 17200);
      await makeBill(THIS_MONTH, null);

      const history = await repo.listBillAmountHistory(template.id);
      expect(history.map((h) => h.amountGrosze)).toEqual([17200, 16580]);
    });
  });
}

runContract('Repozytorium w pamięci', createInMemoryRepository);
runContract('Repozytorium SQLite', createSqliteRepository);
