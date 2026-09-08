/**
 * Migawka całej zawartości aplikacji — podstawa kopii zapasowej (Etap 10).
 *
 * Dane leżą wyłącznie w pamięci telefonu. Odinstalowanie aplikacji, awaria
 * albo zgubienie telefonu oznaczały do tej pory bezpowrotną utratę wszystkiego,
 * co użytkownik wpisał. Ten typ opisuje, co trzeba wynieść na zewnątrz,
 * żeby dało się to odtworzyć.
 *
 * DLACZEGO NIE KOPIA PLIKU BAZY:
 * Plik `.db` odtworzyłby dane najwierniej, ale wymagałby, żeby wersja schematu
 * w pliku pasowała do wersji w aplikacji. Kopia zrobiona przed migracją nie
 * dałaby się wczytać po aktualizacji — a to właśnie wtedy jest najbardziej
 * potrzebna. Migawka opisuje dane w kategoriach modelu (7), a nie tabel,
 * więc przeżywa zmiany schematu.
 *
 * DLACZEGO IDENTYFIKATORY SĄ CZĘŚCIĄ MIGAWKI:
 * `Payment.categoryId`, `billTemplateId` i `subscriptionId` wskazują na inne
 * rekordy. Gdyby odtwarzanie nadawało nowe identyfikatory, powiązania trzeba
 * byłoby mapować w locie, a każdy błąd w mapowaniu cicho przypiąłby wydatek
 * do złej kategorii. Odtwarzamy więc razem z identyfikatorami — migawka jest
 * wierną kopią, nie ponownym wpisaniem danych.
 */

import type { SavedReport } from './analysis';
import type { BillTemplate, Category, Income, Payment, Subscription } from './models';

/**
 * Wpis rejestru „ten szablon miał już rekord w tym miesiącu" (BR-12).
 *
 * Bez tego rejestru odtworzenie kopii kazałoby automatowi utworzyć rachunki
 * na nowo dla każdego miesiąca w historii — łącznie z tymi, które użytkownik
 * świadomie usunął. Rejestr jest częścią danych, nie szczegółem bazy.
 */
export type GeneratedRecord = {
  sourceType: 'BILL' | 'SUBSCRIPTION';
  /** Identyfikator szablonu rachunku albo subskrypcji. */
  sourceId: number;
  year: number;
  /** Miesiąc liczony od 1 (styczeń) do 12 (grudzień). */
  month: number;
};

/**
 * Ślad po rekordzie skasowanym przez użytkownika (Etap 14b).
 *
 * DLACZEGO KOPIA ZAPASOWA NIESIE TEŻ TO, CZEGO JUŻ NIE MA:
 * Skasowany wydatek zniknął z tego telefonu, ale niekoniecznie z serwera
 * i z drugiego telefonu. Kopia bez tej listy odtworzyłaby stan, w którym
 * aplikacja nie wie już, że coś skasowano — a wtedy przy najbliższej
 * synchronizacji drugi telefon przysłałby te rekordy z powrotem jako nowe.
 * Kasowanie przestałoby być trwałe, i to bez żadnego komunikatu.
 */
export type DeletedRecord = {
  entityType: 'PAYMENT' | 'CATEGORY' | 'BILL_TEMPLATE' | 'SUBSCRIPTION' | 'INCOME';
  /** Trwały identyfikator rekordu, którego już nie ma. */
  uuid: string;
  deletedAt: string;
};

/** Komplet danych aplikacji w jednym miejscu. */
export type BackupSnapshot = {
  categories: Category[];
  payments: Payment[];
  billTemplates: BillTemplate[];
  subscriptions: Subscription[];
  generatedRecords: GeneratedRecord[];
  /** Etap 11: dochody domowników. */
  incomes: Income[];
  /**
   * Etap 13: zestawienia zapisane przez użytkownika.
   *
   * To nie są dane finansowe, więc kusiło, żeby je pominąć. Ale zestawienie
   * jest pracą użytkownika tak samo jak wpisany wydatek — po zmianie telefonu
   * musiałby wyklikać je od nowa, nie mając nawet jak sprawdzić, jakie miał.
   */
  savedReports: SavedReport[];
  /**
   * Etap 14b: rekordy skasowane przez użytkownika.
   *
   * Kopie sprzed Etapu 14b tej listy nie mają — czytnik podstawia wtedy
   * pustą, co znaczy „nic nie wiadomo o kasowaniu", a nie „nic nie skasowano".
   */
  deletedRecords: DeletedRecord[];
};

/** Ile rekordów każdego rodzaju zawiera migawka — do pokazania użytkownikowi. */
export type BackupCounts = {
  payments: number;
  billTemplates: number;
  subscriptions: number;
  categories: number;
  incomes: number;
  savedReports: number;
};

export function countSnapshot(snapshot: BackupSnapshot): BackupCounts {
  return {
    payments: snapshot.payments.length,
    billTemplates: snapshot.billTemplates.length,
    subscriptions: snapshot.subscriptions.length,
    categories: snapshot.categories.length,
    incomes: snapshot.incomes.length,
    savedReports: snapshot.savedReports.length,
  };
}
