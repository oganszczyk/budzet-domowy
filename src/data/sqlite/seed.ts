/**
 * Zasiew bazy przy pierwszym uruchomieniu (3.1).
 *
 * T-01 określa oczekiwany stan po pierwszym uruchomieniu:
 * „Domyślne kategorie istnieją, sumy wynoszą 0,00 zł."
 *
 * Dlatego zasiewamy WYŁĄCZNIE kategorie i szablony rachunków — żadnych
 * płatności. Rachunki na bieżący miesiąc powstaną same przy pierwszym
 * wejściu na ich listę, w stanie „Oczekuje na kwotę", więc sumy pozostaną
 * zerowe do momentu, aż użytkownik wpisze pierwsze kwoty (BR-05).
 */

import { MainType } from '@/domain/enums';

import {
  BILL_CATEGORY_NAME,
  CATEGORY_ICONS,
  DEFAULT_BILL_TEMPLATES,
  SHARED_CATEGORY_NAMES,
  SHARED_USED_BY,
} from '../default-categories';
import type { SqlDatabase } from './database';

export async function seedDefaults(db: SqlDatabase): Promise<void> {
  const existing = await db.first<{ count: number }>('SELECT COUNT(*) AS count FROM category');
  // Zasiew jest jednorazowy. Jeżeli kategorie już są, nie dokładamy duplikatów.
  if ((existing?.count ?? 0) > 0) return;

  const now = new Date().toISOString();

  const insertCategory = async (name: string, usedBy: MainType[], sortOrder: number) => {
    const result = await db.run(
      'INSERT INTO category (name, iconKey, isActive, sortOrder, usedBy) VALUES (?, ?, 1, ?, ?)',
      [name, CATEGORY_ICONS[name] ?? 'pricetag-outline', sortOrder, usedBy.join(',')]
    );
    return result.lastInsertRowId;
  };

  // Rachunki mają jedną, niedzieloną kategorię.
  const billCategoryId = await insertCategory(BILL_CATEGORY_NAME, [MainType.BILL], 0);

  // Subskrypcje i zakupy korzystają z tej samej listy podkategorii.
  for (const [index, name] of SHARED_CATEGORY_NAMES.entries()) {
    await insertCategory(name, SHARED_USED_BY, index + 1);
  }

  // 5.2: domyślne rachunki cykliczne, bez kwot.
  for (const template of DEFAULT_BILL_TEMPLATES) {
    await db.run(
      `INSERT INTO bill_template
         (name, categoryId, defaultDueDay, isActive, useFixedAmount, fixedAmountGrosze, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 0, NULL, ?, ?)`,
      [template.name, billCategoryId, template.defaultDueDay, template.isActive ? 1 : 0, now, now]
    );
  }
}
