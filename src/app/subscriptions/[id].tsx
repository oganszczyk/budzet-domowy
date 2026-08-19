/**
 * 5.3: SUBSKRYPCJE — szczegóły
 *
 * Pokazuje wszystkie dane z 7.4 i pozwala zmienić kwotę oraz zakończyć
 * lub wznowić subskrypcję.
 *
 * BR-07 / AC 5.3: zmiana kwoty dotyczy wyłącznie przyszłych płatności.
 * Zapisane rekordy mają własną kopię kwoty i pozostają nietknięte.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { intervalMonths, nextPaymentDate, yearlyCostGrosze } from '@/domain/subscription-schedule';
import { useMonth } from '@/features/month/month-context';
import {
  useEndSubscription,
  useResumeSubscription,
  useSubscription,
  useUpdateSubscription,
} from '@/features/subscriptions/queries';
import { formatDate } from '@/lib/date';
import { formatGrosze, validateAmountGrosze } from '@/lib/money';
import { AmountInput } from '@/ui/components/amount-input';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { DetailRow } from '@/ui/components/detail-row';
import { Screen } from '@/ui/components/screen';
import { confirm } from '@/ui/confirm';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subscriptionId = Number(id);
  const router = useRouter();
  const { month } = useMonth();

  const { data: subscription, isLoading } = useSubscription(subscriptionId);
  const updateSubscription = useUpdateSubscription();
  const endSubscription = useEndSubscription();
  const resumeSubscription = useResumeSubscription();

  const [draftAmount, setDraftAmount] = useState<number | null | undefined>(undefined);

  if (isLoading) return <Screen centered scrollable={false} />;

  if (!subscription) {
    return (
      <Screen centered>
        <Text style={styles.missing}>{strings.subscriptions.notFound}</Text>
      </Screen>
    );
  }

  const next = nextPaymentDate(subscription, month);
  const hasAmountEdit =
    draftAmount !== undefined && draftAmount !== null && draftAmount !== subscription.amountGrosze;
  const amountValid = draftAmount === undefined || validateAmountGrosze(draftAmount).ok;

  const handleSave = () => {
    if (!hasAmountEdit || draftAmount === null || draftAmount === undefined) return;
    updateSubscription.mutate({ id: subscription.id, patch: { amountGrosze: draftAmount } });
    setDraftAmount(undefined);
  };

  const handleEnd = async () => {
    const confirmed = await confirm({
      title: strings.subscriptions.endConfirmTitle,
      message: strings.subscriptions.endConfirmMessage,
      confirmLabel: strings.subscriptions.end,
      destructive: true,
    });
    if (!confirmed) return;
    endSubscription.mutate(subscription.id);
  };

  return (
    <>
      <Stack.Screen options={{ title: subscription.name }} />

      <Screen>
        <Card>
          <View style={styles.summary}>
            <Text style={styles.name}>{subscription.name}</Text>
            <Text style={styles.amount}>{formatGrosze(subscription.amountGrosze)}</Text>
            <Text style={subscription.isActive ? styles.badgeActive : styles.badgeEnded}>
              {subscription.isActive ? strings.subscriptions.active : strings.subscriptions.ended}
            </Text>
          </View>
        </Card>

        <Card style={styles.details}>
          <DetailRow
            label={strings.subscriptions.frequencyLabel}
            value={strings.subscriptions.frequency[subscription.frequencyType]}
          />
          {subscription.frequencyType === 'CUSTOM' ? (
            <DetailRow
              label={strings.subscriptions.customIntervalLabel}
              value={String(intervalMonths(subscription))}
            />
          ) : null}
          <DetailRow
            label={strings.subscriptions.startDate}
            value={formatDate(subscription.startDate)}
          />
          <DetailRow
            label={strings.subscriptions.nextPayment}
            value={next ? formatDate(next) : '—'}
          />
          <DetailRow
            label={strings.subscriptions.yearlyForecast}
            value={formatGrosze(yearlyCostGrosze(subscription))}
          />
        </Card>

        <View style={styles.section}>
          <AmountInput
            label={strings.subscriptions.amountLabel}
            initialGrosze={subscription.amountGrosze}
            onChangeGrosze={(grosze) => setDraftAmount(grosze)}
            error={amountValid ? null : strings.validation.amountInvalid}
          />
          <Text style={styles.hint}>{strings.subscriptions.amountChangeHint}</Text>
        </View>

        <View style={styles.actions}>
          <Button
            label={strings.common.save}
            icon="checkmark"
            onPress={handleSave}
            disabled={!hasAmountEdit || !amountValid}
            loading={updateSubscription.isPending}
          />

          {subscription.isActive ? (
            <Button
              label={strings.subscriptions.end}
              icon="close-circle-outline"
              variant="danger"
              onPress={handleEnd}
              loading={endSubscription.isPending}
            />
          ) : (
            <Button
              label={strings.subscriptions.resume}
              icon="refresh-outline"
              variant="secondary"
              onPress={() => resumeSubscription.mutate(subscription.id)}
              loading={resumeSubscription.isPending}
            />
          )}

          <Button
            label={strings.common.back}
            variant="secondary"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/subscriptions'))}
          />
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  name: {
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.text,
  },
  amount: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.subscriptions,
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
  details: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  missing: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
});
