/**
 * Przypadek użycia: automatyczne tworzenie płatności subskrypcji (5.3).
 *
 *  [x] Aktywna subskrypcja tworzy płatność zgodnie z harmonogramem.
 *  [x] Kwota jest kopiowana automatycznie do kolejnego okresu.
 *  [x] Nie tworzyć duplikatu płatności dla tego samego terminu (BR-12).
 *
 * BR-07: „Zmiana szablonu cyklicznego nie nadpisuje historycznych płatności."
 * Kwotę kopiujemy w momencie tworzenia płatności i już jej nie ruszamy.
 * Podniesienie ceny Netflixa zmienia więc przyszłe miesiące, a nie te,
 * które użytkownik już zapłacił — tego wymaga AC 5.3.
 */

import type { ExpensesRepository } from '@/data/repository';
import { MainType, PaymentSource } from '@/domain/enums';
import type { Payment } from '@/domain/models';
import { occursInMonth, paymentDateInMonth } from '@/domain/subscription-schedule';
import type { YearMonth } from '@/lib/date';

/**
 * Uzupełnia brakujące płatności subskrypcji dla wybranego miesiąca
 * i zwraca te, które faktycznie powstały.
 */
export async function generateSubscriptionPayments(
  repository: ExpensesRepository,
  month: YearMonth
): Promise<Payment[]> {
  const subscriptions = await repository.listSubscriptions();
  const created: Payment[] = [];

  for (const subscription of subscriptions) {
    // AC 5.3: „Zakończona subskrypcja nie generuje nowych płatności."
    if (!subscription.isActive) continue;

    // Harmonogram: miesięczna co miesiąc, roczna tylko w miesiącu rocznicy.
    if (!occursInMonth(subscription, month)) continue;

    // Jak przy rachunkach: pytamy rejestru, a nie o istnienie płatności,
    // żeby ręcznie usunięta płatność nie wracała sama.
    if (await repository.hasGeneratedSubscriptionPayment(subscription.id, month)) continue;

    const payment = await repository.createPayment({
      mainType: MainType.SUBSCRIPTION,
      categoryId: subscription.categoryId,
      title: subscription.name,
      // Kwota kopiowana „na teraz" — późniejsza zmiana ceny jej nie ruszy (BR-07).
      amountGrosze: subscription.amountGrosze,
      effectiveDate: paymentDateInMonth(subscription, month),
      dueDate: null,
      paidDate: null,
      status: null,
      source: PaymentSource.AUTO_SUBSCRIPTION,
      merchant: subscription.name,
      description: null,
      paymentMethod: null,
      billTemplateId: null,
      subscriptionId: subscription.id,
      receiptImagePath: null,
    });

    await repository.markSubscriptionPaymentGenerated(subscription.id, month);
    created.push(payment);
  }

  return created;
}
