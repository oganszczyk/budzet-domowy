import { checkCredentials, describeAuthError, MIN_PASSWORD_LENGTH } from './auth-errors';

/** Błąd w kształcie, w jakim wystawia go Supabase. */
function authError(fields: Record<string, unknown>) {
  return { name: 'AuthApiError', message: 'coś po angielsku', ...fields };
}

describe('checkCredentials', () => {
  const LONG_ENOUGH = 'a'.repeat(MIN_PASSWORD_LENGTH);

  it('poprawne dane przechodzą', () => {
    expect(checkCredentials('ola@example.com', LONG_ENOUGH, true)).toEqual({ ok: true });
  });

  it('pusty adres albo puste hasło zatrzymuje formularz przed wysłaniem', () => {
    expect(checkCredentials('', LONG_ENOUGH, true)).toEqual({ ok: false, reason: 'EMPTY_FIELD' });
    expect(checkCredentials('   ', LONG_ENOUGH, true)).toEqual({
      ok: false,
      reason: 'EMPTY_FIELD',
    });
    expect(checkCredentials('ola@example.com', '', true)).toEqual({
      ok: false,
      reason: 'EMPTY_FIELD',
    });
  });

  it('adres bez małpy albo bez kropki to pomyłka literowa', () => {
    expect(checkCredentials('ola', LONG_ENOUGH, true)).toEqual({
      ok: false,
      reason: 'INVALID_EMAIL',
    });
    expect(checkCredentials('ola@example', LONG_ENOUGH, true)).toEqual({
      ok: false,
      reason: 'INVALID_EMAIL',
    });
    expect(checkCredentials('ola @example.com', LONG_ENOUGH, true)).toEqual({
      ok: false,
      reason: 'INVALID_EMAIL',
    });
  });

  it('adres z kropką w nazwie i z plusem jest poprawny', () => {
    // Odrzucenie takiego adresu byłoby usterką — te formy istnieją naprawdę.
    expect(checkCredentials('ola.kowalska+dom@example.co.uk', LONG_ENOUGH, true)).toEqual({
      ok: true,
    });
  });

  it('przy ZAKŁADANIU KONTA za krótkie hasło jest odrzucane', () => {
    expect(checkCredentials('ola@example.com', 'a'.repeat(MIN_PASSWORD_LENGTH - 1), true)).toEqual({
      ok: false,
      reason: 'WEAK_PASSWORD',
    });
  });

  it('przy LOGOWANIU długość hasła NIE jest sprawdzana', () => {
    // Inaczej zmiana wymagań zamknęłaby drzwi komuś, kto ma poprawne hasło.
    expect(checkCredentials('ola@example.com', 'krótkie', false)).toEqual({ ok: true });
  });
});

describe('describeAuthError', () => {
  it('złe hasło', () => {
    expect(describeAuthError(authError({ code: 'invalid_credentials', status: 400 }))).toBe(
      'INVALID_CREDENTIALS'
    );
  });

  it('konto założone, ale niepotwierdzone', () => {
    expect(describeAuthError(authError({ code: 'email_not_confirmed' }))).toBe(
      'EMAIL_NOT_CONFIRMED'
    );
  });

  it('adres zajęty — oba kody, których używa Supabase', () => {
    expect(describeAuthError(authError({ code: 'user_already_exists' }))).toBe('USER_EXISTS');
    expect(describeAuthError(authError({ code: 'email_exists' }))).toBe('USER_EXISTS');
  });

  it('hasło odrzucone przez serwer', () => {
    expect(describeAuthError(authError({ code: 'weak_password' }))).toBe('WEAK_PASSWORD');
  });

  it('za dużo prób — po kodzie i po samym statusie 429', () => {
    expect(describeAuthError(authError({ code: 'over_request_rate_limit' }))).toBe('RATE_LIMITED');
    expect(describeAuthError(authError({ code: 'over_email_send_rate_limit' }))).toBe(
      'RATE_LIMITED'
    );
    expect(describeAuthError(authError({ status: 429 }))).toBe('RATE_LIMITED');
  });

  it('BRAK SIECI rozpoznajemy na trzy sposoby', () => {
    // Ten powód jest najważniejszy: na darmowym planie projekt Supabase
    // zasypia po tygodniu i pierwsza próba po przerwie wygląda jak awaria.
    expect(describeAuthError({ name: 'AuthRetryableFetchError', status: 0 })).toBe('NO_NETWORK');
    expect(describeAuthError({ status: 0 })).toBe('NO_NETWORK');
    expect(describeAuthError(new TypeError('Network request failed'))).toBe('NO_NETWORK');
  });

  it('nieznany błąd nie udaje, że wie', () => {
    expect(describeAuthError(authError({ code: 'coś_nowego' }))).toBe('UNKNOWN');
    expect(describeAuthError(null)).toBe('UNKNOWN');
    expect(describeAuthError(undefined)).toBe('UNKNOWN');
    expect(describeAuthError('tekst')).toBe('UNKNOWN');
  });

  it('kod ma pierwszeństwo przed treścią komunikatu', () => {
    // Treść komunikatu Supabase zmienia między wersjami; kod jest stały.
    const error = authError({ code: 'invalid_credentials', message: 'Network request failed' });
    expect(describeAuthError(error)).toBe('INVALID_CREDENTIALS');
  });
});
