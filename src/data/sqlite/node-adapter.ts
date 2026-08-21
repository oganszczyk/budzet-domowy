/**
 * Adapter wbudowanego modułu `node:sqlite` — WYŁĄCZNIE DO TESTÓW.
 *
 * NIE IMPORTUJ TEGO PLIKU Z KODU APLIKACJI. `node:sqlite` nie istnieje
 * na telefonie; w aplikacji obowiązuje `expo-adapter.ts`.
 *
 * Po co osobny adapter? Żeby zapytania SQL dało się sprawdzić w testach,
 * na prawdziwym silniku SQLite, zamiast dowiadywać się o błędzie dopiero
 * po zainstalowaniu aplikacji na telefonie.
 */

import { DatabaseSync } from 'node:sqlite';

import type { RunResult, SqlDatabase, SqlParam } from './database';

class NodeSqlDatabase implements SqlDatabase {
  constructor(private readonly db: DatabaseSync) {}

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params: SqlParam[] = []): Promise<RunResult> {
    const result = this.db.prepare(sql).run(...params);
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  }

  async all<T>(sql: string, params: SqlParam[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(...params) as T[];
  }

  async first<T>(sql: string, params: SqlParam[] = []): Promise<T | null> {
    const row = this.db.prepare(sql).get(...params);
    return (row ?? null) as T | null;
  }

  private closed = false;

  /** Idempotentne — sprzątanie w testach bywa wywoływane więcej niż raz. */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.db.close();
  }
}

/** Baza w pamięci procesu — każdy test dostaje własną, czystą. */
export function openNodeDatabase(path = ':memory:'): SqlDatabase {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return new NodeSqlDatabase(db);
}
