/**
 * Etap 14a: EKRAN KONTA.
 *
 * Cztery stany, każdy z inną treścią: sprawdzanie sesji, brak podłączonego
 * projektu, niezalogowany i zalogowany.
 *
 * ZASADA TEGO EKRANU: konto to jeszcze nie jest bezpieczeństwo danych.
 * Człowiek, który zobaczy „Jesteś zalogowany", w naturalny sposób pomyśli,
 * że wydatki są już gdzieś w chmurze — i przestanie robić kopie zapasowe.
 * Straciłby dane przy pierwszej awarii telefonu. Dlatego ostrzeżenie
 * o niedziałającej jeszcze synchronizacji stoi na tym ekranie ZAWSZE,
 * także po zalogowaniu, i jest napisane wprost.
 *
 * Ekran nie zna Supabase (8.1). Woła `useAuth()` i tłumaczy zwrócony powód
 * odmowy na polskie zdanie ze `strings.ts`.
 *
 * Etap 14c dokłada kartę wysyłki, widoczną wyłącznie po zalogowaniu.
 * Ostrzeżenie u dołu zmieniło wtedy treść, a nie zniknęło: wysyłanie bez
 * pobierania wygląda na całość, a nią nie jest.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { strings } from '@/constants/strings';
import { useAuth, type AuthOutcome } from '@/features/auth/auth-context';
import { usePendingSyncCount, useSynchronize } from '@/features/sync/mutations';
import { plural } from '@/lib/plural';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { confirm } from '@/ui/confirm';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** Co pokazać pod przyciskiem po ostatniej próbie. */
type Feedback =
  { kind: 'error'; message: string } | { kind: 'success'; title: string; detail: string };

export default function AccountScreen() {
  const { status, email, signIn, signUp, signOut } = useAuth();

  return (
    <>
      <Stack.Screen options={{ title: strings.account.title }} />

      <Screen>
        <Text style={styles.intro}>{strings.account.intro}</Text>

        {status === 'loading' && <LoadingCard />}
        {status === 'unavailable' && <UnavailableCard />}
        {status === 'signedOut' && <SignedOutCard onSignIn={signIn} onSignUp={signUp} />}
        {status === 'signedIn' && <SignedInCard email={email} onSignOut={signOut} />}
        {status === 'signedIn' && <SyncCard />}

        {/*
          Ostrzeżenie stoi POZA kartami, więc widać je w każdym stanie —
          również po zalogowaniu, gdzie jest najbardziej potrzebne.
        */}
        <View style={styles.warning}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.statusWaiting} />
          <Text style={styles.warningText}>{strings.account.cloudWarning}</Text>
        </View>
      </Screen>
    </>
  );
}

function LoadingCard() {
  return (
    <Card style={styles.centeredCard}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.sectionDescription}>{strings.account.loading}</Text>
    </Card>
  );
}

function UnavailableCard() {
  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>{strings.account.unavailableTitle}</Text>
      <Text style={styles.sectionDescription}>{strings.account.unavailableMessage}</Text>
    </Card>
  );
}

type SignedOutCardProps = {
  onSignIn: (email: string, password: string) => Promise<AuthOutcome>;
  onSignUp: (email: string, password: string) => Promise<AuthOutcome>;
};

function SignedOutCard({ onSignIn, onSignUp }: SignedOutCardProps) {
  /**
   * JEDEN FORMULARZ, DWA TRYBY.
   *
   * Logowanie i rejestracja mają identyczne pola, więc dwa osobne ekrany
   * byłyby powtórzeniem tego samego kodu. Przełącznik zachowuje wpisany
   * adres — człowiek, który pomylił tryb, nie wpisuje go po raz drugi.
   */
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const isSignUp = mode === 'signUp';

  const handleSubmit = async () => {
    setBusy(true);
    setFeedback(null);

    try {
      const result = isSignUp ? await onSignUp(email, password) : await onSignIn(email, password);

      if (!result.ok) {
        setFeedback({ kind: 'error', message: strings.account.error[result.reason] });
        return;
      }

      if (result.needsConfirmation) {
        // Hasło znika z pamięci ekranu — potwierdzenie wymaga wyjścia
        // do poczty, a po powrocie i tak trzeba się zalogować od nowa.
        setPassword('');
        setMode('signIn');
        setFeedback({
          kind: 'success',
          title: strings.account.confirmationSentTitle,
          detail: strings.account.confirmationSentMessage,
        });
      }

      // Przy powodzeniu bez potwierdzania nie ustawiamy nic: `useAuth`
      // przełączy stan na „zalogowany" i ta karta zniknie z ekranu.
    } finally {
      setBusy(false);
    }
  };

  const submitLabel = isSignUp
    ? busy
      ? strings.account.signUpWorking
      : strings.account.signUpButton
    : busy
      ? strings.account.signInWorking
      : strings.account.signInButton;

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>
        {isSignUp ? strings.account.signUpTitle : strings.account.signInTitle}
      </Text>

      <View style={styles.field}>
        <Text style={styles.label}>{strings.account.emailLabel}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={strings.account.emailPlaceholder}
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          inputMode="email"
          // Bez tego Android podstawia wielką literę na początku adresu,
          // a serwer odrzuca logowanie bez wyjaśnienia przyczyny.
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          accessibilityLabel={strings.account.emailLabel}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{strings.account.passwordLabel}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={isSignUp ? strings.account.passwordPlaceholder : undefined}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          accessibilityLabel={strings.account.passwordLabel}
          style={styles.input}
        />
      </View>

      {isSignUp && <Text style={styles.hint}>{strings.account.passwordHint}</Text>}

      <Button
        label={submitLabel}
        icon={isSignUp ? 'person-add-outline' : 'log-in-outline'}
        onPress={handleSubmit}
        loading={busy}
      />

      <Button
        label={isSignUp ? strings.account.switchToSignIn : strings.account.switchToSignUp}
        variant="secondary"
        onPress={() => {
          setMode(isSignUp ? 'signIn' : 'signUp');
          setFeedback(null);
        }}
        disabled={busy}
      />

      <FeedbackBox feedback={feedback} />
    </Card>
  );
}

type SignedInCardProps = {
  email: string | null;
  onSignOut: () => Promise<void>;
};

function SignedInCard({ email, onSignOut }: SignedInCardProps) {
  const [busy, setBusy] = useState(false);

  const handleSignOut = async () => {
    // 5.8: potwierdzenie przed operacją, którą da się cofnąć wyłącznie hasłem.
    const confirmed = await confirm({
      title: strings.account.signOutConfirmTitle,
      message: strings.account.signOutConfirmMessage,
      confirmLabel: strings.account.signOutConfirmButton,
      destructive: true,
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await onSignOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.section}>
      <View style={styles.signedInHeader}>
        <Ionicons name="checkmark-circle-outline" size={20} color={colors.statusPaid} />
        <Text style={styles.sectionTitle}>{strings.account.signedInTitle}</Text>
      </View>

      <View>
        <Text style={styles.label}>{strings.account.signedInAs}</Text>
        <Text style={styles.email}>{email}</Text>
      </View>

      <Button
        label={strings.account.signOutButton}
        icon="log-out-outline"
        variant="danger"
        onPress={handleSignOut}
        loading={busy}
      />
    </Card>
  );
}

/**
 * Etapy 14c i 14d: synchronizacja.
 *
 * DLACZEGO OBOK PRZYCISKU STOI LICZBA
 *
 * Sam „Synchronizuj" jest ślepy w obie strony: przed naciśnięciem nie wiadomo,
 * czy jest co wysyłać, a po naciśnięciu — czy cokolwiek się stało. Licznik
 * odpowiada na oba pytania jedną liczbą, bez żadnego okna dialogowego.
 *
 * DLACZEGO WYNIK MA CZTERY LINIE, A NIE JEDNĄ
 *
 * „Gotowe" wystarczyłoby, gdyby synchronizacja mogła skończyć się tylko
 * powodzeniem albo porażką. Ona ma stany pośrednie, które użytkownik MUSI
 * zobaczyć: coś zostało nadpisane nowszą wersją z drugiego telefonu (jego
 * poprawka przepadła), coś zostało pominięte (tego wydatku nie ma i nie
 * będzie, dopóki nie spróbuje ponownie). Zwinięte w jedno słowo, obie te
 * rzeczy wyglądałyby jak pełny sukces.
 */
function SyncCard() {
  const pending = usePendingSyncCount();
  const sync = useSynchronize();

  const czeka = pending.data ?? 0;
  const wynik = sync.data;

  return (
    <Card style={styles.section}>
      <View style={styles.signedInHeader}>
        <Ionicons name="sync-outline" size={20} color={colors.primary} />
        <Text style={styles.sectionTitle}>{strings.account.sync.title}</Text>
      </View>

      <Text style={styles.sectionDescription}>
        {czeka === 0
          ? strings.account.sync.upToDate
          : `${czeka} ${plural(czeka, strings.account.sync.pending)}`}
      </Text>

      <Button
        label={sync.isPending ? strings.account.sync.working : strings.account.sync.button}
        icon="sync-outline"
        onPress={() => sync.mutate()}
        loading={sync.isPending}
      />

      <SyncResult outcome={wynik} />
    </Card>
  );
}

/** Zdania opisujące wynik — tyle, ile naprawdę się wydarzyło. */
function podsumowanie(outcome: NonNullable<ReturnType<typeof useSynchronize>['data']>): string[] {
  const { sent, applied, overwritten, skipped } = outcome;
  const forma = (ile: number) => plural(ile, strings.account.sync.records);
  const linie: string[] = [];

  if (sent > 0) linie.push(strings.account.sync.sent(sent, forma(sent)));
  if (applied > 0) linie.push(strings.account.sync.received(applied, forma(applied)));
  if (overwritten > 0) {
    linie.push(strings.account.sync.overwritten(overwritten, forma(overwritten)));
  }
  if (skipped > 0) linie.push(strings.account.sync.skipped(skipped, forma(skipped)));

  if (linie.length === 0) linie.push(strings.account.sync.nothingToDo);

  return linie;
}

function SyncResult({ outcome }: { outcome: ReturnType<typeof useSynchronize>['data'] }) {
  if (!outcome) return null;

  const linie = podsumowanie(outcome);

  if (outcome.ok) {
    return (
      <View style={[styles.feedback, styles.feedbackSuccess]}>
        <Ionicons name="checkmark-circle-outline" size={18} color={colors.statusPaid} />
        <View style={styles.feedbackTexts}>
          {linie.map((linia, index) => (
            <Text
              key={linia}
              style={
                index === 0
                  ? [styles.feedbackText, styles.feedbackSuccessText]
                  : styles.feedbackDetail
              }
            >
              {linia}
            </Text>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.feedback, styles.feedbackError]}>
      <Ionicons name="close-circle-outline" size={18} color={colors.statusOverdue} />
      <View style={styles.feedbackTexts}>
        <Text style={[styles.feedbackText, styles.feedbackErrorText]}>
          {outcome.reason
            ? strings.account.sync.error[outcome.reason]
            : strings.account.sync.error.UNKNOWN}
        </Text>
        {/*
          Po niepowodzeniu pokazujemy, ile zdążyło przejść w obie strony.
          Bez tego „nie udało się" kazałoby sądzić, że wszystko trzeba
          zaczynać od zera — a przy słabym łączu zniechęcałoby do kolejnych
          prób akurat wtedy, gdy są najbardziej potrzebne.
        */}
        {(outcome.sent > 0 || outcome.applied > 0) &&
          linie.map((linia) => (
            <Text key={linia} style={styles.feedbackDetail}>
              {linia}
            </Text>
          ))}
      </View>
    </View>
  );
}

function FeedbackBox({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null;

  if (feedback.kind === 'error') {
    return (
      <View style={[styles.feedback, styles.feedbackError]}>
        <Ionicons name="close-circle-outline" size={18} color={colors.statusOverdue} />
        <Text style={[styles.feedbackText, styles.feedbackErrorText]}>{feedback.message}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.feedback, styles.feedbackSuccess]}>
      <Ionicons name="mail-outline" size={18} color={colors.statusPaid} />
      <View style={styles.feedbackTexts}>
        <Text style={[styles.feedbackText, styles.feedbackSuccessText]}>{feedback.title}</Text>
        <Text style={styles.feedbackDetail}>{feedback.detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontSize: fontSize.body,
    lineHeight: 22,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  centeredCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.text,
  },
  sectionDescription: {
    fontSize: fontSize.body,
    lineHeight: 21,
    color: colors.textMuted,
  },
  signedInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  email: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.caption,
    lineHeight: 18,
    color: colors.textMuted,
  },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  feedbackTexts: {
    flex: 1,
    gap: spacing.xs,
  },
  feedbackSuccess: {
    backgroundColor: colors.statusPaidSoft,
  },
  feedbackError: {
    backgroundColor: colors.statusOverdueSoft,
  },
  feedbackText: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  feedbackSuccessText: {
    color: colors.statusPaid,
  },
  feedbackErrorText: {
    color: colors.statusOverdue,
  },
  feedbackDetail: {
    fontSize: fontSize.caption,
    lineHeight: 18,
    color: colors.textMuted,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.statusWaitingSoft,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.caption,
    lineHeight: 18,
    color: colors.statusWaiting,
  },
});
