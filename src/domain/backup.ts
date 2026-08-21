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

import type { BillTemplate, Category, Payment, Subscription } from './models';

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

/** Komplet danych aplikacji w jednym miejscu. */
export type BackupSnapshot = {
  categories: Category[];
  payments: Payment[];
  billTemplates: BillTemplate[];
  subscriptions: Subscription[];
  generatedRecords: GeneratedRecord[];
};

/** Ile rekordów każdego rodzaju zawiera migawka — do pokazania użytkownikowi. */
export type BackupCounts = {
  payments: number;
  billTemplates: number;
  subscriptions: number;
  categories: number;
};

export function countSnapshot(snapshot: BackupSnapshot): BackupCounts {
  return {
    payments: snapshot.payments.length,
    billTemplates: snapshot.billTemplates.length,
    subscriptions: snapshot.subscriptions.length,
    categories: snapshot.categories.length,
  };
}
