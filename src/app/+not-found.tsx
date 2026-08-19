/** Ekran pokazywany, gdy nawigacja trafi na nieistniejącą trasę. */

import { Link, Stack } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { strings } from '@/constants/strings';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: strings.app.name }} />
      <Screen centered>
        <Text style={styles.message}>{strings.common.notFound}</Text>
        <Link href="/" style={styles.link}>
          {strings.common.goHome}
        </Link>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: fontSize.label,
    color: colors.text,
    textAlign: 'center',
  },
  link: {
    marginTop: spacing.lg,
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.primary,
  },
});
