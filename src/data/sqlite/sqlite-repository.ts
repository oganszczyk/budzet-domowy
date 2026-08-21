/**
 * Repozytorium oparte na SQLite (8: „relacyjna baza SQLite").
 *
 * Implementuje DOKŁADNIE ten sam interfejs co wersja pamięciowa, więc
 * podmiana nie wymaga zmian w żadnym ekranie ani haku (8.2). Kolejność
 * budowy aplikacji — najpierw ekrany na danych w pamięci, potem baza —
 * była możliwa właśnie dzięki temu szwowi.
 */

import { computeBillStatus } from '@/domain/bill-status';
import { MainType } from '@/domain/enums';
import type { BillTemplate, Category, MonthlyTotals, Payment, Subscription } from '@/domain/models';
import { monthRange, todayIso, yearMonthOf, type YearMonth } from '@/lib/date';

import type {
  BillAmountHistoryEntry,
  BillTemplatePatch,
  CategoryTotal,
  ExpensesRepository,
  NewBillTemplate,
  NewCategory,
  NewPayment,
  NewSubscription,
  PaymentPatch,
  SubscriptionPatch,
} from '../repository';
import type { SqlDatabase, SqlParam } from './database';

/** Wiersze przychodzą z SQLite jako zwykłe obiekty — te typy je opisują. */
type CategoryRow = {
  id: number;
  name: string;
  iconKey: string;
  isActive: number;
  sortOrder: number;
  usedBy: string;
};

type PaymentRow = {
  id: number;
  mainType: string;
  categoryId: number;
  title: string;
  amountGrosze: number | null;
  effectiveDate: string;
  dueDate: string | null;
  paidDate: string | null;
  status: string | null;
  source: string;
  merchant: string | null;
  description: string | null;
  paymentMethod: string | null;
  billTemplateId: number | null;
  subscriptionId: number | null;
  receiptImagePath: string | null;
  createdAt: string;
  updatedAt: string;
};

type BillTemplateRow = {
  id: number;
  name: string;
  categoryId: number;
  defaultDueDay: number;
  isActive: number;
  useFixedAmount: number;
  fixedAmountGrosze: number | null;
  createdAt: string;
  updatedAt: string;
};

type SubscriptionRow = {
  id: number;
  name: string;
  amountGrosze: number;
  frequencyType: string;
  customIntervalMonths: number | null;
  startDate: string;
  nextPaymentDate: string;
  categoryId: number;
  isActive: number;
  lastUsageConfirmationDate: string | null;
  confirmationIntervalMonths: number;
  createdAt: string;
  updatedAt: string;
};

/** SQLite nie zna typu boolean — zapisujemy 0/1. */
const toDbBool = (value: boolean): number => (value ? 1 : 0);
const fromDbBool = (value: number): boolean => value === 1;

const PAYMENT_COLUMNS = `
  id, mainType, categoryId, title, amountGrosze, effectiveDate, dueDate, paidDate,
  status, source, merchant, description, paymentMethod, billTemplateId,
  subscriptionId, receiptImagePath, createdAt, updatedAt
`;

export class SqliteExpensesRepository implements ExpensesRepository {
  constructor(private readonly db: SqlDatabase) {}

  // --- Mapowanie wierszy na modele ---

  private toCategory(row: CategoryRow): Category {
    return {
      id: row.id,
      name: row.name,
      iconKey: row.iconKey,
      isActive: fromDbBool(row.isActive),
      sortOrder: row.sortOrder,
      usedBy: row.usedBy.split(',').filter(Boolean) as MainType[],
    };
  }

  /**
   * BR-11: status rachunku wyliczamy przy odczycie, nie ufamy kolumnie.
   * Rachunek po terminie zmienia więc status sam, bez żadnej aktualizacji bazy.
   */
  private toPayment(row: PaymentRow): Payment {
    const payment = {
      id: row.id,
      mainType: row.mainType as Payment['mainType'],
      categoryId: row.categoryId,
      title: row.title,
      amountGrosze: row.amountGrosze,
      effectiveDate: row.effectiveDate,
      dueDate: row.dueDate,
      paidDate: row.paidDate,
      status: null as Payment['status'],
      source: row.source as Payment['source'],
      merchant: row.merchant,
      description: row.description,
      paymentMethod: row.paymentMethod as Payment['paymentMethod'],
      billTemplateId: row.billTemplateId,
      subscriptionId: row.subscriptionId,
      receiptImagePath: row.receiptImagePath,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } satisfies Payment;

    if (payment.mainType !== MainType.BILL) return payment;
    return { ...payment, status: computeBillStatus(payment, todayIso()) };
  }

  private toBillTemplate(row: BillTemplateRow): BillTemplate {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      defaultDueDay: row.defaultDueDay,
      isActive: fromDbBool(row.isActive),
      useFixedAmount: fromDbBool(row.useFixedAmount),
      fixedAmountGrosze: row.fixedAmountGrosze,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toSubscription(row: SubscriptionRow): Subscription {
    return {
      id: row.id,
      name: row.name,
      amountGrosze: row.amountGrosze,
      frequencyType: row.frequencyType as Subscription['frequencyType'],
      customIntervalMonths: row.customIntervalMonths,
      startDate: row.startDate,
      nextPaymentDate: row.nextPaymentDate,
      categoryId: row.categoryId,
      isActive: fromDbBool(row.isActive),
      lastUsageConfirmationDate: row.lastUsageConfirmationDate,
      confirmationIntervalMonths: row.confirmationIntervalMonths,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  // --- Kategorie (7.1) ---

  async listCategories(mainType?: MainType): Promise<Category[]> {
    const rows = await this.db.all<CategoryRow>(
      'SELECT * FROM category WHERE isActive = 1 ORDER BY sortOrder, id'
    );
    const categories = rows.map((row) => this.toCategory(row));
    if (mainType === undefined) return categories;
    return categories.filter((c) => c.usedBy.includes(mainType));
  }

  async getCategory(id: number): Promise<Category | null> {
    const row = await this.db.first<CategoryRow>('SELECT * FROM category WHERE id = ?', [id]);
    return row ? this.toCategory(row) : null;
  }

  async createCategory(input: NewCategory): Promise<Category> {
    const next = await this.db.first<{ nextOrder: number }>(
      'SELECT COALESCE(MAX(sortOrder), 0) + 1 AS nextOrder FROM category'
    );
    const sortOrder = input.sortOrder ?? next?.nextOrder ?? 1;

    const result = await this.db.run(
      'INSERT INTO category (name, iconKey, isActive, sortOrder, usedBy) VALUES (?, ?, ?, ?, ?)',
      [input.name, input.iconKey, toDbBool(input.isActive), sortOrder, input.usedBy.join(',')]
    );

    return { ...input, id: result.lastInsertRowId, sortOrder };
  }

  // --- Sumy (6.1, BR-09) ---

  /**
   * 6.1: sumy liczy baza, nie aplikacja.
   *
   * `amountGrosze IS NOT NULL` realizuje BR-05 — rachunek oczekujący na kwotę
   * nie wchodzi do sumy. Rachunki liczymy niezależnie od statusu opłacenia.
   */
  async getMonthlyTotals(month: YearMonth): Promise<MonthlyTotals> {
    const { start, end } = monthRange(month);
    const rows = await this.db.all<{ mainType: string; total: number }>(
      `SELECT mainType, COALESCE(SUM(amountGrosze), 0) AS total
         FROM payment
        WHERE effectiveDate BETWEEN ? AND ?
          AND amountGrosze IS NOT NULL
        GROUP BY mainType`,
      [start, end]
    );

    const byType = new Map(rows.map((r) => [r.mainType, r.total]));
    return {
      billsGrosze: byType.get(MainType.BILL) ?? 0,
      subscriptionsGrosze: byType.get(MainType.SUBSCRIPTION) ?? 0,
      purchasesGrosze: byType.get(MainType.PURCHASE) ?? 0,
    };
  }

  /** 5.4: każda podkategoria z jej dokładną miesięczną sumą. */
  async getCategoryTotals(month: YearMonth, mainType: MainType): Promise<CategoryTotal[]> {
    const { start, end } = monthRange(month);
    const rows = await this.db.all<{ categoryId: number; total: number }>(
      `SELECT categoryId, COALESCE(SUM(amountGrosze), 0) AS total
         FROM payment
        WHERE effectiveDate BETWEEN ? AND ?
          AND mainType = ?
          AND amountGrosze IS NOT NULL
        GROUP BY categoryId`,
      [start, end, mainType]
    );

    const byCategory = new Map(rows.map((r) => [r.categoryId, r.total]));
    const categories = await this.listCategories(mainType);

    // Podkategorie bez wydatków też muszą się pojawić — z sumą 0,00 zł (5.1).
    return categories.map((category) => ({
      category,
      totalGrosze: byCategory.get(category.id) ?? 0,
    }));
  }

  // --- Płatności (7.2) ---

  /**
   * Sortowanie: najnowsze pierwsze, a przy równej dacie decyduje identyfikator.
   * AC 5.7 wymaga stabilnej kolejności dla wielu płatności tego samego dnia.
   */
  private static readonly NEWEST_FIRST = 'ORDER BY effectiveDate DESC, id DESC';

  async listPaymentsForMonth(month: YearMonth, mainType?: MainType): Promise<Payment[]> {
    const { start, end } = monthRange(month);
    const params: SqlParam[] = [start, end];
    let sql = `SELECT ${PAYMENT_COLUMNS} FROM payment WHERE effectiveDate BETWEEN ? AND ?`;

    if (mainType !== undefined) {
      sql += ' AND mainType = ?';
      params.push(mainType);
    }

    const rows = await this.db.all<PaymentRow>(
      `${sql} ${SqliteExpensesRepository.NEWEST_FIRST}`,
      params
    );
    return rows.map((row) => this.toPayment(row));
  }

  async listPaymentsForCategory(
    month: YearMonth,
    categoryId: number,
    mainType?: MainType
  ): Promise<Payment[]> {
    const { start, end } = monthRange(month);
    const params: SqlParam[] = [start, end, categoryId];
    let sql = `SELECT ${PAYMENT_COLUMNS} FROM payment
                WHERE effectiveDate BETWEEN ? AND ? AND categoryId = ?`;

    if (mainType !== undefined) {
      sql += ' AND mainType = ?';
      params.push(mainType);
    }

    const rows = await this.db.all<PaymentRow>(
      `${sql} ${SqliteExpensesRepository.NEWEST_FIRST}`,
      params
    );
    return rows.map((row) => this.toPayment(row));
  }

  /** 5.7 + BR-05: rachunki bez kwoty nie trafiają do historii. */
  async listHistory(): Promise<Payment[]> {
    const rows = await this.db.all<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM payment
        WHERE amountGrosze IS NOT NULL
        ${SqliteExpensesRepository.NEWEST_FIRST}`
    );
    return rows.map((row) => this.toPayment(row));
  }

  async getPayment(id: number): Promise<Payment | null> {
    const row = await this.db.first<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM payment WHERE id = ?`,
      [id]
    );
    return row ? this.toPayment(row) : null;
  }

  async createPayment(input: NewPayment): Promise<Payment> {
    const now = new Date().toISOString();
    const result = await this.db.run(
      `INSERT INTO payment (
         mainType, categoryId, title, amountGrosze, effectiveDate, dueDate, paidDate,
         status, source, merchant, description, paymentMethod, billTemplateId,
         subscriptionId, receiptImagePath, createdAt, updatedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.mainType,
        input.categoryId,
        input.title,
        input.amountGrosze,
        input.effectiveDate,
        input.dueDate,
        input.paidDate,
        input.status,
        input.source,
        input.merchant,
        input.description,
        input.paymentMethod,
        input.billTemplateId,
        input.subscriptionId,
        input.receiptImagePath,
        now,
        now,
      ]
    );

    const created = await this.getPayment(result.lastInsertRowId);
    if (!created) throw new Error('Nie udało się odczytać zapisanej płatności.');
    return created;
  }

  async updatePayment(id: number, patch: PaymentPatch): Promise<Payment> {
    const allowed: (keyof PaymentPatch)[] = [
      'mainType',
      'categoryId',
      'title',
      'amountGrosze',
      'effectiveDate',
      'dueDate',
      'paidDate',
      'status',
      'source',
      'merchant',
      'description',
      'paymentMethod',
      'billTemplateId',
      'subscriptionId',
      'receiptImagePath',
    ];

    const fields = allowed.filter((key) => key in patch);
    const params: SqlParam[] = fields.map((key) => (patch[key] ?? null) as SqlParam);

    // 6.2: każda modyfikacja zapisuje updatedAt.
    const assignments = [...fields.map((key) => `${key} = ?`), 'updatedAt = ?'];
    params.push(new Date().toISOString(), id);

    await this.db.run(`UPDATE payment SET ${assignments.join(', ')} WHERE id = ?`, params);

    const updated = await this.getPayment(id);
    if (!updated) throw new Error(`Nie znaleziono płatności o id ${id}.`);
    return updated;
  }

  async deletePayment(id: number): Promise<void> {
    await this.db.run('DELETE FROM payment WHERE id = ?', [id]);
  }

  // --- Szablony rachunków (7.3) ---

  async listBillTemplates(includeInactive = false): Promise<BillTemplate[]> {
    const sql = includeInactive
      ? 'SELECT * FROM bill_template ORDER BY id'
      : 'SELECT * FROM bill_template WHERE isActive = 1 ORDER BY id';
    const rows = await this.db.all<BillTemplateRow>(sql);
    return rows.map((row) => this.toBillTemplate(row));
  }

  async getBillTemplate(id: number): Promise<BillTemplate | null> {
    const row = await this.db.first<BillTemplateRow>('SELECT * FROM bill_template WHERE id = ?', [
      id,
    ]);
    return row ? this.toBillTemplate(row) : null;
  }

  async createBillTemplate(input: NewBillTemplate): Promise<BillTemplate> {
    const now = new Date().toISOString();
    const result = await this.db.run(
      `INSERT INTO bill_template
         (name, categoryId, defaultDueDay, isActive, useFixedAmount, fixedAmountGrosze, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.categoryId,
        input.defaultDueDay,
        toDbBool(input.isActive),
        toDbBool(input.useFixedAmount),
        input.fixedAmountGrosze,
        now,
        now,
      ]
    );

    const created = await this.getBillTemplate(result.lastInsertRowId);
    if (!created) throw new Error('Nie udało się odczytać zapisanego szablonu.');
    return created;
  }

  async updateBillTemplate(id: number, patch: BillTemplatePatch): Promise<BillTemplate> {
    const assignments: string[] = [];
    const params: SqlParam[] = [];

    const set = (column: string, value: SqlParam) => {
      assignments.push(`${column} = ?`);
      params.push(value);
    };

    if (patch.name !== undefined) set('name', patch.name);
    if (patch.categoryId !== undefined) set('categoryId', patch.categoryId);
    if (patch.defaultDueDay !== undefined) set('defaultDueDay', patch.defaultDueDay);
    if (patch.isActive !== undefined) set('isActive', toDbBool(patch.isActive));
    if (patch.useFixedAmount !== undefined) set('useFixedAmount', toDbBool(patch.useFixedAmount));
    if (patch.fixedAmountGrosze !== undefined) set('fixedAmountGrosze', patch.fixedAmountGrosze);

    set('updatedAt', new Date().toISOString());
    params.push(id);

    await this.db.run(`UPDATE bill_template SET ${assignments.join(', ')} WHERE id = ?`, params);

    const updated = await this.getBillTemplate(id);
    if (!updated) throw new Error(`Nie znaleziono szablonu rachunku o id ${id}.`);
    return updated;
  }

  /** 7.5: wyłączamy, nie kasujemy — inaczej zniknęłaby historia (BR-07). */
  async deactivateBillTemplate(id: number): Promise<void> {
    await this.updateBillTemplate(id, { isActive: false });
  }

  async findBillForTemplateAndMonth(
    billTemplateId: number,
    month: YearMonth
  ): Promise<Payment | null> {
    const { start, end } = monthRange(month);
    const row = await this.db.first<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM payment
        WHERE billTemplateId = ? AND effectiveDate BETWEEN ? AND ?
        LIMIT 1`,
      [billTemplateId, start, end]
    );
    return row ? this.toPayment(row) : null;
  }

  /** 5.2: historia wcześniejszych kwot tego samego szablonu. */
  async listBillAmountHistory(billTemplateId: number): Promise<BillAmountHistoryEntry[]> {
    const rows = await this.db.all<{
      id: number;
      effectiveDate: string;
      amountGrosze: number;
    }>(
      `SELECT id, effectiveDate, amountGrosze FROM payment
        WHERE billTemplateId = ? AND amountGrosze IS NOT NULL
        ORDER BY effectiveDate DESC`,
      [billTemplateId]
    );

    return rows.map((row) => ({
      paymentId: row.id,
      month: yearMonthOf(row.effectiveDate),
      amountGrosze: row.amountGrosze,
    }));
  }

  // --- Subskrypcje (7.4) ---

  async listSubscriptions(): Promise<Subscription[]> {
    const rows = await this.db.all<SubscriptionRow>('SELECT * FROM subscription ORDER BY id');
    return rows.map((row) => this.toSubscription(row));
  }

  async getSubscription(id: number): Promise<Subscription | null> {
    const row = await this.db.first<SubscriptionRow>('SELECT * FROM subscription WHERE id = ?', [
      id,
    ]);
    return row ? this.toSubscription(row) : null;
  }

  async createSubscription(input: NewSubscription): Promise<Subscription> {
    const now = new Date().toISOString();
    const result = await this.db.run(
      `INSERT INTO subscription
         (name, amountGrosze, frequencyType, customIntervalMonths, startDate, nextPaymentDate,
          categoryId, isActive, lastUsageConfirmationDate, confirmationIntervalMonths,
          createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.amountGrosze,
        input.frequencyType,
        input.customIntervalMonths,
        input.startDate,
        input.nextPaymentDate,
        input.categoryId,
        toDbBool(input.isActive),
        input.lastUsageConfirmationDate,
        input.confirmationIntervalMonths,
        now,
        now,
      ]
    );

    const created = await this.getSubscription(result.lastInsertRowId);
    if (!created) throw new Error('Nie udało się odczytać zapisanej subskrypcji.');
    return created;
  }

  async updateSubscription(id: number, patch: SubscriptionPatch): Promise<Subscription> {
    const assignments: string[] = [];
    const params: SqlParam[] = [];

    const set = (column: string, value: SqlParam) => {
      assignments.push(`${column} = ?`);
      params.push(value);
    };

    if (patch.name !== undefined) set('name', patch.name);
    if (patch.amountGrosze !== undefined) set('amountGrosze', patch.amountGrosze);
    if (patch.frequencyType !== undefined) set('frequencyType', patch.frequencyType);
    if (patch.customIntervalMonths !== undefined)
      set('customIntervalMonths', patch.customIntervalMonths);
    if (patch.startDate !== undefined) set('startDate', patch.startDate);
    if (patch.nextPaymentDate !== undefined) set('nextPaymentDate', patch.nextPaymentDate);
    if (patch.categoryId !== undefined) set('categoryId', patch.categoryId);
    if (patch.isActive !== undefined) set('isActive', toDbBool(patch.isActive));
    if (patch.lastUsageConfirmationDate !== undefined)
      set('lastUsageConfirmationDate', patch.lastUsageConfirmationDate);
    if (patch.confirmationIntervalMonths !== undefined)
      set('confirmationIntervalMonths', patch.confirmationIntervalMonths);

    set('updatedAt', new Date().toISOString());
    params.push(id);

    await this.db.run(`UPDATE subscription SET ${assignments.join(', ')} WHERE id = ?`, params);

    const updated = await this.getSubscription(id);
    if (!updated) throw new Error(`Nie znaleziono subskrypcji o id ${id}.`);
    return updated;
  }

  // --- Rejestr wygenerowanych rekordów ---

  private async hasGenerated(
    sourceType: 'BILL' | 'SUBSCRIPTION',
    sourceId: number,
    month: YearMonth
  ): Promise<boolean> {
    const row = await this.db.first<{ found: number }>(
      `SELECT 1 AS found FROM generated_record
        WHERE sourceType = ? AND sourceId = ? AND year = ? AND month = ?`,
      [sourceType, sourceId, month.year, month.month]
    );
    return row !== null;
  }

  private async markGenerated(
    sourceType: 'BILL' | 'SUBSCRIPTION',
    sourceId: number,
    month: YearMonth
  ): Promise<void> {
    await this.db.run(
      `INSERT OR IGNORE INTO generated_record (sourceType, sourceId, year, month)
       VALUES (?, ?, ?, ?)`,
      [sourceType, sourceId, month.year, month.month]
    );
  }

  hasGeneratedBill(billTemplateId: number, month: YearMonth): Promise<boolean> {
    return this.hasGenerated('BILL', billTemplateId, month);
  }

  markBillGenerated(billTemplateId: number, month: YearMonth): Promise<void> {
    return this.markGenerated('BILL', billTemplateId, month);
  }

  hasGeneratedSubscriptionPayment(subscriptionId: number, month: YearMonth): Promise<boolean> {
    return this.hasGenerated('SUBSCRIPTION', subscriptionId, month);
  }

  markSubscriptionPaymentGenerated(subscriptionId: number, month: YearMonth): Promise<void> {
    return this.markGenerated('SUBSCRIPTION', subscriptionId, month);
  }
}
