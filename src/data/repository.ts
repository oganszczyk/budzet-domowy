/**
 * Repozytorium — jedyne wejście do danych.
 *
 * 8.1: ekrany nie znają bazy danych. Pytają repozytorium, a repozytorium
 * wie, skąd wziąć odpowiedź.
 * 8.2: „Kod powinien umożliwiać późniejsze zastąpienie lokalnego
 * repozytorium repozytorium chmurowym."
 *
 * To właśnie ten plik na to pozwala. Dzisiaj odpowiedzi pochodzą z pamięci
 * (tryb demonstracyjny), jutro z SQLite, a kiedyś mogłyby z serwera —
 * a ekrany pozostaną bez zmian, bo widzą tylko ten interfejs.
 *
 * Każda metoda zwraca Promise, mimo że wersja pamięciowa mogłaby odpowiadać
 * natychmiast. To celowe: prawdziwa baza odpowiada asynchronicznie i gdyby
 * interfejs tego nie zakładał, podmiana wymusiłaby przepisanie ekranów.
 */

import type { BackupSnapshot } from '@/domain/backup';
import type { MainType } from '@/domain/enums';
import type {
  BillTemplate,
  Category,
  Income,
  MonthlyTotals,
  Payment,
  Subscription,
} from '@/domain/models';
import type { YearMonth } from '@/lib/date';

/** Dane potrzebne do utworzenia nowej płatności. Resztę pól uzupełnia repozytorium. */
export type NewPayment = Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>;

/** Pola, które wolno zmienić w istniejącej płatności. */
export type PaymentPatch = Partial<Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>>;

/** Dane potrzebne do utworzenia szablonu rachunku cyklicznego. */
export type NewBillTemplate = Omit<BillTemplate, 'id' | 'createdAt' | 'updatedAt'>;

/** Pola, które wolno zmienić w szablonie rachunku. */
export type BillTemplatePatch = Partial<NewBillTemplate>;

/** Dane potrzebne do utworzenia subskrypcji (7.4). */
export type NewSubscription = Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>;

/** Pola, które wolno zmienić w subskrypcji. */
export type SubscriptionPatch = Partial<NewSubscription>;

/** Dane potrzebne do utworzenia podkategorii (7.1). */
export type NewCategory = Omit<Category, 'id' | 'sortOrder'> & { sortOrder?: number };

/** Dane potrzebne do zapisania dochodu domownika (Etap 11). */
export type NewIncome = Omit<Income, 'id' | 'createdAt' | 'updatedAt'>;

/** Pola, które wolno zmienić w zapisanym dochodzie. */
export type IncomePatch = Partial<NewIncome>;

/** Podkategoria wraz z jej sumą w wybranym miesiącu (5.4). */
export type CategoryTotal = {
  category: Category;
  totalGrosze: number;
};

/** 5.2: pozycja historii wcześniejszych kwot tego samego rachunku. */
export type BillAmountHistoryEntry = {
  paymentId: number;
  month: YearMonth;
  amountGrosze: number;
};

export interface ExpensesRepository {
  // --- Kategorie (7.1) ---

  /** Lista aktywnych kategorii, opcjonalnie tylko dla jednej kategorii głównej. */
  listCategories(mainType?: MainType): Promise<Category[]>;

  /**
   * 12.1: specyfikacja zostawiała otwarte pytanie, czy użytkownik może
   * tworzyć własne kategorie. Decyzja właściciela projektu: tak, ale
   * WYŁĄCZNIE podkategorie — kategorie główne pozostają trzy (BR-01).
   */
  createCategory(input: NewCategory): Promise<Category>;

  // --- Sumy (6.1, BR-09) ---

  /** 5.1: trzy sumy na karty ekranu głównego. */
  getMonthlyTotals(month: YearMonth): Promise<MonthlyTotals>;

  /** 5.4: sumy poszczególnych podkategorii w wybranym miesiącu. */
  getCategoryTotals(month: YearMonth, mainType: MainType): Promise<CategoryTotal[]>;

  // --- Płatności (7.2) ---

  /** Płatności z wybranego miesiąca, opcjonalnie jednego typu. */
  listPaymentsForMonth(month: YearMonth, mainType?: MainType): Promise<Payment[]>;

  /** 5.4: „Kliknięcie podkategorii otwiera listę przypisanych zakupów." */
  listPaymentsForCategory(
    month: YearMonth,
    categoryId: number,
    mainType?: MainType
  ): Promise<Payment[]>;

  getCategory(id: number): Promise<Category | null>;

  /**
   * 5.7: wspólna historia, od najnowszych do najstarszych.
   * BR-05: rachunki oczekujące na kwotę NIE są tu pokazywane.
   */
  listHistory(): Promise<Payment[]>;

  getPayment(id: number): Promise<Payment | null>;
  createPayment(input: NewPayment): Promise<Payment>;
  updatePayment(id: number, patch: PaymentPatch): Promise<Payment>;
  deletePayment(id: number): Promise<void>;

  // --- Szablony rachunków (7.3) ---

  /** Domyślnie tylko aktywne. `includeInactive` zwraca też wyłączone (ekran zarządzania). */
  listBillTemplates(includeInactive?: boolean): Promise<BillTemplate[]>;
  getBillTemplate(id: number): Promise<BillTemplate | null>;
  createBillTemplate(input: NewBillTemplate): Promise<BillTemplate>;
  updateBillTemplate(id: number, patch: BillTemplatePatch): Promise<BillTemplate>;
  /** 7.5: szablon z historią ukrywamy (isActive=false), a nie kasujemy fizycznie. */
  deactivateBillTemplate(id: number): Promise<void>;

  /**
   * BR-12: sprawdza, czy dla danego szablonu istnieje już rekord na ten miesiąc.
   * Używane przy automatycznym tworzeniu, żeby nie powstał duplikat.
   */
  findBillForTemplateAndMonth(billTemplateId: number, month: YearMonth): Promise<Payment | null>;

  /**
   * Rejestr wygenerowanych rachunków.
   *
   * Automat NIE może pytać „czy taki rachunek istnieje?", bo wtedy usunięcie
   * rachunku przez użytkownika wyglądałoby jak „brakuje go" i automat
   * odtworzyłby go przy następnym otwarciu listy. Rachunek byłby nie do usunięcia.
   *
   * Dlatego zapamiętujemy sam fakt wygenerowania. Usunięcie płatności nie
   * kasuje wpisu w rejestrze, więc decyzja użytkownika zostaje uszanowana.
   */
  hasGeneratedBill(billTemplateId: number, month: YearMonth): Promise<boolean>;
  markBillGenerated(billTemplateId: number, month: YearMonth): Promise<void>;

  /** 5.2: historia wcześniejszych kwot dla tego samego szablonu. */
  listBillAmountHistory(billTemplateId: number): Promise<BillAmountHistoryEntry[]>;

  // --- Subskrypcje (7.4) ---

  /** Domyślnie wszystkie; lista pokazuje też zakończone, żeby dało się je znaleźć. */
  listSubscriptions(): Promise<Subscription[]>;
  getSubscription(id: number): Promise<Subscription | null>;
  createSubscription(input: NewSubscription): Promise<Subscription>;
  updateSubscription(id: number, patch: SubscriptionPatch): Promise<Subscription>;

  /**
   * Rejestr wygenerowanych płatności subskrypcji — ta sama zasada co przy
   * rachunkach: pytamy „czy już to tworzyłem?", a nie „czy to istnieje?",
   * żeby usunięta płatność nie wracała przy następnym otwarciu listy.
   */
  hasGeneratedSubscriptionPayment(subscriptionId: number, month: YearMonth): Promise<boolean>;
  markSubscriptionPaymentGenerated(subscriptionId: number, month: YearMonth): Promise<void>;

  // --- Dochody domowników (Etap 11) ---

  /** Dochody wpisane na wybrany miesiąc, w kolejności dodania. */
  listIncomes(month: YearMonth): Promise<Income[]>;

  getIncome(id: number): Promise<Income | null>;
  createIncome(input: NewIncome): Promise<Income>;
  updateIncome(id: number, patch: IncomePatch): Promise<Income>;
  deleteIncome(id: number): Promise<void>;

  /**
   * Suma dochodów miesiąca w groszach.
   *
   * Osobna metoda zamiast sumowania listy w ekranie: ekran główny potrzebuje
   * wyłącznie sumy, a baza policzy ją jednym zapytaniem, bez przenoszenia
   * wszystkich rekordów.
   */
  getMonthlyIncomeTotal(month: YearMonth): Promise<number>;

  // --- Kopia zapasowa (Etap 10) ---

  /**
   * Wydaje komplet danych do kopii zapasowej.
   *
   * Metoda należy do repozytorium, a nie do ekranu ustawień, z tego samego
   * powodu co cała reszta (8.1): ekran nie ma prawa wiedzieć, że dane leżą
   * w SQLite. Tu w dodatku chodzi o coś więcej — wierna kopia wymaga sięgnięcia
   * także po rekordy nieaktywne i po rejestr wygenerowanych rachunków, których
   * zwykłe metody odczytu celowo nie pokazują.
   */
  exportSnapshot(): Promise<BackupSnapshot>;

  /**
   * ZASTĘPUJE całą zawartość danymi z kopii.
   *
   * Zastąpienie, a nie dołączenie. Doklejanie kopii do istniejących danych
   * dawałoby przy każdym odtworzeniu podwojone wydatki, a użytkownik nie
   * miałby jak ich rozdzielić. Odtwarzanie ma przywrócić stan z dnia kopii —
   * i dokładnie to robi.
   *
   * Operacja musi być niepodzielna: albo wchodzi cała kopia, albo nie zmienia
   * się nic. Przerwanie w połowie zostawiłoby aplikację bez starych danych
   * i bez nowych.
   */
  importSnapshot(snapshot: BackupSnapshot): Promise<void>;
}
