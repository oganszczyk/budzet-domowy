/**
 * 5.1: karta kategorii głównej na ekranie głównym.
 * Pokazuje nazwę kategorii i jej miesięczną sumę, a kliknięcie
 * otwiera szczegóły odpowiadającej kategorii.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { formatGrosze } from '@/lib/money';
import { Card } from '@/ui/components/card';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

type SummaryCardProps = {
  title: string;
  /** Suma w groszach. 5.1: brak danych pokazujemy jako 0,00 zł, nie jako błąd. */
  totalGrosze: number;
  icon: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  onPress: () => void;
};

export function SummaryCard({ title, totalGrosze, icon, accentColor, onPress }: SummaryCardProps) {
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}: ${formatGrosze(totalGrosze)}`}>
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: `${accentColor}1A` }]}>
          <Ionicons name={icon} size={22} color={accentColor} />
        </View>

        <View style={styles.texts}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.amount}>{formatGrosze(totalGrosze)}</Text>
        </View>

        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  amount: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
});
