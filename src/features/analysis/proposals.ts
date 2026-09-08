/**
 * Etap 12: propozycje zestawień — to, co widać po wejściu w „Analiza".
 *
 * Ekran nigdy nie jest pusty i nigdy nie ma na nim więcej niż trzy karty.
 * Decyzja właściciela projektu (27.08.2026): propozycje mają być DOBIERANE
 * DO DANYCH, a nie stałe. Aplikacja ma wskazać to, co się wyróżnia, zamiast
 * kazać użytkownikowi samemu szukać, gdzie coś drgnęło.
 *
 * Czysta funkcja: dostaje rekordy, oddaje trzy propozycje. Nie zna bazy,
 * nie zna Reacta. Reguła „co jest warte pokazania" jest tu jedna, opisana
 * i pokryta testami — a nie rozsypana po komponentach.
 */

import { AnalysisSubjectKind, type AnalysisSubject } from '@/domain/analysis';
import { MainType } from '@/domain/enums';
import type { BillTemplate, Category, Income, Payment, Subscription } from '@/domain/models';
import { addMonths, yearMonthKey, type YearMonth } from '@/lib/date';

import { buildSeries, summarizeSeries, type SeriesPoint } from './series';
import { subjectKey } from './subject';

/** Ile miesięcy wstecz oglądamy, szukając czegoś wartego pokazania. */
export const PROPOSAL_LOOKBACK_MONTHS = 6;

/** Ile kart mieści się na ekranie, zanim zrobi się bałagan. */
export const MAX_PROPOSALS = 3;

/**
 * Progi „to już jest warte uwagi".
 *
 * DWA WARUNKI NARAZ, NIE JEDEN. Sam procent zgłaszałby kawę, która
 * podrożała z 8 na 12 zł (+50%). Sama złotówka zgłaszałaby czynsz, który
 * drgnął o 30 zł na 2 500 zł — czyli szum. Dopiero oba razem wyłapują
 * zmiany, które faktycznie zmieniają domowy budżet.
 */
const MIN_RELATIVE_CHANGE = 0.2;
const MIN_ABSOLUTE_CHANGE_GROSZE = 2000;

/** Ile miesięcy musi mieć dana pozycja, żeby dało się mówić o „zwykle". */
const MIN_MONTHS_FOR_AVERAGE = 3;

/** Wymowa propozycji — decyduje o kolorze paska na karcie. */
export const ProposalTone = {
  /** Coś podrożało albo budżet nie domyka się. */
  ALERT: 'ALERT',
  /** Coś staniało. */
  GOOD: 'GOOD',
  /** Zwykłe zestawienie, bez oceny. */
  NEUTRAL: 'NEUTRAL',
} as const;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ProposalTone = (typeof ProposalTone)[keyof typeof ProposalTone];

export type AnalysisProposal = {
  /** Klucz listy Reacta i klucz testów. */
  key: string;
  subject: AnalysisSubject;
  from: YearMonth;
  to: YearMonth;
  tone: ProposalTone;
  /** Zdanie mówiące, DLACZEGO to pokazujemy. Ekran dokłada nazwę pozycji. */
  reason: string;
};

export type ProposalInput = {
  /** Bieżący miesiąc urządzenia — punkt odniesienia całego ekranu. */
  month: YearMonth;
  payments: Payment[];
  incomes: Income[];
  billTemplates: BillTemplate[];
  categories: Category[];
  subscriptions: Subscription[];
};

/** Teksty powodów wstrzykujemy, żeby ta funkcja nie znała warstwy interfejsu. */
export type ProposalTexts = {
  higher: (percent: number, month: YearMonth) => string;
  lower: (percent: number, month: YearMonth) => string;
  overspent: (month: YearMonth) => string;
  biggestBill: (months: number) => string;
  allExpenses: (months: number) => string;
  bills: (months: number) => string;
  incomeVsSpending: (months: number) => string;
};

type Candidate = {
  subject: AnalysisSubject;
  /**
   * Czy rekordy tej pozycji opisują CAŁY miesiąc od razu.
   *
   * Rachunek i subskrypcja tak: kwota jest znana w chwili powstania rekordu,
   * a rachunek bez kwoty i tak nie wchodzi do sum (BR-05). Zakupy nie —
   * zbierają się przez cały miesiąc, więc porównanie trwającego miesiąca
   * ze średnią zawsze wychodziłoby „taniej niż zwykle". To byłaby fałszywa
   * dobra wiadomość, i to pokazywana codziennie.
   */
  monthGranular: boolean;
};

type ScoredProposal = AnalysisProposal & { score: number };

/**
 * Buduje do trzech propozycji zestawień.
 *
 * Kolejność: najpierw to, co najmocniej odbiega od normy (mierzone
 * ZŁOTÓWKAMI, nie procentami — bo to złotówki wychodzą z portfela),
 * potem zestawienia zapasowe, żeby ekran nigdy nie był pusty.
 */
export function buildProposals(input: ProposalInput, texts: ProposalTexts): AnalysisProposal[] {
  const { month, payments, incomes } = input;
  const from = addMonths(month, -(PROPOSAL_LOOKBACK_MONTHS - 1));
  const previousMonth = addMonths(month, -1);

  const scored: ScoredProposal[] = [];

  for (const candidate of collectCandidates(input)) {
    const points = buildSeries({ from, to: month, subject: candidate.subject, payments, incomes });
    const reference = candidate.monthGranular ? month : previousMonth;

    const deviation = findDeviation(points, reference);
    if (!deviation) continue;

    const percent = Math.abs(Math.round(deviation.relative * 100));

    scored.push({
      key: `deviation:${subjectKey(candidate.subject)}`,
      subject: candidate.subject,
      from,
      to: month,
      tone: deviation.changeGrosze > 0 ? ProposalTone.ALERT : ProposalTone.GOOD,
      reason:
        deviation.changeGrosze > 0
          ? texts.higher(percent, reference)
          : texts.lower(percent, reference),
      score: Math.abs(deviation.changeGrosze),
    });
  }

  const overspend = findOverspend(input, previousMonth);
  if (overspend > 0) {
    scored.push({
      key: 'overspend',
      subject: { kind: AnalysisSubjectKind.INCOME },
      from,
      to: month,
      tone: ProposalTone.ALERT,
      reason: texts.overspent(previousMonth),
      score: overspend,
    });
  }

  scored.sort((a, b) => b.score - a.score);

  return fillWithFallbacks(
    scored.map(({ score: _score, ...proposal }) => proposal),
    input,
    from,
    texts
  );
}

/** Wszystko, o co w ogóle warto zapytać: rachunki, subskrypcje, podkategorie. */
function collectCandidates(input: ProposalInput): Candidate[] {
  return [
    ...input.billTemplates.map((template) => ({
      subject: {
        kind: AnalysisSubjectKind.BILL_TEMPLATE,
        billTemplateId: template.id,
      } as AnalysisSubject,
      monthGranular: true,
    })),
    ...input.subscriptions.map((subscription) => ({
      subject: {
        kind: AnalysisSubjectKind.SUBSCRIPTION,
        subscriptionId: subscription.id,
      } as AnalysisSubject,
      monthGranular: true,
    })),
    ...input.categories
      .filter((category) => category.usedBy.includes(MainType.PURCHASE))
      .map((category) => ({
        subject: { kind: AnalysisSubjectKind.CATEGORY, categoryId: category.id } as AnalysisSubject,
        monthGranular: false,
      })),
  ];
}

type Deviation = {
  changeGrosze: number;
  /** Zmiana względem średniej z wcześniejszych miesięcy, np. 0.42 = +42%. */
  relative: number;
};

/**
 * Czy wskazany miesiąc odbiega od tego, co było wcześniej.
 *
 * Średnią liczymy WYŁĄCZNIE z miesięcy PRZED miesiącem odniesienia. Gdyby
 * wchodził do niej także on sam, podnosiłby własną poprzeczkę i duże skoki
 * wyglądałyby na mniejsze, niż są.
 */
function findDeviation(points: SeriesPoint[], reference: YearMonth): Deviation | null {
  const referenceKey = yearMonthKey(reference);
  const current = points.find((p) => p.key === referenceKey);
  if (!current || current.entryCount === 0) return null;

  const earlier = points.filter((p) => p.key < referenceKey);
  const earlierSummary = summarizeSeries(earlier);

  // „Zwykle" wymaga co najmniej dwóch wcześniejszych miesięcy plus bieżącego.
  if (earlierSummary.monthsWithData < MIN_MONTHS_FOR_AVERAGE - 1) return null;
  if (earlierSummary.averageGrosze === 0) return null;

  const changeGrosze = current.totalGrosze - earlierSummary.averageGrosze;
  const relative = changeGrosze / earlierSummary.averageGrosze;

  if (Math.abs(relative) < MIN_RELATIVE_CHANGE) return null;
  if (Math.abs(changeGrosze) < MIN_ABSOLUTE_CHANGE_GROSZE) return null;

  return { changeGrosze, relative };
}

/**
 * O ile wydatki przekroczyły dochody w OSTATNIM ZAMKNIĘTYM miesiącu.
 *
 * Zamkniętym, bo w trwającym miesiącu część wypłat jeszcze nie wpłynęła
 * i przekroczenie zgłaszałoby się co miesiąc na początku, zawsze niesłusznie.
 * Zwraca 0, gdy nie ma wpisanych dochodów — bez nich nie ma czego przekraczać
 * (ta sama zasada, co przy karcie budżetu z Etapu 11).
 */
function findOverspend(input: ProposalInput, month: YearMonth): number {
  const key = yearMonthKey(month);

  const incomeGrosze = input.incomes
    .filter((i) => i.month === key)
    .reduce((total, i) => total + i.amountGrosze, 0);
  if (incomeGrosze === 0) return 0;

  const spentGrosze = input.payments
    .filter((p) => p.effectiveDate.slice(0, 7) === key)
    .reduce((total, p) => total + (p.amountGrosze ?? 0), 0);

  return Math.max(0, spentGrosze - incomeGrosze);
}

/**
 * Dopełnia listę zestawieniami zapasowymi do trzech kart.
 *
 * Zapasowe propozycje nie niosą oceny — po prostu są zawsze możliwe,
 * także przy zupełnie pustej aplikacji. Ekran analizy, który pierwszego dnia
 * wita komunikatem „brak danych", nie zachęca do niczego.
 *
 * Zapasowych jest CZTERY, a kart mieści się trzy. Nadmiar jest celowy:
 * „największy rachunek" odpada, gdy nie ma jeszcze żadnego rachunku z kwotą,
 * a lista i tak musi się wtedy zapełnić.
 */
function fillWithFallbacks(
  proposals: AnalysisProposal[],
  input: ProposalInput,
  from: YearMonth,
  texts: ProposalTexts
): AnalysisProposal[] {
  const { month } = input;
  const fallbacks: AnalysisProposal[] = [];

  const biggestBill = findBiggestBill(input, from);
  if (biggestBill) {
    fallbacks.push({
      key: `biggestBill:${subjectKey(biggestBill)}`,
      subject: biggestBill,
      from,
      to: month,
      tone: ProposalTone.NEUTRAL,
      reason: texts.biggestBill(PROPOSAL_LOOKBACK_MONTHS),
    });
  }

  fallbacks.push({
    key: 'allExpenses',
    subject: { kind: AnalysisSubjectKind.ALL_EXPENSES },
    from,
    to: month,
    tone: ProposalTone.NEUTRAL,
    reason: texts.allExpenses(PROPOSAL_LOOKBACK_MONTHS),
  });

  fallbacks.push({
    key: 'bills',
    subject: { kind: AnalysisSubjectKind.MAIN_TYPE, mainType: MainType.BILL },
    from,
    to: month,
    tone: ProposalTone.NEUTRAL,
    reason: texts.bills(PROPOSAL_LOOKBACK_MONTHS),
  });

  fallbacks.push({
    key: 'income',
    subject: { kind: AnalysisSubjectKind.INCOME },
    from,
    to: month,
    tone: ProposalTone.NEUTRAL,
    reason: texts.incomeVsSpending(PROPOSAL_LOOKBACK_MONTHS),
  });

  const result: AnalysisProposal[] = [];
  const used = new Set<string>();

  for (const proposal of [...proposals, ...fallbacks]) {
    if (result.length === MAX_PROPOSALS) break;
    // Ta sama pozycja nie może pojawić się dwa razy, choćby trafiła tu
    // raz jako odchylenie, a raz jako zestawienie zapasowe.
    const identity = subjectKey(proposal.subject);
    if (used.has(identity)) continue;

    used.add(identity);
    result.push(proposal);
  }

  return result;
}

/** Rachunek, który w zakresie kosztował najwięcej. `null`, gdy nie ma żadnego. */
function findBiggestBill(input: ProposalInput, from: YearMonth): AnalysisSubject | null {
  let best: { subject: AnalysisSubject; totalGrosze: number } | null = null;

  for (const template of input.billTemplates) {
    const subject: AnalysisSubject = {
      kind: AnalysisSubjectKind.BILL_TEMPLATE,
      billTemplateId: template.id,
    };
    const points = buildSeries({
      from,
      to: input.month,
      subject,
      payments: input.payments,
      incomes: input.incomes,
    });
    const totalGrosze = summarizeSeries(points).totalGrosze;

    if (totalGrosze > 0 && (best === null || totalGrosze > best.totalGrosze)) {
      best = { subject, totalGrosze };
    }
  }

  return best?.subject ?? null;
}
