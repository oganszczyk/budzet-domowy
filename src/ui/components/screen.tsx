/**
 * Wspólny kontener ekranu: bezpieczne marginesy, tło i przewijanie.
 * Dzięki niemu każdy ekran wygląda tak samo i nie powtarzamy tych samych styli.
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/ui/theme';

type ScreenProps = {
  children: ReactNode;
  /** Gdy `false`, treść nie jest przewijana (np. ekran z własną listą). */
  scrollable?: boolean;
  /** Gdy `true`, treść jest wyśrodkowana w pionie (ekrany zastępcze). */
  centered?: boolean;
  contentStyle?: ViewStyle;
};

export function Screen({
  children,
  scrollable = true,
  centered = false,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const padding: ViewStyle = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  };

  if (!scrollable) {
    return (
      <View style={[styles.root, padding, centered && styles.centered, contentStyle]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[padding, centered && styles.centeredContent, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
