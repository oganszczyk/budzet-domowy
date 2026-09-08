/**
 * Etap 14d: TŁUMACZENIE WIERSZA SERWERA NA REKORD APLIKACJI.
 *
 * Odwrotność `sync-payload.ts`. Znowu czyste funkcje, znowu bez sieci —
 * i znowu z tego samego powodu: pomylona nazwa kolumny nie wywala niczego,
 * tylko wpisuje pustkę w wydatek, a widać to dopiero tygodnie później.
 *
 * DLACZEGO ZŁY WIERSZ JEST POMIJANY, A NIE RZUCA WYJĄTKIEM
 *
 * Te dane przychodzą z DRUGIEGO URZĄDZENIA — być może z nowszej wersji
 * aplikacji, która zapisuje coś, czego ta wersja nie rozumie. Wyjątek
 * przerwałby całe pobieranie i użytkownik nie dostałby ŻADNEGO wydatku
 * przez jeden nieznany wiersz. Pomijamy go i liczymy, żeby ekran mógł
 * powiedzieć, że czegoś nie wzięliśmy.
 */

import type {
  RemoteBillTemplate,
  RemoteCategory,
  RemoteDeletion,
  RemoteIncome,
  RemotePayment,
  RemoteSubscription,
} from '@/data/repository';
import type { DeletedRecord } from '@/domain/backup';
import type { MainType } from '@/domain/enums';
import type { Payment, Subscription } from '@/domain/models';

/** Wiersz tak, jak przychodzi z biblioteki Supabase. */
export type IncomingRow = Record<string, unknown>;

/**
 * Nazwy tabel w kolejności POBIERANIA.
 *
 * Ta sama zasada, co przy wysyłce, i ten sam powód: kategoria musi być
 * na miejscu, zanim pojawi się wydatek, który na nią wskazuje. Inaczej
 * repozytorium nie ma czego wpisać w wymaganą kolumnę i musi taki wydatek
 * pominąć — a pominięty wydatek to pieniądze, których nie widać w sumie.
 *
 * Skasowane idą NA KOŃCU. Gdyby szły pierwsze, wydatek skasowany na drugim
 * telefonie zostałby najpierw usunięty, a zaraz potem wpisany z powrotem
 * przez własny wiersz z tabeli płatności — wysyłka nie kasuje wierszy
 * z serwera, tylko dokłada nagrobek.
 */
export const PULL_ORDER = [
  'categories',
  'bill_templates',
  'subscriptions',
  'payments',
  'incomes',
  'deleted_records',
] as const;

export type PullTable = (typeof PULL_ORDER)[number];

/** Klucz znacznika „dokąd doszliśmy" dla jednej tabeli. */
export const markerKey = (table: PullTable): string => `pull:${table}`;

// --- Odczyt pojedynczych wartości ---------------------------------------

const isString = (value: unknown): value is string => typeof value === 'string';

const isInt = (value: unknown): value is number => Number.isSafeInteger(value);

const nullOr = <T>(value: unknown, check: (v: unknown) => v is T): T | null =>
  value === null || value === undefined ? null : check(value) ? value : null;

/**
 * Postgres oddaje `timestamptz` w swoim zapisie, a my porównujemy te wartości
 * jako TEKST (patrz `applyRemoteChanges`). Sprowadzamy więc znacznik serwera
 * do jednego kształtu — ISO w strefie UTC — żeby porównanie „nowszy niż"
 * nie zależało od tego, jak akurat sformatował go serwer.
 */
function toIsoUtc(value: unknown): string | null {
  if (!isString(value)) return null;
  const czas = new Date(value);
  return Number.isNaN(czas.getTime()) ? null : czas.toISOString();
}

/** Lista kategorii głównych; Postgres oddaje ją jako tablicę tekstów. */
function readUsedBy(value: unknown): MainType[] {
  if (Array.isArray(value)) return value.filter(isString) as MainType[];
  // Zapas na wypadek, gdyby przyszła w zapisie z przecinkami.
  if (isString(value)) return value.split(',').filter(Boolean) as MainType[];
  return [];
}

// --- Odczyt rekordów -----------------------------------------------------

export function readCategory(row: IncomingRow): RemoteCategory | null {
  const syncedAt = toIsoUtc(row.synced_at);
  if (!isString(row.uuid) || !isString(row.name) || syncedAt === null) return null;

  return {
    uuid: row.uuid,
    name: row.name,
    iconKey: isString(row.icon_key) ? row.icon_key : 'pricetag-outline',
    isActive: row.is_active !== false,
    sortOrder: isInt(row.sort_order) ? row.sort_order : 0,
    usedBy: readUsedBy(row.used_by),
    syncedAt,
  };
}

export function readBillTemplate(row: IncomingRow): RemoteBillTemplate | null {
  const syncedAt = toIsoUtc(row.synced_at);
  if (!isString(row.uuid) || !isString(row.name) || syncedAt === null) return null;
  if (!isString(row.created_at) || !isString(row.updated_at)) return null;
  if (!isInt(row.default_due_day)) return null;

  return {
    uuid: row.uuid,
    name: row.name,
    categoryUuid: nullOr(row.category_uuid, isString),
    defaultDueDay: row.default_due_day,
    isActive: row.is_active !== false,
    useFixedAmount: row.use_fixed_amount === true,
    fixedAmountGrosze: nullOr(row.fixed_amount_grosze, isInt),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt,
  };
}

export function readSubscription(row: IncomingRow): RemoteSubscription | null {
  const syncedAt = toIsoUtc(row.synced_at);
  if (!isString(row.uuid) || !isString(row.name) || syncedAt === null) return null;
  if (!isString(row.created_at) || !isString(row.updated_at)) return null;
  if (!isInt(row.amount_grosze) || !isString(row.frequency_type)) return null;
  if (!isString(row.start_date) || !isString(row.next_payment_date)) return null;

  return {
    uuid: row.uuid,
    name: row.name,
    amountGrosze: row.amount_grosze,
    frequencyType: row.frequency_type as Subscription['frequencyType'],
    customIntervalMonths: nullOr(row.custom_interval_months, isInt),
    startDate: row.start_date,
    nextPaymentDate: row.next_payment_date,
    categoryUuid: nullOr(row.category_uuid, isString),
    isActive: row.is_active !== false,
    lastUsageConfirmationDate: nullOr(row.last_usage_confirmation_date, isString),
    confirmationIntervalMonths: isInt(row.confirmation_interval_months)
      ? row.confirmation_interval_months
      : 3,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt,
  };
}

export function readPayment(row: IncomingRow): RemotePayment | null {
  const syncedAt = toIsoUtc(row.synced_at);
  if (!isString(row.uuid) || !isString(row.title) || syncedAt === null) return null;
  if (!isString(row.created_at) || !isString(row.updated_at)) return null;
  if (!isString(row.main_type) || !isString(row.source)) return null;
  if (!isString(row.effective_date)) return null;

  return {
    uuid: row.uuid,
    mainType: row.main_type as Payment['mainType'],
    categoryUuid: nullOr(row.category_uuid, isString),
    title: row.title,
    // BR-04: pusta kwota jest poprawna dla rachunku czekającego na kwotę.
    amountGrosze: nullOr(row.amount_grosze, isInt),
    effectiveDate: row.effective_date,
    dueDate: nullOr(row.due_date, isString),
    paidDate: nullOr(row.paid_date, isString),
    // BR-11: status wyliczamy przy odczycie, więc nie przychodzi z serwera.
    status: null,
    source: row.source as Payment['source'],
    merchant: nullOr(row.merchant, isString),
    description: nullOr(row.description, isString),
    paymentMethod: nullOr(row.payment_method, isString) as Payment['paymentMethod'],
    billTemplateUuid: nullOr(row.bill_template_uuid, isString),
    subscriptionUuid: nullOr(row.subscription_uuid, isString),
    // Ścieżka do zdjęcia dotyczy pamięci TAMTEGO telefonu i nie jest wysyłana.
    receiptImagePath: null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt,
  };
}

export function readIncome(row: IncomingRow): RemoteIncome | null {
  const syncedAt = toIsoUtc(row.synced_at);
  if (!isString(row.uuid) || !isString(row.person_name) || syncedAt === null) return null;
  if (!isString(row.created_at) || !isString(row.updated_at)) return null;
  if (!isInt(row.amount_grosze) || !isString(row.month)) return null;

  return {
    uuid: row.uuid,
    personName: row.person_name,
    amountGrosze: row.amount_grosze,
    month: row.month,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt,
  };
}

const RODZAJE_ENCJI: Record<string, DeletedRecord['entityType']> = {
  PAYMENT: 'PAYMENT',
  CATEGORY: 'CATEGORY',
  BILL_TEMPLATE: 'BILL_TEMPLATE',
  SUBSCRIPTION: 'SUBSCRIPTION',
  INCOME: 'INCOME',
};

export function readDeletion(row: IncomingRow): RemoteDeletion | null {
  const syncedAt = toIsoUtc(row.synced_at);
  if (!isString(row.uuid) || !isString(row.entity_type) || syncedAt === null) return null;
  if (!isString(row.deleted_at)) return null;

  const entityType = RODZAJE_ENCJI[row.entity_type];
  if (!entityType) return null;

  return { entityType, uuid: row.uuid, deletedAt: row.deleted_at, syncedAt };
}

/** Czytnik przypisany do tabeli — używa go pętla pobierania. */
export const READERS = {
  categories: readCategory,
  bill_templates: readBillTemplate,
  subscriptions: readSubscription,
  payments: readPayment,
  incomes: readIncome,
  deleted_records: readDeletion,
} as const satisfies Record<PullTable, (row: IncomingRow) => unknown>;

/** Pole `RemoteChanges`, do którego trafiają rekordy z danej tabeli. */
export const CHANGE_FIELD = {
  categories: 'categories',
  bill_templates: 'billTemplates',
  subscriptions: 'subscriptions',
  payments: 'payments',
  incomes: 'incomes',
  deleted_records: 'deletedRecords',
} as const satisfies Record<PullTable, string>;
