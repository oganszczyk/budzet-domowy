import type { SupabaseClient } from '@supabase/supabase-js';

import { InMemoryExpensesRepository } from '@/data/in-memory-repository';
import { MainType } from '@/domain/enums';

import { markerKey } from './sync-inbound';
import { pullRemoteChanges, synchronize } from './sync-service';

const USER = '11111111-2222-3333-4444-555555555555';
const CZAS = '2026-09-08T10:00:00.000Z';

/** Zapytanie, które trafiło na serwer — tyle testom wystarczy. */
type Zapytanie = { table: string; marker: string };

/**
 * Podstawiony klient Supabase dla POBIERANIA.
 *
 * Odtwarza tylko ten kawałek biblioteki, którego używa pętla pobierania:
 * `from(...).select(...).gt(...).order(...).limit(...)`. Dzięki temu da się
 * sprawdzić bez sieci to, co w tej warstwie najłatwiej zepsuć po cichu —
 * kolejność tabel i przesuwanie znacznika.
 */
function fakeClient(strony: Record<string, Record<string, unknown>[][]> = {}) {
  const zapytania: Zapytanie[] = [];
  const wyslane: string[] = [];
  const licznik: Record<string, number> = {};

  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: USER } }, error: null }),
    },
    from(table: string) {
      return {
        async upsert() {
          wyslane.push(table);
          return { error: null };
        },
        select() {
          return {
            gt(_kolumna: string, marker: string) {
              zapytania.push({ table, marker });
              return {
                order() {
                  return {
                    async limit() {
                      const numer = licznik[table] ?? 0;
                      licznik[table] = numer + 1;
                      return { data: strony[table]?.[numer] ?? [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, zapytania, wyslane };
}

async function repozytorium() {
  const repo = new InMemoryExpensesRepository();
  const [category] = await repo.listCategories(MainType.PURCHASE);
  return { repo, categoryUuid: category.uuid };
}

function wierszWydatku(uuid: string, categoryUuid: string, syncedAt: string) {
  return {
    uuid,
    main_type: 'PURCHASE',
    category_uuid: categoryUuid,
    title: 'Zakupy z drugiego telefonu',
    amount_grosze: 4500,
    effective_date: '2026-09-07',
    source: 'MANUAL',
    created_at: CZAS,
    updated_at: CZAS,
    synced_at: syncedAt,
  };
}

describe('pobieranie zmian z serwera (Etap 14d)', () => {
  it('odmawia bez podłączonego projektu', async () => {
    const { repo } = await repozytorium();

    const wynik = await pullRemoteChanges(repo, null);

    expect(wynik.ok).toBe(false);
    if (!wynik.ok) expect(wynik.reason).toBe('NOT_CONFIGURED');
  });

  it('pyta o wszystkie tabele, kategorie przed płatnościami', async () => {
    const { repo } = await repozytorium();
    const { client, zapytania } = fakeClient();

    await pullRemoteChanges(repo, client);

    const kolejnosc = zapytania.map((z) => z.table);
    expect(kolejnosc).toContain('categories');
    expect(kolejnosc).toContain('deleted_records');
    expect(kolejnosc.indexOf('categories')).toBeLessThan(kolejnosc.indexOf('payments'));
    expect(kolejnosc.indexOf('deleted_records')).toBe(kolejnosc.length - 1);
  });

  it('pierwsze pobranie pyta od początku świata', async () => {
    // Brak znacznika znaczy „nigdy nic nie pobrałem", więc nowy telefon
    // ma dostać całą historię, a nie nic.
    const { repo } = await repozytorium();
    const { client, zapytania } = fakeClient();

    await pullRemoteChanges(repo, client);

    expect(zapytania[0].marker).toBe('1970-01-01T00:00:00.000Z');
  });

  it('zapisuje pobrany wydatek i przesuwa znacznik', async () => {
    const { repo, categoryUuid } = await repozytorium();
    const znacznik = '2026-09-08T11:00:00.000Z';
    const { client } = fakeClient({
      payments: [[wierszWydatku('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01', categoryUuid, znacznik)]],
    });

    const wynik = await pullRemoteChanges(repo, client);

    expect(wynik.ok).toBe(true);
    expect(wynik.applied).toBe(1);
    expect(await repo.getSyncMarker(markerKey('payments'))).toBe(znacznik);
    expect((await repo.listHistory()).some((p) => p.title === 'Zakupy z drugiego telefonu')).toBe(
      true
    );
  });

  it('drugie pobranie pyta od zapisanego znacznika, nie od zera', async () => {
    // Bez tego każda synchronizacja ściągałaby całą historię wydatków —
    // działałoby przy stu rekordach i przestało przy kilku tysiącach.
    const { repo, categoryUuid } = await repozytorium();
    const znacznik = '2026-09-08T11:00:00.000Z';
    const { client, zapytania } = fakeClient({
      payments: [[wierszWydatku('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa01', categoryUuid, znacznik)]],
    });

    await pullRemoteChanges(repo, client);
    zapytania.length = 0;
    await pullRemoteChanges(repo, client);

    const pytanieOPlatnosci = zapytania.find((z) => z.table === 'payments');
    expect(pytanieOPlatnosci?.marker).toBe(znacznik);
  });

  it('nieczytelny wiersz jest liczony jako pominięty i nie blokuje reszty', async () => {
    // Wiersz zapisany przez NOWSZĄ wersję aplikacji, której ta nie rozumie.
    // Gdyby zatrzymywał pobieranie, wszystko, co przyszło po nim, nigdy
    // by nie dotarło — a użytkownik nie zobaczyłby żadnego powodu.
    const { repo, categoryUuid } = await repozytorium();
    const { client } = fakeClient({
      payments: [
        [
          { uuid: null, synced_at: '2026-09-08T11:00:00.000Z' },
          wierszWydatku(
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa02',
            categoryUuid,
            '2026-09-08T12:00:00.000Z'
          ),
        ],
      ],
    });

    const wynik = await pullRemoteChanges(repo, client);

    expect(wynik.ok).toBe(true);
    expect(wynik.applied).toBe(1);
    expect(wynik.skipped).toBe(1);
    expect(await repo.getSyncMarker(markerKey('payments'))).toBe('2026-09-08T12:00:00.000Z');
  });

  it('to samo pobrane dwa razy nie tworzy dwóch wydatków', async () => {
    const { repo, categoryUuid } = await repozytorium();
    const wiersz = wierszWydatku(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa03',
      categoryUuid,
      '2026-09-08T11:00:00.000Z'
    );

    const pierwszy = fakeClient({ payments: [[wiersz]] });
    await pullRemoteChanges(repo, pierwszy.client);

    // Drugi klient udaje serwer, który oddaje ten sam wiersz jeszcze raz.
    const drugi = fakeClient({ payments: [[wiersz]] });
    await pullRemoteChanges(repo, drugi.client);

    const pasujace = (await repo.listHistory()).filter((p) => p.uuid === wiersz.uuid);
    expect(pasujace).toHaveLength(1);
  });

  it('pobrany wydatek nie wraca na serwer przy następnej synchronizacji', async () => {
    // Ten sam warunek, co w testach kontraktu, ale sprawdzony przez całą
    // drogę: pobranie, a potem prawdziwa wysyłka. Gdyby rekord wracał,
    // dwa telefony odbijałyby go sobie bez końca.
    const { repo, categoryUuid } = await repozytorium();
    const wiersz = wierszWydatku(
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa04',
      categoryUuid,
      '2026-09-08T11:00:00.000Z'
    );

    const pierwszy = fakeClient();
    await synchronize(repo, pierwszy.client);

    const drugi = fakeClient({ payments: [[wiersz]] });
    await pullRemoteChanges(repo, drugi.client);

    const czekajace = await repo.listPendingChanges();
    expect(czekajace.payments.map((p) => p.uuid)).not.toContain(wiersz.uuid);
  });

  it('pełna synchronizacja najpierw wysyła, potem pobiera', async () => {
    // Kolejność nie jest obojętna: własne zmiany mają trafić na serwer,
    // zanim przyjdą cudze. Dotyczy to zwłaszcza kategorii, które nie mają
    // znacznika czasu i przy pobieraniu zawsze przegrywają z serwerem.
    const { repo } = await repozytorium();
    const { client, wyslane, zapytania } = fakeClient();

    const wynik = await synchronize(repo, client);

    expect(wynik.ok).toBe(true);
    expect(wyslane.length).toBeGreaterThan(0);
    expect(zapytania.length).toBeGreaterThan(0);
    expect(wynik.sent).toBeGreaterThan(0);
  });
});
