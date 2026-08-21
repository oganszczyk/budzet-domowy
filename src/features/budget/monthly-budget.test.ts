/**
 * Testy budżetu miesiąca (Etap 11).
 *
 * Sprawdzają cztery sytuacje, w których wykres musi mówić prawdę:
 * pusty miesiąc, dochód bez wydatków, normalne wydawanie i przekroczenie
 * budżetu. Ta ostatnia jest najważniejsza — właśnie tam najłatwiej
 * o wykres, który wygląda dobrze i kłamie.
 */

import type { MonthlyTotals } from '@/domain/models';

import { budgetSlices, BudgetSliceKey, computeMonthlyBudget } from './monthly-budget';

const totals = (
  billsGrosze: number,
  subscriptionsGrosze: number,
  purchasesGrosze: number
): MonthlyTotals => ({ billsGrosze, subscriptionsGrosze, purchasesGrosze });

const ZERO = totals(0, 0, 0);

/** Suma udziałów wszystkich wycinków — pełny pierścień to dokładnie 1. */
const totalFraction = (slices: { fraction: number }[]) =>
  slices.reduce((sum, s) => sum + s.fraction, 0);

describe('budżet miesiąca', () => {
  describe('wyliczenie kwot', () => {
    it('sumuje trzy kategorie główne na wydatki', () => {
      const budget = computeMonthlyBudget(totals(50000, 12000, 38000), 0);

      expect(budget.spentGrosze).toBe(100000);
    });

    it('odejmuje wydatki od dochodu', () => {
      const budget = computeMonthlyBudget(totals(50000, 12000, 38000), 620000);

      expect(budget.remainingGrosze).toBe(520000);
      expect(budget.isOverspent).toBe(false);
    });

    it('liczy w groszach, bez błędów zaokrągleń (BR-03)', () => {
      // 19,99 + 19,99 + 19,99 — kwoty, na których arytmetyka
      // zmiennoprzecinkowa się wykłada.
      const budget = computeMonthlyBudget(totals(1999, 1999, 1999), 10000);

      expect(budget.spentGrosze).toBe(5997);
      expect(budget.remainingGrosze).toBe(4003);
    });

    it('pokazuje ujemną resztę po przekroczeniu budżetu', () => {
      const budget = computeMonthlyBudget(totals(300000, 0, 400000), 620000);

      expect(budget.remainingGrosze).toBe(-80000);
      expect(budget.isOverspent).toBe(true);
    });

    it('brak wpisanego dochodu oznacza hasIncome=false', () => {
      expect(computeMonthlyBudget(totals(1000, 0, 0), 0).hasIncome).toBe(false);
      expect(computeMonthlyBudget(ZERO, 1).hasIncome).toBe(true);
    });

    it('same wydatki bez dochodu to przekroczenie budżetu', () => {
      const budget = computeMonthlyBudget(totals(1000, 0, 0), 0);

      expect(budget.isOverspent).toBe(true);
      expect(budget.remainingGrosze).toBe(-1000);
    });

    it('równe kwoty to jeszcze nie przekroczenie', () => {
      const budget = computeMonthlyBudget(totals(620000, 0, 0), 620000);

      expect(budget.isOverspent).toBe(false);
      expect(budget.remainingGrosze).toBe(0);
    });
  });

  describe('wycinki pierścienia', () => {
    it('pusty miesiąc nie ma żadnego wycinka', () => {
      expect(budgetSlices(computeMonthlyBudget(ZERO, 0))).toEqual([]);
    });

    it('dochód bez wydatków daje jeden wycinek „zostało" na cały pierścień', () => {
      const slices = budgetSlices(computeMonthlyBudget(ZERO, 620000));

      expect(slices).toHaveLength(1);
      expect(slices[0].key).toBe(BudgetSliceKey.REMAINING);
      expect(slices[0].fraction).toBe(1);
    });

    it('mieszczące się wydatki dzielą pierścień razem z resztą', () => {
      const slices = budgetSlices(computeMonthlyBudget(totals(200000, 100000, 100000), 800000));

      expect(slices.map((s) => s.key)).toEqual([
        BudgetSliceKey.BILLS,
        BudgetSliceKey.SUBSCRIPTIONS,
        BudgetSliceKey.PURCHASES,
        BudgetSliceKey.REMAINING,
      ]);
      expect(slices[0].fraction).toBeCloseTo(0.25);
      expect(slices[3].fraction).toBeCloseTo(0.5);
    });

    it('wycinki zawsze wypełniają dokładnie jeden pełny pierścień', () => {
      const przypadki: [MonthlyTotals, number][] = [
        [totals(200000, 100000, 100000), 800000],
        [totals(300000, 0, 400000), 620000],
        [totals(1000, 0, 0), 0],
        [ZERO, 620000],
        [totals(1999, 1999, 1999), 10000],
      ];

      for (const [t, income] of przypadki) {
        expect(totalFraction(budgetSlices(computeMonthlyBudget(t, income)))).toBeCloseTo(1);
      }
    });

    it('po przekroczeniu budżetu nie ma wycinka „zostało"', () => {
      const slices = budgetSlices(computeMonthlyBudget(totals(300000, 0, 400000), 620000));

      expect(slices.map((s) => s.key)).not.toContain(BudgetSliceKey.REMAINING);
      // Pierścień wypełniają wtedy same wydatki — i nadal dokładnie jeden.
      expect(totalFraction(slices)).toBeCloseTo(1);
    });

    it('wydatki bez wpisanego dochodu wypełniają cały pierścień', () => {
      const slices = budgetSlices(computeMonthlyBudget(totals(6000, 2000, 2000), 0));

      expect(slices.map((s) => s.key)).toEqual([
        BudgetSliceKey.BILLS,
        BudgetSliceKey.SUBSCRIPTIONS,
        BudgetSliceKey.PURCHASES,
      ]);
      expect(slices[0].fraction).toBeCloseTo(0.6);
    });

    it('pomija kategorie o zerowej kwocie', () => {
      const slices = budgetSlices(computeMonthlyBudget(totals(50000, 0, 0), 100000));

      expect(slices.map((s) => s.key)).toEqual([BudgetSliceKey.BILLS, BudgetSliceKey.REMAINING]);
    });

    it('niesie ze sobą kwoty, nie tylko udziały', () => {
      const slices = budgetSlices(computeMonthlyBudget(totals(50000, 0, 0), 100000));

      expect(slices[0].amountGrosze).toBe(50000);
      expect(slices[1].amountGrosze).toBe(50000);
    });
  });
});
