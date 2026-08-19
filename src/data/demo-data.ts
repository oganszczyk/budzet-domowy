/**
 * Dane demonstracyjne.
 *
 * 3.1: „Lokalna baza danych i dane testowe dla pierwszego uruchomienia."
 * Etap 9: przed wydaniem dane demonstracyjne należy usunąć lub oznaczyć
 * jako opcjonalne — dlatego siedzą w osobnym pliku.
 *
 * Dane budujemy względem BIEŻĄCEGO miesiąca urządzenia, żeby aplikacja
 * wyglądała sensownie niezależnie od tego, kiedy ją uruchomisz.
 * Poprzedni miesiąc ma inne kwoty — dzięki temu widać, że przełączanie
 * miesiąca naprawdę zmienia sumy (BR-09, AC 5.1).
 */

import { FrequencyType, MainType, PaymentMethod, PaymentSource } from '@/domain/enums';
import type { BillTemplate, Category, Payment, Subscription } from '@/domain/models';
import { addMonths, currentYearMonth, dueDateFor, type YearMonth } from '@/lib/date';

/** 5.2: domyślne podkategorie rachunków. */
const BILL_CATEGORIES = [
  'Czynsz za mieszkanie',
  'Prąd',
  'Woda',
  'Gaz',
  'Internet',
  'Telefon',
  'Ubezpieczenie',
  'Inne rachunki',
];

/** 5.3: kategorie pomocnicze subskrypcji. */
const SUBSCRIPTION_CATEGORIES = ['Rozrywka', 'Sport', 'AI', 'Chmura', 'Inne'];

/** 5.4: domyślne podkategorie zakupów. */
const PURCHASE_CATEGORIES = [
  'Jedzenie',
  'Kosmetyki i higiena',
  'Sprzątanie',
  'Ubrania',
  'Mieszkanie',
  'Rozrywka',
  'Inne',
];

const ICONS: Record<string, string> = {
  'Czynsz za mieszkanie': 'home-outline',
  Prąd: 'flash-outline',
  Woda: 'water-outline',
  Gaz: 'flame-outline',
  Internet: 'wifi-outline',
  Telefon: 'call-outline',
  Ubezpieczenie: 'shield-checkmark-outline',
  'Inne rachunki': 'document-text-outline',
  Rozrywka: 'film-outline',
  Sport: 'barbell-outline',
  AI: 'sparkles-outline',
  Chmura: 'cloud-outline',
  Jedzenie: 'restaurant-outline',
  'Kosmetyki i higiena': 'flower-outline',
  Sprzątanie: 'sparkles-outline',
  Ubrania: 'shirt-outline',
  Mieszkanie: 'bed-outline',
  Inne: 'ellipsis-horizontal-outline',
};

/** 7.1: buduje pełną listę kategorii z kolejnymi identyfikatorami. */
export function buildDemoCategories(): Category[] {
  const categories: Category[] = [];
  let id = 1;

  const add = (mainType: MainType, names: string[]) => {
    names.forEach((name, index) => {
      categories.push({
        id: id++,
        mainType,
        name,
        iconKey: ICONS[name] ?? 'pricetag-outline',
        isActive: true,
        sortOrder: index,
      });
    });
  };

  add(MainType.BILL, BILL_CATEGORIES);
  add(MainType.SUBSCRIPTION, SUBSCRIPTION_CATEGORIES);
  add(MainType.PURCHASE, PURCHASE_CATEGORIES);

  return categories;
}

/** Znajduje identyfikator kategorii po nazwie i typie. */
function categoryId(categories: Category[], mainType: MainType, name: string): number {
  const found = categories.find((c) => c.mainType === mainType && c.name === name);
  if (!found) throw new Error(`Brak kategorii demonstracyjnej: ${mainType} / ${name}`);
  return found.id;
}

/** Data w wybranym miesiącu, dla podanego dnia. */
function dayIn(month: YearMonth, day: number): string {
  return dueDateFor(month, day);
}

const NOW = new Date().toISOString();

/**
 * Szablony w danych demonstracyjnych udają, że istnieją od roku.
 * Automatyczne tworzenie rachunków (5.2) nie cofa się przed datę powstania
 * szablonu, więc bez tego przeglądanie wcześniejszych miesięcy nie miałoby
 * czego pokazać.
 */
const TEMPLATE_CREATED_AT = (() => {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString();
})();

/** Płatność demonstracyjna bez pól nadawanych przez repozytorium. */
export type PaymentSeed = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Buduje płatności demonstracyjne dla bieżącego i poprzedniego miesiąca.
 * Kwoty podane w groszach (BR-03).
 */
function buildDemoPaymentSeeds(categories: Category[]): PaymentSeed[] {
  const thisMonth = currentYearMonth();
  const lastMonth = addMonths(thisMonth, -1);

  const billCat = (name: string) => categoryId(categories, MainType.BILL, name);
  const subCat = (name: string) => categoryId(categories, MainType.SUBSCRIPTION, name);
  const buyCat = (name: string) => categoryId(categories, MainType.PURCHASE, name);

  const makeBill = (
    month: YearMonth,
    name: string,
    amountGrosze: number | null,
    dueDay: number,
    paidDay: number | null,
    templateId: number
  ): PaymentSeed => ({
    mainType: MainType.BILL,
    categoryId: billCat(name),
    title: name,
    amountGrosze,
    effectiveDate: dayIn(month, 1),
    dueDate: dayIn(month, dueDay),
    paidDate: paidDay === null ? null : dayIn(month, paidDay),
    // Status wyliczamy przy odczycie (BR-11), więc tutaj zostaje pusty.
    status: null,
    source: PaymentSource.AUTO_BILL,
    merchant: null,
    description: null,
    paymentMethod: null,
    billTemplateId: templateId,
    subscriptionId: null,
    receiptImagePath: null,
  });

  const makeSubscription = (
    month: YearMonth,
    name: string,
    category: string,
    amountGrosze: number,
    day: number,
    subscriptionId: number
  ): PaymentSeed => ({
    mainType: MainType.SUBSCRIPTION,
    categoryId: subCat(category),
    title: name,
    amountGrosze,
    effectiveDate: dayIn(month, day),
    dueDate: null,
    paidDate: null,
    status: null,
    source: PaymentSource.AUTO_SUBSCRIPTION,
    merchant: name,
    description: null,
    paymentMethod: PaymentMethod.CARD,
    billTemplateId: null,
    subscriptionId,
    receiptImagePath: null,
  });

  const makePurchase = (
    month: YearMonth,
    merchant: string,
    category: string,
    amountGrosze: number,
    day: number,
    method: Payment['paymentMethod'],
    source: Payment['source'] = PaymentSource.MANUAL
  ): PaymentSeed => ({
    mainType: MainType.PURCHASE,
    categoryId: buyCat(category),
    title: merchant,
    amountGrosze,
    effectiveDate: dayIn(month, day),
    dueDate: null,
    paidDate: null,
    status: null,
    source,
    merchant,
    description: null,
    paymentMethod: method,
    billTemplateId: null,
    subscriptionId: null,
    receiptImagePath: null,
  });

  return [
    // ----- BIEŻĄCY MIESIĄC -----
    // Rachunki dobrane tak, aby wszystkie cztery statusy z 5.2
    // były widoczne od razu po uruchomieniu.
    makeBill(thisMonth, 'Czynsz za mieszkanie', 250000, 10, 5, 1),
    makeBill(thisMonth, 'Prąd', 18040, 15, null, 2),
    makeBill(thisMonth, 'Woda', null, 20, null, 3),
    makeBill(thisMonth, 'Internet', 7999, 12, 12, 4),
    makeBill(thisMonth, 'Gaz', 9520, 28, null, 5),

    makeSubscription(thisMonth, 'Netflix', 'Rozrywka', 4300, 8, 1),
    makeSubscription(thisMonth, 'Siłownia', 'Sport', 12900, 1, 2),
    makeSubscription(thisMonth, 'Narzędzie AI', 'AI', 8000, 15, 3),

    makePurchase(thisMonth, 'Lidl', 'Jedzenie', 12550, 3, PaymentMethod.CARD),
    makePurchase(thisMonth, 'Biedronka', 'Jedzenie', 8730, 9, PaymentMethod.CARD),
    makePurchase(thisMonth, 'Rossmann', 'Kosmetyki i higiena', 4520, 11, PaymentMethod.CASH),
    makePurchase(
      thisMonth,
      'Media Expert',
      'Mieszkanie',
      24999,
      14,
      PaymentMethod.TRANSFER,
      PaymentSource.RECEIPT_SCAN
    ),
    makePurchase(thisMonth, 'Kino Helios', 'Rozrywka', 6200, 16, PaymentMethod.CARD),

    // ----- POPRZEDNI MIESIĄC (inne kwoty, żeby było widać różnicę) -----
    makeBill(lastMonth, 'Czynsz za mieszkanie', 250000, 10, 8, 1),
    makeBill(lastMonth, 'Prąd', 16580, 15, 14, 2),
    makeBill(lastMonth, 'Woda', 4210, 20, 19, 3),
    makeBill(lastMonth, 'Internet', 7999, 12, 12, 4),

    makeSubscription(lastMonth, 'Netflix', 'Rozrywka', 4300, 8, 1),
    makeSubscription(lastMonth, 'Siłownia', 'Sport', 12900, 1, 2),

    makePurchase(lastMonth, 'Lidl', 'Jedzenie', 9840, 6, PaymentMethod.CARD),
    makePurchase(lastMonth, 'Zara', 'Ubrania', 19900, 21, PaymentMethod.CARD),
  ];
}

/** 7.3: szablony rachunków cyklicznych. */
function buildDemoBillTemplates(categories: Category[]): Omit<BillTemplate, 'id'>[] {
  const billCat = (name: string) => categoryId(categories, MainType.BILL, name);

  const template = (
    name: string,
    defaultDueDay: number,
    useFixedAmount = false,
    fixedAmountGrosze: number | null = null
  ) => ({
    name,
    categoryId: billCat(name),
    defaultDueDay,
    isActive: true,
    useFixedAmount,
    fixedAmountGrosze,
    createdAt: TEMPLATE_CREATED_AT,
    updatedAt: TEMPLATE_CREATED_AT,
  });

  return [
    // Czynsz i internet mają stałą kwotę — kopiuje się na kolejne miesiące (5.2).
    template('Czynsz za mieszkanie', 10, true, 250000),
    template('Prąd', 15),
    template('Woda', 20),
    template('Internet', 12, true, 7999),
    template('Gaz', 28),
  ];
}

/** 7.4: subskrypcje. */
function buildDemoSubscriptions(categories: Category[]): Omit<Subscription, 'id'>[] {
  const thisMonth = currentYearMonth();
  const nextMonth = addMonths(thisMonth, 1);
  const subCat = (name: string) => categoryId(categories, MainType.SUBSCRIPTION, name);

  const subscription = (
    name: string,
    category: string,
    amountGrosze: number,
    day: number,
    startedMonthsAgo: number
  ): Omit<Subscription, 'id'> => ({
    name,
    amountGrosze,
    frequencyType: FrequencyType.MONTHLY,
    customIntervalMonths: null,
    startDate: dayIn(addMonths(thisMonth, -startedMonthsAgo), day),
    nextPaymentDate: dayIn(nextMonth, day),
    categoryId: subCat(category),
    isActive: true,
    lastUsageConfirmationDate: null,
    confirmationIntervalMonths: 3,
    createdAt: NOW,
    updatedAt: NOW,
  });

  return [
    subscription('Netflix', 'Rozrywka', 4300, 8, 6),
    subscription('Siłownia', 'Sport', 12900, 1, 9),
    subscription('Narzędzie AI', 'AI', 8000, 15, 2),
  ];
}

/** Komplet danych demonstracyjnych. */
export function buildDemoData() {
  const categories = buildDemoCategories();
  return {
    categories,
    paymentSeeds: buildDemoPaymentSeeds(categories),
    billTemplates: buildDemoBillTemplates(categories),
    subscriptions: buildDemoSubscriptions(categories),
  };
}
