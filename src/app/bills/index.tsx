/**
 * 5.2: RACHUNKI DOMOWE — lista
 *
 * Lista rachunków:
 *  [x] Na górze ekranu wyświetlać łączną sumę rachunków z wybranego miesiąca.
 *  [x] Każdy wiersz pokazuje nazwę, kwotę lub tekst „Uzupełnij kwotę",
 *      termin oraz status.
 *  [x] Kliknięcie wiersza otwiera szczegóły rachunku.
 *  [x] Przycisk dodawania pozwala utworzyć nowy typ rachunku cyklicznego.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import type { BillStatus } from '@/domain/enums';
import type { Payment } from '@/domain/models';
import { useBillsForMonth } from '@/features/bills/queries';
import { useMonth } from '@/features/month/month-context';
import { formatDate, formatMonthYear } from '@/lib/date';
import { formatGrosze } from '@/lib/money';
import { Button } from '@/ui/components/button';
import { Card } from '@/ui/components/card';
import { Screen } from '@/ui/components/screen';
import { StatusBadge } from '@/ui/components/status-badge';
import { colors, fontSize, spacing } from '@/ui/theme';

export default function BillsScreen() {
  const router = useRouter();
  const { month } = useMonth();
  const { data: bills, isLoading } = useBillsForMonth();

  const rows = bills ?? [];

  // 6.1: suma rachunków obejmuje pozycje z uzupełnioną kwotą,
  // niezależnie od statusu opłacenia. BR-05: puste kwoty pomijamy.
  const totalGrosze = rows.reduce((sum, bill) => sum + (bill.amountGrosze ?? 0), 0);

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>{strings.bills.total}</Text>
        <Text style={styles.headerAmount}>{formatGrosze(totalGrosze)}</Text>
        <Text style={styles.headerMonth}>{formatMonthYear(month)}</Text>
      </View>

      <View style={styles.list}>
        {rows.map((bill) => (
          <BillRow
            key={bill.id}
            bill={bill}
            // Trasę podajemy jako wzorzec + parametry, a nie sklejony tekst.
            // Przy włączonych typowanych trasach (app.json: typedRoutes)
            // TypeScript sprawdza wtedy, że taka trasa naprawdę istnieje.
            onPress={() => router.push({ pathname: '/bills/[id]', params: { id: bill.id } })}
          />
        ))}

        {rows.length === 0 && !isLoading ? (
          <Card>
            <Text style={styles.empty}>{strings.bills.empty}</Text>
          </Card>
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          label={strings.bills.addTemplate}
          icon="add"
          variant="secondary"
          onPress={() => router.push('/bills/new')}
        />
      </View>
    </Screen>
  );
}

function BillRow({ bill, onPress }: { bill: Payment; onPress: () => void }) {
  const hasAmount = bill.amountGrosze !== null;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${bill.title}, ${
        hasAmount ? formatGrosze(bill.amountGrosze as number) : strings.bills.fillAmount
      }`}
    >
      <View style={styles.row}>
        <View style={styles.rowMain}>
          <Text style={styles.rowTitle}>{bill.title}</Text>

          {bill.dueDate ? (
            <Text style={styles.rowDue}>
              {strings.bills.dueShort} {formatDate(bill.dueDate)}
            </Text>
          ) : null}

          {bill.status ? <StatusBadge status={bill.status as BillStatus} /> : null}
        </View>

        <View style={styles.rowRight}>
          <Text style={[styles.rowAmount, !hasAmount && styles.rowAmountMissing]}>
            {hasAmount ? formatGrosze(bill.amountGrosze as number) : strings.bills.fillAmount}
          </Text>
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
  rowDue: {
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
  rowAmountMissing: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.statusWaiting,
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
