/**
 * Wybór pojedynczego miesiąca strzałkami (Etap 12).
 *
 * Wygląda jak `MonthSwitcher` z ekranu głównego i to jest celowe — ten sam
 * gest ma znaczyć to samo. Różnica jest w tym, czym steruje: `MonthSwitcher`
 * przestawia wspólny miesiąc całej aplikacji (4.3), a ten komponent tylko
 * jedną wartość podaną z zewnątrz. Dlatego NIE korzysta z `useMonth()` —
 * ustawienie krańca zakresu w analizie nie może przestawiać sum na ekranie
 * głównym.
 *
 * Dwa krańce zakresu to dwa niezależne egzemplarze tego komponentu.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { addMonths, formatMonthYear, type YearMonth } from '@/lib/date';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

type MonthStepperProps = {
  /** Podpis nad wartością, np. „Od miesiąca". */
  label: string;
  value: YearMonth;
  onChange: (next: YearMonth) => void;
  /** Opis dla czytnika ekranu — sama strzałka nic nie mówi. */
  accessibilityLabel: string;
};

export function MonthStepper({ label, value, onChange, accessibilityLabel }: MonthStepperProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>

      <View style={styles.row}>
        <Pressable
          onPress={() => onChange(addMonths(value, -1))}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, wcześniej`}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.primary} />
        </Pressable>

        <Text
          style={styles.value}
          accessibilityLabel={`${accessibilityLabel}: ${formatMonthYear(value)}`}
        >
          {formatMonthYear(value)}
        </Text>

        <Pressable
          onPress={() => onChange(addMonths(value, 1))}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityLabel}, później`}
          hitSlop={spacing.sm}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  value: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  pressed: {
    opacity: 0.6,
  },
});
