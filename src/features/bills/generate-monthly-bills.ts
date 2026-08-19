/**
 * Przypadek użycia: automatyczne tworzenie rachunków na wybrany miesiąc.
 *
 * 8.1: warstwa Application — „przypadki użycia, np. GenerateMonthlyBills".
 *
 * 5.2, Automatyczne tworzenie:
 *  [x] Dla aktywnego szablonu tworzyć jeden rekord na każdy miesiąc.
 *  [x] Nowy rekord dziedziczy nazwę, domyślny dzień terminu i kategorię.
 *  [x] Nowy rekord NIE dziedziczy kwoty, chyba że włączono stałą kwotę.
 *  [x] Domyślny stan nowego rekordu to WAITING_AMOUNT.
 *  [x] Nie tworzyć duplikatu, jeżeli rekord na dany miesiąc już istnieje.
 *
 * BR-12: „Aplikacja nie może tworzyć dwóch automatycznych rekordów tego
 * samego źródła na ten sam termin."
 */

import type { ExpensesRepository } from '@/data/repository';
import { PaymentSource } from '@/domain/enums';
import type { Payment } from '@/domain/models';
import { dueDateFor, yearMonthOf, type YearMonth } from '@/lib/date';

/** Czy miesiąc `a` wypada przed miesiącem `b`? */
function isBefore(a: YearMonth, b: YearMonth): boolean {
  return a.year * 12 + a.month < b.year * 12 + b.month;
}

/**
 * Uzupełnia brakujące rachunki dla wybranego miesiąca i zwraca te,
 * które faktycznie zostały utworzone.
 *
 * Wywołujemy to przy każdym otwarciu listy rachunków. Dzięki temu
 * AC 5.2 („po wejściu w nowy miesiąc aktywne rachunki pojawiają się
 * bez ręcznego kopiowania") działa bez żadnego zadania w tle —
 * a ponowne wejście na ten sam miesiąc niczego nie duplikuje.
 */
export async function generateMonthlyBills(
  repository: ExpensesRepository,
  month: YearMonth
): Promise<Payment[]> {
  const templates = await repository.listBillTemplates();
  const created: Payment[] = [];

  for (const template of templates) {
    // Nie cofamy się przed miesiąc, w którym szablon powstał —
    // inaczej przeglądanie odległej przeszłości tworzyłoby rachunki,
    // których nigdy nie było.
    if (isBefore(month, yearMonthOf(template.createdAt.slice(0, 10)))) {
      continue;
    }

    // BR-12: jeden rekord na szablon i miesiąc, nigdy dwa.
    const existing = await repository.findBillForTemplateAndMonth(template.id, month);
    if (existing !== null) continue;

    const payment = await repository.createPayment({
      mainType: 'BILL',
      categoryId: template.categoryId,
      title: template.name,
      /**
       * Kwoty NIE dziedziczymy, chyba że szablon ma jawnie włączoną stałą
       * kwotę. Pusta kwota to stan WAITING_AMOUNT (BR-04) i nie wchodzi
       * do sum (BR-05) — dlatego nowy miesiąc nie zawyża wydatków.
       */
      amountGrosze: template.useFixedAmount ? template.fixedAmountGrosze : null,
      effectiveDate: dueDateFor(month, 1),
      dueDate: dueDateFor(month, template.defaultDueDay),
      paidDate: null,
      // Status wyliczamy przy odczycie (BR-11).
      status: null,
      source: PaymentSource.AUTO_BILL,
      merchant: null,
      description: null,
      paymentMethod: null,
      billTemplateId: template.id,
      subscriptionId: null,
      receiptImagePath: null,
    });

    created.push(payment);
  }

  return created;
}
