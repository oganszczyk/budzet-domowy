/**
 * Wiersz „etykieta — wartość" na ekranach szczegółów.
 *
 * DLACZEGO `flexShrink: 0` PRZY WARTOŚCI:
 *
 * W React Native Web element w wierszu flex może skurczyć się poniżej swojej
 * treści, a nadmiar zostaje przycięty. Data „19.08.2026" wyświetlała się
 * wtedy jako „19.08.202" — ucięta ostatnia cyfra roku. Dokładnie ten sam
 * mechanizm ucinał wcześniej ostatnią literę w chipach.
 *
 * Wartość nie może się więc kurczyć. Żeby długi tekst (np. opis) miał się
 * gdzie zmieścić, wiersz może się zawinąć — wtedy wartość przechodzi
 * do nowej linii w całości, zamiast zostać obcięta.
 */

import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, spacing } from '@/ui/theme';

type DetailRowProps = {
  label: string;
  value: string;
};

export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    // Długa wartość przechodzi do nowej linii, zamiast być ucinana.
    flexWrap: 'wrap',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  label: {
    flexShrink: 1,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  value: {
    // Bez tego wartość kurczy się poniżej treści i gubi końcówkę.
    flexShrink: 0,
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
});
