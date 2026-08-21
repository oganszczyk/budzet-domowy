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
    subcategories: 'Podkategorie',
    addManual: 'Wpisz ręcznie',
    scanReceipt: 'Zeskanuj paragon',
    amount: 'Kwota',
    date: 'Data',
    dayLabel: 'Dzień miesiąca',
    dayInvalid: 'Ten miesiąc nie ma takiego dnia.',
    category: 'Podkategoria',
    merchant: 'Sklep / miejsce',
    merchantPlaceholder: 'np. Lidl',
    description: 'Opis',
    descriptionPlaceholder: 'Opcjonalna notatka',
    paymentMethod: 'Sposób płatności',
    newTitle: 'Nowy wydatek',
    empty: 'Brak zakupów w tym miesiącu.',
    emptyCategory: 'Brak zakupów w tej podkategorii.',
    noAmount: 'Podaj kwotę większą niż 0,00 zł.',
    method: {
      CARD: 'Karta',
      CASH: 'Gotówka',
      TRANSFER: 'Przelew',
      OTHER: 'Inne',
    },
  },

  /** Tworzenie własnych podkategorii (decyzja do 12.1). */
  categories: {
    addNew: 'Dodaj podkategorię',
    nameLabel: 'Nazwa podkategorii',
    namePlaceholder: 'np. Zwierzęta',
    create: 'Dodaj',
    duplicate: 'Taka podkategoria już istnieje.',
  },

  /** 5.6: skanowanie paragonu. */
  scan: {
    title: 'Skanowanie paragonu',
    takePhoto: 'Zrób zdjęcie',
    pickFromGallery: 'Wybierz z galerii',
    recognizing: 'Rozpoznaję paragon...',
    retake: 'Ponów zdjęcie',
    verifyQuestion: 'Czy dane zostały poprawnie odczytane?',
    verifyHint:
      'Sprawdź i popraw, zanim zapiszesz. Nic nie zostanie zapisane bez Twojego potwierdzenia.',
    photoSaved: 'Zdjęcie zostanie zapisane razem z wydatkiem.',
    amountFrom: 'Kwotę odczytano z wiersza',
    amountFromLabel: {
      DO_ZAPLATY: 'DO ZAPŁATY',
      SUMA: 'SUMA',
      RAZEM: 'RAZEM',
      NAJWIEKSZA: 'największa kwota na paragonie',
    },
    demoBanner:
      'Tryb demonstracyjny: rozpoznawanie nie czyta Twojego zdjęcia, tylko podstawia przykładowy paragon. Prawdziwy odczyt wymaga własnej wersji aplikacji (development build) — Expo Go nie obsługuje modułów natywnych.',
    noPermission: 'Brak zgody na dostęp do aparatu.',
    noPermissionHint: 'Możesz jej udzielić w ustawieniach telefonu albo wybrać zdjęcie z galerii.',
    openSettings: 'Otwórz ustawienia',
    noText: 'Nie udało się odczytać tekstu ze zdjęcia.',
    engineUnavailable: 'Rozpoznawanie tekstu nie jest dostępne w tej wersji aplikacji.',
    ocrError: 'Rozpoznawanie nie powiodło się.',
    fillManually: 'Uzupełnij dane ręcznie',
    amountRequired: 'Podaj kwotę — bez niej nie można zapisać.',
  },

  /** 5.8: szczegóły płatności. */
  paymentDetail: {
    title: 'Szczegóły płatności',
    notFound: 'Nie znaleziono tej płatności.',
    mainType: 'Kategoria główna',
    category: 'Podkategoria',
    date: 'Data',
    source: 'Sposób dodania',
    merchant: 'Sklep / miejsce',
    method: 'Sposób płatności',
    description: 'Opis',
    deleteConfirmTitle: 'Usunąć płatność?',
    deleteConfirmMessage: 'Tej operacji nie można cofnąć.',
    mainTypeName: {
      BILL: 'Rachunek domowy',
      SUBSCRIPTION: 'Subskrypcja',
      PURCHASE: 'Zakup',
    },
    sourceName: {
      MANUAL: 'Wpisany ręcznie',
      AUTO_BILL: 'Utworzony automatycznie z rachunku cyklicznego',
      AUTO_SUBSCRIPTION: 'Utworzony automatycznie z subskrypcji',
      RECEIPT_SCAN: 'Ze skanu paragonu',
    },
  },

  /** 5.7: historia. */
  history: {
    title: 'Historia płatności',
    empty: 'Brak zapisanych płatności.',
    emptyHint:
      'Tu pojawią się wszystkie zapisane płatności: rachunki z uzupełnioną kwotą, subskrypcje i zakupy.',
    monthTotal: 'Razem',
    waitingHidden: 'Rachunki bez kwoty nie są tu pokazywane.',
  },

  /** 5.9: analiza — ekran tymczasowy do czasu osobnej specyfikacji. */
  analysis: {
    title: 'Analiza',
    placeholder: 'Moduł analizy zostanie dodany w kolejnym etapie.',
  },

  /** Etap 10: kopia zapasowa. */
  backup: {
    title: 'Kopia zapasowa',
    openFromHome: 'Kopia zapasowa',
    intro:
      'Wszystkie Twoje dane są zapisane wyłącznie w pamięci tego telefonu. Odinstalowanie aplikacji, awaria albo zgubienie telefonu oznacza ich bezpowrotną utratę. Kopia zapasowa to plik, który możesz wysłać sobie mailem albo zapisać na dysku.',

    createTitle: 'Zapisz kopię',
    createDescription:
      'Zbiera wszystkie wydatki, rachunki i subskrypcje do jednego pliku, a potem otwiera okno udostępniania. Wyślij plik gdzieś POZA telefon — kopia leżąca na tym samym urządzeniu nie ochroni przed jego utratą.',
    createButton: 'Zapisz kopię',
    createWorking: 'Przygotowuję kopię...',
    createDone: 'Kopia gotowa',
    createDoneHint: 'Jeśli okno udostępniania zostało zamknięte, plik nie został nigdzie wysłany.',

    restoreTitle: 'Odtwórz z kopii',
    restoreDescription: 'Wczytuje wcześniej zapisany plik i przywraca stan z dnia jego powstania.',
    restoreButton: 'Wybierz plik kopii',
    restoreWorking: 'Odtwarzam...',
    restoreConfirmTitle: 'Zastąpić wszystkie dane?',
    restoreConfirmMessage:
      'Odtworzenie kopii USUWA wszystko, co jest teraz w aplikacji, i wstawia w to miejsce zawartość pliku. Tej operacji nie można cofnąć. Jeśli masz niezapisane wydatki z ostatnich dni, najpierw zapisz nową kopię.',
    restoreConfirmButton: 'Zastąp dane',
    restoreDone: 'Dane zostały odtworzone',
    restoreDoneFrom: 'Kopia z dnia',

    /** Podsumowanie zawartości kopii — ile czego. */
    countsPayments: 'Płatności',
    countsBillTemplates: 'Rachunki cykliczne',
    countsSubscriptions: 'Subskrypcje',
    countsCategories: 'Podkategorie',

    /** Powody odmowy — każdy mówi, co konkretnie zrobić. */
    error: {
      SHARING_UNAVAILABLE: 'To urządzenie nie potrafi udostępniać plików.',
      WRITE_FAILED:
        'Nie udało się zapisać pliku kopii. Sprawdź, czy w telefonie jest wolne miejsce.',
      READ_FAILED: 'Nie udało się odczytać wskazanego pliku.',
      NOT_JSON:
        'Ten plik nie jest kopią zapasową. Upewnij się, że wskazujesz plik z rozszerzeniem .json, a pobieranie zakończyło się w całości.',
      NOT_BACKUP: 'Ten plik pochodzi z innej aplikacji.',
      FUTURE_VERSION:
        'Ta kopia została zapisana w nowszej wersji aplikacji. Zaktualizuj aplikację i spróbuj ponownie.',
      DAMAGED: 'Plik kopii jest uszkodzony — nic nie zostało zmienione.',
    },

    /** Ostatnia linia obrony przed fałszywym poczuciem bezpieczeństwa. */
    warning:
      'Aplikacja nie tworzy kopii sama. Powtórz to co jakiś czas — kopia sprzed pół roku odtworzy dane sprzed pół roku.',
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
