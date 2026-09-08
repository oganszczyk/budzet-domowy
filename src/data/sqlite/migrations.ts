/**
 * Schemat bazy i migracje (7.1-7.5).
 *
 * 1.2: „Stosować migracje bazy danych zamiast kasowania lokalnej bazy przy
 * zmianach schematu." Dlatego zmiany schematu dopisujemy jako KOLEJNY wpis
 * w tablicy `MIGRATIONS`, nigdy nie edytując poprzednich — one wykonały się
 * już na urządzeniach i ich zmiana rozjechałaby bazy.
 *
 * Wersję trzymamy w `PRAGMA user_version`, czyli w samym pliku bazy.
 * Nie trzeba osobnej tabeli ani pliku obok.
 */

import type { SqlDatabase } from './database';

/**
 * Każdy element to jedna wersja schematu. Indeks + 1 = numer wersji.
 * DOPISUJ NA KOŃCU, nie zmieniaj istniejących.
 */
export const MIGRATIONS: string[] = [
  // --- wersja 1: schemat początkowy ---
  `
  CREATE TABLE category (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    iconKey TEXT NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    -- Lista typów rozdzielona przecinkiem, np. 'SUBSCRIPTION,PURCHASE'.
    -- Subskrypcje i zakupy dzielą podkategorie, żeby analiza mogła je zsumować.
    usedBy TEXT NOT NULL
  );

  CREATE TABLE bill_template (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    categoryId INTEGER NOT NULL REFERENCES category(id),
    defaultDueDay INTEGER NOT NULL,
    isActive INTEGER NOT NULL DEFAULT 1,
    useFixedAmount INTEGER NOT NULL DEFAULT 0,
    fixedAmountGrosze INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE subscription (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amountGrosze INTEGER NOT NULL,
    frequencyType TEXT NOT NULL,
    customIntervalMonths INTEGER,
    startDate TEXT NOT NULL,
    nextPaymentDate TEXT NOT NULL,
    categoryId INTEGER NOT NULL REFERENCES category(id),
    isActive INTEGER NOT NULL DEFAULT 1,
    lastUsageConfirmationDate TEXT,
    confirmationIntervalMonths INTEGER NOT NULL DEFAULT 3,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE payment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mainType TEXT NOT NULL,
    categoryId INTEGER NOT NULL REFERENCES category(id),
    title TEXT NOT NULL,
    -- BR-03: zawsze całkowita liczba groszy.
    -- BR-04: pusta wyłącznie dla rachunku oczekującego na kwotę.
    amountGrosze INTEGER,
    effectiveDate TEXT NOT NULL,
    dueDate TEXT,
    paidDate TEXT,
    -- Status rachunku wyliczamy przy odczycie (BR-11); kolumna zostaje
    -- dla zgodności z 7.2, ale nie jest źródłem prawdy.
    status TEXT,
    source TEXT NOT NULL,
    merchant TEXT,
    description TEXT,
    paymentMethod TEXT,
    billTemplateId INTEGER REFERENCES bill_template(id),
    subscriptionId INTEGER REFERENCES subscription(id),
    receiptImagePath TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  -- 7.5: indeks do historii i sum miesięcznych.
  CREATE INDEX idx_payment_effective_date ON payment(effectiveDate);
  -- 7.5: indeks do kart ekranu głównego.
  CREATE INDEX idx_payment_main_type_date ON payment(mainType, effectiveDate);

  -- 7.5 + BR-12: jeden automatyczny rachunek na szablon i miesiąc.
  -- substr(effectiveDate,1,7) to 'RRRR-MM', czyli miesiąc rekordu.
  CREATE UNIQUE INDEX idx_payment_auto_bill_month
    ON payment(billTemplateId, substr(effectiveDate, 1, 7))
    WHERE source = 'AUTO_BILL' AND billTemplateId IS NOT NULL;

  -- 7.5 + BR-12: jedna automatyczna płatność subskrypcji na termin.
  CREATE UNIQUE INDEX idx_payment_auto_subscription_date
    ON payment(subscriptionId, effectiveDate)
    WHERE source = 'AUTO_SUBSCRIPTION' AND subscriptionId IS NOT NULL;

  -- Rejestr „ten szablon miał już rekord w tym miesiącu".
  -- Bez niego usunięty rachunek wracałby przy następnym otwarciu listy,
  -- bo automat uznałby jego brak za „jeszcze nie utworzono".
  CREATE TABLE generated_record (
    sourceType TEXT NOT NULL,
    sourceId INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    PRIMARY KEY (sourceType, sourceId, year, month)
  );
  `,

  // --- wersja 2: dochody domowników (Etap 11) ---
  //
  // Osobna tabela, a nie płatność z kwotą ujemną — uzasadnienie przy typie
  // `Income` w `src/domain/models.ts`.
  //
  // `month` to tekst 'RRRR-MM', czyli ten sam zapis, co pierwsze siedem
  // znaków daty ISO. Dochód dotyczy miesiąca, nie konkretnego dnia.
  `
  CREATE TABLE income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    personName TEXT NOT NULL,
    -- BR-03: całkowita liczba groszy, zawsze dodatnia.
    amountGrosze INTEGER NOT NULL,
    month TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  -- Ekran główny pyta o dochody wybranego miesiąca przy każdym otwarciu.
  CREATE INDEX idx_income_month ON income(month);
  `,

  // --- wersja 3: zapisane zestawienia + trwałe identyfikatory (Etap 13) ---
  //
  // Dwie zmiany w jednej migracji, celowo. Każda migracja to jeden moment,
  // w którym coś może pójść nie tak na prawdziwych danych użytkownika —
  // lepiej mieć jeden taki moment niż dwa.
  //
  // KOLUMNA `uuid` NIE WCHODZI DO MODELU DANYCH.
  //
  // Właściciel projektu potwierdził, że pojawi się drugi telefon, a przy
  // synchronizacji `INTEGER AUTOINCREMENT` zawodzi: dwa urządzenia niezależnie
  // utworzą wydatek o numerze 42 i jeden nadpisze drugi. Trwały identyfikator
  // trzeba nadać ZANIM uzbiera się rok danych.
  //
  // Zatrzymujemy go jednak na poziomie bazy. Wciągnięcie `uuid` do typów
  // `Payment`, `Category` i pozostałych wymusiłoby dopisanie go wszędzie tam,
  // gdzie takie rekordy powstają — w danych demonstracyjnych, zasiewie,
  // czytniku kopii zapasowej i kilkudziesięciu testach — dla pola, którego
  // dziś nikt nie odczytuje. Kolumna czeka wypełniona; model i format kopii
  // rozszerzymy dopiero wtedy, gdy powstanie prawdziwa synchronizacja.
  //
  // `ALTER TABLE ADD COLUMN` w SQLite przyjmuje wyłącznie stałą wartość
  // domyślną, więc istniejące wiersze wypełniamy osobnym `UPDATE`
  // (`randomblob` jest wyliczany dla każdego wiersza z osobna), a nowe —
  // wyzwalaczem.
  //
  // WYZWALACZ, A NIE ZMIANA ZAPYTAŃ `INSERT`. Rekordy powstają w dziesięciu
  // miejscach repozytorium, licząc odtwarzanie kopii zapasowej. Dopisanie
  // kolumny do każdego z nich to dziesięć okazji, żeby o jednym zapomnieć —
  // i to zapomnieć po cichu, bo brakujący identyfikator niczego nie psuje
  // aż do dnia, w którym powstanie synchronizacja. Baza pilnuje tego sama,
  // więc nie da się tego pominąć.
  `
  CREATE TABLE saved_report (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    -- Przedmiot analizy w zapisie subjectKey, np. 'BILL_TEMPLATE:3'.
    subjectKey TEXT NOT NULL,
    rangeMode TEXT NOT NULL,
    -- Długość przesuwającego się okna; NULL dla trybu 'rok do roku'.
    windowMonths INTEGER,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  ALTER TABLE category ADD COLUMN uuid TEXT;
  ALTER TABLE bill_template ADD COLUMN uuid TEXT;
  ALTER TABLE subscription ADD COLUMN uuid TEXT;
  ALTER TABLE payment ADD COLUMN uuid TEXT;
  ALTER TABLE income ADD COLUMN uuid TEXT;

  UPDATE category SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
  UPDATE bill_template SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
  UPDATE subscription SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
  UPDATE payment SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;
  UPDATE income SET uuid = lower(hex(randomblob(16))) WHERE uuid IS NULL;

  CREATE UNIQUE INDEX idx_category_uuid ON category(uuid);
  CREATE UNIQUE INDEX idx_bill_template_uuid ON bill_template(uuid);
  CREATE UNIQUE INDEX idx_subscription_uuid ON subscription(uuid);
  CREATE UNIQUE INDEX idx_payment_uuid ON payment(uuid);
  CREATE UNIQUE INDEX idx_income_uuid ON income(uuid);

  CREATE TRIGGER trg_category_uuid AFTER INSERT ON category
    WHEN new.uuid IS NULL
    BEGIN UPDATE category SET uuid = lower(hex(randomblob(16))) WHERE id = new.id; END;

  CREATE TRIGGER trg_bill_template_uuid AFTER INSERT ON bill_template
    WHEN new.uuid IS NULL
    BEGIN UPDATE bill_template SET uuid = lower(hex(randomblob(16))) WHERE id = new.id; END;

  CREATE TRIGGER trg_subscription_uuid AFTER INSERT ON subscription
    WHEN new.uuid IS NULL
    BEGIN UPDATE subscription SET uuid = lower(hex(randomblob(16))) WHERE id = new.id; END;

  CREATE TRIGGER trg_payment_uuid AFTER INSERT ON payment
    WHEN new.uuid IS NULL
    BEGIN UPDATE payment SET uuid = lower(hex(randomblob(16))) WHERE id = new.id; END;

  CREATE TRIGGER trg_income_uuid AFTER INSERT ON income
    WHEN new.uuid IS NULL
    BEGIN UPDATE income SET uuid = lower(hex(randomblob(16))) WHERE id = new.id; END;
  `,
];

/** Wersja schematu, do której doprowadzają wszystkie migracje. */
export const TARGET_SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Doprowadza bazę do najnowszej wersji schematu.
 *
 * Wykonuje wyłącznie migracje o numerze wyższym niż zapisana wersja,
 * więc jest bezpieczna do wywołania przy każdym starcie aplikacji.
 * Zwraca informację, czy baza była pusta — wtedy trzeba ją zasiać (3.1).
 */
export async function migrate(db: SqlDatabase): Promise<{ createdFromScratch: boolean }> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion >= TARGET_SCHEMA_VERSION) {
    return { createdFromScratch: false };
  }

  for (let version = currentVersion; version < TARGET_SCHEMA_VERSION; version++) {
    await db.exec(MIGRATIONS[version]);
  }

  // PRAGMA nie przyjmuje parametrów, a wartość pochodzi z naszej stałej,
  // nie od użytkownika — wstawienie jej do tekstu jest tu bezpieczne.
  await db.exec(`PRAGMA user_version = ${TARGET_SCHEMA_VERSION}`);

  return { createdFromScratch: currentVersion === 0 };
}
