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

/** Migawka z jednym rekordem każdego rodzaju i wszystkimi polami wypełnionymi. */
function buildSnapshot(): BackupSnapshot {
  return {
    categories: [
      {
        id: 1,
        name: 'Rachunki',
        iconKey: 'receipt-outline',
        isActive: true,
        sortOrder: 0,
        usedBy: [MainType.BILL],
      },
      {
        id: 2,
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
        personName: 'Ola',
        amountGrosze: 620000,
        month: '2026-08',
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT,
      },
    ],
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
