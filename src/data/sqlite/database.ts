/**
 * Minimalny interfejs bazy SQL.
 *
 * Repozytorium bazodanowe zna wyłącznie ten interfejs, a nie konkretną
 * bibliotekę. Dzięki temu:
 *  - w aplikacji podstawiamy `expo-sqlite` (telefon i przeglądarka),
 *  - w testach podstawiamy wbudowany moduł Node `node:sqlite`.
 *
 * To ważne: bez tego SQL dałoby się sprawdzić dopiero na telefonie, czyli
 * najpóźniej i najdrożej. Tak samo zapytania testujemy w kilkadziesiąt
 * milisekund, na prawdziwym silniku SQLite.
 */

/** Wartości, jakie wolno przekazać jako parametr zapytania. */
export type SqlParam = string | number | null;

export type RunResult = {
  lastInsertRowId: number;
  changes: number;
};

export interface SqlDatabase {
  /** Wykonuje jedno lub wiele poleceń bez parametrów (schemat, migracje). */
  exec(sql: string): Promise<void>;
  /** Wykonuje polecenie zmieniające dane. */
  run(sql: string, params?: SqlParam[]): Promise<RunResult>;
  /** Zwraca wszystkie wiersze. */
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  /** Zwraca pierwszy wiersz albo `null`. */
  first<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  /** Zamyka połączenie. Potrzebne w testach; w aplikacji baza żyje cały czas. */
  close?(): Promise<void>;
}
