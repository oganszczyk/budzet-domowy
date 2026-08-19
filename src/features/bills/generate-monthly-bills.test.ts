import { InMemoryExpensesRepository } from '@/data/in-memory-repository';
import { BillStatus, MainType } from '@/domain/enums';
import { addMonths, currentYearMonth } from '@/lib/date';

import { generateMonthlyBills } from './generate-monthly-bills';

const THIS_MONTH = currentYearMonth();
const NEXT_MONTH = addMonths(THIS_MONTH, 1);

function repo() {
  return new InMemoryExpensesRepository();
}

describe('generateMonthlyBills (5.2, BR-12)', () => {
  it('T-05: w nowym miesiącu powstaje pozycja oczekująca na kwotę', async () => {
    const r = repo();
    const created = await generateMonthlyBills(r, NEXT_MONTH);

    expect(created.length).toBeGreaterThan(0);

    const power = created.find((b) => b.title === 'Prąd');
    expect(power).toBeDefined();
    expect(power?.amountGrosze).toBeNull();
    expect(power?.status).toBe(BillStatus.WAITING_AMOUNT);
  });

  it('AC 5.2: aktywne rachunki pojawiają się bez ręcznego kopiowania', async () => {
    const r = repo();
    const templates = await r.listBillTemplates();

    await generateMonthlyBills(r, NEXT_MONTH);

    const bills = await r.listPaymentsForMonth(NEXT_MONTH, MainType.BILL);
    expect(bills).toHaveLength(templates.length);
  });

  it('BR-12: ponowne wywołanie nie tworzy duplikatów', async () => {
    const r = repo();

    const first = await generateMonthlyBills(r, NEXT_MONTH);
    const second = await generateMonthlyBills(r, NEXT_MONTH);
    const third = await generateMonthlyBills(r, NEXT_MONTH);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toHaveLength(0);
    expect(third).toHaveLength(0);

    const bills = await r.listPaymentsForMonth(NEXT_MONTH, MainType.BILL);
    const templateIds = bills.map((b) => b.billTemplateId);
    expect(new Set(templateIds).size).toBe(templateIds.length);
  });

  it('nie dubluje rachunków, które już są w bieżącym miesiącu', async () => {
    const r = repo();
    const before = await r.listPaymentsForMonth(THIS_MONTH, MainType.BILL);

    await generateMonthlyBills(r, THIS_MONTH);

    const after = await r.listPaymentsForMonth(THIS_MONTH, MainType.BILL);
    expect(after).toHaveLength(before.length);
  });

  it('nowy rekord dziedziczy nazwę, kategorię i dzień terminu z szablonu', async () => {
    const r = repo();
    const templates = await r.listBillTemplates();
    const template = templates.find((t) => t.name === 'Gaz');
    expect(template).toBeDefined();

    const created = await generateMonthlyBills(r, NEXT_MONTH);
    const gas = created.find((b) => b.billTemplateId === template!.id);

    expect(gas?.title).toBe(template!.name);
    expect(gas?.categoryId).toBe(template!.categoryId);
    // defaultDueDay = 28 -> termin wypada 28. dnia wygenerowanego miesiąca.
    expect(gas?.dueDate?.slice(-2)).toBe('28');
  });

  it('kwotę dziedziczy tylko szablon ze stałą kwotą (5.2)', async () => {
    const r = repo();
    const created = await generateMonthlyBills(r, NEXT_MONTH);

    // Czynsz ma useFixedAmount = true, więc kwota jest kopiowana.
    const rent = created.find((b) => b.title === 'Czynsz za mieszkanie');
    expect(rent?.amountGrosze).toBe(250000);
    expect(rent?.status).toBe(BillStatus.TO_PAY);

    // Woda nie ma stałej kwoty — zostaje pusta.
    const water = created.find((b) => b.title === 'Woda');
    expect(water?.amountGrosze).toBeNull();
    expect(water?.status).toBe(BillStatus.WAITING_AMOUNT);
  });

  it('rachunki bez kwoty nie zwiększają sumy nowego miesiąca (BR-05)', async () => {
    const r = repo();
    await generateMonthlyBills(r, NEXT_MONTH);

    const totals = await r.getMonthlyTotals(NEXT_MONTH);
    // Tylko szablony ze stałą kwotą: czynsz 2500,00 + internet 79,99.
    expect(totals.billsGrosze).toBe(250000 + 7999);
  });

  it('nie tworzy rachunków sprzed powstania szablonu', async () => {
    const r = repo();
    const longAgo = addMonths(THIS_MONTH, -36);

    const created = await generateMonthlyBills(r, longAgo);

    expect(created).toHaveLength(0);
  });

  it('usunięty rachunek NIE wraca po ponownym otwarciu listy (5.8)', async () => {
    const r = repo();
    await generateMonthlyBills(r, NEXT_MONTH);

    const bills = await r.listPaymentsForMonth(NEXT_MONTH, MainType.BILL);
    const victim = bills[0];
    await r.deletePayment(victim.id);

    // Każde wejście na listę uruchamia generator — tu udajemy trzy wejścia.
    await generateMonthlyBills(r, NEXT_MONTH);
    await generateMonthlyBills(r, NEXT_MONTH);
    await generateMonthlyBills(r, NEXT_MONTH);

    const after = await r.listPaymentsForMonth(NEXT_MONTH, MainType.BILL);
    expect(after.map((b) => b.id)).not.toContain(victim.id);
    expect(after.map((b) => b.billTemplateId)).not.toContain(victim.billTemplateId);
    expect(after).toHaveLength(bills.length - 1);
  });

  it('usunięcie rachunku w jednym miesiącu nie blokuje kolejnego miesiąca (5.8)', async () => {
    const r = repo();
    const monthAfterNext = addMonths(NEXT_MONTH, 1);

    await generateMonthlyBills(r, NEXT_MONTH);
    const bills = await r.listPaymentsForMonth(NEXT_MONTH, MainType.BILL);
    const victim = bills[0];
    await r.deletePayment(victim.id);

    // Usunięcie dotyczy jednego miesiąca — źródło cykliczne działa dalej.
    await generateMonthlyBills(r, monthAfterNext);

    const later = await r.listPaymentsForMonth(monthAfterNext, MainType.BILL);
    expect(later.map((b) => b.billTemplateId)).toContain(victim.billTemplateId);
  });

  it('wyłączony szablon nie generuje kolejnych rachunków (7.5)', async () => {
    const r = repo();
    const templates = await r.listBillTemplates();
    const target = templates[0];

    await r.deactivateBillTemplate(target.id);
    const created = await generateMonthlyBills(r, NEXT_MONTH);

    expect(created.map((b) => b.billTemplateId)).not.toContain(target.id);
  });
});
