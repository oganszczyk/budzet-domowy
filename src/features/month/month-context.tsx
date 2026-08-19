/**
 * Wybrany miesiąc — jedyny prawdziwy stan interfejsu w aplikacji.
 *
 * 4.3: domyślnie aktualny miesiąc urządzenia; użytkownik przechodzi
 * do poprzedniego lub następnego; wybrany miesiąc pozostaje aktywny
 * podczas przechodzenia do szczegółów kategorii.
 *
 * To ostatnie zdanie jest powodem, dla którego miesiąc trzymamy w kontekście
 * ponad nawigacją, a nie w stanie pojedynczego ekranu. Gdyby miesiąc był
 * stanem ekranu głównego, wejście w „Rachunki” i powrót zresetowałoby go
 * z powrotem na bieżący miesiąc.
 *
 * BR-09: wszystkie sumy w aplikacji zależą od tej jednej wartości.
 */

import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { addMonths, currentYearMonth, type YearMonth } from '@/lib/date';

type MonthContextValue = {
  /** Aktualnie wybrany miesiąc i rok. */
  month: YearMonth;
  /** 4.3: przejście do poprzedniego miesiąca. */
  goToPreviousMonth: () => void;
  /** 4.3: przejście do następnego miesiąca (także w przyszłość). */
  goToNextMonth: () => void;
  /** Powrót do bieżącego miesiąca urządzenia. */
  goToCurrentMonth: () => void;
};

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<YearMonth>(() => currentYearMonth());

  const goToPreviousMonth = useCallback(() => {
    setMonth((current) => addMonths(current, -1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonth((current) => addMonths(current, 1));
  }, []);

  const goToCurrentMonth = useCallback(() => {
    setMonth(currentYearMonth());
  }, []);

  const value = useMemo(
    () => ({ month, goToPreviousMonth, goToNextMonth, goToCurrentMonth }),
    [month, goToPreviousMonth, goToNextMonth, goToCurrentMonth]
  );

  return <MonthContext value={value}>{children}</MonthContext>;
}

/** Odczytuje wybrany miesiąc. Działa tylko wewnątrz <MonthProvider>. */
export function useMonth(): MonthContextValue {
  const value = use(MonthContext);
  if (!value) {
    throw new Error('useMonth() musi być użyte wewnątrz <MonthProvider>.');
  }
  return value;
}
