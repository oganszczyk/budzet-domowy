import { computeBillStatus } from './bill-status';
import { BillStatus } from './enums';

const TODAY = '2026-08-19';

describe('computeBillStatus (5.2, BR-11)', () => {
  it('rachunek bez kwoty oczekuje na kwotę', () => {
    expect(
      computeBillStatus({ amountGrosze: null, paidDate: null, dueDate: '2026-08-10' }, TODAY)
    ).toBe(BillStatus.WAITING_AMOUNT);
  });

  it('rachunek z kwotą przed terminem jest do zapłaty', () => {
    expect(
      computeBillStatus({ amountGrosze: 18040, paidDate: null, dueDate: '2026-08-25' }, TODAY)
    ).toBe(BillStatus.TO_PAY);
  });

  it('T-08: nieopłacony rachunek po terminie jest po terminie', () => {
    expect(
      computeBillStatus({ amountGrosze: 18040, paidDate: null, dueDate: '2026-08-10' }, TODAY)
    ).toBe(BillStatus.OVERDUE);
  });

  it('rachunek z terminem dzisiaj nie jest jeszcze po terminie', () => {
    expect(computeBillStatus({ amountGrosze: 18040, paidDate: null, dueDate: TODAY }, TODAY)).toBe(
      BillStatus.TO_PAY
    );
  });

  it('T-07: rachunek opłacony jest opłacony, nawet po terminie', () => {
    expect(
      computeBillStatus(
        { amountGrosze: 18040, paidDate: '2026-08-12', dueDate: '2026-08-10' },
        TODAY
      )
    ).toBe(BillStatus.PAID);
  });

  it('brak kwoty ma pierwszeństwo przed terminem — OVERDUE wymaga wpisanej kwoty (5.2)', () => {
    expect(
      computeBillStatus({ amountGrosze: null, paidDate: null, dueDate: '2026-01-01' }, TODAY)
    ).toBe(BillStatus.WAITING_AMOUNT);
  });

  it('rachunek bez terminu nigdy nie jest po terminie', () => {
    expect(computeBillStatus({ amountGrosze: 18040, paidDate: null, dueDate: null }, TODAY)).toBe(
      BillStatus.TO_PAY
    );
  });

  it('poprawnie porównuje daty na przełomie roku', () => {
    expect(
      computeBillStatus({ amountGrosze: 5000, paidDate: null, dueDate: '2025-12-31' }, '2026-01-01')
    ).toBe(BillStatus.OVERDUE);
  });
});
