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
    paidDate: 'Data opłacenia',
    addTemplate: 'Dodaj rachunek',
    markAsPaid: 'Oznacz jako opłacony',
    amountHistory: 'Historia kwot',
    status: {
      WAITING_AMOUNT: 'Oczekuje na kwotę',
      TO_PAY: 'Do zapłaty',
      PAID: 'Opłacony',
      OVERDUE: 'Po terminie',
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
