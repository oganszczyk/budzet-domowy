/**
 * BR-11: status OVERDUE jest WYLICZANY na podstawie terminu, statusu
 * opłacenia i bieżącej daty.
 *
 * Dlaczego wyliczany, a nie zapisany w bazie?
 * Rachunek z terminem 10 sierpnia jest 9 sierpnia „Do zapłaty",
 * a 11 sierpnia „Po terminie" — mimo że nikt niczego nie zmienił.
 * Gdybyśmy status zapisali w bazie, byłby nieaktualny następnego dnia,
 * a AC 5.2 wymaga, żeby rachunek po terminie „automatycznie" zmieniał status.
 */

import type { IsoDate } from '@/lib/date';

import { BillStatus } from './enums';

type BillStatusInput = {
  /** BR-04: pusta kwota oznacza rachunek oczekujący. */
  amountGrosze: number | null;
  /** Ustawiana, gdy użytkownik oznaczy rachunek jako opłacony. */
  paidDate: IsoDate | null;
  dueDate: IsoDate | null;
};

/**
 * Wyznacza status rachunku wg tabeli z 5.2.
 *
 * Kolejność sprawdzania ma znaczenie:
 *  1. opłacony  — decyzja użytkownika jest ważniejsza niż wszystko inne;
 *  2. brak kwoty — rachunek dopiero czeka na uzupełnienie;
 *  3. po terminie — kwota jest, termin minął, nadal nieopłacony;
 *  4. do zapłaty — pozostałe przypadki.
 *
 * Punkt 2 przed 3 wynika wprost ze specyfikacji: OVERDUE wymaga,
 * żeby „kwota była wpisana". Rachunek bez kwoty po terminie
 * pozostaje więc w stanie „Oczekuje na kwotę".
 *
 * @param today dzisiejsza data ISO — podawana z zewnątrz, żeby testy
 *              nie zależały od tego, którego dziś jest.
 */
export function computeBillStatus(bill: BillStatusInput, today: IsoDate): BillStatus {
  if (bill.paidDate !== null) return BillStatus.PAID;
  if (bill.amountGrosze === null) return BillStatus.WAITING_AMOUNT;

  // Daty ISO porównujemy zwykłym operatorem — tekst "2026-08-09" < "2026-08-10".
  if (bill.dueDate !== null && bill.dueDate < today) return BillStatus.OVERDUE;

  return BillStatus.TO_PAY;
}
