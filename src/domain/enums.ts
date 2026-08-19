/**
 * Wyliczenia (enumy) z rozdziału 7 specyfikacji.
 *
 * Zapisujemy je jako zwykłe obiekty ze stałymi + typ, a nie przez słowo
 * kluczowe `enum` TypeScriptu. Powód: taki zapis znika po kompilacji
 * (to zwykłe napisy), łatwo go zapisać do bazy i odczytać z powrotem,
 * a TypeScript i tak pilnuje, że nie wpiszemy literówki.
 *
 * Każda nazwa występuje dwa razy: raz jako obiekt (wartość, np. `MainType.BILL`)
 * i raz jako typ (np. `mainType: MainType`). To nie pomyłka — TypeScript trzyma
 * wartości i typy w osobnych przestrzeniach nazw, więc mogą nosić tę samą nazwę.
 * ESLint tego nie rozróżnia i zgłasza fałszywy alarm, dlatego wyłączamy tę regułę
 * w tym jednym pliku.
 */
/* eslint-disable @typescript-eslint/no-redeclare */

/** Kategoria główna. BR-01: każdy zapis należy do dokładnie jednej. */
export const MainType = {
  BILL: 'BILL',
  SUBSCRIPTION: 'SUBSCRIPTION',
  PURCHASE: 'PURCHASE',
} as const;
export type MainType = (typeof MainType)[keyof typeof MainType];

/** 5.2: statusy rachunku. */
export const BillStatus = {
  /** Rekord istnieje, ale kwota jest pusta. */
  WAITING_AMOUNT: 'WAITING_AMOUNT',
  /** Kwota wpisana, nieopłacony, termin nie minął. */
  TO_PAY: 'TO_PAY',
  /** Użytkownik oznaczył rachunek jako opłacony. */
  PAID: 'PAID',
  /** Kwota wpisana, nieopłacony, termin minął. */
  OVERDUE: 'OVERDUE',
} as const;
export type BillStatus = (typeof BillStatus)[keyof typeof BillStatus];

/** 7.2: skąd wziął się rekord płatności. */
export const PaymentSource = {
  /** Wpisany ręcznie przez użytkownika (5.5). */
  MANUAL: 'MANUAL',
  /** Utworzony automatycznie z szablonu rachunku (5.2). */
  AUTO_BILL: 'AUTO_BILL',
  /** Utworzony automatycznie z subskrypcji (5.3). */
  AUTO_SUBSCRIPTION: 'AUTO_SUBSCRIPTION',
  /** Powstał ze skanu paragonu, po potwierdzeniu przez użytkownika (5.6). */
  RECEIPT_SCAN: 'RECEIPT_SCAN',
} as const;
export type PaymentSource = (typeof PaymentSource)[keyof typeof PaymentSource];

/** 5.5: sposób płatności — pole opcjonalne. */
export const PaymentMethod = {
  CARD: 'CARD',
  CASH: 'CASH',
  TRANSFER: 'TRANSFER',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** 7.4: częstotliwość subskrypcji. */
export const FrequencyType = {
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  HALF_YEARLY: 'HALF_YEARLY',
  YEARLY: 'YEARLY',
  /** Własna — liczba miesięcy w polu customIntervalMonths. */
  CUSTOM: 'CUSTOM',
} as const;
export type FrequencyType = (typeof FrequencyType)[keyof typeof FrequencyType];

/** Ile miesięcy dzieli kolejne płatności danej częstotliwości. */
export const FREQUENCY_MONTHS: Record<Exclude<FrequencyType, 'CUSTOM'>, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};
