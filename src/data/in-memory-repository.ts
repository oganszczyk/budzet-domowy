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

import type { BackupSnapshot, GeneratedRecord } from '@/domain/backup';
import { computeBillStatus } from '@/domain/bill-status';
import { MainType } from '@/domain/enums';
import type {
  BillTemplate,
  Category,
  Income,
  MonthlyTotals,
  Payment,
  Subscription,
} from '@/domain/models';
import { monthRange, todayIso, yearMonthKey, yearMonthOf, type YearMonth } from '@/lib/date';

import { buildDemoData } from './demo-data';
import type {
  BillAmountHistoryEntry,
  BillTemplatePatch,
  CategoryTotal,
  ExpensesRepository,
  IncomePatch,
  NewBillTemplate,
  NewCategory,
  NewIncome,
  NewPayment,
  NewSubscription,
  PaymentPatch,
  SubscriptionPatch,
} from './repository';

export class InMemoryExpensesRepository implements ExpensesRepository {
  private categories: Category[] = [];
  private payments: Payment[] = [];
  private billTemplates: BillTemplate[] = [];
  private subscriptions: Subscription[] = [];
  /** Etap 11: dochody domowników. */
  private incomes: Income[] = [];
  private nextPaymentId = 1;
  private nextBillTemplateId = 1;
  /**
   * Rejestr „ten szablon miał już rekord w tym miesiącu".
   * Klucz: `${idSzablonu}:${rok}-${miesiąc}`. Patrz komentarz przy
   * `hasGeneratedBill` w interfejsie repozytorium.
   */
  private generatedBills = new Set<string>();
  /** To samo dla subskrypcji (5.3: „nie tworzyć duplikatu płatności"). */
  private generatedSubscriptionPayments = new Set<string>();
  private nextSubscriptionId = 1;
  private nextCategoryId = 1;
  private nextIncomeId = 1;

  constructor() {
    this.reset();
  }

  /** Wczytuje dane demonstracyjne od zera. */
  reset(): void {
    const demo = buildDemoData();
    const now = new Date().toISOString();

    this.categories = demo.categories;
    this.nextCategoryId = this.categories.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    this.nextPaymentId = 1;
    this.payments = demo.paymentSeeds.map((seed) => ({
      ...seed,
      id: this.nextPaymentId++,
      createdAt: now,
      updatedAt: now,
    }));
    this.nextBillTemplateId = 1;
    this.billTemplates = demo.billTemplates.map((template) => ({
      ...template,
      id: this.nextBillTemplateId++,
    }));
    this.incomes = [];
    this.nextIncomeId = 1;
    this.nextSubscriptionId = 1;
    this.subscriptions = demo.subscriptions.map((subscription) => ({
      ...subscription,
      id: this.nextSubscriptionId++,
    }));

    // Rekordy z danych demonstracyjnych już „istnieją", więc od razu trafiają
    // do rejestrów — inaczej automat próbowałby utworzyć je drugi raz.
    this.generatedBills = new Set(
      this.payments
        .filter((p) => p.billTemplateId !== null)
        .map((p) => this.generationKey(p.billTemplateId as number, yearMonthOf(p.effectiveDate)))
    );
    this.generatedSubscriptionPayments = new Set(
      this.payments
        .filter((p) => p.subscriptionId !== null)
        .map((p) =>
          this.subscriptionGenerationKey(p.subscriptionId as number, yearMonthOf(p.effectiveDate))
        )
    );
  }

  // --- Kategorie ---

  async listCategories(mainType?: MainType): Promise<Category[]> {
    return this.categories
      .filter((c) => c.isActive && (mainType === undefined || c.usedBy.includes(mainType)))
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

  /** 5.4: zakupy przypisane do jednej podkategorii w wybranym miesiącu. */
  async listPaymentsForCategory(
    month: YearMonth,
    categoryId: number,
    mainType?: MainType
  ): Promise<Payment[]> {
    return this.paymentsInMonth(month)
      .filter(
        (p) => p.categoryId === categoryId && (mainType === undefined || p.mainType === mainType)
      )
      .sort((a, b) => this.compareNewestFirst(a, b));
  }

  async getCategory(id: number): Promise<Category | null> {
    return this.categories.find((c) => c.id === id) ?? null;
  }

  /**
   * Tworzy nową podkategorię.
   *
   * Nowe podkategorie trafiają na koniec listy (`sortOrder` większy niż
   * wszystkie dotychczasowe), żeby wbudowane pozostały na swoich miejscach.
   */
  async createCategory(input: NewCategory): Promise<Category> {
    const maxSortOrder = this.categories.reduce((max, c) => Math.max(max, c.sortOrder), 0);

    const category: Category = {
      ...input,
      id: this.nextCategoryId++,
      sortOrder: input.sortOrder ?? maxSortOrder + 1,
    };
    this.categories.push(category);
    return category;
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

  // --- Szablony rachunków (7.3) ---

  async listBillTemplates(includeInactive = false): Promise<BillTemplate[]> {
    return this.billTemplates.filter((t) => includeInactive || t.isActive);
  }

  async getBillTemplate(id: number): Promise<BillTemplate | null> {
    return this.billTemplates.find((t) => t.id === id) ?? null;
  }

  async createBillTemplate(input: NewBillTemplate): Promise<BillTemplate> {
    const now = new Date().toISOString();
    const template: BillTemplate = {
      ...input,
      id: this.nextBillTemplateId++,
      createdAt: now,
      updatedAt: now,
    };
    this.billTemplates.push(template);
    return template;
  }

  async updateBillTemplate(id: number, patch: BillTemplatePatch): Promise<BillTemplate> {
    const index = this.billTemplates.findIndex((t) => t.id === id);
    if (index === -1) throw new Error(`Nie znaleziono szablonu rachunku o id ${id}.`);

    const updated: BillTemplate = {
      ...this.billTemplates[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.billTemplates[index] = updated;
    return updated;
  }

  /**
   * 7.5: „Usunięcie kategorii z historią powinno oznaczać isActive=false,
   * nie fizyczne kasowanie." Tak samo traktujemy szablony rachunków —
   * wyłączamy je, żeby nie stracić historycznych płatności (BR-07).
   */
  async deactivateBillTemplate(id: number): Promise<void> {
    await this.updateBillTemplate(id, { isActive: false });
  }

  /** BR-12: czy dla tego szablonu istnieje już rekord na wskazany miesiąc? */
  async findBillForTemplateAndMonth(
    billTemplateId: number,
    month: YearMonth
  ): Promise<Payment | null> {
    const { start, end } = monthRange(month);
    const found = this.payments.find(
      (p) =>
        p.billTemplateId === billTemplateId && p.effectiveDate >= start && p.effectiveDate <= end
    );
    return found ? this.withComputedStatus(found) : null;
  }

  /** Klucz rejestru wygenerowanych rachunków. */
  private generationKey(billTemplateId: number, month: YearMonth): string {
    return `${billTemplateId}:${month.year}-${month.month}`;
  }

  async hasGeneratedBill(billTemplateId: number, month: YearMonth): Promise<boolean> {
    return this.generatedBills.has(this.generationKey(billTemplateId, month));
  }

  async markBillGenerated(billTemplateId: number, month: YearMonth): Promise<void> {
    this.generatedBills.add(this.generationKey(billTemplateId, month));
  }

  /**
   * 5.2: „Historia wcześniejszych kwot dla tego samego szablonu."
   * Pokazujemy tylko miesiące z uzupełnioną kwotą, od najnowszych.
   */
  async listBillAmountHistory(billTemplateId: number): Promise<BillAmountHistoryEntry[]> {
    return this.payments
      .filter((p) => p.billTemplateId === billTemplateId && p.amountGrosze !== null)
      .sort((a, b) => (a.effectiveDate < b.effectiveDate ? 1 : -1))
      .map((p) => ({
        paymentId: p.id,
        month: yearMonthOf(p.effectiveDate),
        amountGrosze: p.amountGrosze as number,
      }));
  }

  // --- Subskrypcje (7.4) ---

  async listSubscriptions(): Promise<Subscription[]> {
    return [...this.subscriptions];
  }

  async getSubscription(id: number): Promise<Subscription | null> {
    return this.subscriptions.find((s) => s.id === id) ?? null;
  }

  async createSubscription(input: NewSubscription): Promise<Subscription> {
    const now = new Date().toISOString();
    const subscription: Subscription = {
      ...input,
      id: this.nextSubscriptionId++,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.push(subscription);
    return subscription;
  }

  async updateSubscription(id: number, patch: SubscriptionPatch): Promise<Subscription> {
    const index = this.subscriptions.findIndex((s) => s.id === id);
    if (index === -1) throw new Error(`Nie znaleziono subskrypcji o id ${id}.`);

    const updated: Subscription = {
      ...this.subscriptions[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.subscriptions[index] = updated;
    return updated;
  }

  private subscriptionGenerationKey(subscriptionId: number, month: YearMonth): string {
    return `${subscriptionId}:${month.year}-${month.month}`;
  }

  async hasGeneratedSubscriptionPayment(
    subscriptionId: number,
    month: YearMonth
  ): Promise<boolean> {
    return this.generatedSubscriptionPayments.has(
      this.subscriptionGenerationKey(subscriptionId, month)
    );
  }

  async markSubscriptionPaymentGenerated(subscriptionId: number, month: YearMonth): Promise<void> {
    this.generatedSubscriptionPayments.add(this.subscriptionGenerationKey(subscriptionId, month));
  }

  // --- Dochody domowników (Etap 11) ---

  async listIncomes(month: YearMonth): Promise<Income[]> {
    const key = yearMonthKey(month);
    return this.incomes.filter((i) => i.month === key).sort((a, b) => a.id - b.id);
  }

  async getIncome(id: number): Promise<Income | null> {
    return this.incomes.find((i) => i.id === id) ?? null;
  }

  async createIncome(input: NewIncome): Promise<Income> {
    const now = new Date().toISOString();
    const income: Income = { ...input, id: this.nextIncomeId++, createdAt: now, updatedAt: now };
    this.incomes.push(income);
    return income;
  }

  async updateIncome(id: number, patch: IncomePatch): Promise<Income> {
    const index = this.incomes.findIndex((i) => i.id === id);
    if (index === -1) throw new Error(`Nie znaleziono dochodu o id ${id}.`);

    const updated: Income = {
      ...this.incomes[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.incomes[index] = updated;
    return updated;
  }

  async deleteIncome(id: number): Promise<void> {
    this.incomes = this.incomes.filter((i) => i.id !== id);
  }

  async getMonthlyIncomeTotal(month: YearMonth): Promise<number> {
    const key = yearMonthKey(month);
    return this.incomes
      .filter((i) => i.month === key)
      .reduce((total, i) => total + i.amountGrosze, 0);
  }

  // --- Kopia zapasowa (Etap 10) ---

  /**
   * Wydaje dane w postaci ZAPISANEJ, bez wyliczonego statusu rachunku.
   *
   * BR-11 mówi, że status liczymy przy odczycie. Gdyby kopia zapisała status
   * wyliczony dzisiaj, rachunek „po terminie" wróciłby po odtworzeniu jako
   * po terminie na zawsze — nawet gdyby użytkownik odtworzył kopię przed
   * upływem terminu. Kopiujemy więc to, co leży w danych.
   */
  async exportSnapshot(): Promise<BackupSnapshot> {
    return {
      categories: this.categories.map((c) => ({ ...c, usedBy: [...c.usedBy] })),
      payments: this.payments.map((p) => ({ ...p })),
      billTemplates: this.billTemplates.map((t) => ({ ...t })),
      subscriptions: this.subscriptions.map((s) => ({ ...s })),
      incomes: this.incomes.map((i) => ({ ...i })),
      generatedRecords: [
        ...this.readGenerationKeys(this.generatedBills, 'BILL'),
        ...this.readGenerationKeys(this.generatedSubscriptionPayments, 'SUBSCRIPTION'),
      ],
    };
  }

  async importSnapshot(snapshot: BackupSnapshot): Promise<void> {
    this.categories = snapshot.categories.map((c) => ({ ...c, usedBy: [...c.usedBy] }));
    this.payments = snapshot.payments.map((p) => ({ ...p }));
    this.billTemplates = snapshot.billTemplates.map((t) => ({ ...t }));
    this.subscriptions = snapshot.subscriptions.map((s) => ({ ...s }));
    this.incomes = snapshot.incomes.map((i) => ({ ...i }));

    this.generatedBills = new Set(
      snapshot.generatedRecords
        .filter((r) => r.sourceType === 'BILL')
        .map((r) => this.generationKey(r.sourceId, { year: r.year, month: r.month }))
    );
    this.generatedSubscriptionPayments = new Set(
      snapshot.generatedRecords
        .filter((r) => r.sourceType === 'SUBSCRIPTION')
        .map((r) => this.subscriptionGenerationKey(r.sourceId, { year: r.year, month: r.month }))
    );

    // Licznik musi ruszyć POWYŻEJ najwyższego odtworzonego identyfikatora.
    // Gdyby zaczął od 1, pierwszy nowy wydatek dostałby numer zajęty przez
    // rekord z kopii i nadpisałby go przy edycji.
    const maxId = (items: { id: number }[]) => items.reduce((max, i) => Math.max(max, i.id), 0);

    this.nextCategoryId = maxId(this.categories) + 1;
    this.nextPaymentId = maxId(this.payments) + 1;
    this.nextBillTemplateId = maxId(this.billTemplates) + 1;
    this.nextSubscriptionId = maxId(this.subscriptions) + 1;
    this.nextIncomeId = maxId(this.incomes) + 1;
  }

  /** Rozkłada klucze rejestru z powrotem na rekordy `{ sourceId, rok, miesiąc }`. */
  private readGenerationKeys(
    keys: Set<string>,
    sourceType: GeneratedRecord['sourceType']
  ): GeneratedRecord[] {
    return [...keys].map((key) => {
      const [sourceId, yearMonth] = key.split(':');
      const [year, month] = yearMonth.split('-');
      return {
        sourceType,
        sourceId: Number(sourceId),
        year: Number(year),
        month: Number(month),
      };
    });
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
