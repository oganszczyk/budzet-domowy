/**
 * Repozytorium — jedyne wejście do danych.
 *
 * 8.1: ekrany nie znają bazy danych. Pytają repozytorium, a repozytorium
 * wie, skąd wziąć odpowiedź.
 * 8.2: „Kod powinien umożliwiać późniejsze zastąpienie lokalnego
 * repozytorium repozytorium chmurowym."
 *
 * To właśnie ten plik na to pozwala. Dzisiaj odpowiedzi pochodzą z pamięci
 * (tryb demonstracyjny), jutro z SQLite, a kiedyś mogłyby z serwera —
 * a ekrany pozostaną bez zmian, bo widzą tylko ten interfejs.
 *
 * Każda metoda zwraca Promise, mimo że wersja pamięciowa mogłaby odpowiadać
 * natychmiast. To celowe: prawdziwa baza odpowiada asynchronicznie i gdyby
 * interfejs tego nie zakładał, podmiana wymusiłaby przepisanie ekranów.
 */

import type { MainType } from '@/domain/enums';
import type { BillTemplate, Category, MonthlyTotals, Payment, Subscription } from '@/domain/models';
import type { YearMonth } from '@/lib/date';

/** Dane potrzebne do utworzenia nowej płatności. Resztę pól uzupełnia repozytorium. */
export type NewPayment = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;

/** Pola, które wolno zmienić w istniejącej płatności. */
export type PaymentPatch = Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>>;

/** Podkategoria wraz z jej sumą w wybranym miesiącu (5.4). */
export type CategoryTotal = {
  category: Category;
  totalGrosze: number;
};

export interface ExpensesRepository {
  // --- Kategorie (7.1) ---

  /** Lista aktywnych kategorii, opcjonalnie tylko dla jednej kategorii głównej. */
  listCategories(mainType?: MainType): Promise<Category[]>;

  // --- Sumy (6.1, BR-09) ---

  /** 5.1: trzy sumy na karty ekranu głównego. */
  getMonthlyTotals(month: YearMonth): Promise<MonthlyTotals>;

  /** 5.4: sumy poszczególnych podkategorii w wybranym miesiącu. */
  getCategoryTotals(month: YearMonth, mainType: MainType): Promise<CategoryTotal[]>;

  // --- Płatności (7.2) ---

  /** Płatności z wybranego miesiąca, opcjonalnie jednego typu. */
  listPaymentsForMonth(month: YearMonth, mainType?: MainType): Promise<Payment[]>;

  /**
   * 5.7: wspólna historia, od najnowszych do najstarszych.
   * BR-05: rachunki oczekujące na kwotę NIE są tu pokazywane.
   */
  listHistory(): Promise<Payment[]>;

  getPayment(id: number): Promise<Payment | null>;
  createPayment(input: NewPayment): Promise<Payment>;
  updatePayment(id: number, patch: PaymentPatch): Promise<Payment>;
  deletePayment(id: number): Promise<void>;

  // --- Szablony cykliczne (7.3, 7.4) ---

  listBillTemplates(): Promise<BillTemplate[]>;
  listSubscriptions(): Promise<Subscription[]>;
}
