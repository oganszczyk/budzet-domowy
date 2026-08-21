/**
 * 5.7: HISTORIA WSZYSTKICH PŁATNOŚCI
 *
 *  [x] Wyświetlać wszystkie zapisane rekordy z rachunków, subskrypcji i zakupów.
 *  [x] Sortować chronologicznie od najnowszych do najstarszych.
 *  [x] Grupować wizualnie według miesiąca.
 *  [x] Każdy wiersz pokazuje nazwę, kategorię, datę, kwotę i ikonę.
 *  [x] Rachunki z kwotą, ale statusem „Do zapłaty", są widoczne z oznaczeniem statusu.
 *  [x] Rachunki oczekujące na wpisanie kwoty NIE są wyświetlane (BR-05).
 *  [x] Kliknięcie pozycji otwiera szczegóły.
 *
 * Historia celowo NIE zależy od wybranego miesiąca. BR-09 dotyczy sum,
 * a 5.7 mówi wprost o „wszystkich zapisanych rekordach" — miesiąc jest tu
 * tylko nagłówkiem porządkującym, nie filtrem.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { BillStatus, MainType } from '@/domain/enums';
import type { Category, Payment } from '@/domain/models';
import { useCategories, useHistory } from '@/features/expenses/queries';
import { groupPaymentsByMonth } from '@/features/history/group-by-month';
import { formatDate, formatMonthYear } from '@/lib/date';
import { formatGrosze } from '@/lib/money';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { StatusBadge } from '@/ui/components/status-badge';
import { colors, fontSize, radius, spacing } from '@/ui/theme';

/** Ikona i kolor zależne od kategorii głównej — 5.7 wymaga ikony w wierszu. */
const TYPE_STYLE: Record<MainType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  [MainType.BILL]: { icon: 'receipt-outline', color: colors.bills },
  [MainType.SUBSCRIPTION]: { icon: 'repeat-outline', color: colors.subscriptions },
  [MainType.PURCHASE]: { icon: 'cart-outline', color: colors.purchases },
};

export default function HistoryScreen() {
  const { data: history, isLoading } = useHistory();
  const { data: categories } = useCategories();

  const groups = groupPaymentsByMonth(history ?? []);

  if (!isLoading && groups.length === 0) {
    return (
      <Screen centered>
        <Text style={styles.emptyTitle}>{strings.history.empty}</Text>
        <Text style={styles.emptyHint}>{strings.history.emptyHint}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>{strings.history.title}</Text>

      {groups.map((group) => (
        <View key={`${group.month.year}-${group.month.month}`} style={styles.group}>
          <View style={styles.groupHeader}>
            <Text style={styles.groupMonth}>{formatMonthYear(group.month)}</Text>
            <Text style={styles.groupTotal}>
              {strings.history.monthTotal} {formatGrosze(group.totalGrosze)}
            </Text>
          </View>

          <View style={styles.list}>
            {group.payments.map((payment) => (
              <HistoryRow key={payment.id} payment={payment} categories={categories ?? []} />
            ))}
          </View>
        </View>
      ))}

      <Text style={styles.footnote}>{strings.history.waitingHidden}</Text>
    </Screen>
  );
}

function HistoryRow({ payment, categories }: { payment: Payment; categories: Category[] }) {
  const router = useRouter();
  const style = TYPE_STYLE[payment.mainType];

  /**
   * Rachunki mają własny, bogatszy ekran — z historią kwot i oznaczaniem
   * jako opłacony. Pozostałe typy trafiają na wspólny ekran szczegółów.
   */
  const openDetails = () => {
    if (payment.mainType === MainType.BILL) {
      router.push({ pathname: '/bills/[id]', params: { id: payment.id } });
    } else {
      router.push({ pathname: '/payment/[id]', params: { id: payment.id } });
    }
  };

  // Rachunki nie mają podkategorii, więc pokazujemy nazwę kategorii głównej.
  const subtitle =
    payment.mainType === MainType.BILL
      ? strings.paymentDetail.mainTypeName[payment.mainType]
      : (categories.find((c) => c.id === payment.categoryId)?.name ??
        strings.paymentDetail.mainTypeName[payment.mainType]);

  return (
    <Card
      onPress={openDetails}
      accessibilityLabel={`${payment.merchant ?? payment.title}: ${formatGrosze(
        payment.amountGrosze ?? 0
      )}`}
    >
      <View style={styles.row}>
        <View style={[styles.iconBox, { backgroundColor: `${style.color}1A` }]}>
          <Ionicons name={style.icon} size={18} color={style.color} />
        </View>

        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{payment.merchant ?? payment.title}</Text>
          <Text style={styles.rowMeta}>
            {subtitle} · {formatDate(payment.effectiveDate)}
          </Text>

          {/* 5.7: rachunek z kwotą, ale nieopłacony, niesie oznaczenie statusu. */}
          {payment.status && payment.status !== BillStatus.PAID ? (
            <StatusBadge status={payment.status as BillStatus} />
          ) : null}
        </View>

        <Text style={styles.rowAmount}>{formatGrosze(payment.amountGrosze ?? 0)}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: fontSize.heading,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.lg,
  },
  group: {
    marginBottom: spacing.xl,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  groupMonth: {
    flexShrink: 0,
    fontSize: fontSize.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  groupTotal: {
    flexShrink: 0,
    fontSize: fontSize.caption,
    fontWeight: '600',
    color: colors.text,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMain: {
    flex: 1,
    gap: spacing.xs,
    alignItems: 'flex-start',
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
    flexShrink: 0,
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  emptyTitle: {
    fontSize: fontSize.label,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: spacing.sm,
    fontSize: fontSize.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  footnote: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
