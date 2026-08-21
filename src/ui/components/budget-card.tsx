/**
 * Etap 11: karta budżetu z wykresem pierścieniowym.
 *
 * Odpowiada na jedno pytanie: ile jeszcze mogę wydać w tym miesiącu.
 * Kwota w środku pierścienia jest najważniejszą liczbą na ekranie głównym,
 * dlatego to ona zajmuje środek, a nie żaden nagłówek.
 *
 * Karta ma trzy stany i każdy pokazuje coś innego:
 *
 *  1. Bez wpisanych dochodów — nie da się powiedzieć „ile zostało", więc
 *     w środku stoi suma wydatków, a pod spodem zaproszenie do wpisania
 *     zarobków. Zmyślanie budżetu byłoby gorsze niż jego brak.
 *  2. W budżecie — kwota „zostało" na zielono, pierścień pokazuje wydatki
 *     i szarą resztę.
 *  3. Po przekroczeniu — kwota na czerwono z podpisem „ponad budżet",
 *     pierścień w całości wypełniony wydatkami.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { budgetSlices, BudgetSliceKey, type MonthlyBudget } from '@/features/budget/monthly-budget';
import { formatGrosze } from '@/lib/money';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { DonutChart, type DonutSegment } from '@/ui/components/donut-chart';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** Kolory wycinków — te same, co karty kategorii głównych na ekranie głównym. */
const SLICE_COLORS: Record<BudgetSliceKey, string> = {
  BILLS: colors.bills,
  SUBSCRIPTIONS: colors.subscriptions,
  PURCHASES: colors.purchases,
  REMAINING: colors.remaining,
};

type BudgetCardProps = {
  budget: MonthlyBudget;
  /** Otwiera ekran dochodów. */
  onPressIncome: () => void;
};

export function BudgetCard({ budget, onPressIncome }: BudgetCardProps) {
  const slices = budgetSlices(budget);

  const segments: DonutSegment[] = slices.map((slice) => ({
    key: slice.key,
    fraction: slice.fraction,
    color: SLICE_COLORS[slice.key],
  }));

  // Bez dochodu nie ma czego odejmować — w środku pokazujemy sumę wydatków.
  const centerAmount = budget.hasIncome ? budget.remainingGrosze : budget.spentGrosze;
  const centerLabel = budget.hasIncome
    ? budget.isOverspent
      ? strings.budget.overspent
      : strings.budget.remaining
    : strings.budget.spentCenter;

  const centerColor = budget.hasIncome && budget.isOverspent ? colors.overspent : colors.text;

  return (
    <Card style={styles.card}>
      <DonutChart
        segments={segments}
        accessibilityLabel={`${centerLabel}: ${formatGrosze(centerAmount)}`}
      >
        <Text style={[styles.centerAmount, { color: centerColor }]} numberOfLines={1}>
          {/* Przekroczenie pokazujemy bez minusa — słowo „ponad budżet"
              mówi to samo, a minus przy dużej czerwonej kwocie czyta się
              jak błąd aplikacji. */}
          {formatGrosze(Math.abs(centerAmount))}
        </Text>
        <Text style={styles.centerLabel}>{centerLabel}</Text>
      </DonutChart>

      {budget.hasIncome ? (
        <View style={styles.summary}>
          <SummaryRow
            label={strings.budget.income}
            amountGrosze={budget.incomeGrosze}
            color={colors.income}
          />
          <SummaryRow
            label={strings.budget.spent}
            amountGrosze={budget.spentGrosze}
            color={colors.text}
          />
        </View>
      ) : null}

      <View style={styles.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: SLICE_COLORS[slice.key] }]} />
            <Text style={styles.legendLabel}>{strings.budget.legend[slice.key]}</Text>
            <Text style={styles.legendAmount}>{formatGrosze(slice.amountGrosze)}</Text>
          </View>
        ))}
      </View>

      {budget.hasIncome ? (
        <Button
          label={strings.budget.editIncome}
          icon="people-outline"
          variant="secondary"
          onPress={onPressIncome}
        />
      ) : (
        <View style={styles.invitation}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.invitationText}>
            {slices.length === 0 ? strings.budget.emptyMonth : strings.budget.noIncomeHint}
          </Text>
        </View>
      )}

      {budget.hasIncome ? null : (
        <Button label={strings.budget.addIncome} icon="add-outline" onPress={onPressIncome} />
      )}
    </Card>
  );
}

/** Wiersz „Wpłynęło / Wydano" pod wykresem. */
function SummaryRow({
  label,
  amountGrosze,
  color,
}: {
  label: string;
  amountGrosze: number;
  color: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryAmount, { color }]}>{formatGrosze(amountGrosze)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  centerAmount: {
    fontSize: fontSize.amount,
    fontWeight: '800',
  },
  centerLabel: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  summary: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  summaryRow: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: fontSize.label,
    fontWeight: '700',
  },
  legend: {
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  legendLabel: {
    flex: 1,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  legendAmount: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
  },
  invitation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  invitationText: {
    flex: 1,
    fontSize: fontSize.caption,
    lineHeight: 18,
    color: colors.primary,
  },
});
