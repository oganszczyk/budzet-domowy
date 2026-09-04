/**
 * Etap 12: nazwa przedmiotu analizy i jego zapis w adresie ekranu.
 *
 * `AnalysisSubject` z warstwy domeny jest celowo bezimienny — trzyma
 * identyfikator, a nie napis. Nazwę („Gaz", „Jedzenie", „Netflix") zna
 * dopiero warstwa aplikacji, bo trzeba po nią sięgnąć do repozytorium.
 *
 * Gdyby przedmiot analizy nosił nazwę w sobie, zmiana nazwy rachunku
 * w ustawieniach zostawiłaby na ekranie analizy starą — a zestawienie
 * wyglądałoby na dotyczące czegoś innego, niż faktycznie liczy.
 */

import { strings } from '@/constants/strings';
import { AnalysisSubjectKind, type AnalysisSubject } from '@/domain/analysis';
import { MainType } from '@/domain/enums';
import type { BillTemplate, Category, Subscription } from '@/domain/models';

/** Wszystko, czego potrzeba, żeby zamienić identyfikator na nazwę. */
export type SubjectDictionaries = {
  billTemplates: BillTemplate[];
  categories: Category[];
  subscriptions: Subscription[];
};

export const EMPTY_DICTIONARIES: SubjectDictionaries = {
  billTemplates: [],
  categories: [],
  subscriptions: [],
};

const MAIN_TYPE_LABELS: Record<MainType, string> = {
  [MainType.BILL]: strings.home.billsCard,
  [MainType.SUBSCRIPTION]: strings.home.subscriptionsCard,
  [MainType.PURCHASE]: strings.home.purchasesCard,
};

/**
 * Nazwa przedmiotu analizy widoczna na ekranie.
 *
 * Gdy rekordu już nie ma (użytkownik usunął subskrypcję, a zestawienie
 * zostało otwarte ze starego adresu), oddajemy neutralny zastępnik zamiast
 * pustego napisu. Ekran ma wtedy nadal sensowny nagłówek, a dane i tak
 * są poprawne — filtrujemy przecież po identyfikatorze, nie po nazwie.
 */
export function describeSubject(subject: AnalysisSubject, dict: SubjectDictionaries): string {
  switch (subject.kind) {
    case AnalysisSubjectKind.ALL_EXPENSES:
      return strings.analysis.subjectAllExpenses;
    case AnalysisSubjectKind.INCOME:
      return strings.analysis.subjectIncome;
    case AnalysisSubjectKind.MAIN_TYPE:
      return MAIN_TYPE_LABELS[subject.mainType];
    case AnalysisSubjectKind.BILL_TEMPLATE:
      return (
        dict.billTemplates.find((t) => t.id === subject.billTemplateId)?.name ??
        strings.analysis.subjectUnknown
      );
    case AnalysisSubjectKind.SUBSCRIPTION:
      return (
        dict.subscriptions.find((s) => s.id === subject.subscriptionId)?.name ??
        strings.analysis.subjectUnknown
      );
    case AnalysisSubjectKind.CATEGORY:
      return (
        dict.categories.find((c) => c.id === subject.categoryId)?.name ??
        strings.analysis.subjectUnknown
      );
  }
}

/**
 * Krótki, jednoznaczny zapis przedmiotu analizy: „BILL_TEMPLATE:3".
 *
 * Służy do dwóch rzeczy naraz i dlatego jest jeden, a nie dwa:
 *  - porównania („czy ta propozycja nie powtarza poprzedniej"),
 *  - przekazania przedmiotu w adresie ekranu zestawienia.
 */
export function subjectKey(subject: AnalysisSubject): string {
  switch (subject.kind) {
    case AnalysisSubjectKind.ALL_EXPENSES:
    case AnalysisSubjectKind.INCOME:
      return subject.kind;
    case AnalysisSubjectKind.MAIN_TYPE:
      return `${subject.kind}:${subject.mainType}`;
    case AnalysisSubjectKind.BILL_TEMPLATE:
      return `${subject.kind}:${subject.billTemplateId}`;
    case AnalysisSubjectKind.SUBSCRIPTION:
      return `${subject.kind}:${subject.subscriptionId}`;
    case AnalysisSubjectKind.CATEGORY:
      return `${subject.kind}:${subject.categoryId}`;
  }
}

/**
 * Odczytuje przedmiot analizy z zapisu `subjectKey`.
 *
 * Zwraca `null` dla wszystkiego, czego nie rozumie. Adres ekranu przychodzi
 * z zewnątrz (nawigacja, powrót do zapisanego ekranu) i nie ma gwarancji,
 * że jest poprawny — ekran ma wtedy pokazać wartość domyślną, a nie paść.
 */
export function subjectFromKey(key: string | undefined): AnalysisSubject | null {
  if (!key) return null;

  const [kind, value] = key.split(':');

  switch (kind) {
    case AnalysisSubjectKind.ALL_EXPENSES:
      return { kind: AnalysisSubjectKind.ALL_EXPENSES };
    case AnalysisSubjectKind.INCOME:
      return { kind: AnalysisSubjectKind.INCOME };
    case AnalysisSubjectKind.MAIN_TYPE:
      return value === MainType.BILL ||
        value === MainType.SUBSCRIPTION ||
        value === MainType.PURCHASE
        ? { kind: AnalysisSubjectKind.MAIN_TYPE, mainType: value }
        : null;
    case AnalysisSubjectKind.BILL_TEMPLATE: {
      const id = Number(value);
      return Number.isInteger(id)
        ? { kind: AnalysisSubjectKind.BILL_TEMPLATE, billTemplateId: id }
        : null;
    }
    case AnalysisSubjectKind.SUBSCRIPTION: {
      const id = Number(value);
      return Number.isInteger(id)
        ? { kind: AnalysisSubjectKind.SUBSCRIPTION, subscriptionId: id }
        : null;
    }
    case AnalysisSubjectKind.CATEGORY: {
      const id = Number(value);
      return Number.isInteger(id) ? { kind: AnalysisSubjectKind.CATEGORY, categoryId: id } : null;
    }
    default:
      return null;
  }
}
