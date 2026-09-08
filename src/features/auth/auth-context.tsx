/**
 * Etap 14a: STAN KONTA, WSPÓLNY DLA CAŁEJ APLIKACJI.
 *
 * Kontekst, a nie TanStack Query, z tego samego powodu co wybrany miesiąc:
 * to nie jest odpowiedź na pytanie zadane bazie, tylko stan, który zmienia
 * się sam. Token wygasa po godzinie i biblioteka odnawia go w tle — o takiej
 * zmianie dowiadujemy się z nasłuchu, a nie z zapytania.
 *
 * CO TEN ETAP ROBI, A CZEGO NIE
 *
 * Robi: zakładanie konta, logowanie, wylogowanie, pamiętanie sesji między
 * uruchomieniami aplikacji.
 *
 * NIE robi: niczego z danymi. Wydatki nadal leżą wyłącznie w SQLite na tym
 * telefonie i zalogowanie się niczego nie wysyła ani nie pobiera. Wysyłka
 * to Etap 14c, pobieranie 14d. Ekran konta mówi o tym wprost, żeby nikt nie
 * uznał zalogowania za wykonaną kopię danych.
 */

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { getSupabaseClient } from '@/data/supabase/client';

import { checkCredentials, describeAuthError, type AuthFailureReason } from './auth-errors';

export type AuthStatus =
  /** Sprawdzamy, czy w telefonie leży zapamiętana sesja. Trwa ułamek sekundy. */
  | 'loading'
  /** Aplikacja zbudowana bez pliku `.env` — konta w ogóle nie ma. */
  | 'unavailable'
  | 'signedOut'
  | 'signedIn';

/** Wynik próby zalogowania albo założenia konta. */
export type AuthOutcome =
  { ok: true; needsConfirmation: boolean } | { ok: false; reason: AuthFailureReason };

type AuthContextValue = {
  status: AuthStatus;
  /** Adres zalogowanego konta; `null`, gdy nikt nie jest zalogowany. */
  email: string | null;
  signIn: (email: string, password: string) => Promise<AuthOutcome>;
  signUp: (email: string, password: string) => Promise<AuthOutcome>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const NOT_CONFIGURED: AuthOutcome = { ok: false, reason: 'NOT_CONFIGURED' };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();

    if (client === null) {
      setStatus('unavailable');
      return;
    }

    let active = true;

    /**
     * Odczyt zapamiętanej sesji. Bez tego każde uruchomienie aplikacji
     * zaczynałoby się od ekranu logowania, mimo ważnego tokenu w Keychainie.
     */
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setEmail(data.session?.user.email ?? null);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });

    /**
     * Nasłuch obejmuje też odnowienie tokenu i wylogowanie wymuszone przez
     * serwer (np. po zmianie hasła na drugim telefonie). Gdybyśmy polegali
     * wyłącznie na własnych wywołaniach, aplikacja pokazywałaby „zalogowany"
     * długo po tym, jak sesja przestała działać.
     */
    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setEmail(session?.user.email ?? null);
      setStatus(session ? 'signedIn' : 'signedOut');
    });

    /**
     * ODNAWIANIE TOKENU TYLKO PRZY OTWARTEJ APLIKACJI.
     *
     * Biblioteka odnawia token cyklicznym budzikiem. Zostawiony w tle
     * budziłby telefon co godzinę po to, żeby odświeżyć token, którego nikt
     * nie potrzebuje — i zjadał baterię. Supabase udostępnia dwie metody
     * właśnie do sterowania tym z cyklu życia aplikacji.
     */
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void client.auth.startAutoRefresh();
      } else {
        void client.auth.stopAutoRefresh();
      }
    });

    if (AppState.currentState === 'active') {
      void client.auth.startAutoRefresh();
    }

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
      appStateSubscription.remove();
      void client.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = useCallback(async (rawEmail: string, password: string): Promise<AuthOutcome> => {
    const client = getSupabaseClient();
    if (client === null) return NOT_CONFIGURED;

    // Przy logowaniu NIE sprawdzamy długości hasła — patrz `auth-errors.ts`.
    const check = checkCredentials(rawEmail, password, false);
    if (!check.ok) return { ok: false, reason: check.reason };

    const { error } = await client.auth.signInWithPassword({
      email: rawEmail.trim(),
      password,
    });

    if (error) return { ok: false, reason: describeAuthError(error) };

    // Stan ustawi nasłuch `onAuthStateChange` — jedno miejsce, jedna prawda.
    return { ok: true, needsConfirmation: false };
  }, []);

  const signUp = useCallback(async (rawEmail: string, password: string): Promise<AuthOutcome> => {
    const client = getSupabaseClient();
    if (client === null) return NOT_CONFIGURED;

    const check = checkCredentials(rawEmail, password, true);
    if (!check.ok) return { ok: false, reason: check.reason };

    const { data, error } = await client.auth.signUp({ email: rawEmail.trim(), password });

    if (error) return { ok: false, reason: describeAuthError(error) };

    /**
     * ADRES JUŻ ZAJĘTY — Supabase NIE zgłasza tego błędem.
     *
     * Gdy potwierdzanie adresu jest włączone, rejestracja na zajęty adres
     * kończy się pozornym sukcesem: serwer oddaje użytkownika z PUSTĄ listą
     * tożsamości. Robi to celowo, żeby obcy nie mógł sprawdzać, kto ma tu
     * konto. Bez tego rozpoznania aplikacja mówiłaby „sprawdź pocztę",
     * a poczta nigdy by nie przyszła.
     */
    if (data.user && data.user.identities?.length === 0) {
      return { ok: false, reason: 'USER_EXISTS' };
    }

    // Brak sesji po rejestracji oznacza, że serwer czeka na kliknięcie
    // w link z listu. Z sesją — konto jest gotowe od razu.
    return { ok: true, needsConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (client === null) return;

    await client.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({ status, email, signIn, signUp, signOut }),
    [status, email, signIn, signUp, signOut]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

/** Stan konta. Działa tylko wewnątrz <AuthProvider>. */
export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useAuth() musi być użyte wewnątrz <AuthProvider>.');
  }
  return value;
}
