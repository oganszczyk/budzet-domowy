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
  ExpensesRepository,
  PendingChanges,
  SyncedMark,
  SyncedMarks,
} from '@/data/repository';
import { getSupabaseClient } from '@/data/supabase/client';

import { describeSyncError, type SyncFailureReason } from './sync-errors';
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

/** Ile rekordów czeka na wysłanie — do pokazania na ekranie przed wysyłką. */
export async function countPendingChanges(repository: ExpensesRepository): Promise<number> {
  const changes = await repository.listPendingChanges();
  return countPayload(buildSyncPayload('podglad', changes));
}
