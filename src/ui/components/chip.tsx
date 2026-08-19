/**
 * Chip — element wyboru jednej opcji z listy (podkategoria, częstotliwość).
 *
 * DWA SZCZEGÓŁY, KTÓRE TU DECYDUJĄ O POPRAWNYM WYGLĄDZIE:
 *
 * 1. `flexShrink: 0`
 *    Chipy leżą w kontenerze `flexDirection: row` z zawijaniem. Domyślnie
 *    element flex MOŻE się skurczyć poniżej swojej zawartości — i wtedy
 *    ostatnia litera zostaje ucięta. To była przyczyna błędu: niezaznaczona
 *    podkategoria gubiła ostatnią literę.
 *
 * 2. Stała grubość czcionki
 *    Wcześniej zaznaczony chip miał `fontWeight: 600`, a niezaznaczony 400.
 *    Pogrubiony tekst jest szerszy, więc kliknięcie zmieniało szerokość chipa
 *    i wymuszało przeliczenie układu — stąd „litera nagle się pojawiała".
 *    Teraz grubość jest zawsze taka sama, a zaznaczenie zmienia wyłącznie
 *    kolory. Szerokość chipa nie zależy więc od tego, czy jest wybrany.
 */

import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/ui/theme';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Kontener na chipy — używaj razem z <Chip>. */
export const chipRowStyle = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: spacing.sm,
} as const;

const styles = StyleSheet.create({
  chip: {
    // Bez tego chip kurczy się poniżej swojej treści i ucina ostatnią literę.
    flexShrink: 0,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  selected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontSize: fontSize.body,
    // Grubość jest stała w obu stanach — patrz komentarz na górze pliku.
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelSelected: {
    color: colors.primary,
  },
});
