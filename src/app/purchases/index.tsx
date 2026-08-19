/**
 * 5.4: WYDATKI I ZAKUPY — widok szczegółów kategorii
 *
 *  [x] Wyświetlić łączną sumę zakupów z wybranego miesiąca.
 *  [x] Wyświetlić każdą podkategorię z jej dokładną miesięczną sumą.
 *  [x] Kliknięcie podkategorii otwiera listę przypisanych zakupów.
 *  [x] Udostępnić dwa główne przyciski: „Wpisz ręcznie" i „Zeskanuj paragon".
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { useMonth } from '@/features/month/month-context';
import { usePurchaseCategoryTotals } from '@/features/purchases/queries';
import { formatMonthYear } from '@/lib/date';
import { formatGrosze } from '@/lib/money';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

export default function PurchasesScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const { data: categoryTotals } = usePurchaseCategoryTotals();

  const totals = categoryTotals ?? [];
  const monthTotal = totals.reduce((sum, entry) => sum + entry.totalGrosze, 0);

  /**
   * Podkategorie bez wydatków chowamy na dole listy, a nie ukrywamy —
   * użytkownik musi móc wejść w pustą podkategorię, żeby zobaczyć,
   * że faktycznie nic w niej nie ma (5.1: brak danych to 0,00 zł, nie błąd).
   */
  const withSpending = totals.filter((entry) => entry.totalGrosze > 0);
  const empty = totals.filter((entry) => entry.totalGrosze === 0);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>{strings.purchases.total}</Text>
        <Text style={styles.headerAmount}>{formatGrosze(monthTotal)}</Text>
        <Text style={styles.headerMonth}>{formatMonthYear(month)}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={strings.purchases.addManual}
          icon="create-outline"
          onPress={() => router.push('/purchases/new')}
        />
        <Button
          label={strings.purchases.scanReceipt}
          icon="camera-outline"
          variant="secondary"
          // Etap 7 — do tego czasu przycisk istnieje, ale nic nie robi.
          disabled
          onPress={() => {}}
        />
        <Text style={styles.hint}>{strings.purchases.scanComingSoon}</Text>
      </View>

      <Text style={styles.sectionTitle}>{strings.purchases.subcategories}</Text>

      <View style={styles.list}>
        {[...withSpending, ...empty].map(({ category, totalGrosze }) => (
          <Card
            key={category.id}
            onPress={() =>
              router.push({
                pathname: '/purchases/[categoryId]',
                params: { categoryId: category.id },
              })
            }
            accessibilityLabel={`${category.name}: ${formatGrosze(totalGrosze)}`}
          >
            <View style={styles.row}>
              <View style={styles.iconBox}>
                <Ionicons
                  name={category.iconKey as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={colors.purchases}
                />
              </View>

              <Text style={styles.rowTitle}>{category.name}</Text>

              <Text style={[styles.rowAmount, totalGrosze === 0 && styles.rowAmountZero]}>
                {formatGrosze(totalGrosze)}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  headerLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  headerAmount: {
    fontSize: fontSize.amount,
    fontWeight: '700',
    color: colors.text,
  },
  headerMonth: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  sectionTitle: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  rowTitle: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
  },
  rowAmount: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  rowAmountZero: {
    fontWeight: '400',
    color: colors.textMuted,
  },
});
