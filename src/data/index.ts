/**
 * Wybór aktywnego repozytorium.
 *
 * TO JEST TEN JEDEN PLIK, o którym pisaliśmy budując ekrany na danych
 * w pamięci. Ekrany znają wyłącznie interfejs `ExpensesRepository` (8.2),
 * więc podmiana pamięci na SQLite ogranicza się do tego miejsca.
 *
 * `getRepository()` zwraca obietnicę, bo otwarcie bazy i wykonanie migracji
 * jest asynchroniczne. Wywołania i tak zawsze siedzą w `queryFn`/`mutationFn`,
 * które są asynchroniczne — więc nic to nie komplikuje.
 */

import { migrate } from './sqlite/migrations';
import { openExpoDatabase } from './sqlite/expo-adapter';
import { seedDefaults } from './sqlite/seed';
import { SqliteExpensesRepository } from './sqlite/sqlite-repository';
import type { ExpensesRepository } from './repository';

/**
 * Trzymamy OBIETNICĘ, nie gotowe repozytorium.
 *
 * Gdyby kilka ekranów zapytało o repozytorium zanim baza się otworzy,
 * każde dostałoby tę samą obietnicę — baza otworzy się i zmigruje raz,
 * a nie tyle razy, ile ekranów akurat startowało.
 */
let repositoryPromise: Promise<ExpensesRepository> | null = null;

async function createRepository(): Promise<ExpensesRepository> {
  const db = await openExpoDatabase();

  // 1.2: migracje zamiast kasowania bazy. Bezpieczne przy każdym starcie.
  await migrate(db);

  // 3.1 / T-01: kategorie i domyślne rachunki cykliczne przy pierwszym
  // uruchomieniu. Bez płatności, więc sumy startują od 0,00 zł.
  await seedDefaults(db);

  return new SqliteExpensesRepository(db);
}

/** Zwraca aktywne repozytorium, otwierając bazę przy pierwszym użyciu. */
export function getRepository(): Promise<ExpensesRepository> {
  if (repositoryPromise === null) {
    repositoryPromise = createRepository();
  }
  return repositoryPromise;
}

export type {
  BillAmountHistoryEntry,
  BillTemplatePatch,
  CategoryTotal,
  ExpensesRepository,
  NewBillTemplate,
  NewCategory,
  NewPayment,
  NewSubscription,
  PaymentPatch,
  SubscriptionPatch,
} from './repository';
