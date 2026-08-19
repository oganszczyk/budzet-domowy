/**
 * 5.1: EKRAN GŁÓWNY — HOME
 *
 * Cel ekranu: w ciągu kilku sekund użytkownik ma zrozumieć, ile wydał
 * w wybranym miesiącu na trzy podstawowe obszary.
 *
 * Etap 0: nagłówek miesiąca, trzy karty i przejścia do kategorii już działają.
 * Sumy pokazują 0,00 zł, ponieważ baza danych powstaje w Etapie 1,
 * a podłączenie zapytań agregujących to Etap 2.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { MonthSwitcher } from '@/ui/components/month-switcher';
import { Screen } from '@/ui/components/screen';
import { SummaryCard } from '@/ui/components/summary-card';
import { colors, fontSize, spacing } from '@/ui/theme';

/**
 * Tymczasowa wartość na czas Etapu 0.
 * W Etapie 2 zastąpimy ją sumami liczonymi w bazie (BR-09).
 * 5.1: brak danych prezentujemy jako 0,00 zł, bez komunikatu błędu —
 * więc ekran wygląda już teraz dokładnie tak, jak będzie wyglądał docelowo.
 */
const PLACEHOLDER_TOTAL_GROSZE = 0;

export default function HomeScreen() {
  const router = useRouter();

  return (
    <Screen>
      <MonthSwitcher />

      <Text style={styles.sectionLabel}>{strings.home.monthTotal}</Text>

      <View style={styles.cards}>
        <SummaryCard
          title={strings.home.billsCard}
          totalGrosze={PLACEHOLDER_TOTAL_GROSZE}
          icon="receipt-outline"
          accentColor={colors.bills}
          onPress={() => router.push('/bills')}
        />

        <SummaryCard
          title={strings.home.subscriptionsCard}
          totalGrosze={PLACEHOLDER_TOTAL_GROSZE}
          icon="repeat-outline"
          accentColor={colors.subscriptions}
          onPress={() => router.push('/subscriptions')}
        />

        <SummaryCard
          title={strings.home.purchasesCard}
          totalGrosze={PLACEHOLDER_TOTAL_GROSZE}
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
