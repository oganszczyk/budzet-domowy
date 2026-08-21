# Plan dalszych prac — po Etapie 11

Stan na 21.08.2026. Aplikacja jest kompletna względem MVP (rozdziały 1–11
specyfikacji) plus dwa rozszerzenia: kopia zapasowa (Etap 10) i budżet
miesiąca z dochodami (Etap 11). Działa na fizycznym urządzeniu, offline,
z 268 testami.

Wersja do czytania (ta sama treść, wygodniejszy układ):
https://claude.ai/code/artifact/bf527b05-9eb4-413b-8c4b-4fad6e7deac6

## Stanowisko wyjściowe

Największym ryzykiem NIE jest teraz brak funkcji, tylko dobudowywanie ich
szybciej, niż pojawia się na nie potrzeba. Aplikacja jest używalna. Kilka
tygodni normalnego używania powie o priorytetach więcej niż jakakolwiek
lista pomysłów — łącznie z tą.

Ten dokument jest mapą możliwości, nie kolejką zadań do wykonania.

---

## Część 1 — Ekran analizy (5.9, 12.1)

Specyfikacja zostawiła ten ekran otwarty: „nie wdrażać wykresów bez osobnej
specyfikacji", z wymogiem „zapewnić miejsce w architekturze na filtrowanie
analiz po miesiącu i kategorii". To jest ta osobna specyfikacja.

Wymaganie właściciela projektu: **nie najprostsze rzeczy**, tylko zestawienia
miesiąca z innymi miesiącami oraz możliwość tworzenia własnych zestawień
do porównania.

### Jedno pojęcie zamiast dwóch funkcji: „zestawienie"

Kuszące jest zbudowanie osobno „porównania miesięcy" i osobno „własnych
zestawień". To byłby błąd — powstałyby dwa mechanizmy robiące to samo,
z dwoma kompletami błędów.

**Zestawienie to nazwany wybór tego, co sumujemy.** Zbiór par
(kategoria główna, podkategoria). Nic więcej.

Mając zestawienie, dla dowolnego miesiąca da się policzyć jedną liczbę.
Wtedy:

- **porównanie miesięcy** = to samo zestawienie policzone dla dwóch miesięcy,
- **własne zestawienie** = zestawienie, które użytkownik sam zdefiniował,
- **przebieg w czasie** = to samo zestawienie policzone dla 12 miesięcy.

Trzy funkcje, jeden mechanizm.

### Zestawienia wbudowane — działają bez konfiguracji

Ekran analizy nie może witać użytkownika pustką i przyciskiem „utwórz
zestawienie". Zestawienia wbudowane wyliczamy z tego, co już jest w bazie,
i nie zapisujemy ich nigdzie:

- Wszystko
- Rachunki domowe / Subskrypcje / Zakupy (trzy kategorie główne, BR-01)
- Każda podkategoria z osobna
- Dochody (Etap 11)
- Zostało (dochody minus wydatki)

Własne zestawienia dokładają się do tej listy, nie zastępują jej.

### Model danych

Migracja do wersji 3 schematu:

```sql
CREATE TABLE comparison_set (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  colorKey TEXT NOT NULL,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE comparison_set_member (
  setId INTEGER NOT NULL REFERENCES comparison_set(id),
  mainType TEXT NOT NULL,
  categoryId INTEGER REFERENCES category(id),
  PRIMARY KEY (setId, mainType, categoryId)
);
```

`categoryId` może być puste — znaczy „cała kategoria główna".

Repozytorium (8.1 — ekran nie zna SQL):

```
sumForSet(set, month) -> grosze
seriesForSet(set, odMiesiąca, doMiesiąca) -> [{ month, grosze }]
```

Zestawienia wchodzą do kopii zapasowej — format pliku w wersji 3, z tą samą
zasadą co przy dochodach: starsze kopie nadal się wczytują, brak listy
znaczy „nie było ich wtedy".

### Trzy pułapki, które decydują o uczciwości tego ekranu

Ekran porównań jest łatwy do zbudowania i łatwy do zbudowania ŹLE. Poniższe
trzy rzeczy odróżniają wykres, który mówi prawdę, od takiego, który ładnie
wygląda i wprowadza w błąd.

**1. Miesiąc w toku.** 21 sierpnia porównany z całym lipcem to 21 dni
kontra 31. Aplikacja pokaże „wydajesz mniej", co jest nieprawdą. Konieczne:
wyraźna informacja („miesiąc w toku, 21 z 31 dni") oraz przełącznik
porównania do tego samego dnia poprzedniego miesiąca. To jest
NAJWAŻNIEJSZA rzecz na tym ekranie.

**2. Rachunki nieregularne.** Ubezpieczenie płacone raz na kwartał ląduje
w jednym miesiącu i wygląda jak rozrzutność. Do rozważenia: przełącznik
„rozłóż rachunki cykliczne na miesiące" — albo, minimalnie, oznaczenie
miesięcy, w których wypadła płatność cykliczna.

**3. Za mało danych na średnią.** Przy dwóch miesiącach historii „średnia
miesięczna" to szum, a wygląda jak wiedza. Nie pokazujemy średnich poniżej
ustalonego progu miesięcy — zamiast tego mówimy, ilu miesięcy brakuje.

### Podział na etapy (zasada 4 z AGENTS.md)

| Etap   | Zakres                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **12** | Silnik zestawień + porównanie miesiąc do miesiąca. Zestawienia wbudowane, tabela różnic, obsługa miesiąca w toku. Bez własnych zestawień, bez wykresów. |
| **13** | Własne zestawienia: tabele, ekran tworzenia i edycji, objęcie kopią zapasową.                                                                           |
| **14** | Przebieg w czasie: wykres słupkowy 6/12 miesięcy, porównanie dowolnych dwóch miesięcy, rachunki nieregularne.                                           |

Etap 12 sam w sobie jest użyteczny — to jest sprawdzian, czy podział jest
dobry.

---

## Część 2 — Chmura, serwer, drugi telefon

### Najpierw pytanie, nie technologia

„Serwer" bywa odpowiedzią na trzy różne problemy, które łatwo pomylić:

1. **Trwałość danych** — żeby awaria telefonu nie kosztowała wszystkiego.
   To jest już rozwiązane Etapem 10, tyle że ręcznie.
2. **Drugi telefon albo druga osoba** — żeby domownik dopisywał wydatki
   ze swojego urządzenia. To jest jedyny powód, dla którego naprawdę
   potrzeba serwera.
3. **Dostęp z komputera** — wygodne wpisywanie na klawiaturze.

Każdy z nich ma inną cenę. Odpowiedź na pytanie „który z nich mnie boli"
przesądza o wyborze bardziej niż jakiekolwiek porównanie technologii.

### Trzy drogi, od najtańszej

|                                                                    | Co rozwiązuje            | Koszt wdrożenia | Koszt stały                   |
| ------------------------------------------------------------------ | ------------------------ | --------------- | ----------------------------- |
| **A. Automatyczna kopia do chmury plików** (Dysk Google, OneDrive) | tylko 1                  | dni             | brak                          |
| **B. Gotowy backend** (Supabase, Firebase)                         | 1, 2, 3                  | tygodnie        | darmowy próg, potem abonament |
| **C. Własny serwer i własne API**                                  | 1, 2, 3 + pełna kontrola | tygodnie        | **stały i nieusuwalny**       |

**A** to automatyzacja tego, co dziś robisz ręcznie. Bez kont, bez logowania,
bez wynoszenia danych na cudzy serwer aplikacji. Jeśli jedynym bólem jest
punkt 1 — to jest cała odpowiedź.

**B** to droga rekomendowana, gdy pojawi się drugi telefon. Postgres,
konta, synchronizacja i uwierzytelnianie z pudełka, darmowy próg z zapasem
dla gospodarstwa domowego.

**C** oznacza, że od tej pory utrzymujesz serwer: hosting, certyfikaty,
aktualizacje bezpieczeństwa, kopie zapasowe samego serwera i dostępność.
Dla aplikacji domowej trudno wskazać powód, dla którego miałoby się to
opłacić względem B.

### Architektura jest na to przygotowana — ale to jest łatwe 20%

Interfejs `ExpensesRepository` (8.2) istnieje dokładnie po to. Repozytorium
chmurowe to kolejna jego implementacja, a `src/data/index.ts` to jeden plik,
w którym się je podmienia. Żaden ekran się nie zmieni. To prawda i to
naprawdę ma wartość.

Ale podmiana repozytorium jest łatwiejszą częścią. Trudna jest
synchronizacja:

**Identyfikatory.** Dziś każdy rekord dostaje `INTEGER AUTOINCREMENT`,
niezależnie na każdym urządzeniu. Dwa telefony niezależnie utworzą wydatek
o numerze 42 i przy synchronizacji jeden nadpisze drugi. Synchronizacja
wymaga identyfikatorów unikalnych globalnie (UUID).

**To jest jedyna rzecz, o której warto zdecydować wcześniej** — dołożenie
kolumny `uuid` do istniejących tabel jest tanie dziś, a po roku zbierania
danych dotyka też formatu kopii zapasowej.

**Konflikty.** Dwa telefony edytują ten sam rachunek bez zasięgu. Kto
wygrywa? Najprostsza uczciwa reguła to „wygrywa ostatni zapis" na podstawie
`updatedAt`. Dla gospodarstwa domowego wystarczy; dla księgowości nie.

**Usunięcia.** Skasowany rekord musi dać się odróżnić od „jeszcze
niezsynchronizowanego", inaczej wróci przy następnej synchronizacji.
Zamiast `DELETE` potrzebne są nagrobki (`deletedAt`).

**Praca bez internetu musi zostać.** Dziś aplikacja działa offline
w całości. To jest jej cecha, nie przypadek — łatwo ją stracić przy
przejściu na chmurę i trudno odzyskać.

**Prywatność.** Od momentu, w którym finanse opuszczają telefon, leżą na
czyimś serwerze. Przy publikacji w sklepie dochodzi polityka prywatności
i zgody (specyfikacja, 12).

### Rekomendacja

**A** — jeśli cokolwiek, to teraz i tanio.
**B** — kiedy realnie pojawi się drugi telefon, nie wcześniej.
**C** — dla aplikacji domowej najprawdopodobniej nigdy.

---

## Część 3 — Ulepszenia w kolejności wartości

### Najwyższa wartość względem kosztu

**1. Powiadomienie przed terminem rachunku.** Rachunki mają `dueDate`,
a aplikacja nic z tym nie robi. Rachunek zapłacony po terminie kosztuje
realne pieniądze — to jedyna funkcja z tej listy, która sama się spłaca.
Powiadomienia lokalne, bez serwera. Specyfikacja zostawiła to jako otwarte
pytanie (12.1).

**2. Przypomnienie o kopii zapasowej.** „Nie robiłeś kopii od 30 dni".
Kopia ręczna zostanie zapomniana — to nie jest przypuszczenie, tylko reguła.
Kilkanaście linijek kodu.

**3. Automatyczna kategoryzacja po sklepie.** „Lidl" → Jedzenie, na
podstawie Twojej własnej historii. Oszczędza jedno dotknięcie przy każdym
zakupie, czyli działa codziennie. Specyfikacja: „Później".

**4. Budżety i limity dla kategorii.** Naturalne przedłużenie Etapu 11:
skoro jest dochód i pierścień, można dołożyć „Jedzenie maksymalnie 1500 zł"
i pokazywać przekroczenia. Specyfikacja: „Później".

### Warte zrobienia, mniej pilne

**5. Aktualizacje bez przebudowy APK** (`expo-updates`). Dziś każda zmiana
w kodzie to kilkanaście minut budowania i ręczna instalacja. Ułatwienie
głównie dla nas, nie dla użytkownika — ale za to przy każdej zmianie.

**6. Zdjęcia paragonów w kopii zapasowej.** Znana luka Etapu 10: baza trzyma
tylko ścieżki. Wymaga archiwum ZIP zamiast pojedynczego pliku JSON.

**7. Eksport CSV.** Dla tych, którzy chcą własnych obliczeń w arkuszu.
Specyfikacja: „Później". Uwaga: to NIE jest kopia zapasowa — CSV nie
odtworzy powiązań między rekordami.

**8. PIN albo biometria.** Finanse gospodarstwa domowego na telefonie,
który bywa odblokowany. Specyfikacja: „Później".

### Kosztowne albo zależne od innych decyzji

**9. Odczyt pozycji z paragonu**, a nie tylko kwoty końcowej. Znacznie
trudniejsze niż obecne OCR — wymaga rozumienia układu paragonu, nie tylko
odczytu tekstu. Specyfikacja: „Później".

**10. Wspólne gospodarstwo domowe.** Zależy w całości od Części 2.

---

## Otwarte decyzje — tylko Ty możesz na nie odpowiedzieć

1. **Czy w ciągu roku pojawi się drugi telefon?** Odpowiedź „tak" albo
   „może" uzasadnia dołożenie kolumny `uuid` przy najbliższej migracji.
   Odpowiedź „nie" pozwala to pominąć i przyjąć późniejszy koszt.
2. **Czy zdjęcia paragonów mają wchodzić do kopii zapasowej?** Przesądza
   o tym, czy kopia zostaje pojedynczym plikiem JSON, czy staje się ZIP-em.
3. **Ile miesięcy wstecz ma pokazywać przebieg w czasie?** 6 czy 12 zmienia
   czytelność wykresu na telefonie.
4. **Czy rachunki nieregularne rozkładać na miesiące w porównaniach?**
   Rozłożone są uczciwsze dla oceny nawyków, nierozłożone zgadzają się
   z wyciągiem z konta.

---

## Co bym zrobił na Twoim miejscu

1. **Nic, przez dwa–trzy tygodnie.** Używaj aplikacji. Zapisuj, co uwiera —
   to lepsze źródło priorytetów niż ta lista.
2. **Sprawdź odtwarzanie kopii zapasowej.** To jedyna funkcja
   niepotwierdzona na urządzeniu, opisana w `ETAPY.md`.
3. **Potem Etap 12** — porównania miesięcy. Zamówiłeś je, a dane już są.
4. **Powiadomienia o rachunkach** — kiedy pierwszy raz zapłacisz coś po
   terminie. Wtedy przestaje to być pomysłem, a staje się potrzebą.
5. **Chmura dopiero wtedy, gdy pojawi się drugi telefon.**
