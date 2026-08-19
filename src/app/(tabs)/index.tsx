/**
 * 5.1: EKRAN GŁÓWNY — HOME
 *
 * Cel ekranu: w ciągu kilku sekund użytkownik ma zrozumieć, ile wydał
 * w wybranym miesiącu na trzy podstawowe obszary.
 *
 * Sumy pochodzą z repozytorium (BR-09 — zależą od wybranego miesiąca).
 * Ekran nie wie, czy dane leżą w pamięci, czy w bazie SQLite — pyta hook,
 * a hook pyta repozytorium (8.1).
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { useMonthlyTotals } from '@/features/expenses/queries';
import { MonthSwitcher } from '@/ui/components/month-switcher';
import { Screen } from '@/ui/components/screen';
import { SummaryCard } from '@/ui/components/summary-card';
import { colors, fontSize, spacing } from '@/ui/theme';

/**
 * 5.1: „Brak danych jest prezentowany jako 0,00 zł, bez komunikatu błędu."
 * Ta sama zasada obowiązuje, zanim dane zdążą się wczytać — pokazujemy zera,
 * a nie pusty ekran ani kręcące się kółko.
 */
const EMPTY_TOTALS = {
  billsGrosze: 0,
  subscriptionsGrosze: 0,
  purchasesGrosze: 0,
};

export default function HomeScreen() {
  const router = useRouter();
  const { data } = useMonthlyTotals();
  const totals = data ?? EMPTY_TOTALS;

  return (
    <Screen>
      <MonthSwitcher />

      <Text style={styles.sectionLabel}>{strings.home.monthTotal}</Text>

      <View style={styles.cards}>
        <SummaryCard
          title={strings.home.billsCard}
          totalGrosze={totals.billsGrosze}
          icon="receipt-outline"
          accentColor={colors.bills}
          onPress={() => router.push('/bills')}
        />

        <SummaryCard
          title={strings.home.subscriptionsCard}
          totalGrosze={totals.subscriptionsGrosze}
          icon="repeat-outline"
          accentColor={colors.subscriptions}
          onPress={() => router.push('/subscriptions')}
        />

        <SummaryCard
          title={strings.home.purchasesCard}
          totalGrosze={totals.purchasesGrosze}
          icon="cart-outline"
          accentColor={colors.purchases}
          onPress={() => router.push('/purchases')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
