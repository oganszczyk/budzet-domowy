/**
 * Testy formatu kopii zapasowej.
 *
 * Odtworzenie kopii KASUJE dotychczasowe dane, więc rozpoznanie złego pliku
 * musi być pewne. Te testy pilnują obu kierunków: że dobra kopia przechodzi
 * bez zmiany choćby jednego pola, i że każdy rodzaj uszkodzenia zostaje
 * odrzucony ze zrozumiałym powodem.
 */

import type { BackupSnapshot } from '@/domain/backup';
import { FrequencyType, MainType, PaymentMethod, PaymentSource } from '@/domain/enums';

import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  backupFileName,
  parseBackup,
  serializeBackup,
} from './backup-file';

const CREATED_AT = '2026-08-21T10:30:00.000Z';

/**
 * Identyfikator wyliczony z numeru rekordu.
 *
 * Testy porównują migawkę zbudowaną dwa razy, więc losowy identyfikator
 * sprawiłby, że ta sama migawka przestałaby być równa sama sobie.
 */
const testUuid = (id: number): string => String(id).padStart(32, '0');

/** Migawka z jednym rekordem każdego rodzaju i wszystkimi polami wypełnionymi. */
function buildSnapshot(): BackupSnapshot {
  return {
    categories: [
      {
        id: 1,
        uuid: testUuid(1),
        name: 'Rachunki',
        iconKey: 'receipt-outline',
        isActive: true,
        sortOrder: 0,
        usedBy: [MainType.BILL],
      },
      {
        id: 2,
        uuid: testUuid(2),
        name: 'Rozrywka',
        iconKey: 'game-controller-outline',
        isActive: true,
        sortOrder: 1,
        usedBy: [MainType.SUBSCRIPTION, MainType.PURCHASE],
      },
    ],
    payments: [
      {
        id: 10,
        uuid: testUuid(10),
        mainType: MainType.PURCHASE,
        categoryId: 2,
        title: 'Lidl',
        amountGrosze: 12550,
        effectiveDate: '2026-08-15',
        dueDate: null,
        paidDate: null,
        status: null,
        source: PaymentSource.RECEIPT_SCAN,
        merchant: 'Lidl',
        description: 'Zakupy tygodniowe',
        paymentMethod: PaymentMethod.CARD,
        billTemplateId: null,
        subscriptionId: null,
        receiptImagePath: '/data/paragony/paragon-1.jpg',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
    billTemplates: [
      {
        id: 5,
        uuid: testUuid(5),
        name: 'Prąd',
        categoryId: 1,
        defaultDueDay: 10,
        isActive: true,
        useFixedAmount: false,
        fixedAmountGrosze: null,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
    subscriptions: [
      {
        id: 7,
        uuid: testUuid(7),
        name: 'Netflix',
        amountGrosze: 4300,
        frequencyType: FrequencyType.MONTHLY,
        customIntervalMonths: null,
        startDate: '2026-01-05',
        nextPaymentDate: '2026-09-05',
        categoryId: 2,
        isActive: true,
        lastUsageConfirmationDate: '2026-07-05',
        confirmationIntervalMonths: 3,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
    generatedRecords: [{ sourceType: 'BILL', sourceId: 5, year: 2026, month: 8 }],
    incomes: [
      {
        id: 3,
        uuid: testUuid(3),
        personName: 'Ola',
        amountGrosze: 620000,
        month: '2026-08',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
    savedReports: [
      {
        id: 4,
        name: 'Gaz w czasie',
        subjectKey: 'BILL_TEMPLATE:3',
        rangeMode: 'CUSTOM',
        windowMonths: 6,
        sortOrder: 1,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
    deletedRecords: [{ entityType: 'PAYMENT', uuid: testUuid(99), deletedAt: CREATED_AT }],
  };
}

/** Zapisuje migawkę, czyta ją z powrotem i zwraca wynik odczytu. */
function roundTrip(snapshot: BackupSnapshot) {
  return parseBackup(serializeBackup(snapshot, CREATED_AT));
}

/** Buduje tekst kopii po zepsuciu jednego miejsca w strukturze. */
function corrupted(mutate: (raw: Record<string, never>) => void): string {
  const raw = JSON.parse(serializeBackup(buildSnapshot(), CREATED_AT));
  mutate(raw);
  return JSON.stringify(raw);
}

describe('plik kopii zapasowej', () => {
  describe('zapis i odczyt', () => {
    it('odtwarza migawkę bez żadnej zmiany', () => {
      const snapshot = buildSnapshot();
      const result = roundTrip(snapshot);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot).toEqual(snapshot);
    });

    it('zapisuje znacznik aplikacji, wersję formatu i datę', () => {
      const result = roundTrip(buildSnapshot());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.app).toBe(BACKUP_APP_ID);
      expect(result.file.formatVersion).toBe(BACKUP_FORMAT_VERSION);
      expect(result.file.createdAt).toBe(CREATED_AT);
    });

    it('radzi sobie z pustą aplikacją', () => {
      const empty: BackupSnapshot = {
        categories: [],
        payments: [],
        billTemplates: [],
        subscriptions: [],
        generatedRecords: [],
        incomes: [],
        savedReports: [],
        deletedRecords: [],
      };

      const result = roundTrip(empty);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot).toEqual(empty);
    });

    it('zachowuje kwotę jako całkowitą liczbę groszy (BR-03)', () => {
      const result = roundTrip(buildSnapshot());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot.payments[0].amountGrosze).toBe(12550);
    });

    it('zachowuje pustą kwotę rachunku oczekującego (BR-04)', () => {
      const snapshot = buildSnapshot();
      snapshot.payments[0].amountGrosze = null;

      const result = roundTrip(snapshot);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot.payments[0].amountGrosze).toBeNull();
    });
  });

  describe('zgodność ze starszymi kopiami', () => {
    /** Plik z Etapu 10 — powstał, zanim istniały dochody domowników. */
    function version1File(): string {
      const raw = JSON.parse(serializeBackup(buildSnapshot(), CREATED_AT));
      raw.formatVersion = 1;
      delete raw.snapshot.incomes;
      // Zestawienia powstały dopiero w wersji 3 formatu.
      delete raw.snapshot.savedReports;
      return JSON.stringify(raw);
    }

    /** Kopia z Etapu 11 — ma już dochody, nie ma jeszcze zestawień. */
    function version2File(): string {
      const raw = JSON.parse(serializeBackup(buildSnapshot(), CREATED_AT));
      raw.formatVersion = 2;
      delete raw.snapshot.savedReports;
      return JSON.stringify(raw);
    }

    it('wczytuje kopię w wersji 1', () => {
      const result = parseBackup(version1File());

      expect(result.ok).toBe(true);
    });

    it('traktuje brak dochodów w wersji 1 jako pustą listę, nie jako uszkodzenie', () => {
      const result = parseBackup(version1File());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot.incomes).toEqual([]);
    });

    it('zachowuje pozostałe dane z kopii w wersji 1', () => {
      const result = parseBackup(version1File());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot.payments).toEqual(buildSnapshot().payments);
    });

    it('traktuje brak zestawień w starszej kopii jako pustą listę', () => {
      // Etap 13 podniósł format do wersji 3. Kopia zrobiona wczoraj, w wersji 2,
      // nie ma pola `savedReports` — i to nie jest uszkodzenie. Gdyby było,
      // wydanie tego etapu unieważniłoby wszystkie dotychczasowe kopie
      // użytkownika, czyli dokładnie wtedy, gdy są najbardziej potrzebne.
      const result = parseBackup(version2File());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot.savedReports).toEqual([]);
      // Dochody z wersji 2 mają przy tym przetrwać w komplecie.
      expect(result.file.snapshot.incomes).toEqual(buildSnapshot().incomes);
    });
  });

  describe('zapisane zestawienia (Etap 13)', () => {
    it('przechodzą zapis i odczyt bez zmiany', () => {
      const snapshot = buildSnapshot();
      const result = roundTrip(snapshot);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot.savedReports).toEqual(snapshot.savedReports);
    });

    it('odrzuca zestawienie z nieznanym trybem zakresu', () => {
      const snapshot = buildSnapshot();
      const damaged = {
        ...snapshot,
        savedReports: [{ ...snapshot.savedReports[0], rangeMode: 'CO_TO_JEST' }],
      };

      const result = parseBackup(serializeBackup(damaged as unknown as BackupSnapshot, CREATED_AT));

      expect(result).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca okno o bezsensownej długości', () => {
      // Zero miesięcy dałoby zakres, z którego nie da się zbudować wykresu.
      const snapshot = buildSnapshot();
      const damaged = {
        ...snapshot,
        savedReports: [{ ...snapshot.savedReports[0], windowMonths: 0 }],
      };

      const result = parseBackup(serializeBackup(damaged, CREATED_AT));

      expect(result).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('przyjmuje puste okno dla trybu roku do roku', () => {
      const snapshot = buildSnapshot();
      const yearOverYear = {
        ...snapshot,
        savedReports: [
          {
            ...snapshot.savedReports[0],
            rangeMode: 'YEAR_OVER_YEAR' as const,
            windowMonths: null,
          },
        ],
      };

      const result = parseBackup(serializeBackup(yearOverYear, CREATED_AT));

      expect(result.ok).toBe(true);
    });
  });

  describe('dochody domowników', () => {
    it('przechodzą zapis i odczyt bez zmiany', () => {
      const snapshot = buildSnapshot();
      const result = roundTrip(snapshot);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.file.snapshot.incomes).toEqual(snapshot.incomes);
    });

    it('odrzucają kwotę ujemną', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.incomes as Record<string, unknown>[])[0].amountGrosze = -1000;
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzucają miesiąc w innym formacie niż RRRR-MM', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.incomes as Record<string, unknown>[])[0].month = 'sierpień 2026';
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzucają miesiąc 00 i 13', () => {
      for (const month of ['2026-00', '2026-13']) {
        const text = corrupted((raw) => {
          const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
          (snapshot.incomes as Record<string, unknown>[])[0].month = month;
        });

        expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
      }
    });
  });

  describe('nazwa pliku', () => {
    it('zawiera dzień powstania kopii', () => {
      expect(backupFileName(CREATED_AT)).toBe('domowe-wydatki-2026-08-21.json');
    });
  });

  describe('odrzucanie złych plików', () => {
    it('odrzuca tekst, który nie jest JSON-em', () => {
      const result = parseBackup('to nie jest plik kopii');

      expect(result).toEqual({ ok: false, reason: 'NOT_JSON' });
    });

    it('odrzuca ucięty plik', () => {
      const full = serializeBackup(buildSnapshot(), CREATED_AT);
      const result = parseBackup(full.slice(0, Math.floor(full.length / 2)));

      expect(result).toEqual({ ok: false, reason: 'NOT_JSON' });
    });

    it('odrzuca poprawny JSON obcej aplikacji', () => {
      const result = parseBackup(JSON.stringify({ app: 'inna-aplikacja', dane: [] }));

      expect(result).toEqual({ ok: false, reason: 'NOT_BACKUP' });
    });

    it('odrzuca kopię z nowszej wersji formatu', () => {
      const text = corrupted((raw) => {
        (raw as Record<string, unknown>).formatVersion = BACKUP_FORMAT_VERSION + 1;
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'FUTURE_VERSION' });
    });

    it('odrzuca plik bez migawki', () => {
      const text = corrupted((raw) => {
        delete (raw as Record<string, unknown>).snapshot;
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca brakującą tablicę rekordów', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        delete snapshot.payments;
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca kwotę zapisaną jako liczba z przecinkiem (BR-03)', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.payments as Record<string, unknown>[])[0].amountGrosze = 125.5;
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca datę w innym formacie niż RRRR-MM-DD', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.payments as Record<string, unknown>[])[0].effectiveDate = '15.08.2026';
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca nieznaną kategorię główną', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.payments as Record<string, unknown>[])[0].mainType = 'INWESTYCJA';
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca nieznany sposób płatności', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.payments as Record<string, unknown>[])[0].paymentMethod = 'BLIK';
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca dzień terminu spoza zakresu 1-31', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.billTemplates as Record<string, unknown>[])[0].defaultDueDay = 45;
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca miesiąc spoza zakresu w rejestrze wygenerowanych', () => {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.generatedRecords as Record<string, unknown>[])[0].month = 13;
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    });

    it('odrzuca cały plik, gdy zepsuty jest choć jeden rekord z wielu', () => {
      const snapshot = buildSnapshot();
      snapshot.payments = [
        snapshot.payments[0],
        { ...snapshot.payments[0], id: 11 },
        { ...snapshot.payments[0], id: 12 },
      ];

      const raw = JSON.parse(serializeBackup(snapshot, CREATED_AT));
      raw.snapshot.payments[1].effectiveDate = null;

      expect(parseBackup(JSON.stringify(raw))).toEqual({ ok: false, reason: 'DAMAGED' });
    });
  });
});

/**
 * Etap 14b: trwałe identyfikatory i ślad po skasowanych w pliku kopii.
 *
 * Kopia zapasowa jest jedynym miejscem, w którym dane wracają do aplikacji
 * Z ZEWNĄTRZ. Wszystko inne przychodzi z własnej bazy albo własnych
 * formularzy. Dlatego identyfikatorów pilnujemy tutaj tak samo drobiazgowo
 * jak kwot — z tą różnicą, że błąd w identyfikatorze nie jest widoczny
 * od razu: ujawnia się przy synchronizacji, jako rozdwojony albo wracający
 * wydatek, wiele dni po odtworzeniu kopii.
 */
describe('trwałe identyfikatory w kopii (Etap 14b)', () => {
  /** Buduje kopię po usunięciu wskazanych pól — odgrywa plik ze starszej wersji. */
  function withoutFields(usun: (snapshot: Record<string, unknown>) => void): string {
    const raw = JSON.parse(serializeBackup(buildSnapshot(), CREATED_AT));
    usun(raw.snapshot);
    return JSON.stringify(raw);
  }

  it('identyfikator przeżywa zapis i odczyt bez zmiany', () => {
    const result = roundTrip(buildSnapshot());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.file.snapshot.payments[0].uuid).toBe(buildSnapshot().payments[0].uuid);
    expect(result.file.snapshot.categories[0].uuid).toBe(buildSnapshot().categories[0].uuid);
  });

  it('kopia sprzed Etapu 14b wczytuje się, a rekordy dostają identyfikatory', () => {
    // Użytkownik ma na telefonie kopie zrobione starszą wersją aplikacji.
    // Odrzucenie ich zabrałoby mu jedyne zabezpieczenie danych, jakie ma.
    const text = withoutFields((snapshot) => {
      for (const lista of ['categories', 'payments', 'billTemplates', 'subscriptions', 'incomes']) {
        for (const rekord of snapshot[lista] as Record<string, unknown>[]) {
          delete rekord.uuid;
        }
      }
    });

    const result = parseBackup(text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.file.snapshot.payments[0].uuid).toMatch(/^[0-9a-f]{32}$/);
    expect(result.file.snapshot.categories[0].uuid).toMatch(/^[0-9a-f]{32}$/);
    expect(result.file.snapshot.incomes[0].uuid).toMatch(/^[0-9a-f]{32}$/);
  });

  it('każdy rekord starej kopii dostaje WŁASNY identyfikator', () => {
    const text = withoutFields((snapshot) => {
      for (const rekord of snapshot.categories as Record<string, unknown>[]) delete rekord.uuid;
    });

    const result = parseBackup(text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const [first, second] = result.file.snapshot.categories;
    expect(first.uuid).not.toBe(second.uuid);
  });

  it('odrzuca kopię z uszkodzonym identyfikatorem', () => {
    // Obecne, ale bezsensowne pole to co innego niż jego brak: znaczy, że plik
    // jest uszkodzony. Dolosowanie identyfikatora w tym miejscu byłoby
    // najgorsze z możliwych — dwa telefony odtworzyłyby tę samą kopię pod
    // różnymi identyfikatorami i każdy wydatek istniałby po synchronizacji
    // dwa razy.
    for (const zle of ['', 'nie-jest-identyfikatorem', 'ABCDEF', 42, null]) {
      const text = corrupted((raw) => {
        const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
        (snapshot.payments as Record<string, unknown>[])[0].uuid = zle;
      });

      expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
    }
  });

  it('ślad po skasowanych przeżywa zapis i odczyt', () => {
    const result = roundTrip(buildSnapshot());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.file.snapshot.deletedRecords).toEqual(buildSnapshot().deletedRecords);
  });

  it('kopia bez listy skasowanych wczytuje się z pustą listą', () => {
    const text = withoutFields((snapshot) => {
      delete snapshot.deletedRecords;
    });

    const result = parseBackup(text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.file.snapshot.deletedRecords).toEqual([]);
  });

  it('odrzuca wpis o skasowaniu bez poprawnego identyfikatora', () => {
    // Tutaj identyfikator to CAŁA treść wpisu. Dolosowany nie kasowałby
    // niczego, a wyglądałby na poprawny.
    const text = corrupted((raw) => {
      const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
      delete (snapshot.deletedRecords as Record<string, unknown>[])[0].uuid;
    });

    expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
  });

  it('odrzuca wpis o skasowaniu nieznanego rodzaju rekordu', () => {
    const text = corrupted((raw) => {
      const snapshot = (raw as Record<string, Record<string, unknown>>).snapshot;
      (snapshot.deletedRecords as Record<string, unknown>[])[0].entityType = 'COŚ_INNEGO';
    });

    expect(parseBackup(text)).toEqual({ ok: false, reason: 'DAMAGED' });
  });
});
