import type { SupabaseClient } from '@supabase/supabase-js';

import { InMemoryExpensesRepository } from '@/data/in-memory-repository';
import type { ExpensesRepository } from '@/data/repository';
import { MainType, PaymentSource } from '@/domain/enums';
import { currentYearMonth, dueDateFor } from '@/lib/date';

import { countPendingChanges, pushPendingChanges } from './sync-service';

const USER = '11111111-2222-3333-4444-555555555555';
const THIS_MONTH = currentYearMonth();

/** Zapis jednego wywołania `upsert` — tyle testom wystarczy. */
type Wyslane = { table: string; rows: Record<string, unknown>[]; onConflict?: string };

/**
 * Podstawiony klient Supabase.
 *
 * Prawdziwy wymaga sieci, konta i uruchomionego schematu na serwerze —
 * czyli trzech rzeczy, których w teście jednostkowym nie ma. Ten zapisuje,
 * co dostał, i na żądanie udaje awarię.
 *
 * Dzięki temu sprawdzalne jest to, co w tej warstwie najłatwiej zepsuć:
 * KOLEJNOŚĆ wysyłki i to, czy znacznik „do wysłania" gaśnie we właściwym
 * momencie. Obie te rzeczy milczą, gdy są zrobione źle.
 */
function fakeClient(options: { failOn?: string; user?: string | null } = {}) {
  const wyslane: Wyslane[] = [];

  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.user === null ? null : { id: options.user ?? USER } },
        error: null,
      }),
    },
    from(table: string) {
      return {
        async upsert(rows: Record<string, unknown>[], opts?: { onConflict?: string }) {
          if (options.failOn === table) {
            return { error: { code: '42P01', message: 'relation does not exist' } };
          }
          wyslane.push({ table, rows, onConflict: opts?.onConflict });
          return { error: null };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseClient, wyslane };
}

async function repozytoriumZWydatkiem(): Promise<ExpensesRepository> {
  const repo = new InMemoryExpensesRepository();
  const [category] = await repo.listCategories(MainType.PURCHASE);

  await repo.createPayment({
    mainType: MainType.PURCHASE,
    categoryId: category.id,
    title: 'Lidl',
    amountGrosze: 12550,
    effectiveDate: dueDateFor(THIS_MONTH, 5),
    dueDate: null,
    paidDate: null,
    status: null,
    source: PaymentSource.MANUAL,
    merchant: 'Lidl',
    description: null,
    paymentMethod: null,
    billTemplateId: null,
    subscriptionId: null,
    receiptImagePath: null,
  });

  return repo;
}

describe('wysyłka zmian na serwer (Etap 14c)', () => {
  it('odmawia bez podłączonego projektu', async () => {
    const repo = new InMemoryExpensesRepository();

    const wynik = await pushPendingChanges(repo, null);

    expect(wynik).toEqual({ ok: false, reason: 'NOT_CONFIGURED', sent: 0 });
  });

  it('odmawia, gdy nikt nie jest zalogowany', async () => {
    // Bez konta serwer nie wie, czyje to dane, a reguły RLS i tak by je
    // odrzuciły. Lepiej powiedzieć to od razu niż po nieudanym żądaniu.
    const repo = new InMemoryExpensesRepository();
    const { client } = fakeClient({ user: null });

    const wynik = await pushPendingChanges(repo, client);

    expect(wynik).toEqual({ ok: false, reason: 'NOT_SIGNED_IN', sent: 0 });
  });

  it('wysyła tabele w kolejności zależności', async () => {
    const repo = await repozytoriumZWydatkiem();
    const { client, wyslane } = fakeClient();

    const wynik = await pushPendingChanges(repo, client);

    expect(wynik.ok).toBe(true);

    const kolejnosc = wyslane.map((w) => w.table);
    expect(kolejnosc.indexOf('categories')).toBeGreaterThanOrEqual(0);
    expect(kolejnosc.indexOf('categories')).toBeLessThan(kolejnosc.indexOf('payments'));
  });

  it('podaje serwerowi, po czym rozpoznać ten sam rekord', async () => {
    // Bez `onConflict` powtórna wysyłka nie poprawiłaby rekordu, tylko
    // odbiła się od klucza głównego — i synchronizacja stanęłaby na dobre.
    const repo = await repozytoriumZWydatkiem();
    const { client, wyslane } = fakeClient();

    await pushPendingChanges(repo, client);

    for (const paczka of wyslane) {
      const oczekiwane =
        paczka.table === 'deleted_records' ? 'user_id,entity_type,uuid' : 'user_id,uuid';
      expect(paczka.onConflict).toBe(oczekiwane);
    }
  });

  it('po udanej wysyłce nie ma już nic do wysłania', async () => {
    const repo = await repozytoriumZWydatkiem();
    const { client } = fakeClient();

    expect(await countPendingChanges(repo)).toBeGreaterThan(0);
    await pushPendingChanges(repo, client);

    expect(await countPendingChanges(repo)).toBe(0);
  });

  it('druga wysyłka bez zmian nie wysyła niczego', async () => {
    const repo = await repozytoriumZWydatkiem();
    const { client, wyslane } = fakeClient();

    await pushPendingChanges(repo, client);
    const poPierwszej = wyslane.length;
    const wynik = await pushPendingChanges(repo, client);

    expect(wynik).toEqual({ ok: true, sent: 0 });
    expect(wyslane.length).toBe(poPierwszej);
  });

  it('poprawiony wydatek jedzie ponownie', async () => {
    const repo = await repozytoriumZWydatkiem();
    const { client } = fakeClient();
    await pushPendingChanges(repo, client);

    const [payment] = await repo.listHistory();
    await repo.updatePayment(payment.id, { amountGrosze: 9900 });

    expect(await countPendingChanges(repo)).toBe(1);
  });

  it('skasowany wydatek jedzie jako osobna zmiana', async () => {
    const repo = await repozytoriumZWydatkiem();
    const { client, wyslane } = fakeClient();
    await pushPendingChanges(repo, client);

    const [payment] = await repo.listHistory();
    await repo.deletePayment(payment.id);
    await pushPendingChanges(repo, client);

    const nagrobki = wyslane.filter((w) => w.table === 'deleted_records');
    expect(nagrobki).toHaveLength(1);
    expect(nagrobki[0].rows[0]).toMatchObject({
      user_id: USER,
      entity_type: 'PAYMENT',
      uuid: payment.uuid,
    });
  });

  it('nieudana wysyłka zachowuje to, co już dojechało', async () => {
    // Przy słabym zasięgu wysyłka bywa przerwana w połowie. Gdyby przerwanie
    // unieważniało całą partię, użytkownik z kiepskim łączem nigdy nie
    // doszedłby do końca — każda próba zaczynałaby od zera.
    const repo = await repozytoriumZWydatkiem();
    const { client } = fakeClient({ failOn: 'payments' });

    const przed = await countPendingChanges(repo);
    const wynik = await pushPendingChanges(repo, client);

    expect(wynik.ok).toBe(false);
    if (wynik.ok) return;

    expect(wynik.reason).toBe('SCHEMA_MISSING');
    // Kategorie dojechały przed awarią i nie wrócą do kolejki.
    expect(await countPendingChanges(repo)).toBeLessThan(przed);
  });

  it('rekord, który nie dojechał, zostaje w kolejce', async () => {
    // To jest ta połowa, która MUSI zostać. Zgaszony znacznik przy nieudanej
    // wysyłce znaczy „ten rekord jest już w chmurze" — a nie jest, i nic go
    // tam nigdy nie wyśle.
    const repo = await repozytoriumZWydatkiem();
    const { client } = fakeClient({ failOn: 'payments' });

    const przed = (await repo.listPendingChanges()).payments.length;
    expect(przed).toBeGreaterThan(0);

    await pushPendingChanges(repo, client);

    // Ani jeden wydatek nie został oznaczony jako wysłany, bo ani jeden
    // nie dojechał. Kategorie i szablony, które przeszły przed awarią,
    // znikną z kolejki — te nie.
    const czekajace = await repo.listPendingChanges();
    expect(czekajace.payments).toHaveLength(przed);
  });

  it('pusta aplikacja kończy wysyłkę bez jednego żądania', async () => {
    const repo = await repozytoriumZWydatkiem();
    const { client, wyslane } = fakeClient();
    await pushPendingChanges(repo, client);
    wyslane.length = 0;

    const wynik = await pushPendingChanges(repo, client);

    expect(wynik).toEqual({ ok: true, sent: 0 });
    expect(wyslane).toEqual([]);
  });
});
