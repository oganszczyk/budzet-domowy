# Plan wdrożenia — postęp

Odwzorowanie rozdziału 9 specyfikacji. Każdy etap kończy się działającą aplikacją.

## Etap 0 — szkielet projektu ✅ ZAKOŃCZONY

- [x] Utworzyć projekt i podstawową strukturę katalogów
- [x] Skonfigurować analizę statyczną i formatowanie kodu (ESLint + Prettier)
- [x] Dodać motyw, formatowanie pl-PL i stałe tekstowe interfejsu
- [x] Utworzyć nawigację do ekranów Home, Historia i Analiza
- [x] Dodać tymczasowe puste widoki wszystkich głównych tras

Weryfikacja: 29 testów jednostkowych, typecheck, lint, build — wszystko przechodzi.
Przełączanie miesiąca sprawdzone także na przełomie roku.

## Zmiana kolejności: najpierw tryb demonstracyjny

Decyzja właściciela projektu (19.08.2026): budujemy najpierw wszystkie ekrany
na danych trzymanych w pamięci, a bazę SQLite podłączamy na końcu.

Jest to możliwe bez podwójnej pracy, ponieważ ekrany rozmawiają wyłącznie
z interfejsem `ExpensesRepository` (`src/data/repository.ts`), zgodnie z 8.1 i 8.2.
Podmiana danych z pamięci na SQLite to zmiana jednego pliku: `src/data/index.ts`.

**Ograniczenie trybu demonstracyjnego:** dane nie przeżywają zamknięcia
aplikacji. Scenariusz T-16 („ponowne uruchomienie aplikacji") będzie
możliwy do zaliczenia dopiero po Etapie 1b.

## Etap 1a — model danych i repozytorium w pamięci ✅ ZAKOŃCZONY

- [x] Zaimplementować modele Category, Payment, BillTemplate i Subscription
- [x] Utworzyć enumy statusów, źródeł i częstotliwości
- [x] Wyliczanie statusu rachunku (BR-11) + testy
- [x] Zdefiniować interfejs repozytorium (szew do podmiany na SQLite)
- [x] Repozytorium w pamięci + operacje CRUD
- [x] Dane demonstracyjne dla bieżącego i poprzedniego miesiąca (3.1)
- [x] Testy scenariuszy T-01, T-02, T-03, T-04, T-15

## Etap 1b — baza SQLite ⬜ (po ukończeniu ekranów)

- [ ] Utworzyć bazę SQLite, tabele, indeksy i pierwszą migrację
- [ ] Podmienić repozytorium w `src/data/index.ts`
- [ ] Dodać domyślne kategorie przy pierwszym uruchomieniu
- [ ] Napisać testy zapisu/odczytu bazy oraz scenariusz T-16

## Etap 2 — ekran główny ✅ ZAKOŃCZONY

- [x] Zaimplementować wybór miesiąca i roku
- [x] Zaimplementować trzy karty kategorii z sumami
- [x] Podłączyć karty do zapytań agregujących
- [x] Dodać przejścia do szczegółów kategorii
- [x] Sprawdzić aktualizację sum po zmianie miesiąca

## Etap 3 — rachunki ✅ ZAKOŃCZONY

- [x] Zaimplementować listę rachunków dla wybranego miesiąca
- [x] Zaimplementować formularz szablonu rachunku
- [x] Zaimplementować automatyczne tworzenie miesięcznych rekordów (BR-12)
- [x] Zaimplementować edycję kwoty, terminu i statusu
- [x] Zaimplementować automatyczny status „Po terminie" (BR-11)
- [x] Dodać historię wcześniejszych kwot rachunku

Sprawdzone w działającej aplikacji:

| Sprawdzenie                                     | Wynik                                                |
| ----------------------------------------------- | ---------------------------------------------------- |
| Cztery statusy widoczne jednocześnie            | Opłacony, Do zapłaty, Po terminie, Oczekuje na kwotę |
| AC 5.2: rachunek bez kwoty nie zwiększa sumy    | Woda pominięta w sumie 2 855,59 zł                   |
| AC 5.2: po wpisaniu kwoty suma się aktualizuje  | 2 855,59 → 2 898,09 zł bez restartu                  |
| T-07: oznaczenie jako opłacony                  | status + data 19.08.2026 zapisane                    |
| 6.1: opłacony rachunek nadal wlicza się do sumy | suma bez zmian po opłaceniu                          |
| Nowy szablon rachunku                           | „Śmieci" dodane, stan Oczekuje na kwotę              |

## Poprawki po testach na telefonie (19.08.2026)

Zgłoszenie właściciela projektu: część rachunków wracała po usunięciu,
brakowało możliwości zmiany terminu płatności.

| Problem                         | Przyczyna                                                                                                  | Poprawka                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Usunięty rachunek wracał        | Automat pytał „czy taki rachunek istnieje?", więc usunięcie wyglądało jak brak i rekord powstawał ponownie | Rejestr wygenerowanych rachunków — automat pyta „czy już go kiedyś tworzyłem?" |
| Nie dało się zmienić terminu    | Etap 3 wymagał edycji terminu; ekran pokazywał go tylko do odczytu                                         | Edytowalny dzień terminu z walidacją długości miesiąca                         |
| Brak kontroli nad cyklicznością | 5.8 wymaga osobnego działania dla źródła cyklicznego; nie było takiego ekranu                              | Ekran „Rachunki cykliczne" — włączanie i wyłączanie (7.5, bez utraty historii) |

## Etap 4 — subskrypcje ✅ ZAKOŃCZONY

- [x] Zaimplementować listę i formularz subskrypcji
- [x] Zaimplementować generator płatności cyklicznych
- [x] Zaimplementować zakończenie subskrypcji bez usuwania historii
- [x] Zaimplementować okresowe pytanie o dalsze korzystanie (P1)
- [x] Dodać prognozowany koszt roczny (P1)

Harmonogram wyliczamy z daty rozpoczęcia i częstotliwości, a nie przez
przesuwanie zapisanego pola — tak jak status rachunku (BR-11). Wartość
wyliczona nie może się rozjechać po nieudanym zapisie.

Sprawdzone w działającej aplikacji:

| Sprawdzenie                           | Wynik                                                            |
| ------------------------------------- | ---------------------------------------------------------------- |
| Prognoza roczna z trzech miesięcznych | 3 024,00 zł = (43 + 129 + 80) × 12                               |
| Pytanie kontrolne po 3 miesiącach     | pyta o Netflix, „Przypomnij później" przechodzi do Siłowni       |
| T-11: zakończenie subskrypcji         | suma miesiąca bez zmian (252,00 zł), prognoza spada o 516,00 zł  |
| T-10: subskrypcja roczna              | dodaje 89,00 zł do prognozy, a nie 1 068,00 zł                   |
| AC 5.3: zmiana kwoty                  | nowa cena w przyszłych miesiącach, zapisane płatności nietknięte |

## Etap 5 — zakupy ręczne ✅ ZAKOŃCZONY

- [x] Zaimplementować podkategorie i ich miesięczne sumy
- [x] Zaimplementować formularz ręcznego wydatku
- [x] Dodać walidację kwoty, daty i kategorii
- [x] Dodać listę zakupów po kliknięciu podkategorii

Powstał też wspólny ekran szczegółów płatności (5.8) pod `/payment/[id]`,
obsługujący wszystkie trzy typy. Etap 6 może go użyć bez powielania kodu —
zostaje mu wtedy sama wspólna historia.

Sprawdzone w działającej aplikacji:

| Sprawdzenie                        | Wynik                                                    |
| ---------------------------------- | -------------------------------------------------------- |
| Sumy podkategorii                  | Jedzenie 125,50 + 87,30 = 212,80 zł                      |
| BR-10: pusta i zerowa kwota        | zapis zablokowany, komunikat widoczny                    |
| T-02: dodanie 125,50 zł w Jedzeniu | suma 569,99 → 695,49 zł, podkategoria 212,80 → 338,30 zł |
| T-03: edycja 125,50 → 100,00 zł    | podkategoria 338,30 → 312,80 zł (spadek o 25,50 zł)      |
| T-04: usunięcie zakupu             | podkategoria wraca do 212,80 zł, pozycja znika           |
| 5.7: kolejność listy               | od najnowszych: 19.08, 09.08, 03.08                      |

## Etap 6 — historia i szczegóły ✅ ZAKOŃCZONY

- [x] Zaimplementować wspólną chronologiczną historię
- [x] Zaimplementować ekran szczegółów zależny od typu płatności (powstał w Etapie 5)
- [x] Zaimplementować edycję i usuwanie z potwierdzeniem (powstało w Etapie 5)
- [x] Sprawdzić aktualizację wszystkich sum po zmianach

Historia celowo NIE zależy od wybranego miesiąca. BR-09 dotyczy sum,
a 5.7 mówi o „wszystkich zapisanych rekordach" — miesiąc jest tu nagłówkiem
porządkującym, nie filtrem.

Sprawdzone w działającej aplikacji:

| Sprawdzenie                          | Wynik                                                           |
| ------------------------------------ | --------------------------------------------------------------- |
| BR-05: rachunek bez kwoty ukryty     | Woda widoczna w lipcu (42,10 zł), ukryta w sierpniu             |
| 5.7: status tylko przy nieopłaconych | Gaz „Do zapłaty", Prąd „Po terminie", opłacone bez odznaki      |
| Trasowanie zależne od typu           | rachunek do /bills/[id] z historią kwot, zakup do /payment/[id] |
| AC 5.7: edycja bez restartu          | Lidl 125,50 na 200,00 zł, suma miesiąca 3 677,58 na 3 752,08 zł |
| AC 5.7: usunięcie znika z sum        | suma 3 752,08 na 3 552,08 zł, lipcowy Lidl nietknięty           |
| Zgodność z ekranem głównym           | trzy karty sumują się do 3 552,08 zł — tyle samo co historia    |

## Etap 7 — skanowanie paragonu ⬜

## Etap 8 — analiza jako placeholder ⬜

## Etap 9 — jakość i wydanie lokalne ⬜

## Odstępstwa od specyfikacji

| Punkt specyfikacji | Zapis w dokumencie     | Co robimy                                   | Dlaczego                                                                                                                               |
| ------------------ | ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 8. Frontend        | Flutter / Dart         | React Native + Expo (SDK 54)                | Decyzja właściciela projektu. Reszta specyfikacji — model danych, ekrany, reguły biznesowe, scenariusze testowe — pozostaje bez zmian. |
| 8. Baza lokalna    | SQLite                 | SQLite (`expo-sqlite`)                      | Bez zmian.                                                                                                                             |
| 8. Stan aplikacji  | jeden spójny mechanizm | TanStack Query + Context na wybrany miesiąc | Prawie cały stan to dane z bazy; unieważnianie zapytań realizuje AC 5.1 („suma zmienia się bez restartu").                             |
