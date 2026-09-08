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

import type { SavedReport } from '@/domain/analysis';
import type { BackupSnapshot, DeletedRecord } from '@/domain/backup';
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
/**
 * DLACZEGO `uuid` JEST NIEOBOWIĄZKOWY PRZY TWORZENIU (Etap 14b).
 *
 * Trwały identyfikator jest OBOWIĄZKOWY w gotowym rekordzie — bez niego
 * synchronizacja nie ma czym rozpoznać wydatku na drugim telefonie. Ale
 * przy TWORZENIU podaje się go tylko wtedy, gdy rekord ma zachować cudzy
 * identyfikator: przy odtwarzaniu kopii zapasowej i przy pobraniu rekordu
 * z serwera. W pozostałych kilkunastu miejscach — formularzach, automacie
 * rachunków, danych demonstracyjnych, zasiewie i testach — nadaje go baza.
 *
 * Gdyby był wymagany, każde z tych miejsc musiałoby zawołać generator,
 * a pominięcie jednego przeszłoby przez kompilator dopiero po dopisaniu
 * tam pola z byle jaką wartością. Nieobowiązkowe pole odwraca ten układ:
 * kto milczy, dostaje poprawny identyfikator z bazy.
 */
export type NewPayment = Omit<Payment, 'id' | 'uuid' | 'createdAt' | 'updatedAt'> & {
  uuid?: string;
};

/** Pola, które wolno zmienić w istniejącej płatności. */
export type PaymentPatch = Partial<Omit<Payment, 'id' | 'uuid' | 'createdAt' | 'updatedAt'>>;

/** Dane potrzebne do utworzenia szablonu rachunku cyklicznego. */
export type NewBillTemplate = Omit<BillTemplate, 'id' | 'uuid' | 'createdAt' | 'updatedAt'> & {
  uuid?: string;
};

/** Pola, które wolno zmienić w szablonie rachunku. */
export type BillTemplatePatch = Partial<Omit<NewBillTemplate, 'uuid'>>;

/** Dane potrzebne do utworzenia subskrypcji (7.4). */
export type NewSubscription = Omit<Subscription, 'id' | 'uuid' | 'createdAt' | 'updatedAt'> & {
  uuid?: string;
};

/** Pola, które wolno zmienić w subskrypcji. */
export type SubscriptionPatch = Partial<Omit<NewSubscription, 'uuid'>>;

/** Dane potrzebne do utworzenia podkategorii (7.1). */
export type NewCategory = Omit<Category, 'id' | 'uuid' | 'sortOrder'> & {
  sortOrder?: number;
  uuid?: string;
};

/** Dane potrzebne do zapisania dochodu domownika (Etap 11). */
export type NewIncome = Omit<Income, 'id' | 'uuid' | 'createdAt' | 'updatedAt'> & {
  uuid?: string;
};

/** Pola, które wolno zmienić w zapisanym dochodzie. */
export type IncomePatch = Partial<Omit<NewIncome, 'uuid'>>;

/** Dane potrzebne do zapisania zestawienia (Etap 13). Kolejność nadaje repozytorium. */
export type NewSavedReport = Omit<SavedReport, 'id' | 'sortOrder' | 'createdAt' | 'updatedAt'> & {
  sortOrder?: number;
};

/** Pola, które wolno zmienić w zapisanym zestawieniu — w praktyce nazwa. */
export type SavedReportPatch = Partial<Omit<SavedReport, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Etap 14c: REKORDY CZEKAJĄCE NA WYSŁANIE.
 *
 * Każdy zapis podnosi w bazie znacznik `pendingSync` (Etap 14b). Te typy
 * opisują, co repozytorium oddaje synchronizacji, gdy o te rekordy zapyta.
 *
 * DLACZEGO DOKŁADAMY `...Uuid` OBOK `...Id`
 *
 * Lokalne `categoryId` to numer kolejny tej jednej bazy — na drugim telefonie
 * ta sama liczba oznacza inną kategorię. Serwer musi dostać identyfikator
 * trwały. Repozytorium dokłada go ZŁĄCZENIEM przy odczycie, zamiast trzymać
 * w tabelach klucze obce po `uuid`: wewnątrz telefonu liczba jest poprawna
 * i szybsza, a tłumaczenie potrzebne jest wyłącznie w rozmowie z serwerem
 * (uzasadnienie odstąpienia od pierwotnego planu — `docs/ETAPY.md`, Etap 14b).
 *
 * Pole bywa puste, choć w bazie klucz obcy jest wymagany: `billTemplateId`
 * i `subscriptionId` są puste dla wydatku wpisanego ręcznie.
 */
export type PendingBillTemplate = BillTemplate & {
  /** Trwały identyfikator kategorii, do której należy szablon. */
  categoryUuid: string | null;
};

export type PendingSubscription = Subscription & {
  categoryUuid: string | null;
};

export type PendingPayment = Payment & {
  categoryUuid: string | null;
  /** Trwały identyfikator szablonu, z którego powstał rachunek. */
  billTemplateUuid: string | null;
  /** Trwały identyfikator subskrypcji, z której powstała płatność. */
  subscriptionUuid: string | null;
};

/** Wszystko, czego serwer jeszcze nie widział w tej postaci. */
export type PendingChanges = {
  categories: Category[];
  billTemplates: PendingBillTemplate[];
  subscriptions: PendingSubscription[];
  payments: PendingPayment[];
  incomes: Income[];
  deletedRecords: DeletedRecord[];
};

/**
 * Potwierdzenie, że KONKRETNA POSTAĆ rekordu dotarła na serwer.
 *
 * `updatedAt` nie jest tu ozdobą. Między odczytem rekordów a potwierdzeniem
 * wysyłki mija czas — na słabym łączu nawet kilkanaście sekund — i użytkownik
 * może w tym czasie poprawić kwotę wydatku, który właśnie poleciał. Zgaszenie
 * znacznika po samym `uuid` skasowałoby wtedy ślad po TEJ poprawce, a serwer
 * zostałby ze starą kwotą już na zawsze: rekord nie jest oznaczony, więc nic
 * go ponownie nie wyśle.
 *
 * Warunek `WHERE uuid = ? AND updatedAt = ?` gasi znacznik wyłącznie wtedy,
 * gdy rekord jest nadal dokładnie tym, co wysłano.
 */
export type SyncedMark = {
  uuid: string;
  updatedAt: string;
};

/**
 * Co zostało wysłane. Kategorie idą samym `uuid`, bo jako jedyna encja
 * nie mają znacznika czasu zmiany — zmiana nazwy kategorii w trakcie wysyłki
 * może więc przepaść do następnego zapisu. Świadome uproszczenie: kategorie
 * zmienia się rzadko, a dołożenie im `updatedAt` to migracja schematu.
 */
export type SyncedMarks = {
  categories: string[];
  billTemplates: SyncedMark[];
  subscriptions: SyncedMark[];
  payments: SyncedMark[];
  incomes: SyncedMark[];
  deletedRecords: { entityType: DeletedRecord['entityType']; uuid: string }[];
};

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

  // --- Analiza (Etap 12) ---

  /**
   * Wszystkie płatności z ciągu miesięcy, od najstarszej do najnowszej.
   *
   * DLACZEGO SUROWE REKORDY, A NIE GOTOWE SUMY
   *
   * Kuszące było dołożyć tu metodę `getMonthlySeries(zakres, przedmiot)`
   * i policzyć sumy w SQL. Odrzucone: przedmiotów analizy jest sześć rodzajów
   * (rachunek, subskrypcja, podkategoria, kategoria główna, wszystko, dochody),
   * więc zapytanie musiałoby sklejać warunek WHERE z typu przedmiotu — czyli
   * reguła „co wchodzi do zestawienia" wylądowałaby w tekście SQL i nie dałoby
   * się jej sprawdzić testem bez bazy.
   *
   * Przy skali domowego budżetu (kilkaset rekordów na rok) przeniesienie
   * płatności do pamięci kosztuje tyle co nic, a cała matematyka analizy
   * zostaje czystą funkcją w `src/features/analysis/`.
   *
   * BR-05 obowiązuje jak wszędzie: rachunki bez kwoty (`amountGrosze === null`)
   * są tu zwracane, ale sumowanie ma je pominąć. Zwracamy je, bo zestawienie
   * musi umieć powiedzieć „w marcu nie wpisałeś kwoty" — a tego nie da się
   * odróżnić od „w marcu nie było rachunku", jeśli baza ich nie odda.
   *
   * Zakres obejmuje OBA skrajne miesiące.
   */
  listPaymentsForRange(from: YearMonth, to: YearMonth): Promise<Payment[]>;

  /** Dochody domowników z ciągu miesięcy, chronologicznie. Zakres domknięty. */
  listIncomesForRange(from: YearMonth, to: YearMonth): Promise<Income[]>;

  // --- Zapisane zestawienia (Etap 13) ---

  /** Zestawienia zapisane przez użytkownika, w kolejności ustawionej na liście. */
  listSavedReports(): Promise<SavedReport[]>;

  createSavedReport(input: NewSavedReport): Promise<SavedReport>;
  updateSavedReport(id: number, patch: SavedReportPatch): Promise<SavedReport>;

  /**
   * Zapisane zestawienie kasujemy NAPRAWDĘ, a nie ukrywamy jak kategorie (7.5).
   *
   * Reguła „nie kasuj, wyłącz" chroni historię: usunięta kategoria zabrałaby
   * ze sobą sens zapisanych wydatków. Zestawienie nie jest niczyim rodzicem —
   * to zapamiętane pytanie, nie dane. Nic nie osieroci.
   */
  deleteSavedReport(id: number): Promise<void>;

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
  /**
   * Etap 14b: rekordy skasowane przez użytkownika, których nie ma już w bazie.
   *
   * Potrzebne kopii zapasowej i — od Etapu 14c — synchronizacji. Wyliczyć
   * tego nie da się z niczego innego: skasowany wydatek nie zostawia po sobie
   * żadnego śladu poza tą listą.
   */
  listDeletedRecords(): Promise<DeletedRecord[]>;

  /**
   * Etap 14c: rekordy, których serwer jeszcze nie widział w tej postaci.
   *
   * Zwraca WSZYSTKO naraz, a nie stronami. Przy pierwszej synchronizacji to
   * cała historia wydatków — przy kilku tysiącach rekordów nadal ułamek
   * megabajta, czyli mniej niż jedno zdjęcie paragonu. Dzielenie na strony
   * dołożymy, gdy będzie po co, a nie na zapas.
   */
  listPendingChanges(): Promise<PendingChanges>;

  /**
   * Gasi znacznik „do wysłania" przy rekordach, które dotarły na serwer.
   *
   * Wywoływane PO potwierdzeniu zapisu przez serwer, nigdy przed. Odwrotna
   * kolejność gubiłaby dane po cichu: zgaszony znacznik przy nieudanej
   * wysyłce znaczy, że nic już tego rekordu nie wyśle.
   */
  markSynced(marks: SyncedMarks): Promise<void>;

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
