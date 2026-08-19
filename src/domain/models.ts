/**
 * Model danych z rozdziału 7 specyfikacji.
 *
 * Założenie modelu (7): wspólna tabela płatności jest źródłem historii i sum.
 * Rachunki oraz subskrypcje mają osobne szablony cykliczne, które generują
 * rekordy w tabeli płatności.
 *
 * To dlatego `Payment` ma pola `billTemplateId` i `subscriptionId` —
 * pokazują, z czego dany rekord powstał.
 */

import type { IsoDate } from '@/lib/date';

import type { BillStatus, FrequencyType, MainType, PaymentMethod, PaymentSource } from './enums';

/** 7.1: Encja Category — kategorie i podkategorie. */
export type Category = {
  id: number;
  mainType: MainType;
  /** Nazwa widoczna w aplikacji, po polsku. */
  name: string;
  /** Klucz ikony — sam napis, nigdy gotowy komponent. */
  iconKey: string;
  /** 7.5: kategorię z historią ukrywamy, a nie kasujemy. */
  isActive: boolean;
  sortOrder: number;
};

/** 7.2: Encja Payment — jeden zapis finansowy. */
export type Payment = {
  id: number;
  mainType: MainType;
  /** Podkategoria lub kategoria źródłowa. */
  categoryId: number;
  /** Np. „Prąd", „Netflix", „Lidl". */
  title: string;
  /**
   * Kwota w groszach (BR-03).
   * BR-04: może być pusta WYŁĄCZNIE dla rachunku w stanie WAITING_AMOUNT.
   * BR-05: pusta kwota nie wchodzi do sum i nie trafia do historii.
   */
  amountGrosze: number | null;
  /** Data zakupu/płatności albo miesiąc rachunku. */
  effectiveDate: IsoDate;
  /** Termin rachunku. */
  dueDate: IsoDate | null;
  /** Data opłacenia rachunku. */
  paidDate: IsoDate | null;
  /** Status rachunku; dla pozostałych typów `null`. */
  status: BillStatus | null;
  source: PaymentSource;
  /** Sklep lub usługodawca. */
  merchant: string | null;
  description: string | null;
  paymentMethod: PaymentMethod | null;
  /** Źródłowy szablon rachunku cyklicznego. */
  billTemplateId: number | null;
  /** Źródłowa subskrypcja. */
  subscriptionId: number | null;
  /** Lokalna ścieżka zdjęcia paragonu. */
  receiptImagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 7.3: Encja BillTemplate — szablon rachunku cyklicznego. */
export type BillTemplate = {
  id: number;
  name: string;
  categoryId: number;
  /** Domyślny dzień terminu w miesiącu (1-31). */
  defaultDueDay: number;
  /** Czy tworzyć rekordy na kolejne miesiące. */
  isActive: boolean;
  /** Czy kopiować stałą kwotę do nowych miesięcy. */
  useFixedAmount: boolean;
  fixedAmountGrosze: number | null;
  createdAt: string;
  updatedAt: string;
};

/** 7.4: Encja Subscription. */
export type Subscription = {
  id: number;
  name: string;
  /** Aktualna kwota przyszłych płatności. */
  amountGrosze: number;
  frequencyType: FrequencyType;
  /** Liczba miesięcy dla częstotliwości własnej. */
  customIntervalMonths: number | null;
  startDate: IsoDate;
  /** Następna data wygenerowania płatności. */
  nextPaymentDate: IsoDate;
  categoryId: number;
  isActive: boolean;
  /** Ostatnie potwierdzenie korzystania (5.3). */
  lastUsageConfirmationDate: IsoDate | null;
  /** Domyślnie 3 miesiące. */
  confirmationIntervalMonths: number;
  createdAt: string;
  updatedAt: string;
};

/** 5.1: trzy sumy pokazywane na ekranie głównym. */
export type MonthlyTotals = {
  billsGrosze: number;
  subscriptionsGrosze: number;
  purchasesGrosze: number;
};
