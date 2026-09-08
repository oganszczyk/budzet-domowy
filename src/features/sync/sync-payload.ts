/**
 * Etap 14c: TŁUMACZENIE REKORDU Z TELEFONU NA WIERSZ SERWERA.
 *
 * Ten plik nie dotyka ani sieci, ani bazy. Zamienia obiekty na obiekty,
 * dzięki czemu całe tłumaczenie da się sprawdzić w Node — a jest to jedyne
 * miejsce w synchronizacji, w którym łatwo o cichą pomyłkę. Pomylona nazwa
 * kolumny nie wywala aplikacji: wysyła wydatek z pustym polem i wychodzi
 * na jaw dopiero na drugim telefonie, tygodnie później.
 *
 * TRZY RZECZY, KTÓRE SIĘ TU DZIEJĄ
 *
 * 1. `categoryId` → `category_uuid`. Lokalny numer nic nie znaczy poza tym
 *    jednym telefonem (patrz `src/lib/uuid.ts`). Repozytorium dokłada trwały
 *    identyfikator złączeniem przy odczycie — tutaj tylko go przepisujemy.
 *
 * 2. `nazwyWielbladzie` → `nazwy_z_podkreslnikiem`. Postgres sam sprowadza
 *    nazwy do małych liter, więc `categoryId` stałoby się tam `categoryid`.
 *    Zapis z podkreślnikami jest w tej bazie zwyczajem i trzymamy się go.
 *
 * 3. Odsiew pól, które nie mają prawa opuścić telefonu — patrz niżej.
 */

import type {
  PendingBillTemplate,
  PendingChanges,
  PendingPayment,
  PendingSubscription,
} from '@/data/repository';
import type { DeletedRecord } from '@/domain/backup';
import type { Category, Income } from '@/domain/models';

/**
 * Wiersz gotowy do wysłania. Klucze to nazwy kolumn z pliku
 * `docs/supabase/01-schemat-i-reguly.sql`.
 */
export type ServerRow = Record<string, string | number | boolean | string[] | null>;

/** Komplet wierszy do wysłania, w kolejności, w jakiej mają iść. */
export type SyncPayload = {
  categories: ServerRow[];
  bill_templates: ServerRow[];
  subscriptions: ServerRow[];
  payments: ServerRow[];
  incomes: ServerRow[];
  deleted_records: ServerRow[];
};

/**
 * Kolejność wysyłki: najpierw to, na co wskazują inne rekordy.
 *
 * Serwer nie ma kluczy obcych (uzasadnienie w pliku SQL), więc odwrotna
 * kolejność też by przeszła — ale zostawiłaby na serwerze wydatki
 * wskazujące na kategorie, których jeszcze tam nie ma. Gdyby w tym momencie
 * odezwał się drugi telefon, zobaczyłby wydatki bez kategorii.
 *
 * Skasowane idą na końcu, bo kasowanie ma sens dopiero wtedy, gdy jest
 * co kasować.
 */
export const UPLOAD_ORDER = [
  'categories',
  'bill_templates',
  'subscriptions',
  'payments',
  'incomes',
  'deleted_records',
] as const satisfies readonly (keyof SyncPayload)[];

export type UploadTable = (typeof UPLOAD_ORDER)[number];

function categoryRow(userId: string, category: Category): ServerRow {
  return {
    user_id: userId,
    uuid: category.uuid,
    name: category.name,
    icon_key: category.iconKey,
    is_active: category.isActive,
    sort_order: category.sortOrder,
    used_by: [...category.usedBy],
  };
}

function billTemplateRow(userId: string, template: PendingBillTemplate): ServerRow {
  return {
    user_id: userId,
    uuid: template.uuid,
    name: template.name,
    category_uuid: template.categoryUuid,
    default_due_day: template.defaultDueDay,
    is_active: template.isActive,
    use_fixed_amount: template.useFixedAmount,
    fixed_amount_grosze: template.fixedAmountGrosze,
    created_at: template.createdAt,
    updated_at: template.updatedAt,
  };
}

function subscriptionRow(userId: string, subscription: PendingSubscription): ServerRow {
  return {
    user_id: userId,
    uuid: subscription.uuid,
    name: subscription.name,
    amount_grosze: subscription.amountGrosze,
    frequency_type: subscription.frequencyType,
    custom_interval_months: subscription.customIntervalMonths,
    start_date: subscription.startDate,
    next_payment_date: subscription.nextPaymentDate,
    category_uuid: subscription.categoryUuid,
    is_active: subscription.isActive,
    last_usage_confirmation_date: subscription.lastUsageConfirmationDate,
    confirmation_interval_months: subscription.confirmationIntervalMonths,
    created_at: subscription.createdAt,
    updated_at: subscription.updatedAt,
  };
}

/**
 * DWÓCH PÓL PŁATNOŚCI CELOWO TU NIE MA.
 *
 * `receiptImagePath` to ścieżka do pliku w pamięci JEDNEGO telefonu.
 * Na drugim nie prowadzi donikąd, więc wysłana dałaby wydatek, który udaje,
 * że ma paragon, i zawodzi przy próbie otwarcia. Zdjęcie zostaje tam, gdzie
 * leży; jego przenoszenie to osobna decyzja, nie ten etap.
 *
 * `status` aplikacja wylicza przy każdym odczycie z terminu i daty opłacenia
 * (BR-11) — właśnie po to, żeby rachunek stawał się „po terminie" sam,
 * bez zapisu do bazy. Wysłany byłby wartością, która o północy przestaje
 * być prawdziwa.
 */
function paymentRow(userId: string, payment: PendingPayment): ServerRow {
  return {
    user_id: userId,
    uuid: payment.uuid,
    main_type: payment.mainType,
    category_uuid: payment.categoryUuid,
    title: payment.title,
    amount_grosze: payment.amountGrosze,
    effective_date: payment.effectiveDate,
    due_date: payment.dueDate,
    paid_date: payment.paidDate,
    source: payment.source,
    merchant: payment.merchant,
    description: payment.description,
    payment_method: payment.paymentMethod,
    bill_template_uuid: payment.billTemplateUuid,
    subscription_uuid: payment.subscriptionUuid,
    created_at: payment.createdAt,
    updated_at: payment.updatedAt,
  };
}

function incomeRow(userId: string, income: Income): ServerRow {
  return {
    user_id: userId,
    uuid: income.uuid,
    person_name: income.personName,
    amount_grosze: income.amountGrosze,
    month: income.month,
    created_at: income.createdAt,
    updated_at: income.updatedAt,
  };
}

function deletedRow(userId: string, record: DeletedRecord): ServerRow {
  return {
    user_id: userId,
    entity_type: record.entityType,
    uuid: record.uuid,
    deleted_at: record.deletedAt,
  };
}

/**
 * Buduje komplet wierszy do wysłania.
 *
 * `userId` doklejamy do KAŻDEGO wiersza, bo reguły RLS odrzucą wiersz
 * podpisany cudzym kontem — i słusznie. Serwer i tak sprawdza to sam;
 * my podajemy tę wartość, bo bez niej nie wiedziałby, czyj jest wiersz.
 */
export function buildSyncPayload(userId: string, changes: PendingChanges): SyncPayload {
  return {
    categories: changes.categories.map((category) => categoryRow(userId, category)),
    bill_templates: changes.billTemplates.map((template) => billTemplateRow(userId, template)),
    subscriptions: changes.subscriptions.map((subscription) =>
      subscriptionRow(userId, subscription)
    ),
    payments: changes.payments.map((payment) => paymentRow(userId, payment)),
    incomes: changes.incomes.map((income) => incomeRow(userId, income)),
    deleted_records: changes.deletedRecords.map((record) => deletedRow(userId, record)),
  };
}

/** Ile rekordów w ogóle czeka na wysłanie — do pokazania użytkownikowi. */
export function countPayload(payload: SyncPayload): number {
  return UPLOAD_ORDER.reduce((total, table) => total + payload[table].length, 0);
}
