import { describeSyncError } from './sync-errors';

describe('powody nieudanej synchronizacji (Etap 14c)', () => {
  it('rozpoznaje brak tabel po kodzie Postgresa', () => {
    // To jest NAJWAŻNIEJSZY z tych powodów. Znaczy „nie uruchomiłeś jeszcze
    // pliku SQL w panelu Supabase" — czyli jedyną usterkę, której nie da się
    // naprawić z telefonu, i jedyną, po której użytkownik musi coś zrobić
    // na komputerze.
    expect(describeSyncError({ code: '42P01' })).toBe('SCHEMA_MISSING');
    expect(describeSyncError({ code: 'PGRST205' })).toBe('SCHEMA_MISSING');
  });

  it('rozpoznaje brak tabel po treści komunikatu', () => {
    // Kod bywa pusty, gdy odpowiada PostgREST, a nie sam Postgres.
    expect(describeSyncError({ message: 'relation "public.payments" does not exist' })).toBe(
      'SCHEMA_MISSING'
    );
    expect(
      describeSyncError({
        message: "Could not find the table 'public.incomes' in the schema cache",
      })
    ).toBe('SCHEMA_MISSING');
  });

  it('rozpoznaje starszą wersję schematu jako brak tabel', () => {
    // Brakująca KOLUMNA znaczy, że tabele powstały ze starszego pliku SQL.
    // Rada dla użytkownika jest ta sama: uruchom aktualny plik.
    expect(describeSyncError({ code: '42703' })).toBe('SCHEMA_MISSING');
  });

  it('rozpoznaje odbicie od reguł dostępu', () => {
    expect(describeSyncError({ code: '42501' })).toBe('PERMISSION_DENIED');
    expect(
      describeSyncError({
        message: 'new row violates row-level security policy for table "payments"',
      })
    ).toBe('PERMISSION_DENIED');
  });

  it('rozpoznaje brak internetu', () => {
    // Tak wygląda brak zasięgu w React Native: wyjątek z warstwy sieciowej,
    // bez żadnego kodu bazy, bo odpowiedź w ogóle nie powstała.
    expect(describeSyncError(new TypeError('Network request failed'))).toBe('OFFLINE');
    expect(describeSyncError({ message: 'Failed to fetch' })).toBe('OFFLINE');
    expect(describeSyncError({ message: 'Request timeout' })).toBe('OFFLINE');
  });

  it('rozpoznaje wygasłą sesję', () => {
    expect(describeSyncError({ message: 'JWT expired' })).toBe('NOT_SIGNED_IN');
  });

  it('nie zgaduje, gdy nie wie', () => {
    // Powód „nieznany" jest uczciwy. Wciśnięcie takiego błędu do jednej
    // z pozostałych szufladek dałoby użytkownikowi radę, która nie pomoże,
    // a wygląda na pewną.
    expect(describeSyncError({ message: 'coś zupełnie innego' })).toBe('UNKNOWN');
    expect(describeSyncError({})).toBe('UNKNOWN');
    expect(describeSyncError(null)).toBe('UNKNOWN');
    expect(describeSyncError(undefined)).toBe('UNKNOWN');
  });

  it('kod błędu jest ważniejszy niż treść komunikatu', () => {
    // Treść bywa tłumaczona i zmieniana między wersjami biblioteki, kod nie.
    const blad = { code: '42P01', message: 'permission denied for table payments' };

    expect(describeSyncError(blad)).toBe('SCHEMA_MISSING');
  });
});
