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

## Etap 1 — model danych i baza ⬜ NASTĘPNY

- [ ] Zaimplementować modele Category, Payment, BillTemplate i Subscription
- [ ] Utworzyć enumy statusów, źródeł i częstotliwości
- [ ] Utworzyć bazę SQLite, tabele, indeksy i pierwszą migrację
- [ ] Dodać repozytoria i operacje CRUD
- [ ] Dodać domyślne kategorie przy pierwszym uruchomieniu
- [ ] Napisać testy konwersji kwot oraz zapisu/odczytu bazy

## Etap 2 — ekran główny ⬜

- [ ] Podłączyć trzy karty do zapytań agregujących z bazy
- [ ] Sprawdzić aktualizację sum po zmianie danych

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
