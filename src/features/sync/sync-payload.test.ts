import type { PendingChanges } from '@/data/repository';
import { BillStatus, FrequencyType, MainType, PaymentMethod, PaymentSource } from '@/domain/enums';

import { buildSyncPayload, countPayload, UPLOAD_ORDER } from './sync-payload';

const USER = '11111111-2222-3333-4444-555555555555';
const CZAS = '2026-09-08T10:00:00.000Z';

const uuid = (n: number) => String(n).padStart(32, '0');

function changes(overrides: Partial<PendingChanges> = {}): PendingChanges {
  return {
    categories: [],
    billTemplates: [],
    subscriptions: [],
    payments: [],
    incomes: [],
    deletedRecords: [],
    ...overrides,
  };
}

const KATEGORIA = {
  id: 1,
  uuid: uuid(1),
  name: 'Jedzenie',
  iconKey: 'restaurant-outline',
  isActive: true,
  sortOrder: 3,
  usedBy: [MainType.SUBSCRIPTION, MainType.PURCHASE],
};

const WYDATEK = {
  id: 10,
  uuid: uuid(10),
  mainType: MainType.PURCHASE,
  categoryId: 1,
  categoryUuid: uuid(1),
  billTemplateUuid: null,
  subscriptionUuid: null,
  title: 'Lidl',
  amountGrosze: 12550,
  effectiveDate: '2026-09-05',
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
  createdAt: CZAS,
  updatedAt: CZAS,
};

describe('tłumaczenie rekordów na wiersze serwera (Etap 14c)', () => {
  it('przepisuje kategorię na nazwy kolumn serwera', () => {
    const payload = buildSyncPayload(USER, changes({ categories: [KATEGORIA] }));

    expect(payload.categories).toEqual([
      {
        user_id: USER,
        uuid: uuid(1),
        name: 'Jedzenie',
        icon_key: 'restaurant-outline',
        is_active: true,
        sort_order: 3,
        used_by: ['SUBSCRIPTION', 'PURCHASE'],
      },
    ]);
  });

  it('wydatek wskazuje kategorię trwałym identyfikatorem, nie lokalnym numerem', () => {
    // Lokalne `categoryId` to numer kolejny JEDNEGO telefonu. Wysłane,
    // przypięłoby wydatek do przypadkowej kategorii na drugim urządzeniu.
    const payload = buildSyncPayload(USER, changes({ payments: [WYDATEK] }));
    const wiersz = payload.payments[0];

    expect(wiersz.category_uuid).toBe(uuid(1));
    expect(wiersz).not.toHaveProperty('categoryId');
    expect(wiersz).not.toHaveProperty('id');
  });

  it('ścieżka do zdjęcia paragonu NIE opuszcza telefonu', () => {
    // To ścieżka do pliku w pamięci jednego urządzenia. Na drugim nie
    // prowadzi donikąd, więc dałaby wydatek udający, że ma paragon,
    // i zawodzący przy próbie otwarcia.
    const payload = buildSyncPayload(USER, changes({ payments: [WYDATEK] }));

    expect(payload.payments[0]).not.toHaveProperty('receipt_image_path');
    expect(JSON.stringify(payload)).not.toContain('paragon-1.jpg');
  });

  it('stan rachunku NIE opuszcza telefonu', () => {
    // BR-11: aplikacja wylicza go przy każdym odczycie, żeby rachunek stawał
    // się „po terminie" sam. Wysłany byłby wartością, która o północy
    // przestaje być prawdziwa.
    const rachunek = {
      ...WYDATEK,
      mainType: MainType.BILL,
      status: BillStatus.OVERDUE,
      dueDate: '2026-09-10',
    };

    const payload = buildSyncPayload(USER, changes({ payments: [rachunek] }));

    expect(payload.payments[0]).not.toHaveProperty('status');
  });

  it('każdy wiersz jest podpisany kontem', () => {
    // Bez tego reguły RLS odrzucą zapis — i słusznie, bo serwer nie wiedziałby,
    // czyj jest wiersz.
    const payload = buildSyncPayload(
      USER,
      changes({
        categories: [KATEGORIA],
        payments: [WYDATEK],
        incomes: [
          {
            id: 3,
            uuid: uuid(3),
            personName: 'Ola',
            amountGrosze: 620000,
            month: '2026-09',
            createdAt: CZAS,
            updatedAt: CZAS,
          },
        ],
        deletedRecords: [{ entityType: 'PAYMENT', uuid: uuid(99), deletedAt: CZAS }],
      })
    );

    for (const tabela of UPLOAD_ORDER) {
      for (const wiersz of payload[tabela]) {
        expect(wiersz.user_id).toBe(USER);
      }
    }
  });

  it('kwoty jadą w groszach, jako liczby całkowite', () => {
    // BR-03. Gdyby gdzieś po drodze zamieniły się w złotówki, wydatek
    // wróciłby z serwera sto razy mniejszy.
    const payload = buildSyncPayload(USER, changes({ payments: [WYDATEK] }));

    expect(payload.payments[0].amount_grosze).toBe(12550);
    expect(Number.isInteger(payload.payments[0].amount_grosze)).toBe(true);
  });

  it('pusta kwota rachunku zostaje pusta', () => {
    // BR-04: rachunek czekający na wpisanie kwoty. Zamiana na zero
    // wpisałaby mu kwotę, której użytkownik nie podał, i weszłaby do sum.
    const rachunek = { ...WYDATEK, mainType: MainType.BILL, amountGrosze: null };

    const payload = buildSyncPayload(USER, changes({ payments: [rachunek] }));

    expect(payload.payments[0].amount_grosze).toBeNull();
  });

  it('szablon i subskrypcja niosą identyfikator swojej kategorii', () => {
    const payload = buildSyncPayload(
      USER,
      changes({
        billTemplates: [
          {
            id: 5,
            uuid: uuid(5),
            categoryUuid: uuid(1),
            name: 'Prąd',
            categoryId: 1,
            defaultDueDay: 10,
            isActive: true,
            useFixedAmount: false,
            fixedAmountGrosze: null,
            createdAt: CZAS,
            updatedAt: CZAS,
          },
        ],
        subscriptions: [
          {
            id: 7,
            uuid: uuid(7),
            categoryUuid: uuid(1),
            name: 'Netflix',
            amountGrosze: 4300,
            frequencyType: FrequencyType.MONTHLY,
            customIntervalMonths: null,
            startDate: '2026-01-05',
            nextPaymentDate: '2026-10-05',
            categoryId: 1,
            isActive: true,
            lastUsageConfirmationDate: null,
            confirmationIntervalMonths: 3,
            createdAt: CZAS,
            updatedAt: CZAS,
          },
        ],
      })
    );

    expect(payload.bill_templates[0].category_uuid).toBe(uuid(1));
    expect(payload.subscriptions[0].category_uuid).toBe(uuid(1));
  });

  it('kolejność wysyłki stawia kategorie przed tym, co na nie wskazuje', () => {
    // Serwer nie ma kluczy obcych, więc odwrotna kolejność też by przeszła —
    // ale zostawiłaby tam wydatki wskazujące na kategorie, których jeszcze
    // nie ma. Drugi telefon zobaczyłby wtedy wydatki bez kategorii.
    expect(UPLOAD_ORDER.indexOf('categories')).toBeLessThan(UPLOAD_ORDER.indexOf('payments'));
    expect(UPLOAD_ORDER.indexOf('categories')).toBeLessThan(UPLOAD_ORDER.indexOf('bill_templates'));
    expect(UPLOAD_ORDER.indexOf('bill_templates')).toBeLessThan(UPLOAD_ORDER.indexOf('payments'));
    expect(UPLOAD_ORDER.indexOf('subscriptions')).toBeLessThan(UPLOAD_ORDER.indexOf('payments'));

    // Kasowanie ma sens dopiero wtedy, gdy jest co kasować.
    expect(UPLOAD_ORDER.indexOf('deleted_records')).toBe(UPLOAD_ORDER.length - 1);
  });

  it('nic do wysłania to zero, nie pusty obiekt', () => {
    expect(countPayload(buildSyncPayload(USER, changes()))).toBe(0);
  });

  it('liczy wszystkie rodzaje rekordów razem', () => {
    const payload = buildSyncPayload(
      USER,
      changes({
        categories: [KATEGORIA],
        payments: [WYDATEK],
        deletedRecords: [{ entityType: 'INCOME', uuid: uuid(50), deletedAt: CZAS }],
      })
    );

    expect(countPayload(payload)).toBe(3);
  });
});
