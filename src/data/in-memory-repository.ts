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

import type { SavedReport } from '@/domain/analysis';
import type { BackupSnapshot, DeletedRecord, GeneratedRecord } from '@/domain/backup';
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
import {
  monthRange,
  monthSpan,
  todayIso,
  yearMonthKey,
  yearMonthOf,
  type YearMonth,
} from '@/lib/date';
import { newUuid } from '@/lib/uuid';

import { buildDemoData } from './demo-data';
import type {
  ApplyResult,
  RemoteChanges,
  PendingChanges,
  SyncedMark,
  SyncedMarks,
  BillAmountHistoryEntry,
  BillTemplatePatch,
  CategoryTotal,
  ExpensesRepository,
  IncomePatch,
  NewBillTemplate,
  NewCategory,
  NewIncome,
  NewPayment,
  NewSavedReport,
  NewSubscription,
  PaymentPatch,
  SavedReportPatch,
  SubscriptionPatch,
} from './repository';

export class InMemoryExpensesRepository implements ExpensesRepository {
  private categories: Category[] = [];
  private payments: Payment[] = [];
  private billTemplates: BillTemplate[] = [];
  private subscriptions: Subscription[] = [];
  /** Etap 11: dochody domowników. */
  private incomes: Income[] = [];
  /** Etap 13: zestawienia zapisane przez użytkownika. */
  private savedReports: SavedReport[] = [];
  private nextSavedReportId = 1;
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

  /**
   * Etap 14b: ślad po skasowanych rekordach.
   *
   * W wersji na SQLite tę listę prowadzą wyzwalacze z migracji 4. Tutaj musi
   * ją prowadzić kod — i właśnie dlatego obie wersje przechodzą ten sam
   * zestaw testów: różnica w takim szczególe jest dokładnie tym rodzajem
   * rozjazdu, który inaczej wyszedłby dopiero na telefonie.
   */
  private deletedRecords: DeletedRecord[] = [];

  /** Wczytuje dane demonstracyjne od zera. */
  reset(): void {
    const demo = buildDemoData();
    const now = new Date().toISOString();

    // Dane demonstracyjne opisują wydatki, nie rekordy — trwały identyfikator
    // nadaje ten, kto je zapisuje. Tutaj tym zapisującym jest ta klasa.
    this.categories = demo.categories.map((category) => ({ ...category, uuid: newUuid() }));
    this.nextCategoryId = this.categories.reduce((max, c) => Math.max(max, c.id), 0) + 1;
    this.nextPaymentId = 1;
    this.payments = demo.paymentSeeds.map((seed) => ({
      ...seed,
      uuid: newUuid(),
      id: this.nextPaymentId++,
      createdAt: now,
      updatedAt: now,
    }));
    this.nextBillTemplateId = 1;
    this.billTemplates = demo.billTemplates.map((template) => ({
      ...template,
      uuid: newUuid(),
      id: this.nextBillTemplateId++,
    }));
    this.deletedRecords = [];
    this.incomes = [];
    this.nextIncomeId = 1;
    this.savedReports = [];
    this.nextSavedReportId = 1;
    this.nextSubscriptionId = 1;
    this.subscriptions = demo.subscriptions.map((subscription) => ({
      ...subscription,
      uuid: newUuid(),
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

    this.markEverythingPending();
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
      uuid: input.uuid ?? newUuid(),
      id: this.nextCategoryId++,
      sortOrder: input.sortOrder ?? maxSortOrder + 1,
    };
    this.categories.push(category);
    this.markPending('CATEGORY', category.uuid);
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
      uuid: input.uuid ?? newUuid(),
      id: this.nextPaymentId++,
      createdAt: now,
      updatedAt: now,
    };
    this.payments.push(payment);
    this.markPending('PAYMENT', payment.uuid);
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
    this.markPending('PAYMENT', updated.uuid);
    return this.withComputedStatus(updated);
  }

  async deletePayment(id: number): Promise<void> {
    const removed = this.payments.find((p) => p.id === id);
    if (!removed) return;

    this.payments = this.payments.filter((p) => p.id !== id);
    this.recordDeletion('PAYMENT', removed.uuid);
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
      uuid: input.uuid ?? newUuid(),
      id: this.nextBillTemplateId++,
      createdAt: now,
      updatedAt: now,
    };
    this.billTemplates.push(template);
    this.markPending('BILL_TEMPLATE', template.uuid);
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
    this.markPending('BILL_TEMPLATE', updated.uuid);
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
      uuid: input.uuid ?? newUuid(),
      id: this.nextSubscriptionId++,
      createdAt: now,
      updatedAt: now,
    };
    this.subscriptions.push(subscription);
    this.markPending('SUBSCRIPTION', subscription.uuid);
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
    this.markPending('SUBSCRIPTION', updated.uuid);
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
    const income: Income = {
      ...input,
      uuid: input.uuid ?? newUuid(),
      id: this.nextIncomeId++,
      createdAt: now,
      updatedAt: now,
    };
    this.incomes.push(income);
    this.markPending('INCOME', income.uuid);
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
    this.markPending('INCOME', updated.uuid);
    return updated;
  }

  async deleteIncome(id: number): Promise<void> {
    const removed = this.incomes.find((i) => i.id === id);
    if (!removed) return;

    this.incomes = this.incomes.filter((i) => i.id !== id);
    this.recordDeletion('INCOME', removed.uuid);
  }

  async getMonthlyIncomeTotal(month: YearMonth): Promise<number> {
    const key = yearMonthKey(month);
    return this.incomes
      .filter((i) => i.month === key)
      .reduce((total, i) => total + i.amountGrosze, 0);
  }

  // --- Analiza (Etap 12) ---

  async listPaymentsForRange(from: YearMonth, to: YearMonth): Promise<Payment[]> {
    const { start, end } = monthSpan(from, to);

    return this.payments
      .filter((p) => p.effectiveDate >= start && p.effectiveDate <= end)
      .map((p) => this.withComputedStatus(p))
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.id - b.id);
  }

  async listIncomesForRange(from: YearMonth, to: YearMonth): Promise<Income[]> {
    // Dochód zna tylko miesiąc („RRRR-MM"), więc obcinamy daty skrajne
    // do siedmiu znaków. To ten sam zapis, więc porównanie tekstowe
    // jest jednocześnie porównaniem chronologicznym.
    const { start, end } = monthSpan(from, to);
    const firstKey = start.slice(0, 7);
    const lastKey = end.slice(0, 7);

    return this.incomes
      .filter((i) => i.month >= firstKey && i.month <= lastKey)
      .sort((a, b) => a.month.localeCompare(b.month) || a.id - b.id);
  }

  // --- Zapisane zestawienia (Etap 13) ---

  async listSavedReports(): Promise<SavedReport[]> {
    return [...this.savedReports].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  }

  async createSavedReport(input: NewSavedReport): Promise<SavedReport> {
    const now = new Date().toISOString();
    const maxSortOrder = this.savedReports.reduce((max, r) => Math.max(max, r.sortOrder), 0);

    const report: SavedReport = {
      ...input,
      id: this.nextSavedReportId++,
      sortOrder: input.sortOrder ?? maxSortOrder + 1,
      createdAt: now,
      updatedAt: now,
    };
    this.savedReports.push(report);
    return report;
  }

  async updateSavedReport(id: number, patch: SavedReportPatch): Promise<SavedReport> {
    const index = this.savedReports.findIndex((r) => r.id === id);
    if (index === -1) throw new Error(`Nie znaleziono zestawienia o id ${id}.`);

    const updated: SavedReport = {
      ...this.savedReports[index],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.savedReports[index] = updated;
    return updated;
  }

  async deleteSavedReport(id: number): Promise<void> {
    this.savedReports = this.savedReports.filter((r) => r.id !== id);
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
  async listDeletedRecords(): Promise<DeletedRecord[]> {
    return this.deletedRecords.map((record) => ({ ...record }));
  }

  /**
   * Zapisuje, że rekord o tym identyfikatorze zniknął.
   *
   * `INSERT OR REPLACE` w wersji na SQLite pozwala nadpisać wcześniejszy wpis
   * o tym samym rekordzie; tutaj robi to samo usunięcie duplikatu. Ten sam
   * rekord da się skasować dwa razy tylko po odtworzeniu kopii, ale wtedy
   * dwa wpisy o tej samej treści myliłyby przy liczeniu.
   */
  private recordDeletion(entityType: DeletedRecord['entityType'], uuid: string): void {
    this.deletedRecords = this.deletedRecords.filter(
      (record) => !(record.entityType === entityType && record.uuid === uuid)
    );
    this.deletedRecords.push({ entityType, uuid, deletedAt: new Date().toISOString() });
    this.markPending(`DELETED_${entityType}`, uuid);
  }

  // --- Synchronizacja (Etap 14c) ---

  /**
   * Rekordy czekające na wysłanie — odpowiednik kolumny `pendingSync`.
   *
   * Wersja na SQLite podnosi ten znacznik WYZWALACZEM, więc nie da się
   * o niego zapomnieć przy żadnym zapisie. Tutaj wyzwalaczy nie ma i trzeba
   * go podnosić ręcznie w każdej metodzie, która coś zmienia.
   *
   * PIERWSZE PODEJŚCIE BYŁO SPRYTNIEJSZE I BŁĘDNE. Zamiast znacznika
   * porównywało `updatedAt` rekordu z zapamiętanym przy wysyłce — obywało
   * się bez dopisków w kilkunastu metodach, ale gubiło zmianę wykonaną w tej
   * samej MILISEKUNDZIE co poprzednia: `new Date().toISOString()` daje
   * wtedy identyczny tekst, więc edycja wyglądała na brak edycji. Testy
   * kontraktu złapały to od razu, bo wersja na SQLite takiego problemu
   * nie ma. Wierny odpowiednik jest tu wart więcej niż krótszy zapis.
   */
  private pendingSync = new Set<string>();

  private pendingKey(kind: string, uuid: string): string {
    return `${kind}:${uuid}`;
  }

  /** Odpowiednik wyzwalacza: ten rekord czeka na wysłanie. */
  private markPending(kind: string, uuid: string): void {
    this.pendingSync.add(this.pendingKey(kind, uuid));
  }

  private isPending(kind: string, uuid: string): boolean {
    return this.pendingSync.has(this.pendingKey(kind, uuid));
  }

  /**
   * Wszystko czeka na wysłanie — stan po wczytaniu danych demonstracyjnych
   * i po odtworzeniu kopii zapasowej.
   *
   * Odpowiednik `DEFAULT 1` przy kolumnie `pendingSync` w wersji na SQLite:
   * rekord, który dopiero co pojawił się w TEJ bazie, nie był jeszcze przez
   * nią wysłany — choćby powstał wiele miesięcy temu na innym telefonie.
   */
  private markEverythingPending(): void {
    this.pendingSync = new Set();

    for (const category of this.categories) this.markPending('CATEGORY', category.uuid);
    for (const template of this.billTemplates) this.markPending('BILL_TEMPLATE', template.uuid);
    for (const subscription of this.subscriptions) {
      this.markPending('SUBSCRIPTION', subscription.uuid);
    }
    for (const payment of this.payments) this.markPending('PAYMENT', payment.uuid);
    for (const income of this.incomes) this.markPending('INCOME', income.uuid);
    for (const record of this.deletedRecords) {
      this.markPending(`DELETED_${record.entityType}`, record.uuid);
    }
  }

  private categoryUuidOf(categoryId: number): string | null {
    return this.categories.find((category) => category.id === categoryId)?.uuid ?? null;
  }

  async listPendingChanges(): Promise<PendingChanges> {
    return {
      categories: this.categories.filter((category) => this.isPending('CATEGORY', category.uuid)),
      billTemplates: this.billTemplates
        .filter((template) => this.isPending('BILL_TEMPLATE', template.uuid))
        .map((template) => ({
          ...template,
          categoryUuid: this.categoryUuidOf(template.categoryId),
        })),
      subscriptions: this.subscriptions
        .filter((subscription) => this.isPending('SUBSCRIPTION', subscription.uuid))
        .map((subscription) => ({
          ...subscription,
          categoryUuid: this.categoryUuidOf(subscription.categoryId),
        })),
      payments: this.payments
        .filter((payment) => this.isPending('PAYMENT', payment.uuid))
        .map((payment) => ({
          ...payment,
          categoryUuid: this.categoryUuidOf(payment.categoryId),
          billTemplateUuid:
            this.billTemplates.find((template) => template.id === payment.billTemplateId)?.uuid ??
            null,
          subscriptionUuid:
            this.subscriptions.find((subscription) => subscription.id === payment.subscriptionId)
              ?.uuid ?? null,
        })),
      incomes: this.incomes.filter((income) => this.isPending('INCOME', income.uuid)),
      deletedRecords: this.deletedRecords.filter((record) =>
        this.isPending(`DELETED_${record.entityType}`, record.uuid)
      ),
    };
  }

  /**
   * Odpowiednik zapytania `UPDATE ... SET pendingSync = 0 WHERE uuid = ?
   * AND updatedAt = ?` z wersji na SQLite — łącznie z warunkiem na znacznik
   * czasu, który chroni przed zgaszeniem kolejki dla poprawki wprowadzonej
   * już PO odczytaniu rekordów do wysłania.
   */
  async markSynced(marks: SyncedMarks): Promise<void> {
    for (const uuid of marks.categories) {
      this.pendingSync.delete(this.pendingKey('CATEGORY', uuid));
    }

    const rodzaje: [string, SyncedMark[]][] = [
      ['BILL_TEMPLATE', marks.billTemplates],
      ['SUBSCRIPTION', marks.subscriptions],
      ['PAYMENT', marks.payments],
      ['INCOME', marks.incomes],
    ];

    const aktualnyZnacznik = (kind: string, uuid: string): string | undefined => {
      const gdzie: Record<string, { uuid: string; updatedAt: string }[]> = {
        BILL_TEMPLATE: this.billTemplates,
        SUBSCRIPTION: this.subscriptions,
        PAYMENT: this.payments,
        INCOME: this.incomes,
      };
      return gdzie[kind]?.find((item) => item.uuid === uuid)?.updatedAt;
    };

    for (const [kind, wpisy] of rodzaje) {
      for (const mark of wpisy) {
        if (aktualnyZnacznik(kind, mark.uuid) !== mark.updatedAt) continue;
        this.pendingSync.delete(this.pendingKey(kind, mark.uuid));
      }
    }

    for (const mark of marks.deletedRecords) {
      this.pendingSync.delete(this.pendingKey(`DELETED_${mark.entityType}`, mark.uuid));
    }
  }

  // --- Pobieranie i scalanie (Etap 14d) ---

  private syncMarkers = new Map<string, string>();

  async getSyncMarker(key: string): Promise<string | null> {
    return this.syncMarkers.get(key) ?? null;
  }

  async setSyncMarker(key: string, value: string): Promise<void> {
    this.syncMarkers.set(key, value);
  }

  private isTombstoned(entityType: DeletedRecord['entityType'], uuid: string): boolean {
    return this.deletedRecords.some(
      (record) => record.entityType === entityType && record.uuid === uuid
    );
  }

  /**
   * Zapisuje zmiany pobrane z serwera.
   *
   * Odpowiednik metody z wersji na SQLite, z tą różnicą, że tam znacznik
   * „do wysłania" trzeba GASIĆ po zapisie (podnosi go wyzwalacz), a tutaj
   * wystarczy go nie podnosić. Wynik ma być identyczny i pilnują tego
   * testy kontraktu — bo rekord odesłany z powrotem na serwer po każdym
   * pobraniu to pętla, której nikt nie zauważy, dopóki nie policzy żądań.
   */
  async applyRemoteChanges(changes: RemoteChanges): Promise<ApplyResult> {
    let applied = 0;
    let skipped = 0;
    let overwritten = 0;

    const idKategorii = (uuid: string | null): number | null =>
      uuid === null ? null : (this.categories.find((c) => c.uuid === uuid)?.id ?? null);

    for (const category of changes.categories) {
      if (this.isTombstoned('CATEGORY', category.uuid)) continue;

      const index = this.categories.findIndex((c) => c.uuid === category.uuid);

      if (index === -1) {
        this.categories.push({ ...category, id: this.nextCategoryId++ });
      } else {
        this.categories[index] = { ...category, id: this.categories[index].id };
        this.pendingSync.delete(this.pendingKey('CATEGORY', category.uuid));
      }

      applied++;
    }

    for (const template of changes.billTemplates) {
      if (this.isTombstoned('BILL_TEMPLATE', template.uuid)) continue;

      const categoryId = idKategorii(template.categoryUuid);
      if (categoryId === null) {
        skipped++;
        continue;
      }

      const index = this.billTemplates.findIndex((item) => item.uuid === template.uuid);
      const { categoryUuid: _pominiete, syncedAt: _znacznik, ...dane } = template;

      if (index === -1) {
        this.billTemplates.push({ ...dane, categoryId, id: this.nextBillTemplateId++ });
        applied++;
        continue;
      }

      if (template.updatedAt <= this.billTemplates[index].updatedAt) continue;

      if (this.isPending('BILL_TEMPLATE', template.uuid)) overwritten++;
      this.billTemplates[index] = { ...dane, categoryId, id: this.billTemplates[index].id };
      this.pendingSync.delete(this.pendingKey('BILL_TEMPLATE', template.uuid));
      applied++;
    }

    for (const subscription of changes.subscriptions) {
      if (this.isTombstoned('SUBSCRIPTION', subscription.uuid)) continue;

      const categoryId = idKategorii(subscription.categoryUuid);
      if (categoryId === null) {
        skipped++;
        continue;
      }

      const index = this.subscriptions.findIndex((item) => item.uuid === subscription.uuid);
      const { categoryUuid: _pominiete, syncedAt: _znacznik, ...dane } = subscription;

      if (index === -1) {
        this.subscriptions.push({ ...dane, categoryId, id: this.nextSubscriptionId++ });
        applied++;
        continue;
      }

      if (subscription.updatedAt <= this.subscriptions[index].updatedAt) continue;

      if (this.isPending('SUBSCRIPTION', subscription.uuid)) overwritten++;
      this.subscriptions[index] = { ...dane, categoryId, id: this.subscriptions[index].id };
      this.pendingSync.delete(this.pendingKey('SUBSCRIPTION', subscription.uuid));
      applied++;
    }

    for (const payment of changes.payments) {
      if (this.isTombstoned('PAYMENT', payment.uuid)) continue;

      const categoryId = idKategorii(payment.categoryUuid);
      if (categoryId === null) {
        skipped++;
        continue;
      }

      const billTemplateId =
        payment.billTemplateUuid === null
          ? null
          : (this.billTemplates.find((item) => item.uuid === payment.billTemplateUuid)?.id ?? null);
      const subscriptionId =
        payment.subscriptionUuid === null
          ? null
          : (this.subscriptions.find((item) => item.uuid === payment.subscriptionUuid)?.id ?? null);

      const index = this.payments.findIndex((item) => item.uuid === payment.uuid);
      const {
        categoryUuid: _kategoria,
        billTemplateUuid: _szablon,
        subscriptionUuid: _subskrypcja,
        syncedAt: _znacznik,
        ...dane
      } = payment;

      // Ścieżka do zdjęcia i status nie przychodzą z serwera — patrz
      // `sync-payload.ts`. Status wyliczamy przy odczycie.
      const zapis = {
        ...dane,
        categoryId,
        billTemplateId,
        subscriptionId,
        status: null,
        receiptImagePath: null,
      };

      if (index === -1) {
        this.payments.push({ ...zapis, id: this.nextPaymentId++ });
        applied++;
        continue;
      }

      if (payment.updatedAt <= this.payments[index].updatedAt) continue;

      if (this.isPending('PAYMENT', payment.uuid)) overwritten++;
      this.payments[index] = { ...zapis, id: this.payments[index].id };
      this.pendingSync.delete(this.pendingKey('PAYMENT', payment.uuid));
      applied++;
    }

    for (const income of changes.incomes) {
      if (this.isTombstoned('INCOME', income.uuid)) continue;

      const index = this.incomes.findIndex((item) => item.uuid === income.uuid);
      const { syncedAt: _znacznik, ...dane } = income;

      if (index === -1) {
        this.incomes.push({ ...dane, id: this.nextIncomeId++ });
        applied++;
        continue;
      }

      if (income.updatedAt <= this.incomes[index].updatedAt) continue;

      if (this.isPending('INCOME', income.uuid)) overwritten++;
      this.incomes[index] = { ...dane, id: this.incomes[index].id };
      this.pendingSync.delete(this.pendingKey('INCOME', income.uuid));
      applied++;
    }

    for (const record of changes.deletedRecords) {
      switch (record.entityType) {
        case 'PAYMENT':
          this.payments = this.payments.filter((item) => item.uuid !== record.uuid);
          break;
        case 'CATEGORY':
          this.categories = this.categories.filter((item) => item.uuid !== record.uuid);
          break;
        case 'BILL_TEMPLATE':
          this.billTemplates = this.billTemplates.filter((item) => item.uuid !== record.uuid);
          break;
        case 'SUBSCRIPTION':
          this.subscriptions = this.subscriptions.filter((item) => item.uuid !== record.uuid);
          break;
        case 'INCOME':
          this.incomes = this.incomes.filter((item) => item.uuid !== record.uuid);
          break;
      }

      this.deletedRecords = this.deletedRecords.filter(
        (item) => !(item.entityType === record.entityType && item.uuid === record.uuid)
      );
      this.deletedRecords.push({
        entityType: record.entityType,
        uuid: record.uuid,
        deletedAt: record.deletedAt,
      });
      // Serwer już o tym wie, więc nagrobek nie wraca do kolejki wysyłki.
      this.pendingSync.delete(this.pendingKey(`DELETED_${record.entityType}`, record.uuid));

      applied++;
    }

    return { applied, skipped, overwritten };
  }

  async exportSnapshot(): Promise<BackupSnapshot> {
    return {
      categories: this.categories.map((c) => ({ ...c, usedBy: [...c.usedBy] })),
      payments: this.payments.map((p) => ({ ...p })),
      billTemplates: this.billTemplates.map((t) => ({ ...t })),
      subscriptions: this.subscriptions.map((s) => ({ ...s })),
      incomes: this.incomes.map((i) => ({ ...i })),
      savedReports: this.savedReports.map((r) => ({ ...r })),
      generatedRecords: [
        ...this.readGenerationKeys(this.generatedBills, 'BILL'),
        ...this.readGenerationKeys(this.generatedSubscriptionPayments, 'SUBSCRIPTION'),
      ],
      deletedRecords: this.deletedRecords.map((record) => ({ ...record })),
    };
  }

  async importSnapshot(snapshot: BackupSnapshot): Promise<void> {
    this.categories = snapshot.categories.map((c) => ({ ...c, usedBy: [...c.usedBy] }));
    this.payments = snapshot.payments.map((p) => ({ ...p }));
    this.billTemplates = snapshot.billTemplates.map((t) => ({ ...t }));
    this.subscriptions = snapshot.subscriptions.map((s) => ({ ...s }));
    this.incomes = snapshot.incomes.map((i) => ({ ...i }));
    this.savedReports = snapshot.savedReports.map((r) => ({ ...r }));
    this.deletedRecords = snapshot.deletedRecords.map((r) => ({ ...r }));

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
    // Odtworzone rekordy są dla TEJ bazy nowe — patrz markEverythingPending().
    this.markEverythingPending();
    this.nextIncomeId = maxId(this.incomes) + 1;
    this.nextSavedReportId = maxId(this.savedReports) + 1;
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
