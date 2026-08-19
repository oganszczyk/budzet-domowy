/**
 * 5.3: SUBSKRYPCJE — lista
 *
 *  [x] Na górze suma kosztów subskrypcji przypadających na wybrany miesiąc.
 *  [x] Prognozowany koszt roczny obliczony z aktywnych subskrypcji (P1).
 *  [x] Każda pozycja: nazwa, kwota, częstotliwość, najbliższa data płatności
 *      i status aktywności.
 *  [x] Przycisk dodawania otwiera formularz nowej subskrypcji.
 *  [x] Okresowe pytanie kontrolne o dalsze korzystanie (P1).
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import type { Subscription } from '@/domain/models';
import {
  needsUsageConfirmation,
  nextPaymentDate,
  yearlyCostGrosze,
} from '@/domain/subscription-schedule';
import { useMonth } from '@/features/month/month-context';
import {
  useConfirmSubscriptionUsage,
  useEndSubscription,
  useSubscriptionsScreen,
} from '@/features/subscriptions/queries';
import { formatDate, formatMonthYear, todayIso } from '@/lib/date';
import { formatGrosze } from '@/lib/money';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const { data } = useSubscriptionsScreen();

  const subscriptions = data?.subscriptions ?? [];
  const payments = data?.payments ?? [];

  // 6.1: suma subskrypcji to wygenerowane płatności przypadające na ten miesiąc.
  const monthTotal = payments.reduce((sum, p) => sum + (p.amountGrosze ?? 0), 0);

  // 5.3 (P1): prognoza roczna liczona tylko z aktywnych subskrypcji.
  const yearlyForecast = subscriptions.reduce((sum, s) => sum + yearlyCostGrosze(s), 0);

  const active = subscriptions.filter((s) => s.isActive);
  const ended = subscriptions.filter((s) => !s.isActive);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>{strings.subscriptions.total}</Text>
        <Text style={styles.headerAmount}>{formatGrosze(monthTotal)}</Text>
        <Text style={styles.headerMonth}>{formatMonthYear(month)}</Text>

        <View style={styles.forecast}>
          <Ionicons name="trending-up-outline" size={16} color={colors.subscriptions} />
          <Text style={styles.forecastText}>
            {strings.subscriptions.yearlyForecast}: {formatGrosze(yearlyForecast)}
          </Text>
        </View>
      </View>

      <UsageConfirmationPrompt subscriptions={active} />

      {active.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{strings.subscriptions.activeSection}</Text>
          <View style={styles.list}>
            {active.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                onPress={() =>
                  router.push({
                    pathname: '/subscriptions/[id]',
                    params: { id: subscription.id },
                  })
                }
              />
            ))}
          </View>
        </>
      ) : null}

      {ended.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>{strings.subscriptions.endedSection}</Text>
          <View style={styles.list}>
            {ended.map((subscription) => (
              <SubscriptionRow
                key={subscription.id}
                subscription={subscription}
                onPress={() =>
                  router.push({
                    pathname: '/subscriptions/[id]',
                    params: { id: subscription.id },
                  })
                }
              />
            ))}
          </View>
        </>
      ) : null}

      {subscriptions.length === 0 ? (
        <Card>
          <Text style={styles.empty}>{strings.subscriptions.empty}</Text>
        </Card>
      ) : null}

      <View style={styles.footer}>
        <Button
          label={strings.subscriptions.add}
          icon="add"
          variant="secondary"
          onPress={() => router.push('/subscriptions/new')}
        />
      </View>
    </Screen>
  );
}

/**
 * 5.3: „Co ustalony okres, domyślnie co 3 miesiące, pokazać pytanie:
 * «Czy nadal korzystasz z tej subskrypcji i ją opłacasz?»"
 *
 * Pytamy o jedną subskrypcję naraz — trzy pytania jednocześnie zamieniłyby
 * ekran w formularz i użytkownik odklikałby je bez czytania.
 */
function UsageConfirmationPrompt({ subscriptions }: { subscriptions: Subscription[] }) {
  const confirmUsage = useConfirmSubscriptionUsage();
  const endSubscription = useEndSubscription();

  /**
   * „Przypomnij później" odkładamy tylko na czas tej wizyty na ekranie —
   * nie zapisujemy tego, bo byłoby to nie do odróżnienia od „Tak",
   * a użytkownik świadomie NIE potwierdził, że nadal korzysta.
   */
  const [postponed, setPostponed] = useState<number[]>([]);

  const today = todayIso();
  const pending = subscriptions.find(
    (s) => needsUsageConfirmation(s, today) && !postponed.includes(s.id)
  );

  if (!pending) return null;

  return (
    <Card style={styles.prompt}>
      <Text style={styles.promptName}>{pending.name}</Text>
      <Text style={styles.promptQuestion}>{strings.subscriptions.usageQuestion}</Text>

      <View style={styles.promptActions}>
        <Button
          label={strings.subscriptions.usageYes}
          icon="checkmark"
          onPress={() => confirmUsage.mutate(pending.id)}
          loading={confirmUsage.isPending}
        />
        <Button
          label={strings.subscriptions.usageEnd}
          variant="danger"
          onPress={() => endSubscription.mutate(pending.id)}
          loading={endSubscription.isPending}
        />
        <Button
          label={strings.subscriptions.usageLater}
          variant="secondary"
          onPress={() => setPostponed((current) => [...current, pending.id])}
        />
      </View>
    </Card>
  );
}

function SubscriptionRow({
  subscription,
  onPress,
}: {
  subscription: Subscription;
  onPress: () => void;
}) {
  const { month } = useMonth();
  const next = nextPaymentDate(subscription, month);

  return (
    <Card onPress={onPress} accessibilityLabel={subscription.name}>
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{subscription.name}</Text>
          <Text style={styles.rowMeta}>
            {strings.subscriptions.frequency[subscription.frequencyType]}
            {next ? ` · ${strings.subscriptions.nextPayment}: ${formatDate(next)}` : ''}
          </Text>
          <Text style={subscription.isActive ? styles.badgeActive : styles.badgeEnded}>
            {subscription.isActive ? strings.subscriptions.active : strings.subscriptions.ended}
          </Text>
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.rowAmount}>{formatGrosze(subscription.amountGrosze)}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </View>
    </Card>
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
  forecast: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  forecastText: {
    fontSize: fontSize.caption,
    color: colors.subscriptions,
    fontWeight: '600',
  },
  sectionTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
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
    alignItems: 'flex-start',
  },
  rowTitle: {
    fontSize: fontSize.label,
    fontWeight: '600',
    color: colors.text,
  },
  rowMeta: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowAmount: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.text,
  },
  badgeActive: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.statusPaid,
  },
  badgeEnded: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.textMuted,
  },
  prompt: {
    borderColor: colors.subscriptions,
    gap: spacing.sm,
  },
  promptName: {
    fontSize: fontSize.label,
    fontWeight: '700',
    color: colors.text,
  },
  promptQuestion: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  promptActions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
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
