/**
 * Plik kopii zapasowej — zapis migawki do tekstu i odczyt z powrotem.
 *
 * Ten plik nie dotyka ani bazy, ani systemu plików, ani ekranów. Zamienia
 * `BackupSnapshot` na tekst i tekst na `BackupSnapshot`. Dzięki temu cały
 * format da się przetestować w Node, bez telefonu — a to jedyna część
 * aplikacji, która przyjmuje dane z ZEWNĄTRZ.
 *
 * DLACZEGO WALIDACJA JEST TAK DROBIAZGOWA:
 * Wszystko inne w aplikacji pochodzi z własnej bazy i własnych formularzy,
 * które już sprawdziły poprawność. Tutaj użytkownik wskazuje dowolny plik
 * z telefonu. Może wskazać zdjęcie, obcięty plik z przerwanego pobierania
 * albo kopię z nowszej wersji aplikacji. Odtwarzanie KASUJE dotychczasowe
 * dane, więc wykrycie takiego pliku musi nastąpić PRZED skasowaniem
 * czegokolwiek — inaczej nieudany import zabrałby też to, co było.
 *
 * Dlatego `parseBackup` zwraca powód odmowy zamiast rzucać wyjątkiem:
 * ekran ma wytłumaczyć po polsku, co jest nie tak.
 */

import { BillStatus, FrequencyType, MainType, PaymentMethod, PaymentSource } from '@/domain/enums';
import type { BackupSnapshot, GeneratedRecord } from '@/domain/backup';
import type { BillTemplate, Category, Income, Payment, Subscription } from '@/domain/models';

/**
 * Wersja FORMATU pliku, nie wersja aplikacji ani schematu bazy.
 *
 * Podnosimy ją tylko wtedy, gdy zmiana układu pliku sprawia, że starsza
 * aplikacja nie zrozumiałaby nowej kopii.
 *
 * Wersja 1: bez dochodów domowników.
 * Wersja 2: z dochodami (Etap 11).
 *
 * Kopie w wersji 1 nadal się wczytują — brakująca lista dochodów znaczy
 * „nie było ich wtedy", czyli pusta. To jest właśnie powód, dla którego
 * plik nosi numer wersji: pozwala starym kopiom zachować ważność zamiast
 * unieważniać je przy każdej nowej funkcji.
 */
export const BACKUP_FORMAT_VERSION = 2;

/** Znacznik pozwalający odróżnić naszą kopię od dowolnego innego pliku JSON. */
export const BACKUP_APP_ID = 'domowe-wydatki';

export type BackupFile = {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  /** Kiedy kopia powstała — pokazujemy przy odtwarzaniu, żeby wiedzieć, co się wgrywa. */
  createdAt: string;
  snapshot: BackupSnapshot;
};

/** Powód, dla którego pliku nie da się użyć. Ekran tłumaczy go na polski. */
export type BackupParseError =
  /** To nie jest poprawny JSON — np. wskazano zdjęcie albo plik się uciął. */
  | 'NOT_JSON'
  /** Poprawny JSON, ale nie kopia tej aplikacji. */
  | 'NOT_BACKUP'
  /** Kopia z nowszej wersji aplikacji — ta wersja jej nie zrozumie. */
  | 'FUTURE_VERSION'
  /** Nasza kopia, ale zawartość jest uszkodzona. */
  | 'DAMAGED';

export type BackupParseResult =
  { ok: true; file: BackupFile } | { ok: false; reason: BackupParseError };

/**
 * Nazwa pliku z datą, żeby kolejne kopie nie nadpisywały się nawzajem
 * i żeby dało się je posortować na liście: `domowe-wydatki-2026-08-21.json`.
 */
export function backupFileName(createdAt: string): string {
  const dayPart = createdAt.slice(0, 10);
  return `${BACKUP_APP_ID}-${dayPart}.json`;
}

/**
 * Zapisuje migawkę do tekstu.
 *
 * Wcięcie dwoma spacjami rozdmuchuje plik o jakieś 30%, ale przy kilku
 * tysiącach wydatków to nadal ułamek megabajta, a plik daje się otworzyć
 * i przejrzeć w dowolnym edytorze. Przy danych, których jedyną kopią jest
 * ten plik, możliwość zajrzenia do środka jest warta więcej niż te bajty.
 */
export function serializeBackup(snapshot: BackupSnapshot, createdAt: string): string {
  const file: BackupFile = {
    app: BACKUP_APP_ID,
    formatVersion: BACKUP_FORMAT_VERSION,
    createdAt,
    snapshot,
  };

  return JSON.stringify(file, null, 2);
}

// --- Sprawdzanie pojedynczych wartości ---------------------------------

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * BR-03: kwoty i identyfikatory to liczby CAŁKOWITE. `Number.isSafeInteger`
 * odrzuca przy okazji NaN, nieskończoności i liczby zbyt duże, by dało się
 * je bezpiecznie porównywać.
 */
const isInt = (value: unknown): value is number => Number.isSafeInteger(value);

const isNullOr = <T>(value: unknown, check: (v: unknown) => v is T): value is T | null =>
  value === null || check(value);

/** Data w formacie ISO „RRRR-MM-DD" — taka, jaką trzyma baza (zasada 3). */
const isIsoDate = (value: unknown): value is string =>
  isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isOneOf = <T extends string>(value: unknown, allowed: Record<string, T>): value is T =>
  isString(value) && Object.prototype.hasOwnProperty.call(allowed, value);

// --- Sprawdzanie rekordów ----------------------------------------------

function readCategory(value: unknown): Category | null {
  if (!isObject(value)) return null;

  const { id, name, iconKey, isActive, sortOrder, usedBy } = value;

  if (!isInt(id) || !isString(name) || !isString(iconKey)) return null;
  if (typeof isActive !== 'boolean' || !isInt(sortOrder)) return null;
  if (!Array.isArray(usedBy) || !usedBy.every((entry) => isOneOf(entry, MainType))) return null;

  return {
    id,
    name,
    iconKey,
    isActive,
    sortOrder,
    usedBy: usedBy as MainType[],
  };
}

function readPayment(value: unknown): Payment | null {
  if (!isObject(value)) return null;

  const v = value;

  if (!isInt(v.id) || !isOneOf(v.mainType, MainType) || !isInt(v.categoryId)) return null;
  if (!isString(v.title)) return null;
  // BR-04: kwota bywa pusta wyłącznie dla rachunku oczekującego na kwotę.
  if (!isNullOr(v.amountGrosze, isInt)) return null;
  if (!isIsoDate(v.effectiveDate)) return null;
  if (!isNullOr(v.dueDate, isIsoDate) || !isNullOr(v.paidDate, isIsoDate)) return null;
  if (v.status !== null && !isOneOf(v.status, BillStatus)) return null;
  if (!isOneOf(v.source, PaymentSource)) return null;
  if (!isNullOr(v.merchant, isString) || !isNullOr(v.description, isString)) return null;
  if (v.paymentMethod !== null && !isOneOf(v.paymentMethod, PaymentMethod)) return null;
  if (!isNullOr(v.billTemplateId, isInt) || !isNullOr(v.subscriptionId, isInt)) return null;
  if (!isNullOr(v.receiptImagePath, isString)) return null;
  if (!isString(v.createdAt) || !isString(v.updatedAt)) return null;

  return {
    id: v.id,
    mainType: v.mainType,
    categoryId: v.categoryId,
    title: v.title,
    amountGrosze: v.amountGrosze,
    effectiveDate: v.effectiveDate,
    dueDate: v.dueDate,
    paidDate: v.paidDate,
    status: v.status as Payment['status'],
    source: v.source,
    merchant: v.merchant,
    description: v.description,
    paymentMethod: v.paymentMethod as Payment['paymentMethod'],
    billTemplateId: v.billTemplateId,
    subscriptionId: v.subscriptionId,
    receiptImagePath: v.receiptImagePath,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function readBillTemplate(value: unknown): BillTemplate | null {
  if (!isObject(value)) return null;

  const v = value;

  if (!isInt(v.id) || !isString(v.name) || !isInt(v.categoryId)) return null;
  if (!isInt(v.defaultDueDay) || v.defaultDueDay < 1 || v.defaultDueDay > 31) return null;
  if (typeof v.isActive !== 'boolean' || typeof v.useFixedAmount !== 'boolean') return null;
  if (!isNullOr(v.fixedAmountGrosze, isInt)) return null;
  if (!isString(v.createdAt) || !isString(v.updatedAt)) return null;

  return {
    id: v.id,
    name: v.name,
    categoryId: v.categoryId,
    defaultDueDay: v.defaultDueDay,
    isActive: v.isActive,
    useFixedAmount: v.useFixedAmount,
    fixedAmountGrosze: v.fixedAmountGrosze,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function readSubscription(value: unknown): Subscription | null {
  if (!isObject(value)) return null;

  const v = value;

  if (!isInt(v.id) || !isString(v.name) || !isInt(v.amountGrosze)) return null;
  if (!isOneOf(v.frequencyType, FrequencyType)) return null;
  if (!isNullOr(v.customIntervalMonths, isInt)) return null;
  if (!isIsoDate(v.startDate) || !isIsoDate(v.nextPaymentDate)) return null;
  if (!isInt(v.categoryId) || typeof v.isActive !== 'boolean') return null;
  if (!isNullOr(v.lastUsageConfirmationDate, isIsoDate)) return null;
  if (!isInt(v.confirmationIntervalMonths)) return null;
  if (!isString(v.createdAt) || !isString(v.updatedAt)) return null;

  return {
    id: v.id,
    name: v.name,
    amountGrosze: v.amountGrosze,
    frequencyType: v.frequencyType,
    customIntervalMonths: v.customIntervalMonths,
    startDate: v.startDate,
    nextPaymentDate: v.nextPaymentDate,
    categoryId: v.categoryId,
    isActive: v.isActive,
    lastUsageConfirmationDate: v.lastUsageConfirmationDate,
    confirmationIntervalMonths: v.confirmationIntervalMonths,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/** Miesiąc dochodu — tekst „RRRR-MM" (Etap 11). */
const isYearMonth = (value: unknown): value is string =>
  isString(value) && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

function readIncome(value: unknown): Income | null {
  if (!isObject(value)) return null;

  const v = value;

  if (!isInt(v.id) || !isString(v.personName)) return null;
  // Dochód ujemny nie ma sensu i zepsułby wyliczenie budżetu.
  if (!isInt(v.amountGrosze) || v.amountGrosze < 0) return null;
  if (!isYearMonth(v.month)) return null;
  if (!isString(v.createdAt) || !isString(v.updatedAt)) return null;

  return {
    id: v.id,
    personName: v.personName,
    amountGrosze: v.amountGrosze,
    month: v.month,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

function readGeneratedRecord(value: unknown): GeneratedRecord | null {
  if (!isObject(value)) return null;

  const { sourceType, sourceId, year, month } = value;

  if (sourceType !== 'BILL' && sourceType !== 'SUBSCRIPTION') return null;
  if (!isInt(sourceId) || !isInt(year)) return null;
  if (!isInt(month) || month < 1 || month > 12) return null;

  return { sourceType, sourceId, year, month };
}

/** Sprawdza całą tablicę; jeden zły rekord unieważnia plik. */
function readAll<T>(value: unknown, read: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;

  const result: T[] = [];
  for (const entry of value) {
    const parsed = read(entry);
    if (parsed === null) return null;
    result.push(parsed);
  }
  return result;
}

// --- Odczyt całego pliku -----------------------------------------------

/**
 * Czyta tekst pliku i zwraca migawkę albo powód odmowy.
 *
 * Nic tu nie jest „naprawiane po cichu". Plik jest albo w całości dobry,
 * albo odrzucony — częściowo odtworzona kopia byłaby gorsza niż brak kopii,
 * bo użytkownik uznałby, że ma komplet danych.
 */
export function parseBackup(text: string): BackupParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'NOT_JSON' };
  }

  if (!isObject(raw) || raw.app !== BACKUP_APP_ID) {
    return { ok: false, reason: 'NOT_BACKUP' };
  }

  if (!isInt(raw.formatVersion)) {
    return { ok: false, reason: 'DAMAGED' };
  }

  // Nowsza wersja formatu może zawierać pola, o których ta aplikacja nie wie.
  // Wczytanie jej po cichu zgubiłoby te dane przy następnym eksporcie.
  if (raw.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: 'FUTURE_VERSION' };
  }

  if (!isString(raw.createdAt) || !isObject(raw.snapshot)) {
    return { ok: false, reason: 'DAMAGED' };
  }

  const s = raw.snapshot;

  const categories = readAll(s.categories, readCategory);
  const payments = readAll(s.payments, readPayment);
  const billTemplates = readAll(s.billTemplates, readBillTemplate);
  const subscriptions = readAll(s.subscriptions, readSubscription);
  const generatedRecords = readAll(s.generatedRecords, readGeneratedRecord);

  // Kopie w wersji 1 powstały, zanim istniały dochody. Brak listy znaczy
  // „nie było żadnych", a nie „plik uszkodzony" — inaczej wydanie Etapu 11
  // unieważniłoby wszystkie wcześniejsze kopie użytkownika.
  const incomes = s.incomes === undefined ? [] : readAll(s.incomes, readIncome);

  if (
    categories === null ||
    payments === null ||
    billTemplates === null ||
    subscriptions === null ||
    generatedRecords === null ||
    incomes === null
  ) {
    return { ok: false, reason: 'DAMAGED' };
  }

  return {
    ok: true,
    file: {
      app: BACKUP_APP_ID,
      formatVersion: raw.formatVersion,
      createdAt: raw.createdAt,
      snapshot: { categories, payments, billTemplates, subscriptions, generatedRecords, incomes },
    },
  };
}
