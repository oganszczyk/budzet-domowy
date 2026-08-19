/**
 * Harmonogram subskrypcji (5.3, 7.4).
 *
 * Terminy WYLICZAMY z daty rozpoczęcia i częstotliwości, zamiast przesuwać
 * zapisaną „następną datę" krok po kroku. Powód jest ten sam co przy statusie
 * rachunku (BR-11): wartość wyliczona nie może się rozjechać.
 *
 * Gdybyśmy przesuwali zapisane pole, wystarczyłby jeden nieudany zapis albo
 * jedno wejście w przyszły miesiąc, żeby harmonogram przestał się zgadzać —
 * i subskrypcja roczna pojawiłaby się w złym miesiącu. Wyliczenie z daty
 * rozpoczęcia zawsze daje tę samą odpowiedź.
 */

import { addMonths, dueDateFor, yearMonthOf, type IsoDate, type YearMonth } from '@/lib/date';

import { FREQUENCY_MONTHS, FrequencyType } from './enums';
import type { Subscription } from './models';

/** Co ile miesięcy wypada płatność tej subskrypcji. */
export function intervalMonths(subscription: Subscription): number {
  if (subscription.frequencyType === FrequencyType.CUSTOM) {
    // Własna częstotliwość — minimum jeden miesiąc, żeby nie dzielić przez zero.
    return Math.max(1, subscription.customIntervalMonths ?? 1);
  }
  return FREQUENCY_MONTHS[subscription.frequencyType];
}

/** Liczba miesięcy od miesiąca `a` do miesiąca `b` (ujemna, gdy b jest wcześniej). */
function monthsBetween(a: YearMonth, b: YearMonth): number {
  return b.year * 12 + b.month - (a.year * 12 + a.month);
}

/**
 * Czy płatność tej subskrypcji wypada w podanym miesiącu?
 *
 * AC 5.3: „Subskrypcja miesięczna pojawia się dokładnie raz w każdym
 * właściwym miesiącu" oraz „Subskrypcja roczna zwiększa sumę tylko
 * w miesiącu jej płatności".
 */
export function occursInMonth(subscription: Subscription, month: YearMonth): boolean {
  const start = yearMonthOf(subscription.startDate);
  const distance = monthsBetween(start, month);

  // Przed rozpoczęciem subskrypcji nic nie powstaje.
  if (distance < 0) return false;

  return distance % intervalMonths(subscription) === 0;
}

/**
 * Data płatności w danym miesiącu — ten sam dzień miesiąca co data rozpoczęcia.
 * `dueDateFor` przycina go do długości miesiąca, więc subskrypcja rozpoczęta
 * 31 stycznia wypadnie 28 lutego, a nie w nieistniejącym dniu.
 */
export function paymentDateInMonth(subscription: Subscription, month: YearMonth): IsoDate {
  const day = Number(subscription.startDate.slice(-2));
  return dueDateFor(month, day);
}

/**
 * 5.3: „Najbliższa data płatności" pokazywana na liście.
 * Zwraca `null` dla zakończonej subskrypcji — nie będzie już płatności.
 */
export function nextPaymentDate(subscription: Subscription, fromMonth: YearMonth): IsoDate | null {
  if (!subscription.isActive) return null;

  const start = yearMonthOf(subscription.startDate);
  const interval = intervalMonths(subscription);
  const distance = monthsBetween(start, fromMonth);

  // Jeszcze przed startem — pierwsza płatność wypada w miesiącu rozpoczęcia.
  if (distance <= 0) return subscription.startDate;

  // Ile miesięcy zostało do końca bieżącego okresu.
  const intoPeriod = distance % interval;
  const monthsAhead = intoPeriod === 0 ? 0 : interval - intoPeriod;

  return paymentDateInMonth(subscription, addMonths(fromMonth, monthsAhead));
}

/**
 * 5.3 (P1): „prognozowany koszt roczny obliczony z aktywnych subskrypcji".
 * Miesięczna kosztuje 12x, kwartalna 4x, roczna 1x.
 */
export function yearlyCostGrosze(subscription: Subscription): number {
  if (!subscription.isActive) return 0;
  return Math.round((subscription.amountGrosze * 12) / intervalMonths(subscription));
}

/**
 * 5.3: „Co ustalony okres, domyślnie co 3 miesiące, pokazać pytanie:
 * «Czy nadal korzystasz z tej subskrypcji i ją opłacasz?»"
 *
 * Pytamy, gdy subskrypcja jest aktywna i minęło tyle miesięcy od ostatniego
 * potwierdzenia (albo od rozpoczęcia, jeśli nigdy nie potwierdzono).
 */
export function needsUsageConfirmation(subscription: Subscription, today: IsoDate): boolean {
  if (!subscription.isActive) return false;

  const since = subscription.lastUsageConfirmationDate ?? subscription.startDate;
  const monthsSince = monthsBetween(yearMonthOf(since), yearMonthOf(today));

  return monthsSince >= subscription.confirmationIntervalMonths;
}
