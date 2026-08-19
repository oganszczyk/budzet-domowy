/**
 * Wszystkie teksty interfejsu.
 *
 * 1.2: nazwy klas i zmiennych mogą być angielskie, ale cały interfejs
 * użytkownika ma być po polsku.
 *
 * Trzymamy je w jednym pliku, ponieważ:
 *  - łatwo poprawić literówkę bez szukania po ekranach,
 *  - widać od razu, czy nazewnictwo jest spójne,
 *  - gdyby aplikacja miała kiedyś obsłużyć drugi język, wystarczy dodać
 *    obok drugi taki plik zamiast przepisywać wszystkie ekrany.
 */

export const strings = {
  app: {
    name: 'Domowe wydatki',
  },

  /** 4.2: dolny pasek nawigacyjny. */
  tabs: {
    home: 'Główna',
    history: 'Historia',
    analysis: 'Analiza',
  },

  /** 5.1: ekran główny. */
  home: {
    previousMonth: 'Poprzedni miesiąc',
    nextMonth: 'Następny miesiąc',
    billsCard: 'Rachunki domowe',
    subscriptionsCard: 'Subskrypcje',
    purchasesCard: 'Wydatki i zakupy',
    monthTotal: 'Suma miesiąca',
  },

  /** 5.2: rachunki domowe. */
  bills: {
    title: 'Rachunki domowe',
    total: 'Suma rachunków',
    fillAmount: 'Uzupełnij kwotę',
    dueDate: 'Termin płatności',
    dueShort: 'Termin:',
    paidDate: 'Data opłacenia',
    addTemplate: 'Dodaj rachunek',
    markAsPaid: 'Oznacz jako opłacony',
    markAsUnpaid: 'Cofnij opłacenie',
    amountHistory: 'Historia wcześniejszych kwot',
    noHistory: 'To pierwszy miesiąc tego rachunku.',
    empty: 'Brak rachunków w tym miesiącu.',
    notFound: 'Nie znaleziono tego rachunku.',
    amountLabel: 'Kwota rachunku',
    monthLabel: 'Miesiąc',
    dueDayLabel: 'Dzień terminu',
    dueDayInvalid: 'Ten miesiąc nie ma takiego dnia.',
    dueDayHint: 'Zmiana dotyczy tylko tego miesiąca.',
    manageTemplates: 'Rachunki cykliczne',
    templatesTitle: 'Rachunki cykliczne',
    templatesIntro:
      'Tutaj decydujesz, które rachunki mają się tworzyć automatycznie co miesiąc. Wyłączenie rachunku nie kasuje historii poprzednich miesięcy.',
    templateActive: 'Tworzy się co miesiąc',
    templateInactive: 'Wyłączony',
    templateFixedAmount: 'Stała kwota',
    templateDueDay: 'Termin: dzień',
    templateEmpty: 'Nie masz jeszcze żadnych rachunków cyklicznych.',
    templateSaved: 'Zapisano zmiany w rachunku cyklicznym.',
    templateDeactivateTitle: 'Wyłączyć ten rachunek?',
    templateDeactivateMessage:
      'Nie będzie się już tworzył w kolejnych miesiącach. Zapisane płatności zostaną nietknięte.',
    templateNotFound: 'Nie znaleziono tego rachunku cyklicznego.',
    deleteHint:
      'Usuwasz rachunek tylko z tego miesiąca. Aby przestał się tworzyć co miesiąc, wyłącz go w „Rachunki cykliczne".',
    descriptionLabel: 'Opis',
    descriptionPlaceholder: 'Opcjonalna notatka',
    deleteConfirmTitle: 'Usunąć rachunek?',
    deleteConfirmMessage: 'Tej operacji nie można cofnąć.',
    status: {
      WAITING_AMOUNT: 'Oczekuje na kwotę',
      TO_PAY: 'Do zapłaty',
      PAID: 'Opłacony',
      OVERDUE: 'Po terminie',
    },
    /** Formularz nowego szablonu rachunku cyklicznego (5.2). */
    newTemplate: {
      title: 'Nowy rachunek cykliczny',
      nameLabel: 'Nazwa rachunku',
      namePlaceholder: 'np. Prąd',
      dueDayLabel: 'Dzień terminu w miesiącu',
      fixedAmountToggle: 'Stała kwota co miesiąc',
      fixedAmountHint:
        'Gdy włączone, kolejne miesiące dostaną od razu tę kwotę. Gdy wyłączone, każdy miesiąc czeka na jej uzupełnienie.',
      fixedAmountLabel: 'Stała kwota',
      created: 'Rachunek cykliczny został dodany.',
      dueDayInvalid: 'Podaj dzień od 1 do 31.',
    },
  },

  /** 5.3: subskrypcje. */
  subscriptions: {
    title: 'Subskrypcje',
    total: 'Suma subskrypcji',
    yearlyForecast: 'Prognozowany koszt roczny',
    nextPayment: 'Najbliższa płatność',
    add: 'Dodaj subskrypcję',
    active: 'Aktywna',
    ended: 'Zakończona',
    end: 'Zakończ subskrypcję',
    resume: 'Wznów subskrypcję',
    empty: 'Nie masz jeszcze żadnych subskrypcji.',
    notFound: 'Nie znaleziono tej subskrypcji.',
    activeSection: 'Aktywne',
    endedSection: 'Zakończone',
    startDate: 'Data rozpoczęcia',
    frequencyLabel: 'Częstotliwość',
    customIntervalLabel: 'Co ile miesięcy',
    customIntervalInvalid: 'Podaj liczbę od 1 do 60.',
    amountLabel: 'Kwota',
    nameLabel: 'Nazwa',
    namePlaceholder: 'np. Netflix',
    categoryLabel: 'Kategoria pomocnicza',
    newTitle: 'Nowa subskrypcja',
    endConfirmTitle: 'Zakończyć subskrypcję?',
    endConfirmMessage: 'Nie powstaną nowe płatności. Wcześniejsze pozostaną w historii i w sumach.',
    amountChangeHint: 'Zmiana kwoty dotyczy przyszłych płatności. Zapisane pozostają bez zmian.',
    usageQuestion: 'Czy nadal korzystasz z tej subskrypcji i ją opłacasz?',
    usageYes: 'Tak',
    usageEnd: 'Zakończ subskrypcję',
    usageLater: 'Przypomnij później',
    frequency: {
      MONTHLY: 'Miesięczna',
      QUARTERLY: 'Kwartalna',
      HALF_YEARLY: 'Półroczna',
      YEARLY: 'Roczna',
      CUSTOM: 'Własna',
    },
  },

  /** 5.4 / 5.5: wydatki i zakupy. */
  purchases: {
    title: 'Wydatki i zakupy',
    total: 'Suma zakupów',
    addManual: 'Wpisz ręcznie',
    scanReceipt: 'Zeskanuj paragon',
    amount: 'Kwota',
    date: 'Data',
    category: 'Podkategoria',
    merchant: 'Sklep / miejsce',
    description: 'Opis',
    paymentMethod: 'Sposób płatności',
    method: {
      CARD: 'Karta',
      CASH: 'Gotówka',
      TRANSFER: 'Przelew',
      OTHER: 'Inne',
    },
  },

  /** 5.7: historia. */
  history: {
    title: 'Historia płatności',
    empty: 'Brak zapisanych płatności.',
  },

  /** 5.9: analiza — ekran tymczasowy do czasu osobnej specyfikacji. */
  analysis: {
    title: 'Analiza',
    placeholder: 'Moduł analizy zostanie dodany w kolejnym etapie.',
  },

  /** Teksty wspólne. */
  common: {
    save: 'Zapisz',
    cancel: 'Anuluj',
    edit: 'Edytuj',
    delete: 'Usuń',
    confirm: 'Potwierdź',
    back: 'Wstecz',
    comingSoon: 'Ten ekran powstanie w kolejnym etapie.',
    notFound: 'Nie znaleziono takiego ekranu.',
    goHome: 'Wróć na stronę główną',
  },

  /** Komunikaty walidacji (5.5, 6.2, BR-10). */
  validation: {
    amountEmpty: 'Podaj kwotę.',
    amountTooLow: 'Kwota musi być większa niż 0,00 zł.',
    amountTooHigh: 'Kwota jest zbyt duża.',
    amountInvalid: 'Kwota jest nieprawidłowa.',
    nameRequired: 'Podaj nazwę.',
    categoryRequired: 'Wybierz podkategorię.',
    dateRequired: 'Podaj datę.',
  },
} as const;
