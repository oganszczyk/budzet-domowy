/**
 * 5.8: SZCZEGÓŁY PŁATNOŚCI
 *
 * Ekran wspólny dla wszystkich trzech typów — pola zależne od typu
 * pokazujemy warunkowo, zamiast budować trzy osobne ekrany.
 *
 *  [x] Nazwa płatności lub sklepu, kwota, data.
 *  [x] Kategoria główna i podkategoria.
 *  [x] Status i termin — dla rachunków.
 *  [x] Częstotliwość i źródłowa subskrypcja — dla subskrypcji.
 *  [x] Sposób dodania: ręcznie, automatycznie lub skan paragonu.
 *  [x] Opis i sposób płatności, jeżeli podane.
 *  [x] Przyciski Edytuj (kwota) i Usuń; potwierdzenie przed usunięciem.
 *
 * Rachunki mają własny, bogatszy ekran (`/bills/[id]`) z historią kwot
 * i oznaczaniem jako opłacony — stamtąd tu nie trafiamy.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { BillStatus, MainType } from '@/domain/enums';
import { useDeletePayment, useUpdatePayment } from '@/features/expenses/mutations';
import { useCategories } from '@/features/expenses/queries';
import { usePayment } from '@/features/purchases/queries';
import { formatDate } from '@/lib/date';
import { formatGrosze, validateAmountGrosze } from '@/lib/money';
import { AmountInput } from '@/ui/components/amount-input';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { StatusBadge } from '@/ui/components/status-badge';
import { confirm } from '@/ui/confirm';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const paymentId = Number(id);
  const router = useRouter();

  const { data: payment, isLoading } = usePayment(paymentId);
  const { data: categories } = useCategories();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();

  const [draftAmount, setDraftAmount] = useState<number | null | undefined>(undefined);

  if (isLoading) return <Screen centered scrollable={false} />;

  if (!payment) {
    return (
      <Screen centered>
        <Text style={styles.missing}>{strings.paymentDetail.notFound}</Text>
      </Screen>
    );
  }

  const category = categories?.find((c) => c.id === payment.categoryId) ?? null;

  const hasAmountEdit =
    draftAmount !== undefined && draftAmount !== null && draftAmount !== payment.amountGrosze;
  const amountValid =
    draftAmount === undefined || draftAmount === null || validateAmountGrosze(draftAmount).ok;

  const handleSave = () => {
    if (!hasAmountEdit || draftAmount === null || draftAmount === undefined) return;
    updatePayment.mutate({ id: payment.id, patch: { amountGrosze: draftAmount } });
    setDraftAmount(undefined);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: strings.paymentDetail.deleteConfirmTitle,
      message: strings.paymentDetail.deleteConfirmMessage,
      confirmLabel: strings.common.delete,
      destructive: true,
    });
    if (!confirmed) return;

    deletePayment.mutate(payment.id, {
      onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/')),
    });
  };

  return (
    <>
      <Stack.Screen options={{ title: payment.merchant ?? payment.title }} />

      <Screen>
        <Card>
          <View style={styles.summary}>
            <Text style={styles.name}>{payment.merchant ?? payment.title}</Text>
            <Text style={styles.amount}>{formatGrosze(payment.amountGrosze ?? 0)}</Text>
            {payment.status ? <StatusBadge status={payment.status as BillStatus} /> : null}
          </View>
        </Card>

        <Card style={styles.details}>
          <DetailRow
            label={strings.paymentDetail.mainType}
            value={strings.paymentDetail.mainTypeName[payment.mainType]}
          />
          {/* Rachunki nie mają podkategorii, więc wiersz pomijamy. */}
          {payment.mainType !== MainType.BILL && category ? (
            <DetailRow label={strings.paymentDetail.category} value={category.name} />
          ) : null}
          <DetailRow label={strings.paymentDetail.date} value={formatDate(payment.effectiveDate)} />
          {payment.dueDate ? (
            <DetailRow label={strings.bills.dueDate} value={formatDate(payment.dueDate)} />
          ) : null}
          {payment.paidDate ? (
            <DetailRow label={strings.bills.paidDate} value={formatDate(payment.paidDate)} />
          ) : null}
          {payment.merchant ? (
            <DetailRow label={strings.paymentDetail.merchant} value={payment.merchant} />
          ) : null}
          {payment.paymentMethod ? (
            <DetailRow
              label={strings.paymentDetail.method}
              value={strings.purchases.method[payment.paymentMethod]}
            />
          ) : null}
          <DetailRow
            label={strings.paymentDetail.source}
            value={strings.paymentDetail.sourceName[payment.source]}
          />
          {payment.description ? (
            <DetailRow label={strings.paymentDetail.description} value={payment.description} />
          ) : null}
        </Card>

        <View style={styles.section}>
          <AmountInput
            label={strings.purchases.amount}
            initialGrosze={payment.amountGrosze}
            onChangeGrosze={(grosze) => setDraftAmount(grosze)}
            error={amountValid ? null : strings.validation.amountInvalid}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label={strings.common.save}
            icon="checkmark"
            onPress={handleSave}
            disabled={!hasAmountEdit || !amountValid}
            loading={updatePayment.isPending}
          />
          <Button
            label={strings.common.delete}
            icon="trash-outline"
            variant="danger"
            onPress={handleDelete}
            loading={deletePayment.isPending}
          />
        </View>
      </Screen>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
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
    color: colors.purchases,
  },
  details: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  detailLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  detailValue: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
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
