/**
 * Etap 12: dane dla ekranu analizy — warstwa Application (8.1).
 *
 * Ekran pyta hook, hook pyta repozytorium, a cała matematyka siedzi
 * w czystych funkcjach obok (`series.ts`, `proposals.ts`). Ten plik jest
 * wyłącznie spoiwem: pobiera rekordy i wstrzykuje do nich polskie teksty.
 *
 * Klucze zapytań zaczynają się od `'expenses'`, tak samo jak wszystkie
 * pozostałe. To nie ozdoba: zapis wydatku unieważnia całą tę gałąź, więc
 * zestawienie odświeża się samo — inaczej wykres pokazywałby stan sprzed
 * dodania zakupu aż do restartu aplikacji (AC 5.1).
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { strings } from '@/constants/strings';
import { getRepository } from '@/data';
import type { AnalysisSubject } from '@/domain/analysis';
import { useAllBillTemplates } from '@/features/bills/queries';
import { useCategories } from '@/features/expenses/queries';
import { useSubscriptionList } from '@/features/subscriptions/queries';
import { addMonths, currentYearMonth, formatMonthYear, type YearMonth } from '@/lib/date';

import {
  buildProposals,
  PROPOSAL_LOOKBACK_MONTHS,
  type AnalysisProposal,
  type ProposalTexts,
} from './proposals';
import { buildSeries, type SeriesPoint } from './series';
import { EMPTY_DICTIONARIES, type SubjectDictionaries } from './subject';

export const analysisQueryKeys = {
  range: (from: YearMonth, to: YearMonth) =>
    ['expenses', 'analysisRange', from.year, from.month, to.year, to.month] as const,
};

/** Surowe rekordy z zakresu — jedno zapytanie na cały ekran zestawienia. */
export function useRangeRecords(from: YearMonth, to: YearMonth) {
  return useQuery({
    queryKey: analysisQueryKeys.range(from, to),
    queryFn: async () => {
      const repository = await getRepository();

      // Dwa zapytania naraz, bo nie zależą od siebie. Dochody i płatności
      // to osobne tabele od Etapu 11 i żadna nie potrzebuje wyniku drugiej.
      const [payments, incomes] = await Promise.all([
        repository.listPaymentsForRange(from, to),
        repository.listIncomesForRange(from, to),
      ]);

      return { payments, incomes };
    },
  });
}

/** Nazwy pozycji: rachunki (także wyłączone), podkategorie, subskrypcje. */
export function useSubjectDictionaries(): SubjectDictionaries {
  // Rachunki WYŁĄCZONE też muszą tu być. Analiza sięga wstecz, a rachunek
  // wyłączony miesiąc temu ma pełną historię wcześniejszych kwot (7.5) —
  // bez niego zestawienie nazwałoby ją „Pozycja usunięta".
  const { data: billTemplates } = useAllBillTemplates();
  const { data: categories } = useCategories();
  const { data: subscriptions } = useSubscriptionList();

  return useMemo(
    () => ({
      billTemplates: billTemplates ?? [],
      categories: categories ?? [],
      subscriptions: subscriptions ?? [],
    }),
    [billTemplates, categories, subscriptions]
  );
}

/** Polskie brzmienie powodów, dla których aplikacja proponuje zestawienie. */
const PROPOSAL_TEXTS: ProposalTexts = {
  higher: (percent, month) => strings.analysis.proposalHigher(percent, formatMonthYear(month)),
  lower: (percent, month) => strings.analysis.proposalLower(percent, formatMonthYear(month)),
  overspent: (month) => strings.analysis.proposalOverspent(formatMonthYear(month)),
  biggestBill: (months) => strings.analysis.proposalBiggestBill(months),
  allExpenses: (months) => strings.analysis.proposalAllExpenses(months),
  bills: (months) => strings.analysis.proposalBills(months),
  incomeVsSpending: (months) => strings.analysis.proposalIncome(months),
};

/**
 * Propozycje na ekranie „Analiza".
 *
 * Punktem odniesienia jest BIEŻĄCY MIESIĄC URZĄDZENIA, a nie miesiąc wybrany
 * przełącznikiem na ekranie głównym. Propozycje odpowiadają na pytanie
 * „co się ostatnio zmieniło", więc przeglądanie historii sprzed roku nie
 * powinno ich przestawiać.
 */
export function useAnalysisProposals(): { proposals: AnalysisProposal[]; isLoaded: boolean } {
  const month = currentYearMonth();
  const dictionaries = useSubjectDictionaries();

  // Zakres propozycji ustala sam `buildProposals`; tutaj musimy jedynie
  // pobrać tyle samo miesięcy, ile on obejrzy.
  const from = useMemo(
    () => addMonths(month, -(PROPOSAL_LOOKBACK_MONTHS - 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month.year, month.month]
  );

  const { data, isPending } = useRangeRecords(from, month);

  const proposals = useMemo(() => {
    if (!data) return [];

    return buildProposals(
      {
        month,
        payments: data.payments,
        incomes: data.incomes,
        billTemplates: dictionaries.billTemplates,
        categories: dictionaries.categories,
        subscriptions: dictionaries.subscriptions,
      },
      PROPOSAL_TEXTS
    );
    // `month` pochodzi z zegara urządzenia i w praktyce jest stałe w trakcie
    // jednego uruchomienia; zależność opisujemy przez jego składowe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dictionaries, month.year, month.month]);

  return { proposals, isLoaded: !isPending };
}

/** Szereg miesięczny dla jednego przedmiotu analizy i jednego zakresu. */
export function useAnalysisSeries(
  subject: AnalysisSubject,
  from: YearMonth,
  to: YearMonth
): { points: SeriesPoint[]; isLoaded: boolean } {
  const { data, isPending } = useRangeRecords(from, to);

  const points = useMemo(() => {
    if (!data) return [];
    return buildSeries({ from, to, subject, payments: data.payments, incomes: data.incomes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, subject, from.year, from.month, to.year, to.month]);

  return { points, isLoaded: !isPending };
}

/** Nazwy pozycji, gdy nie zdążyły się jeszcze wczytać. */
export { EMPTY_DICTIONARIES };
