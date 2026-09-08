/**
 * Odmiana rzeczowników przez liczbę (Etap 13).
 *
 * 1.2: interfejs jest po polsku, a polszczyzna ma TRZY formy liczby mnogiej,
 * nie dwie. „Ostatnie 3 miesięcy" albo „ostatnie 22 miesiące" to nie drobiazg
 * kosmetyczny — tak pisze automat, nie aplikacja, której powierza się domowy
 * budżet.
 *
 * Reguła jest wyjątkowo regularna, o ile pamięta się o nastolatkach:
 *  - 1                                   → miesiąc
 *  - końcówka 2, 3 lub 4                 → miesiące
 *  - reszta, w tym 12, 13, 14            → miesięcy
 *
 * Wyjątek na 12–14 jest tu sednem: bez niego „12 miesiące" przechodzi przez
 * pierwszą regułę, bo kończy się dwójką.
 */

export type PluralForms = {
  /** Dokładnie jeden: „miesiąc". */
  one: string;
  /** Końcówka 2-4 poza nastolatkami: „miesiące". */
  few: string;
  /** Wszystkie pozostałe, w tym zero: „miesięcy". */
  many: string;
};

/** Wybiera właściwą formę dla podanej liczby. Liczby ujemne traktuje jak dodatnie. */
export function plural(count: number, forms: PluralForms): string {
  const n = Math.abs(Math.trunc(count));

  if (n === 1) return forms.one;

  const lastTwo = n % 100;
  const last = n % 10;

  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return forms.few;

  return forms.many;
}

/** Skrót dla najczęstszego przypadku w tej aplikacji. */
export function months(count: number): string {
  return plural(count, { one: 'miesiąc', few: 'miesiące', many: 'miesięcy' });
}
