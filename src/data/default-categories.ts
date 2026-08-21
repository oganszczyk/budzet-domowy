/**
 * Domyślne kategorie i szablony rachunków (5.2, 5.3, 5.4).
 *
 * Jedno miejsce dla całej aplikacji: korzysta z nich zarówno zasiew bazy
 * SQLite przy pierwszym uruchomieniu, jak i repozytorium demonstracyjne.
 */

import { MainType } from '@/domain/enums';

/**
 * Rachunki domowe nie mają podkategorii — nazwa rachunku w pełni go
 * identyfikuje. BR-02 wymaga podkategorii wyłącznie dla ZAKUPÓW.
 */
export const BILL_CATEGORY_NAME = 'Rachunki domowe';

/**
 * WSPÓLNE podkategorie subskrypcji (5.3) i zakupów (5.4).
 *
 * Specyfikacja wymienia dwie listy, ale mają część wspólną. Scalamy je,
 * żeby przyszła analiza mogła zsumować np. Netflixa i bilet do kina
 * po jednym identyfikatorze, zamiast dopasowywać nazwy.
 */
export const SHARED_CATEGORY_NAMES = [
  'Jedzenie',
  'Kosmetyki i higiena',
  'Sprzątanie',
  'Ubrania',
  'Mieszkanie',
  'Rozrywka',
  'Sport',
  // Specyfikacja wymienia „AI" i „chmurę" osobno; w praktyce to ten sam
  // rodzaj wydatku, więc trzymamy je razem.
  'Komputerowe',
  'Inne',
] as const;

export const CATEGORY_ICONS: Record<string, string> = {
  [BILL_CATEGORY_NAME]: 'receipt-outline',
  Jedzenie: 'restaurant-outline',
  'Kosmetyki i higiena': 'flower-outline',
  Sprzątanie: 'sparkles-outline',
  Ubrania: 'shirt-outline',
  Mieszkanie: 'bed-outline',
  Rozrywka: 'film-outline',
  Sport: 'barbell-outline',
  Komputerowe: 'laptop-outline',
  Inne: 'ellipsis-horizontal-outline',
};

/** Podkategorie dzielone przez subskrypcje i zakupy. */
export const SHARED_USED_BY: MainType[] = [MainType.SUBSCRIPTION, MainType.PURCHASE];

/**
 * 5.2, „Domyślne pozycje": rachunki tworzone przy pierwszym uruchomieniu.
 *
 * Telefon i ubezpieczenie specyfikacja opisuje jako „opcjonalna", więc
 * powstają wyłączone — są na liście „Rachunki cykliczne" gotowe do włączenia,
 * ale nie zaśmiecają listy komuś, kto ich nie potrzebuje.
 */
export const DEFAULT_BILL_TEMPLATES: {
  name: string;
  defaultDueDay: number;
  isActive: boolean;
}[] = [
  { name: 'Czynsz za mieszkanie', defaultDueDay: 10, isActive: true },
  { name: 'Prąd', defaultDueDay: 15, isActive: true },
  { name: 'Woda', defaultDueDay: 20, isActive: true },
  { name: 'Gaz', defaultDueDay: 28, isActive: true },
  { name: 'Internet', defaultDueDay: 12, isActive: true },
  { name: 'Telefon', defaultDueDay: 18, isActive: false },
  { name: 'Ubezpieczenie', defaultDueDay: 5, isActive: false },
];
