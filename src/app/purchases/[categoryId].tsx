/**
 * 5.4: „Kliknięcie podkategorii otwiera listę przypisanych zakupów."
 *
 * Lista zakupów jednej podkategorii w wybranym miesiącu, z sumą na górze.
 * Kliknięcie pozycji prowadzi do szczegółów płatności (5.8).
 */

import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { useMonth } from '@/features/month/month-context';
import { usePurchasesInCategory } from '@/features/purchases/queries';
import { formatDate, formatMonthYear } from '@/lib/date';
import { formatGrosze } from '@/lib/money';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function PurchaseCategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const { month } = useMonth();
  const { data } = usePurchasesInCategory(Number(categoryId));

  const category = data?.category ?? null;
  const payments = data?.payments ?? [];
  const total = payments.reduce((sum, p) => sum + (p.amountGrosze ?? 0), 0);

  return (
    <>
      <Stack.Screen options={{ title: category?.name ?? strings.purchases.title }} />

      <Screen>
        <View style={styles.header}>
          <Text style={styles.headerLabel}>{category?.name ?? ''}</Text>
          <Text style={styles.headerAmount}>{formatGrosze(total)}</Text>
          <Text style={styles.headerMonth}>{formatMonthYear(month)}</Text>
        </View>

        <View style={styles.list}>
          {payments.map((payment) => (
            <Card
              key={payment.id}
              onPress={() => router.push({ pathname: '/payment/[id]', params: { id: payment.id } })}
              accessibilityLabel={`${payment.merchant ?? payment.title}: ${formatGrosze(
                payment.amountGrosze ?? 0
              )}`}
            >
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <Text style={styles.rowTitle}>{payment.merchant ?? payment.title}</Text>
                  <Text style={styles.rowMeta}>
                    {formatDate(payment.effectiveDate)}
                    {payment.paymentMethod
                      ? ` · ${strings.purchases.method[payment.paymentMethod]}`
                      : ''}
                  </Text>
                </View>

                <Text style={styles.rowAmount}>{formatGrosze(payment.amountGrosze ?? 0)}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </Card>
          ))}

          {payments.length === 0 ? (
            <Card>
              <Text style={styles.empty}>{strings.purchases.emptyCategory}</Text>
            </Card>
          ) : null}
        </View>

        <View style={styles.footer}>
          <Button
            label={strings.purchases.addManual}
            icon="create-outline"
            onPress={() =>
              router.push({
                pathname: '/purchases/new',
                // Podkategoria jest już wybrana — formularz nie musi o nią pytać.
                params: { categoryId: String(categoryId) },
              })
            }
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  headerLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  headerAmount: {
    fontSize: fontSize.amount,
    fontWeight: '700',
    color: colors.text,
  },
  headerMonth: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
  },
  rowMeta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  rowAmount: {
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  empty: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footer: {
    marginTop: spacing.xl,
  },
});
