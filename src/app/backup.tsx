/**
 * Etap 10: EKRAN KOPII ZAPASOWEJ
 *
 * Dwie operacje: zapisanie kopii i odtworzenie jej. Ekran nie zna ani bazy,
 * ani formatu pliku — woła haki z `@/features/backup` i tłumaczy ich wynik
 * na polski komunikat (8.1).
 *
 * ZASADA TEGO EKRANU: nigdy nie zostawiaj użytkownika w niepewności, czy
 * coś się stało. Kopia zapasowa jest funkcją, której skuteczności nie da się
 * sprawdzić w momencie użycia — dowiadujemy się o niej dopiero wtedy, gdy
 * jest potrzebna, czyli po utracie danych. Dlatego po każdej operacji
 * pokazujemy KONKRETNIE, co się wydarzyło i ile rekordów objęło.
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import type { BackupCounts } from '@/domain/backup';
import { useCreateBackup, useRestoreBackup } from '@/features/backup/mutations';
import { formatDate } from '@/lib/date';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { confirm } from '@/ui/confirm';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** Komunikat pod przyciskiem: udany wynik albo powód odmowy. */
type Feedback =
  | { kind: 'success'; title: string; detail?: string; counts?: BackupCounts }
  | { kind: 'error'; message: string };

export default function BackupScreen() {
  const createBackup = useCreateBackup();
  const restoreBackup = useRestoreBackup();

  const [createFeedback, setCreateFeedback] = useState<Feedback | null>(null);
  const [restoreFeedback, setRestoreFeedback] = useState<Feedback | null>(null);

  const handleCreate = async () => {
    setCreateFeedback(null);
    const result = await createBackup.mutateAsync();

    if (!result.ok) {
      setCreateFeedback({ kind: 'error', message: strings.backup.error[result.reason] });
      return;
    }

    setCreateFeedback({
      kind: 'success',
      title: strings.backup.createDone,
      detail: result.fileName,
      counts: result.counts,
    });
  };

  const handleRestore = async () => {
    setRestoreFeedback(null);

    // 5.8: potwierdzenie PRZED operacją nieodwracalną. Tu jest ono ważniejsze
    // niż przy usuwaniu pojedynczej płatności — kasujemy całą zawartość.
    const confirmed = await confirm({
      title: strings.backup.restoreConfirmTitle,
      message: strings.backup.restoreConfirmMessage,
      confirmLabel: strings.backup.restoreConfirmButton,
      destructive: true,
    });
    if (!confirmed) return;

    const result = await restoreBackup.mutateAsync();

    if (!result.ok) {
      // Zamknięcie okna wyboru pliku to decyzja użytkownika, nie awaria —
      // komunikat o błędzie byłby tu myleniem go bez powodu.
      if (result.reason === 'CANCELLED') return;
      setRestoreFeedback({ kind: 'error', message: strings.backup.error[result.reason] });
      return;
    }

    setRestoreFeedback({
      kind: 'success',
      title: strings.backup.restoreDone,
      detail: `${strings.backup.restoreDoneFrom} ${formatDate(result.createdAt.slice(0, 10))}`,
      counts: result.counts,
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: strings.backup.title }} />

      <Screen>
        <Text style={styles.intro}>{strings.backup.intro}</Text>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.backup.createTitle}</Text>
          <Text style={styles.sectionDescription}>{strings.backup.createDescription}</Text>

          <Button
            label={
              createBackup.isPending ? strings.backup.createWorking : strings.backup.createButton
            }
            icon="share-outline"
            onPress={handleCreate}
            loading={createBackup.isPending}
            disabled={restoreBackup.isPending}
          />

          <FeedbackBox feedback={createFeedback} hint={strings.backup.createDoneHint} />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.backup.restoreTitle}</Text>
          <Text style={styles.sectionDescription}>{strings.backup.restoreDescription}</Text>

          <Button
            label={
              restoreBackup.isPending ? strings.backup.restoreWorking : strings.backup.restoreButton
            }
            icon="download-outline"
            variant="secondary"
            onPress={handleRestore}
            loading={restoreBackup.isPending}
            disabled={createBackup.isPending}
          />

          <FeedbackBox feedback={restoreFeedback} />
        </Card>

        <View style={styles.warning}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.statusWaiting} />
          <Text style={styles.warningText}>{strings.backup.warning}</Text>
        </View>
      </Screen>
    </>
  );
}

/** Wynik ostatniej operacji: co się udało i czego dotyczyło, albo co poszło nie tak. */
function FeedbackBox({ feedback, hint }: { feedback: Feedback | null; hint?: string }) {
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
      <Ionicons name="checkmark-circle-outline" size={18} color={colors.statusPaid} />

      <View style={styles.feedbackTexts}>
        <Text style={[styles.feedbackText, styles.feedbackSuccessText]}>{feedback.title}</Text>

        {feedback.detail && <Text style={styles.feedbackDetail}>{feedback.detail}</Text>}

        {feedback.counts && <CountsList counts={feedback.counts} />}

        {hint && <Text style={styles.feedbackDetail}>{hint}</Text>}
      </View>
    </View>
  );
}

/**
 * Ile rekordów objęła operacja.
 *
 * To nie jest ozdoba: liczba płatności jest jedynym sygnałem, po którym
 * użytkownik pozna, że kopia zawiera jego dane, a nie pustą aplikację.
 */
function CountsList({ counts }: { counts: BackupCounts }) {
  const rows: [string, number][] = [
    [strings.backup.countsPayments, counts.payments],
    [strings.backup.countsBillTemplates, counts.billTemplates],
    [strings.backup.countsSubscriptions, counts.subscriptions],
    [strings.backup.countsCategories, counts.categories],
    [strings.backup.countsIncomes, counts.incomes],
  ];

  return (
    <View style={styles.counts}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.countRow}>
          <Text style={styles.countLabel}>{label}</Text>
          <Text style={styles.countValue}>{value}</Text>
        </View>
      ))}
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
  counts: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  countLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  countValue: {
    fontSize: fontSize.caption,
    fontWeight: '700',
    color: colors.text,
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
