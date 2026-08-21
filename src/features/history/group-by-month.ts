/**
 * 5.7: „Grupować wizualnie według daty lub miesiąca, jeżeli poprawia
 * czytelność."
 *
 * Historia bywa długa, a wspólna lista trzech źródeł bez podziału zlewa się
 * w jeden ciąg kwot. Nagłówek miesiąca daje punkt zaczepienia przy przewijaniu.
 */

import type { Payment } from '@/domain/models';
import { yearMonthOf, type YearMonth } from '@/lib/date';

export type MonthGroup = {
  month: YearMonth;
  payments: Payment[];
  /** Suma płatności w tym miesiącu — te same rekordy, które są na liście. */
  totalGrosze: number;
};

/**
 * Dzieli listę płatności na grupy miesięczne.
 *
 * Zakłada, że wejście jest już posortowane od najnowszych do najstarszych
 * (tak zwraca `listHistory`), i tę kolejność zachowuje — zarówno między
 * grupami, jak i wewnątrz każdej z nich. Dzięki temu AC 5.7 o kolejności
 * przy wielu płatnościach tego samego dnia obowiązuje także tutaj.
 */
export function groupPaymentsByMonth(payments: Payment[]): MonthGroup[] {
  const groups: MonthGroup[] = [];

  for (const payment of payments) {
    const month = yearMonthOf(payment.effectiveDate);
    const last = groups[groups.length - 1];

    // Wejście jest posortowane, więc płatności z jednego miesiąca leżą obok
    // siebie — wystarczy porównać z ostatnią grupą, bez szukania po całości.
    if (last && last.month.year === month.year && last.month.month === month.month) {
      last.payments.push(payment);
      last.totalGrosze += payment.amountGrosze ?? 0;
      continue;
    }

    groups.push({
      month,
      payments: [payment],
      totalGrosze: payment.amountGrosze ?? 0,
    });
  }

  return groups;
}
