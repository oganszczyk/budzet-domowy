/**
 * 5.2: RACHUNKI DOMOWE — szczegóły rachunku
 *
 *  [x] Nazwa rachunku
 *  [x] Miesiąc i rok
 *  [x] Kwota — pole edytowalne
 *  [x] Termin płatności
 *  [x] Status
 *  [x] Data opłacenia — ustawiana przy oznaczeniu jako opłacony
 *  [x] Opis opcjonalny
 *  [x] Historia wcześniejszych kwot dla tego samego szablonu
 *  [x] Przyciski: Zapisz, Oznacz jako opłacony, Usuń
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { strings } from '@/constants/strings';
import { BillStatus } from '@/domain/enums';
import { useBill, useBillAmountHistory } from '@/features/bills/queries';
import {
  useDeletePayment,
  useMarkBillAsPaid,
  useMarkBillAsUnpaid,
  useUpdatePayment,
} from '@/features/expenses/mutations';
import { formatDate, formatMonthYear, yearMonthOf } from '@/lib/date';
import { formatGrosze, validateAmountGrosze } from '@/lib/money';
import { AmountInput } from '@/ui/components/amount-input';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { StatusBadge } from '@/ui/components/status-badge';
import { confirm } from '@/ui/confirm';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const billId = Number(id);
  const router = useRouter();

  const { data: bill, isLoading } = useBill(billId);
  const { data: history } = useBillAmountHistory(bill?.billTemplateId ?? null);

  const updatePayment = useUpdatePayment();
  const markAsPaid = useMarkBillAsPaid();
  const markAsUnpaid = useMarkBillAsUnpaid();
  const deletePayment = useDeletePayment();

  /**
   * Kwota i opis są edytowalne, więc trzymamy je w stanie ekranu do czasu
   * naciśnięcia „Zapisz". `undefined` znaczy „użytkownik jeszcze nic nie zmienił",
   * dzięki czemu odróżniamy to od świadomego wyczyszczenia pola.
   */
  const [draftAmount, setDraftAmount] = useState<number | null | undefined>(undefined);
  const [amountText, setAmountText] = useState('');
  const [draftDescription, setDraftDescription] = useState<string | undefined>(undefined);

  if (isLoading) {
    return <Screen centered scrollable={false} />;
  }

  if (!bill) {
    return (
      <Screen centered>
        <Text style={styles.missing}>{strings.bills.notFound}</Text>
      </Screen>
    );
  }

  const month = yearMonthOf(bill.effectiveDate);
  const isPaid = bill.status === BillStatus.PAID;

  /**
   * 5.2: „Historia wcześniejszych kwot dla tego samego szablonu."
   * Bieżący miesiąc odfiltrowujemy — jest już widoczny wyżej, w polu kwoty.
   */
  const previousAmounts = (history ?? []).filter((entry) => entry.paymentId !== bill.id);

  const amountToSave = draftAmount === undefined ? bill.amountGrosze : draftAmount;
  const hasAmountEdit = draftAmount !== undefined && draftAmount !== bill.amountGrosze;
  const hasDescriptionEdit =
    draftDescription !== undefined && draftDescription !== (bill.description ?? '');
  const hasChanges = hasAmountEdit || hasDescriptionEdit;

  // Pole puste jest dozwolone (BR-04 — rachunek wraca do stanu oczekującego),
  // ale tekst, który nie jest kwotą, blokuje zapis.
  const amountLooksBroken = amountText.trim() !== '' && draftAmount === null;
  const amountOutOfRange =
    draftAmount !== undefined && draftAmount !== null && !validateAmountGrosze(draftAmount).ok;

  const amountError = amountLooksBroken
    ? strings.validation.amountInvalid
    : amountOutOfRange
      ? strings.validation.amountTooHigh
      : null;

  const canSave = hasChanges && !amountLooksBroken && !amountOutOfRange;

  const handleSave = () => {
    updatePayment.mutate({
      id: bill.id,
      patch: {
        amountGrosze: amountToSave,
        description: hasDescriptionEdit ? draftDescription?.trim() || null : bill.description,
      },
    });
    setDraftAmount(undefined);
    setDraftDescription(undefined);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: strings.bills.deleteConfirmTitle,
      message: strings.bills.deleteConfirmMessage,
      confirmLabel: strings.common.delete,
      destructive: true,
    });
    if (!confirmed) return;

    deletePayment.mutate(bill.id, { onSuccess: () => router.back() });
  };

  return (
    <>
      <Stack.Screen options={{ title: bill.title }} />

      <Screen>
        <Card>
          <View style={styles.summary}>
            <Text style={styles.name}>{bill.title}</Text>
            <Text style={styles.month}>{formatMonthYear(month)}</Text>
            {bill.status ? <StatusBadge status={bill.status as BillStatus} /> : null}
          </View>
        </Card>

        <View style={styles.section}>
          <AmountInput
            label={strings.bills.amountLabel}
            initialGrosze={bill.amountGrosze}
            error={amountError}
            onChangeGrosze={(grosze, raw) => {
              setAmountText(raw);
              // Puste pole = świadomy powrót do stanu „oczekuje na kwotę".
              setDraftAmount(raw.trim() === '' ? null : grosze);
            }}
          />
        </View>

        <Card style={styles.details}>
          <DetailRow
            label={strings.bills.dueDate}
            value={bill.dueDate ? formatDate(bill.dueDate) : '—'}
          />
          <DetailRow
            label={strings.bills.paidDate}
            value={bill.paidDate ? formatDate(bill.paidDate) : '—'}
          />
        </Card>

        <View style={styles.section}>
          <Text style={styles.fieldLabel}>{strings.bills.descriptionLabel}</Text>
          <TextInput
            value={draftDescription ?? bill.description ?? ''}
            onChangeText={setDraftDescription}
            placeholder={strings.bills.descriptionPlaceholder}
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            accessibilityLabel={strings.bills.descriptionLabel}
            style={styles.descriptionInput}
          />
        </View>

        <View style={styles.actions}>
          <Button
            label={strings.common.save}
            icon="checkmark"
            onPress={handleSave}
            disabled={!canSave}
            loading={updatePayment.isPending}
          />

          {isPaid ? (
            <Button
              label={strings.bills.markAsUnpaid}
              icon="arrow-undo-outline"
              variant="secondary"
              onPress={() => markAsUnpaid.mutate(bill.id)}
              loading={markAsUnpaid.isPending}
            />
          ) : (
            <Button
              label={strings.bills.markAsPaid}
              icon="checkmark-done"
              variant="secondary"
              onPress={() => markAsPaid.mutate(bill.id)}
              // BR-04: nie da się opłacić rachunku, który nie ma jeszcze kwoty.
              disabled={bill.amountGrosze === null}
              loading={markAsPaid.isPending}
            />
          )}

          <Button
            label={strings.common.delete}
            icon="trash-outline"
            variant="danger"
            onPress={handleDelete}
            loading={deletePayment.isPending}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.bills.amountHistory}</Text>

          <Card>
            {previousAmounts.length > 0 ? (
              previousAmounts.map((entry) => (
                <DetailRow
                  key={entry.paymentId}
                  label={formatMonthYear(entry.month)}
                  value={formatGrosze(entry.amountGrosze)}
                />
              ))
            ) : (
              <Text style={styles.emptyHistory}>{strings.bills.noHistory}</Text>
            )}
          </Card>
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
  month: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  section: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  fieldLabel: {
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  details: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  detailLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  detailValue: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
  },
  descriptionInput: {
    minHeight: 80,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.body,
    color: colors.text,
    textAlignVertical: 'top',
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyHistory: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  missing: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
});
