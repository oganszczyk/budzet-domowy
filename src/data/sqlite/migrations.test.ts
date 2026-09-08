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

/**
 * Zasiew W KSZTAŁCIE Z EPOKI WERSJI 1 SCHEMATU.
 *
 * `seedDefaults` jest pisany pod aktualny schemat i wstawia kolumny, których
 * wersja 1 nie ma — od Etapu 14d także `uuid`. Testy migracji odgrywają
 * telefon, na którym dane zapisała STARA aplikacja, więc muszą użyć starego
 * zapytania. To ten sam powód, dla którego wydatek wstawiają tu ręcznie,
 * a nie przez dzisiejsze repozytorium.
 *
 * Kilka kategorii wystarczy — testy sprawdzają migrację, nie kompletność
 * listy startowej.
 */
async function seedAtVersionOne(db: ReturnType<typeof openNodeDatabase>) {
  const nazwy: [string, string][] = [
    ['Rachunki domowe', 'BILL'],
    ['Jedzenie', 'SUBSCRIPTION,PURCHASE'],
    ['Rozrywka', 'SUBSCRIPTION,PURCHASE'],
    ['Inne', 'SUBSCRIPTION,PURCHASE'],
  ];

  for (const [index, [name, usedBy]] of nazwy.entries()) {
    await db.run(
      'INSERT INTO category (name, iconKey, isActive, sortOrder, usedBy) VALUES (?, ?, 1, ?, ?)',
      [name, 'pricetag-outline', index, usedBy]
    );
  }

  const now = new Date().toISOString();
  const billCategory = await db.first<{ id: number }>(
    "SELECT id FROM category WHERE name = 'Rachunki domowe'"
  );

  for (const [index, name] of ['Prąd', 'Woda', 'Gaz'].entries()) {
    await db.run(
      `INSERT INTO bill_template
         (name, categoryId, defaultDueDay, isActive, useFixedAmount, fixedAmountGrosze, createdAt, updatedAt)
       VALUES (?, ?, ?, 1, 0, NULL, ?, ?)`,
      [name, billCategory?.id ?? 1, 10 + index, now, now]
    );
  }
}

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
    await seedAtVersionOne(db);

    const oldRepo = new SqliteExpensesRepository(db);
    const [category] = await oldRepo.listCategories(MainType.PURCHASE);

    // Wydatek wstawiony ZAPYTANIEM Z EPOKI TEJ BAZY, a nie przez dzisiejsze
    // repozytorium. Repozytorium zna aktualny schemat i wstawia kolumny,
    // których wersja 1 nie ma. Odgrywamy telefon, na którym dane zapisała
    // STARA aplikacja — a potem przyszła aktualizacja.
    const insertedAt = new Date().toISOString();
    const inserted = await db.run(
      `INSERT INTO payment
         (mainType, categoryId, title, amountGrosze, effectiveDate, dueDate, paidDate,
          status, source, merchant, description, paymentMethod, billTemplateId,
          subscriptionId, receiptImagePath, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
      [
        MainType.PURCHASE,
        category.id,
        'Lidl',
        12550,
        dueDateFor(THIS_MONTH, 5),
        PaymentSource.MANUAL,
        'Lidl',
        insertedAt,
        insertedAt,
      ]
    );

    const created = { id: inserted.lastInsertRowId };

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

/**
 * Etap 13, wersja 3 schematu.
 *
 * Kolumna `uuid` powstała w Etapie 13 jako sama kolumna, przed modelem
 * danych. Od Etapu 14b należy też do typów, ale wypełnia ją nadal baza —
 * i to jest ta część, której kompilator nie sprawdzi za nas.
 */
describe('wersja 3 schematu: zestawienia i trwałe identyfikatory', () => {
  /** Odtwarza bazę w wersji 1 z jednym wydatkiem — stan sprzed aktualizacji. */
  async function databaseAtVersionOne() {
    const db = openNodeDatabase();
    await db.exec(MIGRATIONS[0]);
    await db.exec('PRAGMA user_version = 1');
    await seedAtVersionOne(db);

    const repo = new SqliteExpensesRepository(db);
    const [category] = await repo.listCategories(MainType.PURCHASE);

    // Wydatek wstawiony ZAPYTANIEM Z EPOKI TEJ BAZY, a nie przez dzisiejsze
    // repozytorium. Repozytorium zna aktualny schemat i wstawia kolumny,
    // których wersja 1 nie ma. Odgrywamy telefon, na którym dane zapisała
    // STARA aplikacja — a potem przyszła aktualizacja.
    const insertedAt = new Date().toISOString();
    const inserted = await db.run(
      `INSERT INTO payment
         (mainType, categoryId, title, amountGrosze, effectiveDate, dueDate, paidDate,
          status, source, merchant, description, paymentMethod, billTemplateId,
          subscriptionId, receiptImagePath, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
      [
        MainType.PURCHASE,
        category.id,
        'Lidl',
        12550,
        dueDateFor(THIS_MONTH, 5),
        PaymentSource.MANUAL,
        'Lidl',
        insertedAt,
        insertedAt,
      ]
    );

    return { db, payment: { id: inserted.lastInsertRowId } };
  }

  it('tworzy tabelę zapisanych zestawień', async () => {
    const db = openNodeDatabase();
    await migrate(db);

    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    );

    expect(tables.map((t) => t.name)).toContain('saved_report');
  });

  it('nadaje identyfikator rekordom sprzed aktualizacji', async () => {
    const { db, payment } = await databaseAtVersionOne();

    // Przed aktualizacją kolumny w ogóle nie ma.
    await migrate(db);

    const row = await db.first<{ uuid: string | null }>('SELECT uuid FROM payment WHERE id = ?', [
      payment.id,
    ]);

    expect(typeof row?.uuid).toBe('string');
    expect(row?.uuid).toMatch(/^[0-9a-f]{32}$/);
  });

  it('każdy rekord sprzed aktualizacji dostaje WŁASNY identyfikator', async () => {
    // Gdyby `randomblob` policzył się raz dla całego zapytania, wszystkie
    // wiersze dostałyby tę samą wartość — czyli coś gorszego niż jej brak,
    // bo wyglądałaby na poprawny identyfikator.
    const { db } = await databaseAtVersionOne();
    await migrate(db);

    const rows = await db.all<{ uuid: string }>('SELECT uuid FROM category');
    const unikalne = new Set(rows.map((r) => r.uuid));

    expect(rows.length).toBeGreaterThan(1);
    expect(unikalne.size).toBe(rows.length);
  });

  it('nowe rekordy dostają identyfikator bez udziału repozytorium', async () => {
    // Repozytorium wstawia `uuid` samo (Etap 14b), ale wyzwalacz zostaje jako
    // zabezpieczenie dla zapisów, które o kolumnie zapomną — a takich zapytań
    // przybędzie wraz z synchronizacją. Ten test pilnuje, żeby ono działało:
    // gdyby wyzwalacz zniknął, brak identyfikatora ujawniłby się dopiero
    // w dniu, w którym drugi telefon przestałby rozpoznawać rekordy.
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);
    const repo = new SqliteExpensesRepository(db);

    const income = await repo.createIncome({
      personName: 'Ola',
      amountGrosze: 620000,
      month: '2026-08',
    });
    const category = await repo.createCategory({
      name: 'Zwierzęta',
      usedBy: [MainType.PURCHASE],
      iconKey: 'pricetag-outline',
      isActive: true,
    });

    const incomeRow = await db.first<{ uuid: string | null }>(
      'SELECT uuid FROM income WHERE id = ?',
      [income.id]
    );
    const categoryRow = await db.first<{ uuid: string | null }>(
      'SELECT uuid FROM category WHERE id = ?',
      [category.id]
    );

    expect(incomeRow?.uuid).toMatch(/^[0-9a-f]{32}$/);
    expect(categoryRow?.uuid).toMatch(/^[0-9a-f]{32}$/);
  });

  it('odtworzenie kopii zapasowej też nadaje identyfikatory', async () => {
    // Odtwarzanie wstawia wiersze własnym zapytaniem, z zachowaniem
    // identyfikatorów liczbowych. Wyzwalacz działa i tam.
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);
    const repo = new SqliteExpensesRepository(db);

    await repo.importSnapshot(await repo.exportSnapshot());

    const missing = await db.first<{ count: number }>(
      'SELECT COUNT(*) AS count FROM category WHERE uuid IS NULL'
    );

    expect(missing?.count).toBe(0);
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

/**
 * Etap 14b, wersja 4 schematu.
 *
 * Obie rzeczy z tej migracji — ślad po skasowanych i znacznik „do wysłania" —
 * prowadzą WYZWALACZE, a nie kod aplikacji. To świadoma decyzja (uzasadnienie
 * w `migrations.ts`), ale ma cenę: TypeScript nie sprawdzi ani jednego z nich.
 * Jeżeli wyzwalacz zniknie albo dostanie zły warunek, aplikacja będzie działać
 * bez zarzutu do dnia pierwszej synchronizacji — a wtedy skasowane wydatki
 * zaczną wracać. Te testy są jedynym miejscem, w którym da się to złapać.
 */
describe('wersja 4 schematu: ślad po skasowanych i znacznik do wysłania', () => {
  /** Baza w najnowszej wersji, z domyślnymi kategoriami i jednym wydatkiem. */
  async function databaseWithPayment() {
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);

    const repo = new SqliteExpensesRepository(db);
    const [category] = await repo.listCategories(MainType.PURCHASE);
    const payment = await repo.createPayment({
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

    return { db, repo, payment };
  }

  const readPendingFlag = (db: ReturnType<typeof openNodeDatabase>, id: number) =>
    db.first<{ pendingSync: number }>('SELECT pendingSync FROM payment WHERE id = ?', [id]);

  it('tworzy tabelę skasowanych rekordów', async () => {
    const db = openNodeDatabase();
    await migrate(db);

    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    );

    expect(tables.map((table) => table.name)).toContain('deleted_record');
  });

  it('skasowanie wydatku zostawia jego trwały identyfikator', async () => {
    const { db, repo, payment } = await databaseWithPayment();

    await repo.deletePayment(payment.id);

    const rows = await db.all<{ entityType: string; uuid: string; deletedAt: string }>(
      'SELECT entityType, uuid, deletedAt FROM deleted_record'
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].entityType).toBe('PAYMENT');
    // Identyfikator LOKALNY zniknął razem z wierszem; zostaje ten trwały,
    // bo tylko on coś znaczy dla drugiego telefonu.
    expect(rows[0].uuid).toBe(payment.uuid);
    expect(rows[0].deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('skasowanie dochodu też zostawia ślad', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    const repo = new SqliteExpensesRepository(db);

    const income = await repo.createIncome({
      personName: 'Ola',
      amountGrosze: 620000,
      month: '2026-08',
    });
    await repo.deleteIncome(income.id);

    const rows = await db.all<{ entityType: string; uuid: string }>(
      'SELECT entityType, uuid FROM deleted_record'
    );

    expect(rows).toEqual([{ entityType: 'INCOME', uuid: income.uuid }]);
  });

  it('nowy rekord jest od razu oznaczony do wysłania', async () => {
    const { db, payment } = await databaseWithPayment();

    // Serwer nie widział go jeszcze ani razu.
    expect((await readPendingFlag(db, payment.id))?.pendingSync).toBe(1);
  });

  it('rekordy sprzed aktualizacji też są oznaczone do wysłania', async () => {
    // Kolumna wchodzi z `DEFAULT 1`, więc cała dotychczasowa historia czeka
    // na pierwszą wysyłkę. Gdyby weszła z zerem, wszystko, co użytkownik
    // wpisał przed założeniem konta, nigdy nie trafiłoby do chmury.
    const db = openNodeDatabase();
    await db.exec(MIGRATIONS[0]);
    await db.exec('PRAGMA user_version = 1');
    await seedAtVersionOne(db);

    await migrate(db);

    const rows = await db.all<{ pendingSync: number }>('SELECT pendingSync FROM category');

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.pendingSync === 1)).toBe(true);
  });

  it('edycja wysłanego rekordu oznacza go do wysłania ponownie', async () => {
    const { db, repo, payment } = await databaseWithPayment();

    // Udana wysyłka: znacznik gaśnie.
    await db.run('UPDATE payment SET pendingSync = 0 WHERE id = ?', [payment.id]);
    expect((await readPendingFlag(db, payment.id))?.pendingSync).toBe(0);

    await repo.updatePayment(payment.id, { amountGrosze: 9900 });

    expect((await readPendingFlag(db, payment.id))?.pendingSync).toBe(1);
  });

  it('zgaszenie znacznika po wysyłce nie zapala go z powrotem', async () => {
    // Bez tego synchronizacja nigdy by się nie kończyła: każde zgaszenie
    // znacznika byłoby zmianą rekordu, więc wyzwalacz zapalałby go na nowo,
    // a następna wysyłka wysyłałaby to samo raz jeszcze. W nieskończoność.
    const { db, payment } = await databaseWithPayment();

    await db.run('UPDATE payment SET pendingSync = 0 WHERE id = ?', [payment.id]);

    expect((await readPendingFlag(db, payment.id))?.pendingSync).toBe(0);
  });

  it('powtórna edycja niewysłanego rekordu niczego nie psuje', async () => {
    // Warunek wyzwalacza celowo NIE obejmuje przypadku 1 → 1. Ten test
    // pilnuje, że pominięcie go nie gasi znacznika ani nie zapętla zapisu.
    const { db, repo, payment } = await databaseWithPayment();

    await repo.updatePayment(payment.id, { amountGrosze: 9900 });
    await repo.updatePayment(payment.id, { amountGrosze: 8800 });

    expect((await readPendingFlag(db, payment.id))?.pendingSync).toBe(1);
    expect((await repo.getPayment(payment.id))?.amountGrosze).toBe(8800);
  });

  it('odtworzenie kopii nie zostawia nagrobków po skasowanych tabelach', async () => {
    // Odtwarzanie kasuje całą zawartość bazy, a wyzwalacze wystawiają nagrobek
    // za każdy skasowany wiersz. Zostawione, kazałyby synchronizacji usunąć
    // z serwera dokładnie to, co właśnie odtworzyliśmy z kopii.
    const { db, repo } = await databaseWithPayment();

    const snapshot = await repo.exportSnapshot();
    await repo.importSnapshot(snapshot);

    const rows = await db.all<{ uuid: string }>('SELECT uuid FROM deleted_record');

    expect(rows).toEqual([]);
  });

  it('odtworzenie kopii przywraca nagrobki zapisane w kopii', async () => {
    const { repo, payment } = await databaseWithPayment();

    await repo.deletePayment(payment.id);
    const snapshot = await repo.exportSnapshot();
    expect(snapshot.deletedRecords).toHaveLength(1);

    await repo.importSnapshot(snapshot);

    // Wiedza „ten wydatek został skasowany" przeżywa odtworzenie kopii.
    expect(await repo.listDeletedRecords()).toEqual([
      expect.objectContaining({ entityType: 'PAYMENT', uuid: payment.uuid }),
    ]);
  });
});

/**
 * Etap 14d, wersja 6 schematu.
 *
 * Dane startowe muszą mieć TE SAME identyfikatory na każdym telefonie.
 * Gdyby każdy je losował, „Jedzenie" z jednego urządzenia i „Jedzenie"
 * z drugiego byłyby dla synchronizacji dwiema różnymi kategoriami —
 * a użytkownik zobaczyłby każdą domyślną pozycję podwójnie, bez żadnego
 * sposobu, żeby je scalić. To jest usterka, której nie da się naprawić
 * po fakcie, więc pilnuje jej test.
 */
describe('wersja 6 schematu: stałe identyfikatory danych startowych', () => {
  it('domyślne kategorie mają identyfikatory wbudowane, nie losowe', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);

    const row = await db.first<{ uuid: string }>(
      "SELECT uuid FROM category WHERE name = 'Jedzenie'"
    );

    expect(row?.uuid).toBe('00000000000000000000000000000c01');
  });

  it('domyślne szablony rachunków też', async () => {
    const db = openNodeDatabase();
    await migrate(db);
    await seedDefaults(db);

    const row = await db.first<{ uuid: string }>(
      "SELECT uuid FROM bill_template WHERE name = 'Gaz'"
    );

    expect(row?.uuid).toBe('00000000000000000000000000000b04');
  });

  it('dwa telefony nadają tej samej kategorii ten sam identyfikator', async () => {
    // Sedno sprawy. Dwie niezależne bazy, ta sama nazwa, ten sam wynik.
    const pierwszy = openNodeDatabase();
    await migrate(pierwszy);
    await seedDefaults(pierwszy);

    const drugi = openNodeDatabase();
    await migrate(drugi);
    await seedDefaults(drugi);

    const zPierwszego = await pierwszy.all<{ name: string; uuid: string }>(
      'SELECT name, uuid FROM category ORDER BY sortOrder'
    );
    const zDrugiego = await drugi.all<{ name: string; uuid: string }>(
      'SELECT name, uuid FROM category ORDER BY sortOrder'
    );

    expect(zPierwszego).toEqual(zDrugiego);
  });

  it('poprawia identyfikatory nadane losowo przed tą wersją', async () => {
    // Telefon, który ma aplikację od wcześniejszego etapu, wylosował sobie
    // własne identyfikatory. Migracja musi je sprowadzić do wspólnych,
    // inaczej po pierwszej synchronizacji zobaczy wszystko podwójnie.
    const db = openNodeDatabase();

    // Baza w wersji 3 — jest już kolumna `uuid`, wypełniana losowo.
    for (const migracja of MIGRATIONS.slice(0, 3)) await db.exec(migracja);
    await db.exec('PRAGMA user_version = 3');

    await db.run(
      "INSERT INTO category (name, iconKey, isActive, sortOrder, usedBy) VALUES ('Jedzenie', 'x', 1, 1, 'PURCHASE')"
    );
    const przed = await db.first<{ uuid: string }>(
      "SELECT uuid FROM category WHERE name = 'Jedzenie'"
    );
    expect(przed?.uuid).not.toBe('00000000000000000000000000000c01');

    await migrate(db);

    const po = await db.first<{ uuid: string }>(
      "SELECT uuid FROM category WHERE name = 'Jedzenie'"
    );
    expect(po?.uuid).toBe('00000000000000000000000000000c01');
  });

  it('poprawione rekordy trafiają do kolejki wysyłki', async () => {
    // Identyfikator się zmienił, więc serwer zna je pod starym. Muszą pojechać
    // ponownie — inaczej wydatki wskazywałyby na kategorię, której w chmurze
    // nie ma pod tym numerem.
    const db = openNodeDatabase();
    for (const migracja of MIGRATIONS.slice(0, 4)) await db.exec(migracja);
    await db.exec('PRAGMA user_version = 4');

    await db.run(
      "INSERT INTO category (name, iconKey, isActive, sortOrder, usedBy, pendingSync) VALUES ('Jedzenie', 'x', 1, 1, 'PURCHASE', 0)"
    );

    await migrate(db);

    const row = await db.first<{ pendingSync: number }>(
      "SELECT pendingSync FROM category WHERE name = 'Jedzenie'"
    );
    expect(row?.pendingSync).toBe(1);
  });
});
