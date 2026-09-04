/**
 * Etap 12: WŁASNE ZESTAWIENIE
 *
 * Jeden ekran obsługuje dwie drogi wejścia, celowo:
 *  - kliknięcie propozycji z ekranu „Analiza" (parametry przychodzą w adresie),
 *  - przycisk „Zbuduj własne zestawienie" (parametrów nie ma, biorą się
 *    wartości domyślne).
 *
 * Dzięki temu propozycja nie jest osobnym, uproszczonym widokiem: otwiera
 * DOKŁADNIE ten sam ekran z wypełnionymi polami, więc użytkownik może od razu
 * podmienić pozycję albo zakres i dalej grzebać. Gdyby propozycje miały własny
 * ekran, każda zmiana wymagałaby cofania się i zaczynania od zera.
 *
 * ETAP 12 NIE ZAPISUJE ZESTAWIEŃ. Decyzja właściciela projektu (27.08.2026):
 * najpierw sprawdzamy na telefonie, czy takie zestawienia są w ogóle użyteczne,
 * a dopiero potem dokładamy tabelę w bazie i migrację schematu (Etap 13).
 */

import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { strings } from '@/constants/strings';
import { AnalysisRangeMode, AnalysisSubjectKind, type AnalysisSubject } from '@/domain/analysis';
import { MainType } from '@/domain/enums';
import { useAnalysisSeries, useSubjectDictionaries } from '@/features/analysis/queries';
import { compareYears, summarizeSeries } from '@/features/analysis/series';
import { describeSubject, subjectFromKey, subjectKey } from '@/features/analysis/subject';
import {
  addMonths,
  compareYearMonth,
  currentYearMonth,
  formatMonthYear,
  MONTH_SHORT_NAMES,
  monthsBetween,
  yearMonthFromKey,
  type YearMonth,
} from '@/lib/date';
import { formatGrosze } from '@/lib/money';
import { BarChart, type BarChartBar } from '@/ui/components/bar-chart';
import { Card } from '@/ui/components/card';
import { Chip, chipRowStyle } from '@/ui/components/chip';
import { MonthStepper } from '@/ui/components/month-stepper';
import { Screen } from '@/ui/components/screen';
import { colors, fontSize, spacing } from '@/ui/theme';

/**
 * Grupa wyboru w pierwszym rzędzie.
 *
 * Nie jest to nowy byt w modelu — to tylko sposób podziału listy na dwa
 * poziomy, żeby nie sypać dwudziestu chipów naraz. Grupę WYPROWADZAMY
 * z wybranego przedmiotu analizy (`groupOf`), zamiast trzymać jako osobny
 * stan; dwa stany opisujące to samo zawsze w końcu się rozjeżdżają.
 */
const SubjectGroup = {
  ALL: 'ALL',
  BILL: 'BILL',
  SUBSCRIPTION: 'SUBSCRIPTION',
  PURCHASE: 'PURCHASE',
  INCOME: 'INCOME',
} as const;
// Ta sama nazwa jako wartość i jako typ — wzorzec z `src/domain/enums.ts`.
// eslint-disable-next-line @typescript-eslint/no-redeclare
type SubjectGroup = (typeof SubjectGroup)[keyof typeof SubjectGroup];

const GROUP_ORDER: SubjectGroup[] = [
  SubjectGroup.ALL,
  SubjectGroup.BILL,
  SubjectGroup.SUBSCRIPTION,
  SubjectGroup.PURCHASE,
  SubjectGroup.INCOME,
];

const GROUP_LABELS: Record<SubjectGroup, string> = {
  ALL: strings.analysis.subjectAllExpenses,
  BILL: strings.home.billsCard,
  SUBSCRIPTION: strings.home.subscriptionsCard,
  PURCHASE: strings.home.purchasesCard,
  INCOME: strings.analysis.subjectIncome,
};

const GROUP_COLORS: Record<SubjectGroup, string> = {
  ALL: colors.primary,
  BILL: colors.bills,
  SUBSCRIPTION: colors.subscriptions,
  PURCHASE: colors.purchases,
  INCOME: colors.income,
};

/** Ile miesięcy naraz ma sens oglądać na wykresie. */
const MAX_RANGE_MONTHS = 36;

/** Domyślna długość własnego zakresu — pół roku wstecz do dziś. */
const DEFAULT_RANGE_MONTHS = 6;

export default function AnalysisReportScreen() {
  const params = useLocalSearchParams<{
    subject?: string;
    mode?: string;
    from?: string;
    to?: string;
  }>();

  const today = currentYearMonth();
  const dictionaries = useSubjectDictionaries();

  // Parametry adresu czytamy RAZ, przy pierwszym rysowaniu. Później stan
  // należy do ekranu — inaczej każda zmiana chipa byłaby nadpisywana
  // wartością, z którą ekran został otwarty.
  const [subject, setSubject] = useState<AnalysisSubject>(
    () => subjectFromKey(params.subject) ?? { kind: AnalysisSubjectKind.ALL_EXPENSES }
  );
  const [mode, setMode] = useState<AnalysisRangeMode>(() =>
    params.mode === AnalysisRangeMode.YEAR_OVER_YEAR
      ? AnalysisRangeMode.YEAR_OVER_YEAR
      : AnalysisRangeMode.CUSTOM
  );
  const [customFrom, setCustomFrom] = useState<YearMonth>(
    () => parseMonth(params.from) ?? addMonths(today, -(DEFAULT_RANGE_MONTHS - 1))
  );
  const [customTo, setCustomTo] = useState<YearMonth>(() => parseMonth(params.to) ?? today);

  const group = groupOf(subject);
  const accentColor = GROUP_COLORS[group];

  /**
   * Zakres „rok do roku" liczymy od stycznia POPRZEDNIEGO roku do bieżącego
   * miesiąca. Miesiące poprzedniego roku późniejsze niż bieżący i tak nie
   * wejdą do porównania (patrz `compareYears`), ale muszą być na wykresie —
   * inaczej rok 2025 urwałby się w sierpniu bez wyjaśnienia.
   */
  const range = useMemo(() => {
    if (mode === AnalysisRangeMode.YEAR_OVER_YEAR) {
      return { from: { year: today.year - 1, month: 1 }, to: { year: today.year, month: 12 } };
    }
    return { from: customFrom, to: customTo };
  }, [mode, customFrom, customTo, today.year]);

  const { points, isLoaded } = useAnalysisSeries(subject, range.from, range.to);
  const comparison =
    mode === AnalysisRangeMode.YEAR_OVER_YEAR
      ? compareYears(points, today.year, today.month)
      : null;

  /**
   * Przy „rok do roku" wykres pokazuje tylko miesiące wchodzące do porównania.
   * Dorysowanie pustej reszty bieżącego roku sugerowałoby spadek wydatków
   * w miesiącach, które jeszcze nie nadeszły.
   */
  const visiblePoints = comparison
    ? points.filter((p) => p.month.month <= comparison.monthsCompared)
    : points;

  /**
   * PODSUMOWANIE LICZYMY Z TEGO, CO WIDAĆ, a nie z całego pobranego zakresu.
   *
   * Wyszło to przy sprawdzaniu na danych: w trybie „rok do roku" pobieramy oba
   * pełne lata, ale pokazujemy z nich tylko miesiące wchodzące do porównania.
   * Podsumowanie liczone z całości podawało wtedy „najtaniej: listopad", czyli
   * miesiąc, którego nie było ani na wykresie, ani na liście pod nim — i sumę
   * niezgodną z tym, co użytkownik miał przed oczami.
   */
  const summary = summarizeSeries(visiblePoints);

  const bars: BarChartBar[] = visiblePoints.map((point, index) => ({
    key: point.key,
    label: MONTH_SHORT_NAMES[point.month.month - 1],
    // Rok podpisujemy pod pierwszym słupkiem i przy każdej zmianie roku.
    sublabel: index === 0 || point.month.month === 1 ? String(point.month.year) : undefined,
    valueGrosze: point.totalGrosze,
    isEmpty: point.entryCount === 0,
  }));

  const subjectName = describeSubject(subject, dictionaries);
  const hasAnyData = summary.monthsWithData > 0;

  return (
    <Screen>
      <Text style={styles.sectionLabel}>{strings.analysis.subjectLabel}</Text>

      <View style={chipRowStyle}>
        {GROUP_ORDER.map((candidate) => (
          <Chip
            key={candidate}
            label={GROUP_LABELS[candidate]}
            selected={group === candidate}
            onPress={() => setSubject(defaultSubjectFor(candidate))}
          />
        ))}
      </View>

      <SubjectItems
        group={group}
        subject={subject}
        onSelect={setSubject}
        dictionaries={dictionaries}
      />

      <Text style={styles.sectionLabel}>{strings.analysis.rangeLabel}</Text>

      <View style={chipRowStyle}>
        <Chip
          label={strings.analysis.rangeYearOverYear}
          selected={mode === AnalysisRangeMode.YEAR_OVER_YEAR}
          onPress={() => setMode(AnalysisRangeMode.YEAR_OVER_YEAR)}
        />
        <Chip
          label={strings.analysis.rangeCustom}
          selected={mode === AnalysisRangeMode.CUSTOM}
          onPress={() => setMode(AnalysisRangeMode.CUSTOM)}
        />
      </View>

      {mode === AnalysisRangeMode.CUSTOM ? (
        <View style={styles.steppers}>
          <MonthStepper
            label={strings.analysis.rangeFrom}
            value={customFrom}
            accessibilityLabel={strings.analysis.rangeFromEarlier}
            onChange={(next) => {
              setCustomFrom(next);
              // Okno przesuwa się razem z krańcem, zamiast blokować przycisk.
              // Zablokowana strzałka bez wyjaśnienia wygląda jak usterka.
              setCustomTo((current) => clampEnd(next, current));
            }}
          />
          <MonthStepper
            label={strings.analysis.rangeTo}
            value={customTo}
            accessibilityLabel={strings.analysis.rangeToLater}
            onChange={(next) => {
              setCustomTo(next);
              setCustomFrom((current) => clampStart(current, next));
            }}
          />
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>{subjectName}</Text>

      {comparison ? <YearComparisonCard comparison={comparison} /> : null}

      {!hasAnyData && isLoaded ? (
        <Card>
          <Text style={styles.emptyText}>{strings.analysis.noData}</Text>
        </Card>
      ) : (
        <Card>
          <BarChart
            bars={bars}
            color={accentColor}
            averageGrosze={summary.averageGrosze}
            averageLabel={strings.analysis.average}
            accessibilityLabel={`${subjectName}, ${strings.analysis.chartLabel}`}
          />
        </Card>
      )}

      {hasAnyData ? (
        <>
          <Card style={styles.summaryCard}>
            <SummaryRow label={strings.analysis.total} value={formatGrosze(summary.totalGrosze)} />
            <SummaryRow
              label={strings.analysis.average}
              value={formatGrosze(summary.averageGrosze)}
            />
            {summary.highest ? (
              <SummaryRow
                label={strings.analysis.highest}
                value={`${formatMonthYear(summary.highest.month)} — ${formatGrosze(summary.highest.totalGrosze)}`}
              />
            ) : null}
            {summary.lowest ? (
              <SummaryRow
                label={strings.analysis.lowest}
                value={`${formatMonthYear(summary.lowest.month)} — ${formatGrosze(summary.lowest.totalGrosze)}`}
              />
            ) : null}

            <Text style={styles.hint}>
              {strings.analysis.averageHint(summary.monthsWithData, summary.monthCount)}
            </Text>

            {summary.missingAmountCount > 0 ? (
              <Text style={styles.warning}>
                {strings.analysis.missingAmounts(summary.missingAmountCount)}
              </Text>
            ) : null}
          </Card>

          <Card style={styles.monthsCard}>
            {visiblePoints.map((point) => (
              <View key={point.key} style={styles.monthRow}>
                <Text style={[styles.monthName, point.entryCount === 0 && styles.monthMuted]}>
                  {formatMonthYear(point.month)}
                </Text>
                <Text style={[styles.monthAmount, point.entryCount === 0 && styles.monthMuted]}>
                  {formatGrosze(point.totalGrosze)}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

/** Drugi rząd chipów: konkretny rachunek, subskrypcja albo podkategoria. */
function SubjectItems({
  group,
  subject,
  onSelect,
  dictionaries,
}: {
  group: SubjectGroup;
  subject: AnalysisSubject;
  onSelect: (subject: AnalysisSubject) => void;
  dictionaries: ReturnType<typeof useSubjectDictionaries>;
}) {
  if (group === SubjectGroup.ALL || group === SubjectGroup.INCOME) return null;

  const items =
    group === SubjectGroup.BILL
      ? dictionaries.billTemplates.map((template) => ({
          key: `t${template.id}`,
          name: template.name,
          subject: {
            kind: AnalysisSubjectKind.BILL_TEMPLATE,
            billTemplateId: template.id,
          } as AnalysisSubject,
        }))
      : group === SubjectGroup.SUBSCRIPTION
        ? dictionaries.subscriptions.map((subscription) => ({
            key: `s${subscription.id}`,
            name: subscription.name,
            subject: {
              kind: AnalysisSubjectKind.SUBSCRIPTION,
              subscriptionId: subscription.id,
            } as AnalysisSubject,
          }))
        : dictionaries.categories
            .filter((category) => category.usedBy.includes(MainType.PURCHASE))
            .map((category) => ({
              key: `c${category.id}`,
              name: category.name,
              subject: {
                kind: AnalysisSubjectKind.CATEGORY,
                categoryId: category.id,
              } as AnalysisSubject,
            }));

  const emptyMessage =
    group === SubjectGroup.BILL
      ? strings.analysis.groupBillsEmpty
      : group === SubjectGroup.SUBSCRIPTION
        ? strings.analysis.groupSubscriptionsEmpty
        : strings.analysis.groupCategoriesEmpty;

  const selectedKey = subjectKey(subject);

  return (
    <View style={styles.itemsRow}>
      <View style={chipRowStyle}>
        {/* „Razem" to cała kategoria główna — punkt wyjścia przed zejściem
            do pojedynczej pozycji. */}
        <Chip
          label={strings.analysis.groupTogether}
          selected={subject.kind === AnalysisSubjectKind.MAIN_TYPE}
          onPress={() => onSelect(defaultSubjectFor(group))}
        />
        {items.map((item) => (
          <Chip
            key={item.key}
            label={item.name}
            selected={selectedKey === subjectKey(item.subject)}
            onPress={() => onSelect(item.subject)}
          />
        ))}
      </View>

      {items.length === 0 ? <Text style={styles.hint}>{emptyMessage}</Text> : null}
    </View>
  );
}

function YearComparisonCard({ comparison }: { comparison: ReturnType<typeof compareYears> }) {
  const grew = comparison.differenceGrosze > 0;

  return (
    <Card style={styles.summaryCard}>
      <SummaryRow
        label={`${strings.analysis.yearCurrent} (${comparison.current.year})`}
        value={formatGrosze(comparison.current.totalGrosze)}
      />
      <SummaryRow
        label={`${strings.analysis.yearPrevious} (${comparison.previous.year})`}
        value={formatGrosze(comparison.previous.totalGrosze)}
      />

      {comparison.comparable ? (
        <SummaryRow
          label={strings.analysis.yearDifference}
          value={`${formatGrosze(Math.abs(comparison.differenceGrosze))} ${
            grew ? strings.analysis.yearMore : strings.analysis.yearLess
          }${
            comparison.percentChange === null
              ? ''
              : ` (${Math.abs(Math.round(comparison.percentChange))}%)`
          }`}
          valueColor={grew ? colors.statusOverdue : colors.statusPaid}
        />
      ) : (
        <Text style={styles.hint}>{strings.analysis.yearNotComparable}</Text>
      )}

      <Text style={styles.hint}>{strings.analysis.yearMonthsHint(comparison.monthsCompared)}</Text>
    </Card>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

/** Z wybranego przedmiotu analizy wynika, który chip pierwszego rzędu świeci. */
function groupOf(subject: AnalysisSubject): SubjectGroup {
  switch (subject.kind) {
    case AnalysisSubjectKind.ALL_EXPENSES:
      return SubjectGroup.ALL;
    case AnalysisSubjectKind.INCOME:
      return SubjectGroup.INCOME;
    case AnalysisSubjectKind.BILL_TEMPLATE:
      return SubjectGroup.BILL;
    case AnalysisSubjectKind.SUBSCRIPTION:
      return SubjectGroup.SUBSCRIPTION;
    case AnalysisSubjectKind.CATEGORY:
      return SubjectGroup.PURCHASE;
    case AnalysisSubjectKind.MAIN_TYPE:
      return subject.mainType === MainType.BILL
        ? SubjectGroup.BILL
        : subject.mainType === MainType.SUBSCRIPTION
          ? SubjectGroup.SUBSCRIPTION
          : SubjectGroup.PURCHASE;
  }
}

/** Co pokazać zaraz po wybraniu grupy: całą kategorię główną. */
function defaultSubjectFor(group: SubjectGroup): AnalysisSubject {
  switch (group) {
    case SubjectGroup.ALL:
      return { kind: AnalysisSubjectKind.ALL_EXPENSES };
    case SubjectGroup.INCOME:
      return { kind: AnalysisSubjectKind.INCOME };
    case SubjectGroup.BILL:
      return { kind: AnalysisSubjectKind.MAIN_TYPE, mainType: MainType.BILL };
    case SubjectGroup.SUBSCRIPTION:
      return { kind: AnalysisSubjectKind.MAIN_TYPE, mainType: MainType.SUBSCRIPTION };
    case SubjectGroup.PURCHASE:
      return { kind: AnalysisSubjectKind.MAIN_TYPE, mainType: MainType.PURCHASE };
  }
}

/** Miesiąc z adresu ekranu („2026-03"). `null`, gdy zapis jest niepoprawny. */
function parseMonth(value: string | undefined): YearMonth | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;

  const parsed = yearMonthFromKey(value);
  return parsed.month >= 1 && parsed.month <= 12 ? parsed : null;
}

/** Koniec zakresu nie może być wcześniejszy niż początek ani dalej niż limit. */
function clampEnd(start: YearMonth, end: YearMonth): YearMonth {
  if (compareYearMonth(end, start) < 0) return start;
  return monthsBetween(start, end).length > MAX_RANGE_MONTHS
    ? addMonths(start, MAX_RANGE_MONTHS - 1)
    : end;
}

/** Początek zakresu nie może być późniejszy niż koniec ani dalej niż limit. */
function clampStart(start: YearMonth, end: YearMonth): YearMonth {
  if (compareYearMonth(start, end) > 0) return end;
  return monthsBetween(start, end).length > MAX_RANGE_MONTHS
    ? addMonths(end, -(MAX_RANGE_MONTHS - 1))
    : start;
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: fontSize.caption,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  itemsRow: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  steppers: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  summaryCard: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  monthsCard: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: {
    fontSize: fontSize.body,
    color: colors.textMuted,
    flexShrink: 0,
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  warning: {
    fontSize: fontSize.caption,
    color: colors.statusWaiting,
  },
  emptyText: {
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  monthName: {
    fontSize: fontSize.body,
    color: colors.text,
  },
  monthAmount: {
    fontSize: fontSize.body,
    fontWeight: '600',
    color: colors.text,
  },
  monthMuted: {
    color: colors.textMuted,
  },
});
