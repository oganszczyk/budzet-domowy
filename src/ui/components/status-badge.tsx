/**
 * 5.2: wizualne oznaczenie statusu rachunku.
 *
 * Kolor niesie tę samą informację co tekst, ale sam kolor nigdy nie wystarcza —
 * zawsze pokazujemy też polską nazwę statusu, żeby znaczenie było czytelne
 * także dla osób, które nie rozróżniają tych barw.
 */

import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { BillStatus } from '@/domain/enums';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

const STATUS_COLORS: Record<BillStatus, { text: string; background: string }> = {
  [BillStatus.WAITING_AMOUNT]: {
    text: colors.statusWaiting,
    background: colors.statusWaitingSoft,
  },
  [BillStatus.TO_PAY]: { text: colors.statusToPay, background: colors.statusToPaySoft },
  [BillStatus.PAID]: { text: colors.statusPaid, background: colors.statusPaidSoft },
  [BillStatus.OVERDUE]: { text: colors.statusOverdue, background: colors.statusOverdueSoft },
};

export function StatusBadge({ status }: { status: BillStatus }) {
  const palette = STATUS_COLORS[status];

  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.text }]}>{strings.bills.status[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  label: {
    fontSize: fontSize.caption,
    fontWeight: '600',
  },
});
