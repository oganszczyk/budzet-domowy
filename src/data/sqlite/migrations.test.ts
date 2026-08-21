import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { MainType, PaymentSource } from '@/domain/enums';
import { currentYearMonth, dueDateFor } from '@/lib/date';

import { migrate, MIGRATIONS, TARGET_SCHEMA_VERSION } from './migrations';
import { openNodeDatabase } from './node-adapter';
import { seedDefaults } from './seed';
import { SqliteExpensesRepository } from './sqlite-repository';

const THIS_MONTH = currentYearMonth();

/** Ścieżka do jednorazowego pliku bazy — potrzebna do sprawdzenia trwałości. */
function tempDatabasePath(): string {
  return path.join(os.tmpdir(), `domowe-wydatki-test-${Date.now()}-${Math.random()}.db`);
}

describe('migracje (1.2)', () => {
  it('tworzą schemat i ustawiają wersję', async () => {
    const db = openNodeDatabase();
    const result = await migrate(db);

    expect(result.createdFromScratch).toBe(true);

    const version = await db.first<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(TARGET_SCHEMA_VERSION);
  });

  it('są bezpieczne przy ponownym wywołaniu', async () => {
    const db = openNodeDatabase();
    await migrate(db);

    // Drugie wywołanie nie może próbować tworzyć tabel od nowa.
    const second = await migrate(db);
    expect(second.createdFromScratch).toBe(false);
  });

  it('tworzą wszystkie tabele z rozdziału 7', async () => {
    const db = openNodeDatabase();
    await migrate(db);

    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    const names = tables.map((t) => t.name);

    expect(names).toContain('category');
    expect(names).toContain('payment');
    expect(names).toContain('bill_template');
    expect(names).toContain('subscription');
    expect(names).toContain('generated_record');
  });

  it('tworzą tabelę dochodów z Etapu 11', async () => {
    const db = openNodeDatabase();
    await migrate(db);

    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );

    expect(tables.map((t) => t.name)).toContain('income');
  });

  /**
   * 1.2, zasada 5: „Migracje bazy danych zamiast kasowania lokalnej bazy."
   *
   * Ten test odgrywa aktualizację aplikacji na telefonie z prawdziwymi danymi:
   * baza w starej wersji schematu, w niej wydatki użytkownika, a potem nowa
   * wersja aplikacji. Gdyby migracja kasowała bazę albo się wywracała,
   * użytkownik straciłby wszystko przy zwykłej aktualizacji.
   */
  it('aktualizacja ze starej wersji schematu zachowuje dane użytkownika', async () => {
    const db = openNodeDatabase();

    // --- stan sprzed Etapu 11: tylko pierwsza migracja ---
    await db.exec(MIGRATIONS[0]);
    await db.exec('PRAGMA user_version = 1');
    await seedDefaults(db);

    const oldRepo = new SqliteExpensesRepository(db);
    const [category] = await oldRepo.listCategories(MainType.PURCHASE);
    const created = await oldRepo.createPayment({
      mainType: MainType.PURCHASE,
      categoryId: category.id,
      title: 'Lidl',
      amountGrosze: 12550,
      effectiveDate: dueDateFor(THIS_MONTH, 5),
      dueDate: null,
      paidDate: null,
      status: null,
      source: PaymentSource.MANUAL,
      merchant: 'Lidl',
      description: null,
      paymentMethod: null,
      billTemplateId: null,
      subscriptionId: null,
      receiptImagePath: null,
    });

    // --- aktualizacja aplikacji ---
    const result = await migrate(db);

    // Baza istniała, więc to aktualizacja, a nie tworzenie od zera.
    expect(result.createdFromScratch).toBe(false);

    const version = await db.first<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(TARGET_SCHEMA_VERSION);

    // Wydatek sprzed aktualizacji jest nietknięty.
    const newRepo = new SqliteExpensesRepository(db);
    expect((await newRepo.getPayment(created.id))?.amountGrosze).toBe(12550);
    expect((await newRepo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(12550);

    // A nowa funkcja jest gotowa do użycia.
    expect(await newRepo.getMonthlyIncomeTotal(THIS_MONTH)).toBe(0);
    await newRepo.createIncome({ personName: 'Ola', amountGrosze: 620000, month: '2026-08' });
    expect(await newRepo.listIncomes({ year: 2026, month: 8 })).toHaveLength(1);
  });

  it('tworzą indeksy wymagane w 7.5', async () => {
    const db = openNodeDatabase();
    await migrate(db);

    const indexes = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'"
    );
    const names = indexes.map((i) => i.name);

    expect(names).toContain('idx_payment_effective_date');
    expect(names).toContain('idx_payment_main_type_date');
    expect(names).toContain('idx_payment_auto_bill_month');
    expect(names).toContain('idx_payment_auto_subscription_date');
    expect(names).toContain('idx_income_month');
  });
});

describe('BR-12 wymuszone przez bazę (7.5)', () => {
  async function setup() {
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);
    const repo = new SqliteExpensesRepository(db);
    const [billCategory] = await repo.listCategories(MainType.BILL);
    const [template] = await repo.listBillTemplates();
    return { repo, billCategory, template };
  }

  it('baza odrzuca drugi automatyczny rachunek na ten sam szablon i miesiąc', async () => {
    const { repo, billCategory, template } = await setup();

    const makeBill = () =>
      repo.createPayment({
        mainType: MainType.BILL,
        categoryId: billCategory.id,
        title: template.name,
        amountGrosze: null,
        effectiveDate: dueDateFor(THIS_MONTH, 1),
        dueDate: dueDateFor(THIS_MONTH, template.defaultDueDay),
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

    await makeBill();

    // Nawet gdyby logika aplikacji zawiodła, indeks unikalny nie pozwoli
    // powstać duplikatowi — BR-12 jest pilnowane na dwóch poziomach.
    await expect(makeBill()).rejects.toThrow();
  });

  it('ręczne zakupy nie podlegają temu ograniczeniu', async () => {
    const { repo } = await setup();
    const [category] = await repo.listCategories(MainType.PURCHASE);

    const makePurchase = () =>
      repo.createPayment({
        mainType: MainType.PURCHASE,
        categoryId: category.id,
        title: 'Lidl',
        amountGrosze: 1000,
        effectiveDate: dueDateFor(THIS_MONTH, 5),
        dueDate: null,
        paidDate: null,
        status: null,
        source: PaymentSource.MANUAL,
        merchant: 'Lidl',
        description: null,
        paymentMethod: null,
        billTemplateId: null,
        subscriptionId: null,
        receiptImagePath: null,
      });

    // Dwa zakupy tego samego dnia w tym samym sklepie są całkowicie normalne.
    await expect(makePurchase()).resolves.toBeDefined();
    await expect(makePurchase()).resolves.toBeDefined();
  });
});

describe('zasiew przy pierwszym uruchomieniu (3.1, T-01)', () => {
  it('T-01: domyślne kategorie istnieją, a sumy wynoszą zero', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);
    const repo = new SqliteExpensesRepository(db);

    expect((await repo.listCategories(MainType.BILL)).length).toBeGreaterThan(0);
    expect((await repo.listCategories(MainType.PURCHASE)).length).toBeGreaterThan(0);

    expect(await repo.getMonthlyTotals(THIS_MONTH)).toEqual({
      billsGrosze: 0,
      subscriptionsGrosze: 0,
      purchasesGrosze: 0,
    });
  });

  it('5.2: domyślne rachunki cykliczne są gotowe, opcjonalne wyłączone', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);
    const repo = new SqliteExpensesRepository(db);

    const active = (await repo.listBillTemplates()).map((t) => t.name);
    const all = (await repo.listBillTemplates(true)).map((t) => t.name);

    expect(active).toContain('Prąd');
    expect(active).toContain('Woda');
    // Specyfikacja opisuje je jako „opcjonalna" — są, ale wyłączone.
    expect(active).not.toContain('Telefon');
    expect(all).toContain('Telefon');
    expect(all).toContain('Ubezpieczenie');
  });

  it('powtórny zasiew nie duplikuje kategorii', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);
    const repo = new SqliteExpensesRepository(db);
    const before = (await repo.listCategories()).length;

    await seedDefaults(db);

    expect((await repo.listCategories()).length).toBe(before);
  });
});

describe('T-16: ponowne uruchomienie aplikacji', () => {
  it('wszystkie dane pozostają zapisane po zamknięciu i otwarciu bazy', async () => {
    const file = tempDatabasePath();
    const opened: { close?: () => Promise<void> }[] = [];

    try {
      // --- pierwsze uruchomienie ---
      const firstRun = openNodeDatabase(file);
      opened.push(firstRun);
      await migrate(firstRun);
      await seedDefaults(firstRun);
      const firstRepo = new SqliteExpensesRepository(firstRun);

      const [category] = await firstRepo.listCategories(MainType.PURCHASE);
      const created = await firstRepo.createPayment({
        mainType: MainType.PURCHASE,
        categoryId: category.id,
        title: 'Lidl',
        amountGrosze: 12550,
        effectiveDate: dueDateFor(THIS_MONTH, 3),
        dueDate: null,
        paidDate: null,
        status: null,
        source: PaymentSource.MANUAL,
        merchant: 'Lidl',
        description: 'Zakupy tygodniowe',
        paymentMethod: 'CARD',
        billTemplateId: null,
        subscriptionId: null,
        receiptImagePath: null,
      });

      const ownCategory = await firstRepo.createCategory({
        name: 'Zwierzęta',
        usedBy: [MainType.SUBSCRIPTION, MainType.PURCHASE],
        iconKey: 'pricetag-outline',
        isActive: true,
      });

      // Zamykamy pierwsze połączenie — tak jak zamknięcie aplikacji.
      await firstRun.close?.();

      // --- drugie uruchomienie: nowe połączenie z tym samym plikiem ---
      const secondRun = openNodeDatabase(file);
      opened.push(secondRun);
      const migrated = await migrate(secondRun);
      await seedDefaults(secondRun);
      const secondRepo = new SqliteExpensesRepository(secondRun);

      // Schemat już istnieje, więc migracja nie zaczyna od zera.
      expect(migrated.createdFromScratch).toBe(false);

      const restored = await secondRepo.getPayment(created.id);
      expect(restored?.merchant).toBe('Lidl');
      expect(restored?.amountGrosze).toBe(12550);
      expect(restored?.description).toBe('Zakupy tygodniowe');
      expect(restored?.paymentMethod).toBe('CARD');

      expect((await secondRepo.getMonthlyTotals(THIS_MONTH)).purchasesGrosze).toBe(12550);
      expect((await secondRepo.listHistory()).map((p) => p.id)).toContain(created.id);
      expect((await secondRepo.listCategories(MainType.PURCHASE)).map((c) => c.id)).toContain(
        ownCategory.id
      );
    } finally {
      // Windows nie pozwala usunąć pliku, dopóki baza jest otwarta.
      for (const db of opened) await db.close?.();
      fs.rmSync(file, { force: true });
    }
  });
});
