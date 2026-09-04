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
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { AnalysisRangeMode } from '@/domain/analysis';
import { useAnalysisProposals, useSubjectDictionaries } from '@/features/analysis/queries';
import { ProposalTone, type AnalysisProposal } from '@/features/analysis/proposals';
import { describeSubject, subjectKey } from '@/features/analysis/subject';
import { yearMonthKey } from '@/lib/date';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
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
});
