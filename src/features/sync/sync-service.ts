/**
 * Etap 14c: WYSYŁKA ZMIAN NA SERWER.
 *
 * Jedyne miejsce w aplikacji, które rozmawia z Supabase o danych. Tłumaczenie
 * rekordów siedzi w `sync-payload.ts`, tłumaczenie błędów w `sync-errors.ts` —
 * tutaj zostaje sama rozmowa: co wysłać, w jakiej kolejności i co zrobić,
 * gdy się nie uda.
 *
 * TEN ETAP TYLKO WYSYŁA.
 *
 * Nic nie pobiera. Drugi telefon zobaczy te dane dopiero po Etapie 14d.
 * Wysyłka jest sama w sobie użyteczna — od tej chwili historia wydatków
 * przestaje istnieć wyłącznie w jednym telefonie — ale nie jest jeszcze
 * synchronizacją i ekran ma o tym mówić wprost.
 *
 * DLACZEGO ZNACZNIK GAŚNIE PO KAŻDEJ TABELI, A NIE NA KOŃCU
 *
 * Przy słabym zasięgu wysyłka bywa przerwana w połowie. Gdyby znaczniki
 * gasły dopiero po całości, przerwanie na ostatniej tabeli kazałoby wysłać
 * wszystko od nowa przy następnej próbie — i tak w kółko, dopóki użytkownik
 * nie trafi na moment z dobrym łączem na tyle długim, żeby zdążyć.
 * Gaszenie po każdej tabeli zachowuje to, co już dojechało.
 *
 * ODWROTNA KOLEJNOŚĆ BYŁABY BŁĘDEM. Znacznik zgaszony przed potwierdzeniem
 * serwera znaczy „ten rekord jest już w chmurze" — a jeżeli nie jest,
 * nic go tam nigdy nie wyśle i nikt się o tym nie dowie.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ApplyResult,
  ExpensesRepository,
  PendingChanges,
  RemoteChanges,
  SyncedMark,
  SyncedMarks,
} from '@/data/repository';
import { getSupabaseClient } from '@/data/supabase/client';

import { describeSyncError, type SyncFailureReason } from './sync-errors';
import {
  CHANGE_FIELD,
  markerKey,
  PULL_ORDER,
  READERS,
  type IncomingRow,
  type PullTable,
} from './sync-inbound';
import { buildSyncPayload, countPayload, UPLOAD_ORDER, type UploadTable } from './sync-payload';

export type SyncOutcome =
  | {
      ok: true;
      /** Ile rekordów poszło na serwer. Zero znaczy „wszystko już tam było". */
      sent: number;
    }
  | {
      ok: false;
      reason: SyncFailureReason;
      /** Ile zdążyło dojechać, zanim się nie udało. Ta praca nie przepada. */
      sent: number;
    };

/**
 * Ile wierszy leci w jednym żądaniu.
 *
 * Pierwsza synchronizacja niesie całą historię wydatków. Jedno żądanie
 * z kilkoma tysiącami wierszy potrafi przekroczyć limit czasu na słabym
 * łączu i wtedy przepada CAŁE — mniejsze paczki oznaczają, że przerwanie
 * kosztuje jedną paczkę, a nie wszystko.
 */
const BATCH_SIZE = 200;

/** Klucze, po których serwer rozpoznaje, że to ten sam rekord co poprzednio. */
const CONFLICT_KEYS: Record<UploadTable, string> = {
  categories: 'user_id,uuid',
  bill_templates: 'user_id,uuid',
  subscriptions: 'user_id,uuid',
  payments: 'user_id,uuid',
  incomes: 'user_id,uuid',
  deleted_records: 'user_id,entity_type,uuid',
};

function emptyMarks(): SyncedMarks {
  return {
    categories: [],
    billTemplates: [],
    subscriptions: [],
    payments: [],
    incomes: [],
    deletedRecords: [],
  };
}

const toMark = (record: { uuid: string; updatedAt: string }): SyncedMark => ({
  uuid: record.uuid,
  updatedAt: record.updatedAt,
});

/** Potwierdzenie dla jednej tabeli — reszta zostaje pusta. */
function marksForTable(table: UploadTable, changes: PendingChanges): SyncedMarks {
  const marks = emptyMarks();

  switch (table) {
    case 'categories':
      marks.categories = changes.categories.map((category) => category.uuid);
      break;
    case 'bill_templates':
      marks.billTemplates = changes.billTemplates.map(toMark);
      break;
    case 'subscriptions':
      marks.subscriptions = changes.subscriptions.map(toMark);
      break;
    case 'payments':
      marks.payments = changes.payments.map(toMark);
      break;
    case 'incomes':
      marks.incomes = changes.incomes.map(toMark);
      break;
    case 'deleted_records':
      marks.deletedRecords = changes.deletedRecords.map((record) => ({
        entityType: record.entityType,
        uuid: record.uuid,
      }));
      break;
  }

  return marks;
}

function chunk<T>(items: T[], size: number): T[][] {
  const paczki: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    paczki.push(items.slice(index, index + size));
  }
  return paczki;
}

/**
 * Wysyła na serwer wszystko, czego jeszcze tam nie ma.
 *
 * Klienta przyjmujemy jako argument (domyślnie ten prawdziwy), żeby testy
 * mogły podstawić własnego i sprawdzić kolejność wysyłki oraz zachowanie
 * przy błędzie — bez sieci i bez konta.
 */
export async function pushPendingChanges(
  repository: ExpensesRepository,
  client: SupabaseClient | null = getSupabaseClient()
): Promise<SyncOutcome> {
  if (client === null) return { ok: false, reason: 'NOT_CONFIGURED', sent: 0 };

  let userId: string;

  try {
    const { data, error } = await client.auth.getUser();
    if (error) return { ok: false, reason: describeSyncError(error), sent: 0 };
    if (!data.user) return { ok: false, reason: 'NOT_SIGNED_IN', sent: 0 };
    userId = data.user.id;
  } catch (error) {
    return { ok: false, reason: describeSyncError(error), sent: 0 };
  }

  const changes = await repository.listPendingChanges();
  const payload = buildSyncPayload(userId, changes);

  if (countPayload(payload) === 0) return { ok: true, sent: 0 };

  let sent = 0;

  for (const table of UPLOAD_ORDER) {
    const rows = payload[table];
    if (rows.length === 0) continue;

    for (const paczka of chunk(rows, BATCH_SIZE)) {
      try {
        const { error } = await client
          .from(table)
          .upsert(paczka, { onConflict: CONFLICT_KEYS[table] });

        if (error) return { ok: false, reason: describeSyncError(error), sent };
      } catch (error) {
        // Brak internetu nie wraca jako `error` w odpowiedzi — leci wyjątkiem
        // z warstwy sieciowej, zanim powstanie jakakolwiek odpowiedź.
        return { ok: false, reason: describeSyncError(error), sent };
      }

      sent += paczka.length;
    }

    await repository.markSynced(marksForTable(table, changes));
  }

  return { ok: true, sent };
}

/**
 * Ile wierszy schodzi w jednym żądaniu przy pobieraniu.
 *
 * Mniej niż przy wysyłce, bo pobrane rekordy trzeba jeszcze ZAPISAĆ
 * do lokalnej bazy w jednej transakcji. Duża paczka blokowałaby bazę
 * na tyle długo, że ekran zdążyłby się zaciąć.
 */
const PULL_PAGE_SIZE = 100;

/** Znacznik użyty, gdy nic jeszcze nie pobrano — czyli „od początku świata". */
const OD_POCZATKU = '1970-01-01T00:00:00.000Z';

function emptyChanges(): RemoteChanges {
  return {
    categories: [],
    billTemplates: [],
    subscriptions: [],
    payments: [],
    incomes: [],
    deletedRecords: [],
  };
}

export type PullOutcome =
  | { ok: true; applied: number; skipped: number; overwritten: number }
  | { ok: false; reason: SyncFailureReason; applied: number; skipped: number; overwritten: number };

/**
 * Pobiera z serwera wszystko, czego ten telefon jeszcze nie widział.
 *
 * ZNACZNIK PRZESUWA SIĘ PO KAŻDEJ ZAPISANEJ STRONIE, nie na końcu. Powód
 * jest ten sam, co przy wysyłce: przerwane pobieranie ma zachować to, co już
 * dojechało, zamiast zaczynać od zera przy każdej próbie.
 *
 * Znacznik bierzemy z `syncedAt` OSTATNIEGO wiersza strony — czyli z zegara
 * serwera. Wiersze przychodzą posortowane po tym polu, więc kolejne pytanie
 * „co nowszego niż to" nie zgubi niczego po drodze.
 */
export async function pullRemoteChanges(
  repository: ExpensesRepository,
  client: SupabaseClient | null = getSupabaseClient()
): Promise<PullOutcome> {
  const suma = { applied: 0, skipped: 0, overwritten: 0 };

  if (client === null) return { ok: false, reason: 'NOT_CONFIGURED', ...suma };

  try {
    const { data, error } = await client.auth.getUser();
    if (error) return { ok: false, reason: describeSyncError(error), ...suma };
    if (!data.user) return { ok: false, reason: 'NOT_SIGNED_IN', ...suma };
  } catch (error) {
    return { ok: false, reason: describeSyncError(error), ...suma };
  }

  for (const table of PULL_ORDER) {
    let marker = (await repository.getSyncMarker(markerKey(table))) ?? OD_POCZATKU;

    // Pętla, bo zmian może być więcej niż jedna strona. Kończy się, gdy
    // serwer odda mniej wierszy, niż zmieściłoby się na stronie.
    for (;;) {
      let rows: IncomingRow[];

      try {
        const { data, error } = await client
          .from(table)
          .select('*')
          .gt('synced_at', marker)
          .order('synced_at', { ascending: true })
          .limit(PULL_PAGE_SIZE);

        if (error) return { ok: false, reason: describeSyncError(error), ...suma };
        rows = (data ?? []) as IncomingRow[];
      } catch (error) {
        return { ok: false, reason: describeSyncError(error), ...suma };
      }

      if (rows.length === 0) break;

      const wynik = await applyPage(repository, table, rows);
      suma.applied += wynik.applied;
      suma.skipped += wynik.skipped;
      suma.overwritten += wynik.overwritten;

      // Wiersze nieczytelne dla tej wersji aplikacji też liczymy jako
      // pominięte — inaczej zniknęłyby bez śladu.
      suma.skipped += wynik.nieczytelne;

      if (wynik.ostatniZnacznik !== null) {
        marker = wynik.ostatniZnacznik;
        await repository.setSyncMarker(markerKey(table), marker);
      }

      if (rows.length < PULL_PAGE_SIZE) break;
    }
  }

  return { ok: true, ...suma };
}

/** Zamienia stronę wierszy na zmiany i zapisuje je w lokalnej bazie. */
async function applyPage(
  repository: ExpensesRepository,
  table: PullTable,
  rows: IncomingRow[]
): Promise<ApplyResult & { nieczytelne: number; ostatniZnacznik: string | null }> {
  const changes = emptyChanges();
  const reader = READERS[table] as (row: IncomingRow) => { syncedAt: string } | null;
  const pole = CHANGE_FIELD[table];

  let nieczytelne = 0;
  let ostatniZnacznik: string | null = null;

  for (const row of rows) {
    const rekord = reader(row);

    if (rekord === null) {
      nieczytelne++;
      // Znacznik przesuwamy TAKŻE po wierszu, którego nie umiemy przeczytać.
      // Inaczej pobieranie zatrzymałoby się na nim na zawsze i wszystko,
      // co przyszło po nim, nigdy by nie dotarło.
      const zapasowy = typeof row.synced_at === 'string' ? new Date(row.synced_at) : null;
      if (zapasowy && !Number.isNaN(zapasowy.getTime())) {
        ostatniZnacznik = zapasowy.toISOString();
      }
      continue;
    }

    (changes[pole] as unknown[]).push(rekord);
    ostatniZnacznik = rekord.syncedAt;
  }

  const wynik = await repository.applyRemoteChanges(changes);

  return { ...wynik, nieczytelne, ostatniZnacznik };
}

/**
 * Pełna synchronizacja: NAJPIERW WYSYŁKA, POTEM POBIERANIE.
 *
 * Kolejność nie jest obojętna. Własne zmiany jadą na serwer, zanim przyjdą
 * cudze — dzięki temu przy sporze o ten sam rekord porównujemy dwie wersje,
 * z których obie serwer już zna. Odwrotna kolejność mogłaby nadpisać lokalną
 * poprawkę, zanim ktokolwiek się o niej dowiedział.
 *
 * Dotyczy to zwłaszcza KATEGORII, które jako jedyne nie mają znacznika czasu
 * i przy pobieraniu zawsze przegrywają z wersją z serwera. Wysłane najpierw,
 * wracają jako ta sama wartość i nic nie ginie.
 */
export type SyncOutcomeFull = {
  ok: boolean;
  sent: number;
  applied: number;
  skipped: number;
  overwritten: number;
  reason?: SyncFailureReason;
};

export async function synchronize(
  repository: ExpensesRepository,
  client: SupabaseClient | null = getSupabaseClient()
): Promise<SyncOutcomeFull> {
  const wysylka = await pushPendingChanges(repository, client);

  if (!wysylka.ok) {
    return {
      ok: false,
      reason: wysylka.reason,
      sent: wysylka.sent,
      applied: 0,
      skipped: 0,
      overwritten: 0,
    };
  }

  const pobieranie = await pullRemoteChanges(repository, client);

  return {
    ok: pobieranie.ok,
    reason: pobieranie.ok ? undefined : pobieranie.reason,
    sent: wysylka.sent,
    applied: pobieranie.applied,
    skipped: pobieranie.skipped,
    overwritten: pobieranie.overwritten,
  };
}

/** Ile rekordów czeka na wysłanie — do pokazania na ekranie przed wysyłką. */
export async function countPendingChanges(repository: ExpensesRepository): Promise<number> {
  const changes = await repository.listPendingChanges();
  return countPayload(buildSyncPayload('podglad', changes));
}
