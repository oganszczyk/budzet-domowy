/**
 * Etap 14a: POWODY, DLA KTÓRYCH LOGOWANIE SIĘ NIE UDAJE.
 *
 * Supabase odpowiada po angielsku i kodami przeznaczonymi dla programisty
 * („invalid_credentials", „over_email_send_rate_limit"). Ekran nie ma prawa
 * ich pokazywać — 8.1 mówi, że ekran nie zna warstwy niższej, a 6.2 wymaga
 * komunikatu, który mówi użytkownikowi, CO ZROBIĆ.
 *
 * Ten plik zamienia odpowiedź serwera na jeden z powodów poniżej. Polskie
 * zdania siedzą w `strings.ts`, jak wszystkie inne teksty (1.2).
 *
 * Sprawdzanie danych PRZED wysłaniem jest tu celowo w tym samym miejscu:
 * dla użytkownika „hasło za krótkie" i „hasło nieprawidłowe" to ten sam
 * rodzaj odpowiedzi, niezależnie od tego, kto ją wystawił.
 */

export type AuthFailureReason =
  /** Zły adres albo złe hasło. Serwer celowo nie mówi, które z dwojga. */
  | 'INVALID_CREDENTIALS'
  /** Konto istnieje, ale nikt nie kliknął w link potwierdzający. */
  | 'EMAIL_NOT_CONFIRMED'
  /** Rejestracja na adres, który jest już zajęty. */
  | 'USER_EXISTS'
  /** Hasło nie spełnia wymagań. */
  | 'WEAK_PASSWORD'
  /** Adres nie wygląda na adres e-mail. */
  | 'INVALID_EMAIL'
  /** Pusty adres albo puste hasło. */
  | 'EMPTY_FIELD'
  /** Za dużo prób pod rząd — Supabase chroni się przed zgadywaniem haseł. */
  | 'RATE_LIMITED'
  /** Telefon nie ma połączenia albo projekt Supabase śpi. */
  | 'NO_NETWORK'
  /** Aplikacja zbudowana bez pliku `.env`. */
  | 'NOT_CONFIGURED'
  /** Wszystko inne — komunikat mówi wprost, że nie wiemy. */
  | 'UNKNOWN';

/** Najkrótsze hasło, jakie przyjmujemy przy zakładaniu konta. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Sprawdzenie adresu jest CELOWO pobłażliwe.
 *
 * Wyrażenie regularne dopasowane do pełnej normy adresów e-mail jest długie
 * na kilkaset znaków i odrzuca adresy, które istnieją naprawdę. Jedyne, co
 * ma tu sens, to złapanie oczywistej pomyłki — braku małpy albo kropki —
 * zanim pojedzie zapytanie do serwera. Prawdziwym sprawdzianem poprawności
 * adresu jest to, czy dotrze pod niego list potwierdzający.
 */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Co zrobić z danymi z formularza, zanim ruszy zapytanie do serwera. */
export type CredentialsCheck = { ok: true } | { ok: false; reason: AuthFailureReason };

/**
 * Sprawdza dane logowania bez sięgania do sieci.
 *
 * `requirePasswordLength` jest włączane WYŁĄCZNIE przy zakładaniu konta.
 * Przy logowaniu byłoby szkodliwe: gdyby kiedyś zmieniły się wymagania,
 * aplikacja odmawiałaby wpuszczenia człowieka, który ma poprawne, choć
 * krótsze hasło — i nie dałaby mu żadnej drogi wyjścia.
 */
export function checkCredentials(
  email: string,
  password: string,
  requirePasswordLength: boolean
): CredentialsCheck {
  if (email.trim() === '' || password === '') {
    return { ok: false, reason: 'EMPTY_FIELD' };
  }

  if (!LOOKS_LIKE_EMAIL.test(email.trim())) {
    return { ok: false, reason: 'INVALID_EMAIL' };
  }

  if (requirePasswordLength && password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: 'WEAK_PASSWORD' };
  }

  return { ok: true };
}

/** Kształt błędu Supabase, na tyle, na ile nas obchodzi. */
type ErrorLike = {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
};

function textOf(value: unknown): string {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

/**
 * Tłumaczy błąd z Supabase na powód zrozumiały dla ekranu.
 *
 * Patrzymy najpierw na `code`, bo jest stały. Treść komunikatu sprawdzamy
 * dopiero na końcu i tylko jako zabezpieczenie — Supabase potrafi ją zmienić
 * między wersjami, a wtedy dopasowanie po tekście przestaje działać po cichu.
 */
export function describeAuthError(error: unknown): AuthFailureReason {
  if (error === null || typeof error !== 'object') return 'UNKNOWN';

  const { code, status, name, message } = error as ErrorLike;
  const codeText = textOf(code);
  const nameText = textOf(name);
  const messageText = textOf(message);

  switch (codeText) {
    case 'invalid_credentials':
      return 'INVALID_CREDENTIALS';
    case 'email_not_confirmed':
      return 'EMAIL_NOT_CONFIRMED';
    case 'user_already_exists':
    case 'email_exists':
      return 'USER_EXISTS';
    case 'weak_password':
      return 'WEAK_PASSWORD';
    case 'validation_failed':
      return 'INVALID_EMAIL';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'RATE_LIMITED';
  }

  // Brak odpowiedzi z serwera. `status: 0` oznacza, że zapytanie w ogóle
  // nie doszło — telefon jest offline albo projekt Supabase śpi po tygodniu
  // bezczynności na darmowym planie.
  if (nameText === 'authretryablefetcherror' || status === 0) return 'NO_NETWORK';
  if (messageText.includes('network request failed') || messageText.includes('fetch failed')) {
    return 'NO_NETWORK';
  }

  if (status === 429) return 'RATE_LIMITED';

  return 'UNKNOWN';
}
