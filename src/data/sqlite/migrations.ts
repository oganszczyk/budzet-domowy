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

  // --- wersja 4: ślad po skasowanych i znacznik „do wysłania" (Etap 14b) ---
  //
  // Dwie rzeczy, bez których synchronizacja nie może działać poprawnie.
  //
  // ŚLAD PO SKASOWANYCH (`deleted_record`).
  //
  // Bez niego usunięcie wydatku byłoby nieodwracalne tylko z pozoru. Telefon A
  // kasuje wydatek i po prostu przestaje go mieć. Przy najbliższej wymianie
  // danych telefon B — który tego wydatku nie kasował — nadal go ma i wysyła.
  // Telefon A widzi rekord, którego u siebie nie zna, więc uznaje go za nowy
  // i zapisuje z powrotem. Skasowany wydatek WRACA, i to za każdym razem;
  // nie da się go usunąć na stałe na żadnym z telefonów.
  //
  // Dlatego kasowanie musi zostawiać jawny zapis „ten rekord został usunięty",
  // który da się rozesłać tak samo jak każdą inną zmianę. Zapisujemy `uuid`,
  // a nie `id`, bo lokalny numer nic nie znaczy poza tym jednym telefonem.
  //
  // WYZWALACZ, NIE ZMIANA ZAPYTAŃ `DELETE` — z tego samego powodu, dla którego
  // wyzwalaczem nadajemy `uuid` w wersji 3. Kasowanie dzieje się w kilku
  // miejscach repozytorium i przybędzie go wraz z kolejnymi funkcjami.
  // Zapomniany jeden `DELETE` nie psuje niczego widocznego — objawia się
  // dopiero wracającym wydatkiem, wiele dni później, na drugim urządzeniu.
  //
  // ZNACZNIK „DO WYSŁANIA" (`pendingSync`).
  //
  // Wysyłanie całej bazy przy każdej synchronizacji działałoby przy stu
  // wydatkach i przestałoby przy kilku tysiącach. Znacznik mówi, których
  // rekordów serwer jeszcze nie widział w tej postaci.
  //
  // Nowa kolumna dostaje `DEFAULT 1`, więc WSZYSTKIE dotychczasowe rekordy
  // są od razu oznaczone jako do wysłania — i słusznie, bo serwer nie widział
  // dotąd żadnego.
  //
  // Wyzwalacz `AFTER UPDATE` ma warunek `old.pendingSync = 0 AND
  // new.pendingSync = 0`, który wygląda dziwnie, ale jest przemyślany:
  //
  //   * edycja czystego rekordu (0 → 0, bo zapytanie nie rusza tej kolumny)
  //     spełnia warunek i podnosi znacznik na 1 — o to chodzi;
  //   * edycja rekordu już oznaczonego (1 → 1) warunku nie spełnia, ale też
  //     nie musi, bo znacznik jest już podniesiony;
  //   * skasowanie znacznika po udanej wysyłce (1 → 0) warunku nie spełnia,
  //     więc wysyłka nie oznacza rekordu z powrotem jako niewysłanego —
  //     bez tego synchronizacja nigdy by się nie kończyła;
  //   * zapis wykonany przez sam wyzwalacz (0 → 1) warunku nie spełnia,
  //     więc wyzwalacz nie wywołuje sam siebie w nieskończoność.
  //
  // Indeksy są CZĘŚCIOWE (`WHERE pendingSync = 1`). Zwykły indeks na kolumnie
  // o dwóch wartościach jest bezużyteczny — połowa bazy pod jednym kluczem.
  // Częściowy zawiera wyłącznie rekordy do wysłania, czyli zwykle garść,
  // i po synchronizacji jest niemal pusty.
  `
  CREATE TABLE deleted_record (
    -- 'PAYMENT', 'CATEGORY', 'BILL_TEMPLATE', 'SUBSCRIPTION', 'INCOME'.
    entityType TEXT NOT NULL,
    -- Trwały identyfikator skasowanego rekordu; jego wiersza już nie ma.
    uuid TEXT NOT NULL,
    deletedAt TEXT NOT NULL,
    pendingSync INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (entityType, uuid)
  );

  CREATE INDEX idx_deleted_record_pending
    ON deleted_record(pendingSync) WHERE pendingSync = 1;

  ALTER TABLE category ADD COLUMN pendingSync INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE bill_template ADD COLUMN pendingSync INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE subscription ADD COLUMN pendingSync INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE payment ADD COLUMN pendingSync INTEGER NOT NULL DEFAULT 1;
  ALTER TABLE income ADD COLUMN pendingSync INTEGER NOT NULL DEFAULT 1;

  CREATE INDEX idx_category_pending ON category(pendingSync) WHERE pendingSync = 1;
  CREATE INDEX idx_bill_template_pending ON bill_template(pendingSync) WHERE pendingSync = 1;
  CREATE INDEX idx_subscription_pending ON subscription(pendingSync) WHERE pendingSync = 1;
  CREATE INDEX idx_payment_pending ON payment(pendingSync) WHERE pendingSync = 1;
  CREATE INDEX idx_income_pending ON income(pendingSync) WHERE pendingSync = 1;

  CREATE TRIGGER trg_category_pending AFTER UPDATE ON category
    WHEN old.pendingSync = 0 AND new.pendingSync = 0
    BEGIN UPDATE category SET pendingSync = 1 WHERE id = new.id; END;

  CREATE TRIGGER trg_bill_template_pending AFTER UPDATE ON bill_template
    WHEN old.pendingSync = 0 AND new.pendingSync = 0
    BEGIN UPDATE bill_template SET pendingSync = 1 WHERE id = new.id; END;

  CREATE TRIGGER trg_subscription_pending AFTER UPDATE ON subscription
    WHEN old.pendingSync = 0 AND new.pendingSync = 0
    BEGIN UPDATE subscription SET pendingSync = 1 WHERE id = new.id; END;

  CREATE TRIGGER trg_payment_pending AFTER UPDATE ON payment
    WHEN old.pendingSync = 0 AND new.pendingSync = 0
    BEGIN UPDATE payment SET pendingSync = 1 WHERE id = new.id; END;

  CREATE TRIGGER trg_income_pending AFTER UPDATE ON income
    WHEN old.pendingSync = 0 AND new.pendingSync = 0
    BEGIN UPDATE income SET pendingSync = 1 WHERE id = new.id; END;

  CREATE TRIGGER trg_category_deleted AFTER DELETE ON category
    BEGIN
      INSERT OR REPLACE INTO deleted_record (entityType, uuid, deletedAt, pendingSync)
      VALUES ('CATEGORY', old.uuid, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1);
    END;

  CREATE TRIGGER trg_bill_template_deleted AFTER DELETE ON bill_template
    BEGIN
      INSERT OR REPLACE INTO deleted_record (entityType, uuid, deletedAt, pendingSync)
      VALUES ('BILL_TEMPLATE', old.uuid, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1);
    END;

  CREATE TRIGGER trg_subscription_deleted AFTER DELETE ON subscription
    BEGIN
      INSERT OR REPLACE INTO deleted_record (entityType, uuid, deletedAt, pendingSync)
      VALUES ('SUBSCRIPTION', old.uuid, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1);
    END;

  CREATE TRIGGER trg_payment_deleted AFTER DELETE ON payment
    BEGIN
      INSERT OR REPLACE INTO deleted_record (entityType, uuid, deletedAt, pendingSync)
      VALUES ('PAYMENT', old.uuid, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1);
    END;

  CREATE TRIGGER trg_income_deleted AFTER DELETE ON income
    BEGIN
      INSERT OR REPLACE INTO deleted_record (entityType, uuid, deletedAt, pendingSync)
      VALUES ('INCOME', old.uuid, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), 1);
    END;
  `,

  // --- wersja 5: znacznik „co już pobrano z serwera" (Etap 14d) ---
  //
  // Pobieranie musi wiedzieć, gdzie skończyło poprzednim razem. Bez tego
  // każda synchronizacja ściągałaby całą historię wydatków od początku —
  // działałoby to przy stu rekordach i przestało przy kilku tysiącach.
  //
  // ZNACZNIK POCHODZI Z ZEGARA SERWERA, nie telefonu. Kolumna `synced_at`
  // w chmurze jest stemplowana przez Postgresa (patrz plik SQL). Zegar
  // telefonu bywa przestawiony o godziny — znacznik z niego wzięty kazałby
  // pomijać zmiany albo pobierać w kółko te same.
  //
  // Tabela jest celowo OGÓLNA (klucz i wartość), a nie kolumną na każdą
  // tabelę osobno. Znaczników przybędzie wraz z tym, co synchronizujemy,
  // a każdy nowy nie powinien wymagać migracji schematu.
  //
  // Wartości NIE MA po pierwszej instalacji i to jest poprawny stan:
  // brak znacznika znaczy „nigdy nic nie pobrałem", czyli pobierz wszystko.
  `
  CREATE TABLE sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,

  // --- wersja 6: stałe identyfikatory danych startowych (Etap 14d) ---
  //
  // Do tej pory każdy telefon LOSOWAŁ identyfikatory dla tych samych
  // domyślnych kategorii i rachunków. Dla synchronizacji „Jedzenie" z jednego
  // telefonu i „Jedzenie" z drugiego były więc dwiema różnymi kategoriami —
  // po pierwszym pobraniu danych użytkownik zobaczyłby każdą domyślną
  // pozycję podwójnie, bez żadnego sposobu, żeby je scalić.
  //
  // Ta migracja nadaje im wartości stałe, te same na każdym urządzeniu.
  // Dopasowanie idzie po NAZWIE, bo tylko ona jest wspólna dla obu baz.
  //
  // KOGO TO OMIJA: rekordy, którym użytkownik zmienił nazwę. Zostają przy
  // losowym identyfikatorze i po synchronizacji mogą pojawić się obok
  // odpowiednika z drugiego telefonu. Świadoma granica — dopasowywanie
  // „na oko" zmienionych nazw myliłoby się w drugą stronę, scalając
  // kategorie, które użytkownik celowo rozdzielił.
  //
  // Zapis podnosi znacznik „do wysłania" wyzwalaczem z migracji 4, więc
  // poprawione rekordy pojadą na serwer przy najbliższej synchronizacji.
  `
  UPDATE category SET uuid = '00000000000000000000000000000c00' WHERE name = 'Rachunki domowe';
  UPDATE category SET uuid = '00000000000000000000000000000c01' WHERE name = 'Jedzenie';
  UPDATE category SET uuid = '00000000000000000000000000000c02' WHERE name = 'Kosmetyki i higiena';
  UPDATE category SET uuid = '00000000000000000000000000000c03' WHERE name = 'Sprzątanie';
  UPDATE category SET uuid = '00000000000000000000000000000c04' WHERE name = 'Ubrania';
  UPDATE category SET uuid = '00000000000000000000000000000c05' WHERE name = 'Mieszkanie';
  UPDATE category SET uuid = '00000000000000000000000000000c06' WHERE name = 'Rozrywka';
  UPDATE category SET uuid = '00000000000000000000000000000c07' WHERE name = 'Sport';
  UPDATE category SET uuid = '00000000000000000000000000000c08' WHERE name = 'Komputerowe';
  UPDATE category SET uuid = '00000000000000000000000000000c09' WHERE name = 'Inne';

  UPDATE bill_template SET uuid = '00000000000000000000000000000b01' WHERE name = 'Czynsz za mieszkanie';
  UPDATE bill_template SET uuid = '00000000000000000000000000000b02' WHERE name = 'Prąd';
  UPDATE bill_template SET uuid = '00000000000000000000000000000b03' WHERE name = 'Woda';
  UPDATE bill_template SET uuid = '00000000000000000000000000000b04' WHERE name = 'Gaz';
  UPDATE bill_template SET uuid = '00000000000000000000000000000b05' WHERE name = 'Internet';
  UPDATE bill_template SET uuid = '00000000000000000000000000000b06' WHERE name = 'Telefon';
  UPDATE bill_template SET uuid = '00000000000000000000000000000b07' WHERE name = 'Ubezpieczenie';
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
