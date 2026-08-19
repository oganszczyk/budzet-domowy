/**
 * 5.1: nagłówek z nazwą miesiąca i rokiem oraz przyciskami przejścia
 * do poprzedniego i następnego miesiąca.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { useMonth } from '@/features/month/month-context';
import { formatMonthYear } from '@/lib/date';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

export function MonthSwitcher() {
  const { month, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonth();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={goToPreviousMonth}
        accessibilityRole="button"
        accessibilityLabel={strings.home.previousMonth}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
      </Pressable>

      <Pressable
        onPress={goToCurrentMonth}
        accessibilityRole="button"
        accessibilityLabel={formatMonthYear(month)}
        style={({ pressed }) => [styles.label, pressed && styles.pressed]}
      >
        <Text style={styles.labelText}>{formatMonthYear(month)}</Text>
      </Pressable>

      <Pressable
        onPress={goToNextMonth}
        accessibilityRole="button"
        accessibilityLabel={strings.home.nextMonth}
        hitSlop={spacing.sm}
        style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-forward" size={22} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  label: {
    flex: 1,
    alignItems: 'center',
  },
  labelText: {
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.text,
  },
  pressed: {
    opacity: 0.6,
  },
});
