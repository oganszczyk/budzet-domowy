/**
 * Kontrakt repozytorium — te same testy uruchamiane na OBU implementacjach.
 *
 * To jest dowód, że podmiana danych z pamięci na SQLite niczego nie zmienia
 * z punktu widzenia ekranów. Gdyby któraś reguła biznesowa działała tylko
 * w jednej wersji, ten plik by to wychwycił.
 */

import { AnalysisRangeMode } from '@/domain/analysis';
import { MainType, PaymentSource } from '@/domain/enums';
import type { Payment } from '@/domain/models';
import { addMonths, currentYearMonth, dueDateFor, todayIso, yearMonthKey } from '@/lib/date';

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

    // --- Dochody domowników (Etap 11) ---

    describe('dochody domowników', () => {
      const monthKey = (m = THIS_MONTH) => yearMonthKey(m);

      const addIncome = (
        repo: ExpensesRepository,
        personName: string,
        amountGrosze: number,
        m = THIS_MONTH
      ) => repo.createIncome({ personName, amountGrosze, month: monthKey(m) });

      it('nowy miesiąc zaczyna się bez dochodów, a suma wynosi zero', async () => {
        const repo = await createRepository();

        expect(await repo.listIncomes(THIS_MONTH)).toEqual([]);
        // 5.1: brak danych to 0,00 zł, nie błąd i nie pustka.
        expect(await repo.getMonthlyIncomeTotal(THIS_MONTH)).toBe(0);
      });

      it('sumuje dochody wszystkich domowników', async () => {
        const repo = await createRepository();
        await addIncome(repo, 'Ola', 620000);
        await addIncome(repo, 'Marek', 540000);

        expect(await repo.getMonthlyIncomeTotal(THIS_MONTH)).toBe(1160000);
      });

      it('BR-09: dochody nie przeciekają między miesiącami', async () => {
        const repo = await createRepository();
        await addIncome(repo, 'Ola', 620000);
        await addIncome(repo, 'Ola', 700000, NEXT_MONTH);

        expect(await repo.getMonthlyIncomeTotal(THIS_MONTH)).toBe(620000);
        expect(await repo.getMonthlyIncomeTotal(NEXT_MONTH)).toBe(700000);
        expect((await repo.listIncomes(THIS_MONTH)).map((i) => i.amountGrosze)).toEqual([620000]);
      });

      it('zmiana kwoty aktualizuje sumę', async () => {
        const repo = await createRepository();
        const created = await addIncome(repo, 'Ola', 620000);

        await repo.updateIncome(created.id, { amountGrosze: 650000 });

        expect(await repo.getMonthlyIncomeTotal(THIS_MONTH)).toBe(650000);
        expect((await repo.getIncome(created.id))?.personName).toBe('Ola');
      });

      it('usunięcie wycofuje dochód z sumy', async () => {
        const repo = await createRepository();
        const created = await addIncome(repo, 'Ola', 620000);
        await addIncome(repo, 'Marek', 540000);

        await repo.deleteIncome(created.id);

        expect(await repo.getMonthlyIncomeTotal(THIS_MONTH)).toBe(540000);
        expect(await repo.getIncome(created.id)).toBeNull();
      });

      it('dochód NIE wchodzi do sum wydatków ani do historii płatności (BR-01)', async () => {
        const repo = await createRepository();
        const beforeTotals = await repo.getMonthlyTotals(THIS_MONTH);
        const beforeHistory = (await repo.listHistory()).length;

        await addIncome(repo, 'Ola', 620000);

        expect(await repo.getMonthlyTotals(THIS_MONTH)).toEqual(beforeTotals);
        expect((await repo.listHistory()).length).toBe(beforeHistory);
      });

      it('kopia zapasowa obejmuje dochody', async () => {
        const repo = await createRepository();
        await addIncome(repo, 'Ola', 620000);

        await repo.importSnapshot(await repo.exportSnapshot());

        expect(await repo.getMonthlyIncomeTotal(THIS_MONTH)).toBe(620000);
        expect((await repo.listIncomes(THIS_MONTH))[0].personName).toBe('Ola');
      });
    });

    // --- Kopia zapasowa (Etap 10) ---

    describe('kopia zapasowa', () => {
      it('odtworzenie własnej kopii przywraca sumy co do grosza', async () => {
        const repo = await createRepository();
        await addPurchase(repo, 12550);
        await addPurchase(repo, 4499);
        const expected = await repo.getMonthlyTotals(THIS_MONTH);

        const snapshot = await repo.exportSnapshot();
        await repo.importSnapshot(snapshot);

        expect(await repo.getMonthlyTotals(THIS_MONTH)).toEqual(expected);
      });

      it('odtworzenie ZASTĘPUJE dane, a nie dokłada ich do istniejących', async () => {
        const repo = await createRepository();
        await addPurchase(repo, 12550);
        const snapshot = await repo.exportSnapshot();
        const expected = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;

        // Wydatek dopisany PO zrobieniu kopii. Odtworzenie ma go cofnąć,
        // a nie zsumować z kopią — inaczej każde odtworzenie podwajałoby dane.
        await addPurchase(repo, 9900);
        await repo.importSnapshot(snapshot);

        expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(expected);
      });

      it('zachowuje powiązanie zakupu z jego podkategorią', async () => {
        const repo = await createRepository();
        const created = await addPurchase(repo, 12550);
        const category = await repo.getCategory(created.categoryId);

        await repo.importSnapshot(await repo.exportSnapshot());

        const restored = await repo.getPayment(created.id);
        expect(restored?.categoryId).toBe(created.categoryId);
        expect((await repo.getCategory(restored!.categoryId))?.name).toBe(category?.name);
      });

      it('zachowuje rejestr wygenerowanych rachunków (BR-12)', async () => {
        const repo = await createRepository();
        const [template] = await repo.listBillTemplates();
        await repo.markBillGenerated(template.id, THIS_MONTH);

        await repo.importSnapshot(await repo.exportSnapshot());

        // Bez tego automat utworzyłby rachunek drugi raz — także taki,
        // który użytkownik świadomie usunął.
        expect(await repo.hasGeneratedBill(template.id, THIS_MONTH)).toBe(true);
        expect(await repo.hasGeneratedBill(template.id, NEXT_MONTH)).toBe(false);
      });

      it('obejmuje rachunki cykliczne wyłączone przez użytkownika (7.5)', async () => {
        const repo = await createRepository();
        const [template] = await repo.listBillTemplates();
        await repo.deactivateBillTemplate(template.id);

        await repo.importSnapshot(await repo.exportSnapshot());

        const restored = await repo.getBillTemplate(template.id);
        expect(restored?.isActive).toBe(false);
      });

      it('zachowuje rachunek bez kwoty jako oczekujący (BR-04)', async () => {
        const repo = await createRepository();
        const waiting = await addPurchase(repo, null);

        await repo.importSnapshot(await repo.exportSnapshot());

        expect((await repo.getPayment(waiting.id))?.amountGrosze).toBeNull();
      });

      it('nowy wydatek po odtworzeniu nie nadpisuje rekordu z kopii', async () => {
        const repo = await createRepository();
        const before = (await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze;
        const fromBackup = await addPurchase(repo, 12550);

        await repo.importSnapshot(await repo.exportSnapshot());
        const added = await addPurchase(repo, 9900);

        // Gdyby licznik identyfikatorów wystartował od nowa, nowy wydatek
        // dostałby numer zajęty przez rekord z kopii i podmienił go —
        // suma urosłaby wtedy tylko o różnicę kwot, a nie o obie.
        expect(added.id).not.toBe(fromBackup.id);
        expect((await repo.getPayment(fromBackup.id))?.amountGrosze).toBe(12550);
        expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(
          before + 12550 + 9900
        );
      });

      it('odtworzenie pustej kopii opróżnia aplikację', async () => {
        const repo = await createRepository();
        await addPurchase(repo, 12550);

        await repo.importSnapshot({
          categories: [],
          payments: [],
          billTemplates: [],
          subscriptions: [],
          generatedRecords: [],
          incomes: [],
          savedReports: [],
          deletedRecords: [],
        });

        expect((await repo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(0);
        expect(await repo.listHistory()).toEqual([]);
        expect(await repo.listCategories()).toEqual([]);
      });
    });

    /**
     * Repozytorium pamięciowe startuje z danymi demonstracyjnymi, a SQLite
     * z pustą tabelą płatności. Te testy porównują więc WYŁĄCZNIE rekordy,
     * które same utworzyły — inaczej ten sam kontrakt nie mógłby przejść
     * na obu implementacjach.
     */
    describe('Analiza (Etap 12)', () => {
      const THREE_MONTHS_AGO = addMonths(THIS_MONTH, -3);
      const TWO_MONTHS_AGO = addMonths(THIS_MONTH, -2);
      const LAST_MONTH = addMonths(THIS_MONTH, -1);

      /** Kwoty wyłącznie tych płatności, które utworzył sam test. */
      function ownAmounts(found: Payment[], own: number[]) {
        return found.filter((p) => own.includes(p.id)).map((p) => p.amountGrosze);
      }

      it('zakres obejmuje OBA skrajne miesiące i pomija sąsiadów', async () => {
        const repo = await createRepository();
        const outsideBefore = await addPurchase(repo, 1000, 15, THREE_MONTHS_AGO);
        const first = await addPurchase(repo, 2000, 15, TWO_MONTHS_AGO);
        const last = await addPurchase(repo, 3000, 15, LAST_MONTH);
        const outsideAfter = await addPurchase(repo, 4000, 15, THIS_MONTH);
        const own = [outsideBefore.id, first.id, last.id, outsideAfter.id];

        const inRange = await repo.listPaymentsForRange(TWO_MONTHS_AGO, LAST_MONTH);

        expect(ownAmounts(inRange, own)).toEqual([2000, 3000]);
      });

      it('zakres łapie też pierwszy i ostatni dzień skrajnych miesięcy', async () => {
        const repo = await createRepository();
        // Dzień 31 w krótszym miesiącu cofa się do ostatniego dnia (dueDateFor).
        const firstDay = await addPurchase(repo, 1100, 1, LAST_MONTH);
        const lastDay = await addPurchase(repo, 2200, 31, THIS_MONTH);
        const own = [firstDay.id, lastDay.id];

        const inRange = await repo.listPaymentsForRange(LAST_MONTH, THIS_MONTH);

        expect(ownAmounts(inRange, own)).toEqual([1100, 2200]);
      });

      it('płatności przychodzą od najstarszej, odwrotnie niż w historii', async () => {
        const repo = await createRepository();
        const newest = await addPurchase(repo, 3000, 20, THIS_MONTH);
        const oldest = await addPurchase(repo, 1000, 5, LAST_MONTH);
        const middle = await addPurchase(repo, 2000, 9, THIS_MONTH);
        const own = [newest.id, oldest.id, middle.id];

        const inRange = await repo.listPaymentsForRange(LAST_MONTH, THIS_MONTH);

        expect(ownAmounts(inRange, own)).toEqual([1000, 2000, 3000]);
      });

      it('zakres podany na opak daje ten sam wynik', async () => {
        const repo = await createRepository();
        await addPurchase(repo, 5000, 10, LAST_MONTH);

        const forwards = await repo.listPaymentsForRange(LAST_MONTH, THIS_MONTH);
        const backwards = await repo.listPaymentsForRange(THIS_MONTH, LAST_MONTH);

        expect(backwards.map((p) => p.id)).toEqual(forwards.map((p) => p.id));
      });

      it('BR-05: rachunek bez kwoty jest zwracany, żeby dało się pokazać lukę', async () => {
        const repo = await createRepository();
        const withoutAmount = await addPurchase(repo, null, 12, THIS_MONTH);

        const inRange = await repo.listPaymentsForRange(THIS_MONTH, THIS_MONTH);

        expect(ownAmounts(inRange, [withoutAmount.id])).toEqual([null]);
      });

      it('dochody z zakresu obejmują oba skrajne miesiące', async () => {
        const repo = await createRepository();
        await repo.createIncome({
          personName: 'Ola',
          amountGrosze: 500000,
          month: yearMonthKey(TWO_MONTHS_AGO),
        });
        await repo.createIncome({
          personName: 'Marek',
          amountGrosze: 400000,
          month: yearMonthKey(THIS_MONTH),
        });
        await repo.createIncome({
          personName: 'Poza zakresem',
          amountGrosze: 100000,
          month: yearMonthKey(THREE_MONTHS_AGO),
        });

        const names = (await repo.listIncomesForRange(TWO_MONTHS_AGO, THIS_MONTH)).map(
          (i) => i.personName
        );

        expect(names).toContain('Ola');
        expect(names).toContain('Marek');
        expect(names).not.toContain('Poza zakresem');
      });
    });

    describe('Zapisane zestawienia (Etap 13)', () => {
      const GAZ = {
        name: 'Gaz w czasie',
        subjectKey: 'BILL_TEMPLATE:3',
        rangeMode: AnalysisRangeMode.CUSTOM,
        windowMonths: 6,
      };

      it('zapisane zestawienie wraca z listy w całości', async () => {
        const repo = await createRepository();
        const created = await repo.createSavedReport(GAZ);

        const found = (await repo.listSavedReports()).find((r) => r.id === created.id);

        expect(found).toMatchObject(GAZ);
      });

      it('nowe zestawienia trafiają na koniec listy', async () => {
        const repo = await createRepository();
        const first = await repo.createSavedReport({ ...GAZ, name: 'Pierwsze' });
        const second = await repo.createSavedReport({ ...GAZ, name: 'Drugie' });

        expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
        const order = (await repo.listSavedReports()).map((r) => r.id);
        expect(order.indexOf(second.id)).toBeGreaterThan(order.indexOf(first.id));
      });

      it('tryb roku do roku nie ma długości okna', async () => {
        const repo = await createRepository();

        const created = await repo.createSavedReport({
          name: 'Rok do roku',
          subjectKey: 'ALL_EXPENSES',
          rangeMode: AnalysisRangeMode.YEAR_OVER_YEAR,
          windowMonths: null,
        });

        expect(created.windowMonths).toBeNull();
      });

      it('zmiana nazwy nie rusza reszty zestawienia', async () => {
        const repo = await createRepository();
        const created = await repo.createSavedReport(GAZ);

        const renamed = await repo.updateSavedReport(created.id, { name: 'Gaz i ogrzewanie' });

        expect(renamed.name).toBe('Gaz i ogrzewanie');
        expect(renamed.subjectKey).toBe(GAZ.subjectKey);
        expect(renamed.windowMonths).toBe(6);
      });

      it('usunięte zestawienie znika z listy', async () => {
        const repo = await createRepository();
        const created = await repo.createSavedReport(GAZ);

        await repo.deleteSavedReport(created.id);

        expect((await repo.listSavedReports()).map((r) => r.id)).not.toContain(created.id);
      });

      it('zestawienia wchodzą do kopii zapasowej i wracają z niej', async () => {
        const repo = await createRepository();
        await repo.createSavedReport(GAZ);

        // Zestawienie to praca użytkownika tak samo jak wpisany wydatek —
        // po zmianie telefonu musiałby wyklikać je od nowa.
        await repo.importSnapshot(await repo.exportSnapshot());

        expect((await repo.listSavedReports()).map((r) => r.name)).toContain('Gaz w czasie');
      });

      it('odtworzenie kopii bez zestawień czyści listę', async () => {
        const repo = await createRepository();
        await repo.createSavedReport(GAZ);

        const snapshot = await repo.exportSnapshot();
        await repo.importSnapshot({ ...snapshot, savedReports: [] });

        expect(await repo.listSavedReports()).toEqual([]);
      });
    });

    /**
     * Etap 14c: kolejka rekordów do wysłania.
     *
     * Znowu kontrakt, a nie test jednej implementacji — bo znowu obie robią
     * to zupełnie inaczej. W wersji na SQLite kolejkę prowadzi kolumna
     * `pendingSync` podnoszona wyzwalaczem; w pamięciowej — porównanie
     * odcisku rekordu z zapamiętanym. Rozjazd tutaj znaczyłby, że wydatek
     * nie dojeżdża na drugi telefon, a nikt się o tym nie dowie.
     */
    describe('Kolejka do wysłania (Etap 14c)', () => {
      /** Opróżnia kolejkę, udając udaną wysyłkę wszystkiego. */
      async function udajUdanaWysylke(repo: ExpensesRepository) {
        const czekajace = await repo.listPendingChanges();

        await repo.markSynced({
          categories: czekajace.categories.map((c) => c.uuid),
          billTemplates: czekajace.billTemplates.map((t) => ({
            uuid: t.uuid,
            updatedAt: t.updatedAt,
          })),
          subscriptions: czekajace.subscriptions.map((s) => ({
            uuid: s.uuid,
            updatedAt: s.updatedAt,
          })),
          payments: czekajace.payments.map((p) => ({ uuid: p.uuid, updatedAt: p.updatedAt })),
          incomes: czekajace.incomes.map((i) => ({ uuid: i.uuid, updatedAt: i.updatedAt })),
          deletedRecords: czekajace.deletedRecords.map((d) => ({
            entityType: d.entityType,
            uuid: d.uuid,
          })),
        });
      }

      it('nowy wydatek czeka na wysłanie', async () => {
        const repo = await createRepository();
        await udajUdanaWysylke(repo);

        const payment = await addPurchase(repo, 12550);

        const czekajace = await repo.listPendingChanges();
        expect(czekajace.payments.map((p) => p.uuid)).toContain(payment.uuid);
      });

      it('po potwierdzeniu wysyłki kolejka jest pusta', async () => {
        const repo = await createRepository();
        await addPurchase(repo, 12550);

        await udajUdanaWysylke(repo);

        const czekajace = await repo.listPendingChanges();
        expect(czekajace.payments).toEqual([]);
        expect(czekajace.categories).toEqual([]);
        expect(czekajace.deletedRecords).toEqual([]);
      });

      it('edycja wysłanego wydatku wraca do kolejki', async () => {
        const repo = await createRepository();
        const payment = await addPurchase(repo, 12550);
        await udajUdanaWysylke(repo);

        await repo.updatePayment(payment.id, { amountGrosze: 9900 });

        const czekajace = await repo.listPendingChanges();
        expect(czekajace.payments.map((p) => p.uuid)).toEqual([payment.uuid]);
      });

      it('potwierdzenie NIEAKTUALNEJ postaci rekordu nie gasi kolejki', async () => {
        // Najważniejszy test w tej grupie. Między odczytem rekordów a
        // potwierdzeniem wysyłki mija czas — na słabym łączu kilkanaście
        // sekund — i użytkownik może w tym czasie poprawić kwotę wydatku,
        // który właśnie poleciał. Gdyby potwierdzenie działało po samym
        // `uuid`, ta poprawka przepadłaby: rekord przestałby być oznaczony,
        // więc nic by go już nie wysłało, a serwer zostałby ze starą kwotą.
        const repo = await createRepository();
        const payment = await addPurchase(repo, 12550);
        await udajUdanaWysylke(repo);

        const poprawiony = await repo.updatePayment(payment.id, { amountGrosze: 9900 });

        // Potwierdzenie niesie znacznik czasu SPRZED poprawki. Podajemy go
        // wprost, a nie przez `payment.updatedAt`: utworzenie i poprawka
        // potrafią zmieścić się w tej samej milisekundzie, a wtedy oba
        // znaczniki byłyby identyczne i test nie sprawdzałby niczego.
        await repo.markSynced({
          categories: [],
          billTemplates: [],
          subscriptions: [],
          payments: [{ uuid: payment.uuid, updatedAt: '2020-01-01T00:00:00.000Z' }],
          incomes: [],
          deletedRecords: [],
        });

        const czekajace = await repo.listPendingChanges();
        expect(czekajace.payments.map((p) => p.uuid)).toEqual([poprawiony.uuid]);
      });

      it('skasowany wydatek czeka w kolejce jako osobna zmiana', async () => {
        const repo = await createRepository();
        const payment = await addPurchase(repo, 12550);
        await udajUdanaWysylke(repo);

        await repo.deletePayment(payment.id);

        const czekajace = await repo.listPendingChanges();
        expect(czekajace.deletedRecords).toEqual([
          expect.objectContaining({ entityType: 'PAYMENT', uuid: payment.uuid }),
        ]);
      });

      it('wydatek w kolejce niesie trwały identyfikator swojej kategorii', async () => {
        // To jest cały powód, dla którego odstąpiliśmy od przepisywania
        // kluczy obcych na `uuid` w Etapie 14b: tłumaczenie ma się zdarzyć
        // TUTAJ, jednym złączeniem, a nie w całej aplikacji.
        const repo = await createRepository();
        await udajUdanaWysylke(repo);

        const payment = await addPurchase(repo, 12550);
        const [category] = await repo.listCategories(MainType.PURCHASE);

        const czekajace = await repo.listPendingChanges();
        const wKolejce = czekajace.payments.find((p) => p.uuid === payment.uuid);

        expect(wKolejce?.categoryUuid).toBe(category.uuid);
        expect(wKolejce?.billTemplateUuid).toBeNull();
        expect(wKolejce?.subscriptionUuid).toBeNull();
      });

      it('nowy dochód czeka na wysłanie i znika po potwierdzeniu', async () => {
        const repo = await createRepository();
        await udajUdanaWysylke(repo);

        const income = await repo.createIncome({
          personName: 'Ola',
          amountGrosze: 620000,
          month: '2026-09',
        });

        expect((await repo.listPendingChanges()).incomes.map((i) => i.uuid)).toEqual([income.uuid]);

        await udajUdanaWysylke(repo);

        expect((await repo.listPendingChanges()).incomes).toEqual([]);
      });

      /**
       * Etap 14d: zapisywanie zmian pobranych z serwera.
       *
       * Znowu kontrakt, bo znowu obie implementacje robią to inaczej: w wersji
       * na SQLite trzeba GASIĆ znacznik „do wysłania" po każdym zapisie (podnosi
       * go wyzwalacz), w pamięciowej wystarczy go nie podnosić. Wynik ma być
       * identyczny — a rozjazd oznaczałby, że dwa telefony odbijają sobie te
       * same rekordy w nieskończoność.
       */
      describe('Zmiany pobrane z serwera (Etap 14d)', () => {
        const CZAS_STARY = '2026-01-01T10:00:00.000Z';
        const CZAS_NOWY = '2026-09-08T10:00:00.000Z';

        function pustaPaczka() {
          return {
            categories: [],
            billTemplates: [],
            subscriptions: [],
            payments: [],
            incomes: [],
            deletedRecords: [],
          };
        }

        /** Wydatek „z drugiego telefonu" w kategorii, którą ten telefon zna. */
        async function obcyWydatek(repo: ExpensesRepository, overrides = {}) {
          const [category] = await repo.listCategories(MainType.PURCHASE);

          return {
            uuid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01',
            categoryUuid: category.uuid,
            billTemplateUuid: null,
            subscriptionUuid: null,
            mainType: MainType.PURCHASE,
            title: 'Zakupy z drugiego telefonu',
            amountGrosze: 4500,
            effectiveDate: dueDateFor(THIS_MONTH, 7),
            dueDate: null,
            paidDate: null,
            status: null,
            source: PaymentSource.MANUAL,
            merchant: 'Lidl',
            description: null,
            paymentMethod: null,
            receiptImagePath: null,
            createdAt: CZAS_NOWY,
            updatedAt: CZAS_NOWY,
            syncedAt: CZAS_NOWY,
            ...overrides,
          };
        }

        it('nieznany wydatek z serwera pojawia się w historii', async () => {
          const repo = await createRepository();
          const wydatek = await obcyWydatek(repo);

          const wynik = await repo.applyRemoteChanges({ ...pustaPaczka(), payments: [wydatek] });

          expect(wynik.applied).toBe(1);
          expect((await repo.listHistory()).map((p) => p.uuid)).toContain(wydatek.uuid);
        });

        it('POBRANY WYDATEK NIE WRACA DO KOLEJKI WYSYŁKI', async () => {
          // Najważniejszy test całego etapu. Gdyby zapis pobranego rekordu
          // oznaczał go jako „do wysłania", telefon odesłałby go z powrotem
          // przy najbliższej synchronizacji, drugi telefon zrobiłby to samo
          // i oba odbijałyby sobie te same wydatki bez końca — bez żadnego
          // widocznego objawu poza rosnącym rachunkiem za transfer.
          const repo = await createRepository();
          await udajUdanaWysylke(repo);

          const wydatek = await obcyWydatek(repo);
          await repo.applyRemoteChanges({ ...pustaPaczka(), payments: [wydatek] });

          const czekajace = await repo.listPendingChanges();
          expect(czekajace.payments.map((p) => p.uuid)).not.toContain(wydatek.uuid);
        });

        it('poprawka pobrana z serwera też nie wraca do kolejki', async () => {
          // Ten sam mechanizm, ale przy AKTUALIZACJI istniejącego rekordu —
          // w wersji na SQLite to właśnie tutaj odpala się wyzwalacz.
          const repo = await createRepository();
          const wydatek = await obcyWydatek(repo);
          await repo.applyRemoteChanges({ ...pustaPaczka(), payments: [wydatek] });
          await udajUdanaWysylke(repo);

          await repo.applyRemoteChanges({
            ...pustaPaczka(),
            payments: [{ ...wydatek, amountGrosze: 9900, updatedAt: '2026-09-09T10:00:00.000Z' }],
          });

          const czekajace = await repo.listPendingChanges();
          expect(czekajace.payments.map((p) => p.uuid)).not.toContain(wydatek.uuid);
        });

        it('starsza wersja z serwera nie nadpisuje nowszej tutejszej', async () => {
          const repo = await createRepository();
          const wydatek = await obcyWydatek(repo);
          await repo.applyRemoteChanges({ ...pustaPaczka(), payments: [wydatek] });

          const wynik = await repo.applyRemoteChanges({
            ...pustaPaczka(),
            payments: [{ ...wydatek, amountGrosze: 100, updatedAt: CZAS_STARY }],
          });

          expect(wynik.applied).toBe(0);
          const zapisany = (await repo.listHistory()).find((p) => p.uuid === wydatek.uuid);
          expect(zapisany?.amountGrosze).toBe(4500);
        });

        it('nowsza wersja z serwera wygrywa i jest zgłaszana', async () => {
          // Decyzja właściciela projektu (08.09.2026): konflikt rozstrzyga
          // nowszy zapis. Użytkownik musi się dowiedzieć, że jego poprawka
          // przepadła — inaczej wygląda to na usterkę aplikacji.
          const repo = await createRepository();
          const wydatek = await obcyWydatek(repo);
          await repo.applyRemoteChanges({ ...pustaPaczka(), payments: [wydatek] });

          const lokalny = (await repo.listHistory()).find((p) => p.uuid === wydatek.uuid);
          await repo.updatePayment(lokalny!.id, { amountGrosze: 111 });

          const wynik = await repo.applyRemoteChanges({
            ...pustaPaczka(),
            payments: [{ ...wydatek, amountGrosze: 777, updatedAt: '2026-12-31T23:59:59.000Z' }],
          });

          expect(wynik.overwritten).toBe(1);
          const zapisany = (await repo.listHistory()).find((p) => p.uuid === wydatek.uuid);
          expect(zapisany?.amountGrosze).toBe(777);
        });

        it('wydatek w nieznanej kategorii jest pomijany, a nie zgadywany', async () => {
          // Kategoria jest w bazie wymagana. Wpisanie tu byle jakiej przypięłoby
          // wydatek do przypadkowej kategorii i zafałszowało analizę — po cichu.
          const repo = await createRepository();
          const wydatek = await obcyWydatek(repo, {
            categoryUuid: 'ffffffffffffffffffffffffffffff99',
          });

          const wynik = await repo.applyRemoteChanges({ ...pustaPaczka(), payments: [wydatek] });

          expect(wynik.applied).toBe(0);
          expect(wynik.skipped).toBe(1);
        });

        it('skasowanie z drugiego telefonu usuwa wydatek tutaj', async () => {
          const repo = await createRepository();
          const wydatek = await obcyWydatek(repo);
          await repo.applyRemoteChanges({ ...pustaPaczka(), payments: [wydatek] });

          await repo.applyRemoteChanges({
            ...pustaPaczka(),
            deletedRecords: [
              {
                entityType: 'PAYMENT',
                uuid: wydatek.uuid,
                deletedAt: CZAS_NOWY,
                syncedAt: CZAS_NOWY,
              },
            ],
          });

          expect((await repo.listHistory()).map((p) => p.uuid)).not.toContain(wydatek.uuid);
        });

        it('skasowany wydatek NIE WRACA przy ponownym pobraniu', async () => {
          // Wysyłka nie usuwa wierszy z serwera — dokłada nagrobek. Skasowany
          // wydatek nadal tam leży i przy kolejnym pobraniu przyszedłby znowu.
          // Nagrobek jest jedyną rzeczą, która mówi „nie, tego już nie ma".
          const repo = await createRepository();
          const wydatek = await obcyWydatek(repo);

          await repo.applyRemoteChanges({
            ...pustaPaczka(),
            deletedRecords: [
              {
                entityType: 'PAYMENT',
                uuid: wydatek.uuid,
                deletedAt: CZAS_NOWY,
                syncedAt: CZAS_NOWY,
              },
            ],
          });

          await repo.applyRemoteChanges({ ...pustaPaczka(), payments: [wydatek] });

          expect((await repo.listHistory()).map((p) => p.uuid)).not.toContain(wydatek.uuid);
        });

        it('nagrobek z serwera nie wraca do kolejki wysyłki', async () => {
          const repo = await createRepository();
          const wydatek = await obcyWydatek(repo);

          await repo.applyRemoteChanges({
            ...pustaPaczka(),
            deletedRecords: [
              {
                entityType: 'PAYMENT',
                uuid: wydatek.uuid,
                deletedAt: CZAS_NOWY,
                syncedAt: CZAS_NOWY,
              },
            ],
          });

          const czekajace = await repo.listPendingChanges();
          expect(czekajace.deletedRecords.map((d) => d.uuid)).not.toContain(wydatek.uuid);
        });

        it('dochód z drugiego telefonu wchodzi do sumy miesiąca', async () => {
          const repo = await createRepository();
          const przed = await repo.getMonthlyIncomeTotal(THIS_MONTH);

          await repo.applyRemoteChanges({
            ...pustaPaczka(),
            incomes: [
              {
                uuid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbb01',
                personName: 'Marek',
                amountGrosze: 500000,
                month: `${THIS_MONTH.year}-${String(THIS_MONTH.month).padStart(2, '0')}`,
                createdAt: CZAS_NOWY,
                updatedAt: CZAS_NOWY,
                syncedAt: CZAS_NOWY,
              },
            ],
          });

          expect(await repo.getMonthlyIncomeTotal(THIS_MONTH)).toBe(przed + 500000);
        });

        it('znacznik pobierania przeżywa zapis i odczyt', async () => {
          const repo = await createRepository();

          expect(await repo.getSyncMarker('pull:payments')).toBeNull();

          await repo.setSyncMarker('pull:payments', CZAS_NOWY);

          expect(await repo.getSyncMarker('pull:payments')).toBe(CZAS_NOWY);
        });

        it('brak znacznika znaczy „pobierz wszystko", a nie „nic nie pobieraj"', async () => {
          // Stan po pierwszej instalacji. Gdyby brak znacznika czytało się jako
          // „jestem na bieżąco", nowy telefon nigdy nie pobrałby historii.
          const repo = await createRepository();

          expect(await repo.getSyncMarker('pull:categories')).toBeNull();
        });
      });
    });

    /**
     * Etap 14b: trwałe identyfikatory i ślad po skasowanych.
     *
     * Te testy stoją w kontrakcie, a nie przy jednej implementacji, bo obie
     * realizują to samo ZUPEŁNIE INACZEJ: w wersji na SQLite pilnują tego
     * wyzwalacze bazy, w wersji pamięciowej — kod klasy. Dokładnie tak powstają
     * rozjazdy, których nie widać w testach jednostkowych: coś działa
     * w testach na pamięci i zawodzi na telefonie.
     */
    describe('Trwałe identyfikatory i kasowanie (Etap 14b)', () => {
      it('nowy wydatek dostaje identyfikator, o który nikt nie prosił', async () => {
        const repo = await createRepository();

        const payment = await addPurchase(repo, 12550);

        expect(payment.uuid).toMatch(/^[0-9a-f]{32}$/);
      });

      it('dwa wydatki nigdy nie dzielą identyfikatora', async () => {
        // Wspólny identyfikator byłby gorszy niż jego brak: przy synchronizacji
        // drugi wydatek nadpisałby pierwszy, bo serwer uznałby je za ten sam.
        const repo = await createRepository();

        const first = await addPurchase(repo, 100);
        const second = await addPurchase(repo, 200);

        expect(first.uuid).not.toBe(second.uuid);
      });

      it('identyfikator nie zmienia się przy edycji', async () => {
        // Zmiana identyfikatora przy edycji sprawiłaby, że drugi telefon
        // zobaczyłby poprawiony wydatek jako NOWY, a stary zostałby obok.
        const repo = await createRepository();
        const payment = await addPurchase(repo, 12550);

        const updated = await repo.updatePayment(payment.id, { amountGrosze: 9900 });

        expect(updated.uuid).toBe(payment.uuid);
      });

      it('świeża aplikacja nie ma nic do zgłoszenia jako skasowane', async () => {
        const repo = await createRepository();

        expect(await repo.listDeletedRecords()).toEqual([]);
      });

      it('skasowany wydatek zostawia po sobie identyfikator', async () => {
        const repo = await createRepository();
        const payment = await addPurchase(repo, 12550);

        await repo.deletePayment(payment.id);

        expect(await repo.listDeletedRecords()).toEqual([
          expect.objectContaining({ entityType: 'PAYMENT', uuid: payment.uuid }),
        ]);
      });

      it('skasowanie nieistniejącego wydatku nie zostawia śladu', async () => {
        // Nagrobek po rekordzie, którego nigdy nie było, kazałby serwerowi
        // szukać czegoś nieistniejącego przy każdej synchronizacji.
        const repo = await createRepository();

        await repo.deletePayment(999999);

        expect(await repo.listDeletedRecords()).toEqual([]);
      });

      it('kopia zapasowa niesie ślad po skasowanych', async () => {
        const repo = await createRepository();
        const payment = await addPurchase(repo, 12550);
        await repo.deletePayment(payment.id);

        const snapshot = await repo.exportSnapshot();

        expect(snapshot.deletedRecords).toEqual([
          expect.objectContaining({ entityType: 'PAYMENT', uuid: payment.uuid }),
        ]);
      });

      it('odtworzenie kopii zachowuje identyfikatory, a nie nadaje nowych', async () => {
        // Nadanie nowych rozdwoiłoby każdy wydatek: po synchronizacji ten sam
        // zakup istniałby dwa razy, pod starym i nowym identyfikatorem.
        const repo = await createRepository();
        const payment = await addPurchase(repo, 12550);
        const snapshot = await repo.exportSnapshot();

        await repo.importSnapshot(snapshot);

        const restored = await repo.getPayment(payment.id);
        expect(restored?.uuid).toBe(payment.uuid);
      });
    });
  });
}

runContract('Repozytorium w pamięci', createInMemoryRepository);
runContract('Repozytorium SQLite', createSqliteRepository);
