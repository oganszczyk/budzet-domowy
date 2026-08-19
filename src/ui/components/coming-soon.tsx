/**
 * Ekran zastępczy dla tras, które istnieją w nawigacji,
 * ale zostaną wypełnione w kolejnych etapach planu wdrożenia (rozdział 9).
 *
 * Etap 0 wymaga, żeby wszystkie główne trasy już działały —
 * dzięki temu nawigację testujemy zanim powstanie baza danych.
 */

import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/ui/theme';

type ComingSoonProps = {
  title: string;
  message: string;
  /** Numer etapu z rozdziału 9 specyfikacji, w którym ekran powstanie. */
  stage?: string;
};

export function ComingSoon({ title, message, stage }: ComingSoonProps) {
  return (
    <View style={styles.root}>
      <View style={styles.iconBox}>
        <Ionicons name="construct-outline" size={28} color={colors.primary} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {stage ? <Text style={styles.stage}>{stage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stage: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
});
