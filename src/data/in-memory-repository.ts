/**
 * Repozytorium działające w pamięci — TRYB DEMONSTRACYJNY.
 *
 * Pozwala zbudować i obejrzeć wszystkie ekrany, zanim powstanie baza SQLite.
 * Implementuje dokładnie ten sam interfejs co przyszła wersja bazodanowa,
 * więc podmiana nie wymusi zmian w żadnym ekranie (8.2).
 *
 * OGRANICZENIE: dane żyją tylko w pamięci aplikacji. Zamknięcie aplikacji
 * kasuje wszystko i przywraca dane demonstracyjne. Trwałość zapewni dopiero
 * SQLite (Etap 1, scenariusz T-16).
 */

import { computeBillStatus } from '@/domain/bill-status';
import { MainType } from '@/domain/enums';
import type { BillTemplate, Category, MonthlyTotals, Payment, Subscription } from '@/domain/models';
import { monthRange, todayIso, type YearMonth } from '@/lib/date';

import { buildDemoData } from './demo-data';
import type { CategoryTotal, ExpensesRepository, NewPayment, PaymentPatch } from './repository';

export class InMemoryExpensesRepository implements ExpensesRepository {
  private categories: Category[] = [];
  private payments: Payment[] = [];
  private billTemplates: BillTemplate[] = [];
  private subscriptions: Subscription[] = [];
  private nextPaymentId = 1;

  constructor() {
    this.reset();
  }

  /** Wczytuje dane demonstracyjne od zera. */
  reset(): void {
    const demo = buildDemoData();
    const now = new Date().toISOString();

    this.categories = demo.categories;
    this.nextPaymentId = 1;
    this.payments = demo.paymentSeeds.map((seed) => ({
      ...seed,
      id: this.nextPaymentId++,
      createdAt: now,
      updatedAt: now,
    }));
    this.billTemplates = demo.billTemplates.map((template, index) => ({
      ...template,
      id: index + 1,
    }));
    this.subscriptions = demo.subscriptions.map((subscription, index) => ({
      ...subscription,
      id: index + 1,
    }));
  }

  // --- Kategorie ---

  async listCategories(mainType?: MainType): Promise<Category[]> {
    return this.categories
      .filter((c) => c.isActive && (mainType === undefined || c.mainType === mainType))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // --- Sumy ---

  /**
   * 6.1 + BR-09: sumy zależą od wybranego miesiąca.
   *
   * Rachunki liczymy niezależnie od statusu opłacenia, ale tylko te
   * z uzupełnioną kwotą — BR-05: pusta kwota nie jest wliczana do sum.
   */
  async getMonthlyTotals(month: YearMonth): Promise<MonthlyTotals> {
    const inMonth = this.paymentsInMonth(month);
    const sum = (mainType: MainType) =>
      inMonth
        .filter((p) => p.mainType === mainType && p.amountGrosze !== null)
        .reduce((total, p) => total + (p.amountGrosze ?? 0), 0);

    return {
      billsGrosze: sum(MainType.BILL),
      subscriptionsGrosze: sum(MainType.SUBSCRIPTION),
      purchasesGrosze: sum(MainType.PURCHASE),
    };
  }

  /** 5.4: każda podkategoria z jej dokładną miesięczną sumą. */
  async getCategoryTotals(month: YearMonth, mainType: MainType): Promise<CategoryTotal[]> {
    const inMonth = this.paymentsInMonth(month).filter((p) => p.mainType === mainType);
    const categories = await this.listCategories(mainType);

    return categories.map((category) => ({
      category,
      totalGrosze: inMonth
        .filter((p) => p.categoryId === category.id && p.amountGrosze !== null)
        .reduce((total, p) => total + (p.amountGrosze ?? 0), 0),
    }));
  }

  // --- Płatności ---

  async listPaymentsForMonth(month: YearMonth, mainType?: MainType): Promise<Payment[]> {
    return this.paymentsInMonth(month)
      .filter((p) => mainType === undefined || p.mainType === mainType)
      .sort((a, b) => this.compareNewestFirst(a, b));
  }

  /**
   * 5.7: wspólna historia wszystkich zapisanych płatności,
   * chronologicznie od najnowszych do najstarszych.
   *
   * BR-05: rachunki oczekujące na wpisanie kwoty NIE są tu widoczne.
   */
  async listHistory(): Promise<Payment[]> {
    return this.payments
      .filter((p) => p.amountGrosze !== null)
      .map((p) => this.withComputedStatus(p))
      .sort((a, b) => this.compareNewestFirst(a, b));
  }

  async getPayment(id: number): Promise<Payment | null> {
    const found = this.payments.find((p) => p.id === id);
    return found ? this.withComputedStatus(found) : null;
  }

  async createPayment(input: NewPayment): Promise<Payment> {
    const now = new Date().toISOString();
    const payment: Payment = {
      ...input,
      id: this.nextPaymentId++,
      createdAt: now,
      updatedAt: now,
    };
    this.payments.push(payment);
    return this.withComputedStatus(payment);
  }

  async updatePayment(id: number, patch: PaymentPatch): Promise<Payment> {
    const index = this.payments.findIndex((p) => p.id === id);
    if (index === -1) throw new Error(`Nie znaleziono płatności o id ${id}.`);

    const updated: Payment = {
      ...this.payments[index],
      ...patch,
      // 6.2: każda modyfikacja zapisuje updatedAt.
      updatedAt: new Date().toISOString(),
    };
    this.payments[index] = updated;
    return this.withComputedStatus(updated);
  }

  async deletePayment(id: number): Promise<void> {
    this.payments = this.payments.filter((p) => p.id !== id);
  }

  // --- Szablony cykliczne ---

  async listBillTemplates(): Promise<BillTemplate[]> {
    return this.billTemplates.filter((t) => t.isActive);
  }

  async listSubscriptions(): Promise<Subscription[]> {
    return [...this.subscriptions];
  }

  // --- Pomocnicze ---

  /** Płatności, których effectiveDate mieści się w wybranym miesiącu (BR-09). */
  private paymentsInMonth(month: YearMonth): Payment[] {
    const { start, end } = monthRange(month);
    return this.payments
      .filter((p) => p.effectiveDate >= start && p.effectiveDate <= end)
      .map((p) => this.withComputedStatus(p));
  }

  /**
   * BR-11: status rachunku wyliczamy przy każdym odczycie, a nie zapisujemy.
   * Dzięki temu rachunek po terminie sam zmienia status następnego dnia.
   */
  private withComputedStatus(payment: Payment): Payment {
    if (payment.mainType !== MainType.BILL) return payment;
    return { ...payment, status: computeBillStatus(payment, todayIso()) };
  }

  /**
   * 5.7 AC: lista zachowuje prawidłową kolejność także dla wielu płatności
   * tego samego dnia — przy równej dacie rozstrzyga identyfikator,
   * czyli kolejność dodania.
   */
  private compareNewestFirst(a: Payment, b: Payment): number {
    if (a.effectiveDate !== b.effectiveDate) {
      return a.effectiveDate < b.effectiveDate ? 1 : -1;
    }
    return b.id - a.id;
  }
}
