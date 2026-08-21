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
