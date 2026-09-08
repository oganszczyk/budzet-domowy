/**
 * 5.9 + Etap 12: EKRAN ANALIZY
 *
 * Specyfikacja zostawiła ten ekran pusty do czasu osobnej specyfikacji.
 * Zakres ustalił właściciel projektu 27.08.2026 i sprowadza się do dwóch rzeczy:
 *
 *  1. Ekran NIGDY nie jest pusty — zawsze wita propozycjami zestawień
 *     dobranymi do danych, żeby nie trzeba było wiedzieć, o co zapytać.
 *  2. Propozycji jest NAJWYŻEJ TRZY. To nie jest oszczędność miejsca, tylko
 *     warunek czytelności: lista dziesięciu „ciekawostek" nie jest analizą,
 *     tylko kolejną rzeczą do przejrzenia.
 *
 * Wszystko poza tym użytkownik buduje sam — jednym przyciskiem na dole.
 *
 * Etap 13 dołożył pomiędzy nie listę ZAPISANYCH zestawień. Kolejność na
 * ekranie jest celowa: najpierw to, co aplikacja zauważyła sama, potem to,
 * o co użytkownik prosił wcześniej, a na końcu droga do nowego pytania.
 * Zapisane pokazujemy wierszami, nie kartami — trzy karty przyciągają wzrok,
 * dziesięć kart robi z ekranu listę do przewijania.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { AnalysisRangeMode, type SavedReport } from '@/domain/analysis';
import {
  rangeForSavedReport,
  useAnalysisProposals,
  useDeleteSavedReport,
  useSavedReports,
  useSubjectDictionaries,
} from '@/features/analysis/queries';
import { ProposalTone, type AnalysisProposal } from '@/features/analysis/proposals';
import {
  describeSubject,
  subjectFromKey,
  subjectKey,
  type SubjectDictionaries,
} from '@/features/analysis/subject';
import { currentYearMonth, yearMonthKey } from '@/lib/date';
import { months as monthsWord } from '@/lib/plural';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { confirm } from '@/ui/confirm';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** Kolor i ikona paska propozycji zależą od jej wymowy. */
const TONE_STYLE: Record<ProposalTone, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  [ProposalTone.ALERT]: { color: colors.statusOverdue, icon: 'trending-up-outline' },
  [ProposalTone.GOOD]: { color: colors.statusPaid, icon: 'trending-down-outline' },
  [ProposalTone.NEUTRAL]: { color: colors.primary, icon: 'stats-chart-outline' },
};

export default function AnalysisScreen() {
  const router = useRouter();
  const { proposals } = useAnalysisProposals();
  const dictionaries = useSubjectDictionaries();
  const { data: savedReportsData } = useSavedReports();
  const deleteSavedReport = useDeleteSavedReport();

  const savedReports = savedReportsData ?? [];

  const openReport = (proposal: AnalysisProposal) => {
    router.push({
      pathname: '/analysis/report',
      params: {
        subject: subjectKey(proposal.subject),
        mode: AnalysisRangeMode.CUSTOM,
        from: yearMonthKey(proposal.from),
        to: yearMonthKey(proposal.to),
      },
    });
  };

  /**
   * Zapisane zestawienie zna DŁUGOŚĆ okna, nie daty. Konkretne miesiące
   * wyliczamy dopiero tutaj, względem dzisiaj — dzięki temu zestawienie
   * założone w marcu w październiku pokazuje październik.
   */
  const openSaved = (report: SavedReport) => {
    const range = rangeForSavedReport(report, currentYearMonth());

    router.push({
      pathname: '/analysis/report',
      params: {
        subject: report.subjectKey,
        mode: report.rangeMode,
        from: yearMonthKey(range.from),
        to: yearMonthKey(range.to),
      },
    });
  };

  const handleDelete = async (report: SavedReport) => {
    const confirmed = await confirm({
      title: strings.analysis.deleteTitle,
      message: strings.analysis.deleteMessage,
      confirmLabel: strings.analysis.deleteAction,
      destructive: true,
    });

    if (confirmed) await deleteSavedReport.mutateAsync(report.id);
  };

  return (
    <Screen>
      <Text style={styles.title}>{strings.analysis.title}</Text>

      <Text style={styles.sectionLabel}>{strings.analysis.proposalsLabel}</Text>

      <View style={styles.cards}>
        {proposals.map((proposal) => {
          const tone = TONE_STYLE[proposal.tone];

          return (
            <Card
              key={proposal.key}
              onPress={() => openReport(proposal)}
              accessibilityLabel={describeSubject(proposal.subject, dictionaries)}
            >
              <View style={styles.proposalRow}>
                <View style={[styles.iconBox, { backgroundColor: `${tone.color}1A` }]}>
                  <Ionicons name={tone.icon} size={20} color={tone.color} />
                </View>

                <View style={styles.proposalText}>
                  <Text style={styles.proposalTitle}>
                    {describeSubject(proposal.subject, dictionaries)}
                  </Text>
                  <Text style={styles.proposalReason}>{proposal.reason}</Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          );
        })}
      </View>

      {savedReports.length > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{strings.analysis.savedLabel}</Text>

          <Card style={styles.savedCard}>
            {savedReports.map((report, index) => (
              <SavedReportRow
                key={report.id}
                report={report}
                dictionaries={dictionaries}
                isLast={index === savedReports.length - 1}
                onOpen={() => openSaved(report)}
                onDelete={() => handleDelete(report)}
              />
            ))}
          </Card>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>{strings.analysis.ownLabel}</Text>

      <Button
        label={strings.analysis.buildOwn}
        icon="options-outline"
        variant="secondary"
        onPress={() => router.push('/analysis/report')}
      />
    </Screen>
  );
}

/**
 * Jeden wiersz listy zapisanych zestawień.
 *
 * Celowo WIERSZ, a nie karta jak przy propozycjach. Propozycje są trzy i mają
 * przyciągać wzrok; zapisanych może z czasem być dziesięć i mają się mieścić
 * na ekranie, który nie ma być listą do przewijania.
 */
function SavedReportRow({
  report,
  dictionaries,
  isLast,
  onOpen,
  onDelete,
}: {
  report: SavedReport;
  dictionaries: SubjectDictionaries;
  isLast: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const subject = subjectFromKey(report.subjectKey);
  const subjectName = subject
    ? describeSubject(subject, dictionaries)
    : strings.analysis.subjectUnknown;

  const rangeText =
    report.rangeMode === AnalysisRangeMode.YEAR_OVER_YEAR
      ? strings.analysis.savedYearOverYear
      : strings.analysis.savedWindow(
          report.windowMonths ?? 0,
          monthsWord(report.windowMonths ?? 0)
        );

  return (
    <View style={[styles.savedRow, isLast && styles.savedRowLast]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={report.name}
        style={({ pressed }) => [styles.savedMain, pressed && styles.pressed]}
      >
        <Text style={styles.savedName} numberOfLines={1}>
          {report.name}
        </Text>
        <Text style={styles.savedMeta} numberOfLines={1}>
          {subjectName} · {rangeText}
        </Text>
      </Pressable>

      <Pressable
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel={`${strings.analysis.deleteAction}: ${report.name}`}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.savedDelete, pressed && styles.pressed]}
      >
        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.text,
  },
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  cards: {
    gap: spacing.md,
  },
  proposalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proposalText: {
    flex: 1,
    gap: 2,
  },
  proposalTitle: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  proposalReason: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  savedCard: {
    paddingVertical: spacing.xs,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  savedRowLast: {
    borderBottomWidth: 0,
  },
  savedMain: {
    flex: 1,
    gap: 2,
  },
  savedName: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
  },
  savedMeta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  savedDelete: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
