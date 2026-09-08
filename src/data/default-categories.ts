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

/**
 * STAŁE IDENTYFIKATORY DANYCH STARTOWYCH (Etap 14d).
 *
 * DLACZEGO NIE LOSOWE, SKORO WSZYSTKIE POZOSTAŁE SĄ LOSOWE
 *
 * Każdy telefon zakłada sobie te same domyślne kategorie przy pierwszym
 * uruchomieniu. Gdyby przy tym losował identyfikatory, „Jedzenie" z telefonu
 * A i „Jedzenie" z telefonu B byłyby dla synchronizacji DWOMA RÓŻNYMI
 * kategoriami — a po pierwszym pobraniu danych użytkownik zobaczyłby każdą
 * domyślną kategorię podwójnie, bez żadnego sposobu, żeby je scalić.
 *
 * To nie jest wyjątek od zasady „identyfikator jest losowy", tylko jej
 * uzupełnienie: losowanie służy temu, żeby rekordy utworzone NIEZALEŻNIE
 * nigdy się nie zderzyły. Kategorie startowe nie powstają niezależnie —
 * powstają z tej samej listy, w tej samej aplikacji, i mają być tym samym.
 *
 * Zapis `c` dla kategorii i `b` dla szablonów rachunków, z wiodącymi zerami
 * do 32 znaków. Wygląda inaczej niż identyfikator losowy i o to chodzi:
 * widać na pierwszy rzut oka, że to rekord wbudowany, a nie wpisany.
 *
 * TYCH WARTOŚCI NIE WOLNO ZMIENIAĆ. Zmiana rozdwoi kategorię u każdego,
 * kto ma już aplikację: stara zostanie w chmurze, nowa pojedzie obok.
 */
const wbudowany = (koncowka: string): string => koncowka.padStart(32, '0');

export const BILL_CATEGORY_UUID = wbudowany('c00');

/** Identyfikator podkategorii po nazwie. Nazwa jest tu kluczem trwałym. */
export const SHARED_CATEGORY_UUIDS: Record<string, string> = {
  Jedzenie: wbudowany('c01'),
  'Kosmetyki i higiena': wbudowany('c02'),
  Sprzątanie: wbudowany('c03'),
  Ubrania: wbudowany('c04'),
  Mieszkanie: wbudowany('c05'),
  Rozrywka: wbudowany('c06'),
  Sport: wbudowany('c07'),
  Komputerowe: wbudowany('c08'),
  Inne: wbudowany('c09'),
};

/** Identyfikator domyślnego szablonu rachunku po nazwie. */
export const DEFAULT_BILL_TEMPLATE_UUIDS: Record<string, string> = {
  'Czynsz za mieszkanie': wbudowany('b01'),
  Prąd: wbudowany('b02'),
  Woda: wbudowany('b03'),
  Gaz: wbudowany('b04'),
  Internet: wbudowany('b05'),
  Telefon: wbudowany('b06'),
  Ubezpieczenie: wbudowany('b07'),
};

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
