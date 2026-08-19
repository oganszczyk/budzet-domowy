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

## Etap 3 — rachunki ⬜

## Etap 4 — subskrypcje ⬜

## Etap 5 — zakupy ręczne ⬜

## Etap 6 — historia i szczegóły ⬜

## Etap 7 — skanowanie paragonu ⬜

## Etap 8 — analiza jako placeholder ⬜

## Etap 9 — jakość i wydanie lokalne ⬜

## Odstępstwa od specyfikacji

| Punkt specyfikacji | Zapis w dokumencie     | Co robimy                                   | Dlaczego                                                                                                                               |
| ------------------ | ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 8. Frontend        | Flutter / Dart         | React Native + Expo (SDK 54)                | Decyzja właściciela projektu. Reszta specyfikacji — model danych, ekrany, reguły biznesowe, scenariusze testowe — pozostaje bez zmian. |
| 8. Baza lokalna    | SQLite                 | SQLite (`expo-sqlite`)                      | Bez zmian.                                                                                                                             |
| 8. Stan aplikacji  | jeden spójny mechanizm | TanStack Query + Context na wybrany miesiąc | Prawie cały stan to dane z bazy; unieważnianie zapytań realizuje AC 5.1 („suma zmienia się bez restartu").                             |
