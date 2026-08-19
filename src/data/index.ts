/**
 * Wybór aktywnego repozytorium.
 *
 * TO JEST TEN JEDEN PLIK, KTÓRY ZMIENIMY, gdy powstanie baza SQLite.
 * Wystarczy podmienić `new InMemoryExpensesRepository()` na wersję
 * bazodanową — żaden ekran ani żaden hook nie wymaga poprawki,
 * bo wszystkie znają wyłącznie interfejs `ExpensesRepository` (8.2).
 */

import { InMemoryExpensesRepository } from './in-memory-repository';
import type { ExpensesRepository } from './repository';

let repository: ExpensesRepository | null = null;

/**
 * Zwraca aktywne repozytorium. Tworzymy je raz i trzymamy w module,
 * żeby dane przetrwały przechodzenie między ekranami.
 */
export function getRepository(): ExpensesRepository {
  if (repository === null) {
    repository = new InMemoryExpensesRepository();
  }
  return repository;
}

export type { CategoryTotal, ExpensesRepository, NewPayment, PaymentPatch } from './repository';
