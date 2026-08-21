/**
 * Adapter `expo-sqlite` — baza używana w działającej aplikacji.
 *
 * Cała wiedza o konkretnej bibliotece SQLite siedzi w tym jednym pliku.
 * Repozytorium zna tylko interfejs `SqlDatabase`.
 */

import * as SQLite from 'expo-sqlite';

import type { RunResult, SqlDatabase, SqlParam } from './database';

/** Nazwa pliku bazy na urządzeniu. */
export const DATABASE_NAME = 'domowe-wydatki.db';

class ExpoSqlDatabase implements SqlDatabase {
  constructor(private readonly db: SQLite.SQLiteDatabase) {}

  async exec(sql: string): Promise<void> {
    await this.db.execAsync(sql);
  }

  async run(sql: string, params: SqlParam[] = []): Promise<RunResult> {
    const result = await this.db.runAsync(sql, params);
    return { lastInsertRowId: result.lastInsertRowId, changes: result.changes };
  }

  async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.getAllAsync<T>(sql, params);
  }

  async first<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    return this.db.getFirstAsync<T>(sql, params);
  }
}

export async function openExpoDatabase(): Promise<SqlDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // Klucze obce nie są w SQLite domyślnie egzekwowane — bez tego
  // płatność mogłaby wskazywać na nieistniejącą kategorię.
  await db.execAsync('PRAGMA foreign_keys = ON');

  return new ExpoSqlDatabase(db);
}
