/**
 * Pole kwoty.
 *
 * 5.5: „Przecinek i kropka mogą być akceptowane podczas wpisywania kwoty,
 * ale zapis ma być jednolity."
 *
 * Dlatego trzymamy TEKST wpisywany przez użytkownika, a na grosze zamieniamy
 * dopiero przy zapisie. Gdybyśmy po każdym znaku konwertowali na liczbę,
 * nie dałoby się wpisać „12," — przecinek zniknąłby, zanim użytkownik
 * zdążyłby dopisać grosze.
 */

import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { formatGrosze, parseAmountToGrosze } from '@/lib/money';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

type AmountInputProps = {
  label: string;
  /** Wartość początkowa w groszach; `null` oznacza puste pole. */
  initialGrosze: number | null;
  /** Wywoływane przy każdej zmianie: grosze albo `null`, gdy tekst nie jest kwotą. */
  onChangeGrosze: (grosze: number | null, rawText: string) => void;
  /** Komunikat błędu wyświetlany pod polem. */
  error?: string | null;
  autoFocus?: boolean;
};

export function AmountInput({
  label,
  initialGrosze,
  onChangeGrosze,
  error,
  autoFocus = false,
}: AmountInputProps) {
  const [text, setText] = useState(() =>
    initialGrosze === null ? '' : formatGrosze(initialGrosze, { withCurrency: false })
  );

  const handleChange = (next: string) => {
    setText(next);
    onChangeGrosze(parseAmountToGrosze(next), next);
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        <TextInput
          value={text}
          onChangeText={handleChange}
          // Klawiatura numeryczna z przecinkiem — na Androidzie 'decimal-pad'
          // pokazuje separator dziesiętny zgodny z ustawieniami telefonu.
          keyboardType="decimal-pad"
          inputMode="decimal"
          placeholder="0,00"
          placeholderTextColor={colors.textMuted}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          style={styles.input}
        />
        <Text style={styles.currency}>zł</Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputRowError: {
    borderColor: colors.statusOverdue,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
  },
  currency: {
    fontSize: fontSize.label,
    fontWeight: '600',
    color: colors.textMuted,
  },
  error: {
    fontSize: fontSize.caption,
    color: colors.statusOverdue,
  },
});
