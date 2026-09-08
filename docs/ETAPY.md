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

## Etap 1b — baza SQLite ✅ ZAKOŃCZONY

- [x] Utworzyć bazę SQLite, tabele, indeksy i pierwszą migrację
- [x] Podmienić repozytorium w `src/data/index.ts`
- [x] Dodać domyślne kategorie przy pierwszym uruchomieniu
- [x] Napisać testy zapisu/odczytu bazy oraz scenariusz T-16

Podmiana ograniczyła się do jednego pliku, tak jak zaplanowano — żaden ekran
nie wymagał zmiany. Jedyna różnica techniczna: `getRepository()` zwraca teraz
obietnicę, bo otwarcie bazy jest asynchroniczne.

**Dwie implementacje, jeden zestaw testów.** `repository-contract.test.ts`
uruchamia te same 16 asercji na wersji pamięciowej i na SQLite. Gdyby któraś
reguła biznesowa działała tylko w jednej wersji, test by to wykrył.

**SQL testujemy w Node.** Adapter `node-adapter.ts` podstawia wbudowany
moduł `node:sqlite`, więc zapytania sprawdzamy w milisekundach zamiast
dopiero po instalacji na telefonie. W aplikacji obowiązuje `expo-adapter.ts`.

**BR-12 pilnowane na dwóch poziomach:** logika aplikacji pyta rejestru
wygenerowanych rekordów, a baza dodatkowo ma indeksy unikalne z 7.5.

Zasiew wg T-01: kategorie i domyślne rachunki cykliczne, ZERO płatności —
dlatego po pierwszym uruchomieniu sumy wynoszą 0,00 zł. Telefon
i ubezpieczenie powstają wyłączone, bo 5.2 opisuje je jako opcjonalne.

Sprawdzone w działającej aplikacji:

| Sprawdzenie                         | Wynik                                                                |
| ----------------------------------- | -------------------------------------------------------------------- |
| T-01: pierwsze uruchomienie         | kategorie są, trzy karty pokazują 0,00 zł                            |
| 5.2: automat z domyślnych szablonów | 5 aktywnych rachunków, wszystkie „Oczekuje na kwotę"                 |
| Opcjonalne rachunki wyłączone       | Telefon i Ubezpieczenie poza listą, dostępne w „Rachunki cykliczne"  |
| T-16: ponowne uruchomienie          | po przeładowaniu kwota 234,56 zł i status na miejscu, bez duplikatów |
| Baza działa też w przeglądarce      | expo-sqlite przez WebAssembly, konfiguracja w metro.config.js        |

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

## Etap 7 — skanowanie paragonu ✅ ZAKOŃCZONY (z ograniczeniem)

- [x] Dodać obsługę aparatu i wyboru zdjęcia z galerii
- [x] Utworzyć interfejs ReceiptOcrService
- [x] Zaimplementować ekstrakcję sklepu, daty i kwoty
- [x] Zaimplementować ekran weryfikacji i ręcznej korekty
- [x] Dodać opcjonalne lokalne przechowywanie zdjęcia
- [x] Obsłużyć brak uprawnień i nieczytelny skan

### OGRANICZENIE: prawdziwe OCR wymaga development build

Rozpoznawanie tekstu na urządzeniu potrzebuje modułu natywnego (ML Kit na
Androidzie, Vision na iOS). Takie moduły NIE DZIAŁAJĄ w Expo Go — potrzebna
jest własna wersja aplikacji zbudowana przez EAS Build.

Dopóki testujemy w Expo Go, aktywny jest silnik demonstracyjny: zwraca
przykładowy paragon zamiast czytać zdjęcie. Ekran weryfikacji mówi o tym
wprost żółtym ostrzeżeniem, żeby dane nie wyglądały na odczytane naprawdę.

**Podmiana na prawdziwy silnik to jedna funkcja:** `createOcrService()`
w `src/features/receipts/ocr-service.ts`. Reguły z 5.6 i cały ekran
zostają bez zmian — po to ten interfejs powstał.

### Co jest w pełni zrobione i sprawdzone

Reguły rozpoznawania (5.6) to czysta funkcja `parseReceiptText`, przetestowana
na realistycznych polskich paragonach — 22 testy. Najważniejsza pułapka:
„SUMA PTU" to suma podatku, nie należność. Bez jej wykluczenia paragon
na 11,97 zł zapisałby się jako 2,24 zł.

| Reguła z 5.6                            | Sprawdzenie                               |
| --------------------------------------- | ----------------------------------------- |
| „DO ZAPŁATY" ponad „SUMA" ponad „RAZEM" | trzy testy priorytetów                    |
| Pomijanie sum częściowych               | pozycje z listy zakupów ignorowane        |
| Pomijanie reszty i gotówki              | paragon 23,50 zł mimo „GOTÓWKA 50,00"     |
| Data musi być prawidłowa kalendarzowo   | 31.02.2026 odrzucone, 29.02.2028 przyjęte |
| Nazwa sklepu jest sugestią              | adres, NIP i kod pocztowy pomijane        |
| Brak kwoty nie wysadza parsera          | zwraca puste pole do uzupełnienia         |
| BR-08: brak automatycznego zapisu       | rekord powstaje wyłącznie w handleSave    |

## Etap 8 — analiza jako placeholder ✅ ZAKOŃCZONY

- [x] Dodać ekran z informacją o przyszłym module
- [x] P2 Wdrożyć analizy dopiero po dostarczeniu osobnej specyfikacji — patrz Etap 12

Ekran istnieje od Etapu 0 i celowo pozostaje pusty — 5.9 wymaga osobnej
specyfikacji przed wdrożeniem wykresów.

## Etap 9 — jakość i wydanie lokalne ✅ ZAKOŃCZONY

- [x] Wykonać pełny test scenariuszy z rozdziału 10
- [x] Sprawdzić migrację bazy na danych istniejących
- [x] Sprawdzić aplikację bez internetu
- [x] Sprawdzić odrzucenie uprawnień aparatu
- [x] Usunąć dane demonstracyjne lub oznaczyć je jako opcjonalne
- [x] Zbudować instalacyjny plik APK do testów prywatnych

### Scenariusze z rozdziału 10

`src/scenarios.test.ts` odwzorowuje je jeden do jednego, na prawdziwej bazie
SQLite, przez te same przypadki użycia, których używają ekrany.

| Scenariusz                       | Stan                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| T-01 pierwsze uruchomienie       | ✅ automatyczny                                               |
| T-02 dodanie zakupu 125,50 zł    | ✅ automatyczny                                               |
| T-03 edycja na 100,00 zł         | ✅ automatyczny                                               |
| T-04 usunięcie zakupu            | ✅ automatyczny                                               |
| T-05 nowy miesiąc, rachunek Prąd | ✅ automatyczny                                               |
| T-06 wpisanie kwoty 180,40 zł    | ✅ automatyczny                                               |
| T-07 oznaczenie jako opłacony    | ✅ automatyczny                                               |
| T-08 rachunek po terminie        | ✅ automatyczny                                               |
| T-09 subskrypcja miesięczna      | ✅ automatyczny                                               |
| T-10 subskrypcja roczna          | ✅ automatyczny                                               |
| T-11 zakończenie subskrypcji     | ✅ automatyczny                                               |
| T-12 skan z poprawnymi danymi    | 🟡 reguły odczytu automatyczne; aparat do sprawdzenia ręcznie |
| T-13 skan bez rozpoznanej kwoty  | 🟡 blokada zapisu automatyczna; aparat do sprawdzenia ręcznie |
| T-14 brak zgody na aparat        | 🟡 do sprawdzenia ręcznie na telefonie                        |
| T-15 przełączenie miesiąca       | ✅ automatyczny                                               |
| T-16 ponowne uruchomienie        | ✅ automatyczny (na pliku bazy)                               |

T-12, T-13 i T-14 wymagają prawdziwego aparatu i systemowego okna zgody,
więc nie da się ich odtworzyć w teście. Ich logika — reguły z 5.6, blokada
zapisu bez kwoty, komunikat po odmowie — jest pokryta osobno.

### Praca bez internetu

Aplikacja nie wykonuje ŻADNYCH żądań sieciowych: w kodzie nie ma `fetch`,
`XMLHttpRequest` ani biblioteki sieciowej wśród 24 zależności. Dane leżą
wyłącznie w lokalnej bazie SQLite, a rozpoznawanie tekstu działa na
urządzeniu. Spełnia to 8.2: „Dane użytkownika nie opuszczają urządzenia".

### Dane demonstracyjne

Zasiew bazy tworzy wyłącznie kategorie i szablony rachunków — ZERO płatności.
Generator danych demonstracyjnych pozostał jako narzędzie testowe
(repozytorium pamięciowe) i nie trafia do aplikacji. Test to potwierdza.

### Ryzyko OCR — sprawdzone i zamknięte

`expo-doctor` zgłaszał, że biblioteka OCR jest nieprzetestowana z Nową
Architekturą (SDK 54 włącza ją domyślnie). Ostrzeżenia nadal nie wyciszamy.

**21.08.2026, build `preview` na fizycznym telefonie: skanowanie paragonu
odczytuje prawdziwy tekst.** Moduł natywny podnosi się przy włączonej Nowej
Architekturze. Plan awaryjny zostaje w `AGENTS.md` na wypadek zmiany SDK
albo wersji biblioteki.

### Plik APK — zbudowany

Konto Expo: `rurikaburi`, projekt `@rurikaburi/dom-apka`.
Skrót `eas.cmd` w katalogu projektu uruchamia lokalne `eas-cli`
z certyfikatami systemu Windows (Norton skanuje ruch HTTPS).

W PowerShell trzeba wywołać go ze ścieżką — `.\eas.cmd`, nie `eas.cmd`.

```
.\eas.cmd build --profile preview --platform android
```

Profil `preview` daje APK działający samodzielnie: kod JS jest w środku,
aplikacja nie potrzebuje komputera ani internetu. Profil `development`
zostaje do pracy nad kodem (wymaga `npm start` i wspólnej sieci Wi-Fi).

## Etap 10 — kopia zapasowa ✅ ZAKOŃCZONY

Powód: dane żyły wyłącznie w pliku `domowe-wydatki.db` w prywatnej pamięci
aplikacji. Odinstalowanie, awaria albo zgubienie telefonu = bezpowrotna utrata.
Aplikacja nie miała żadnego eksportu.

- [x] Migawka całej zawartości: `exportSnapshot` / `importSnapshot`
      w obu implementacjach repozytorium
- [x] Format pliku JSON z wersją i pełną walidacją wczytywanych danych
- [x] Zapis pliku + systemowe okno „Udostępnij" (`expo-sharing`)
- [x] Wybór pliku do odtworzenia (`expo-document-picker`)
- [x] Ekran `/backup`, wejście z ekranu głównego
- [x] Testy formatu (19) i kontraktu repozytorium (8, na obu implementacjach)

### Dlaczego JSON, a nie kopia pliku `.db`

Kopia pliku bazy odtworzyłaby dane najwierniej, ale wymagałaby zgodności
wersji schematu. Kopia zrobiona przed migracją nie dałaby się wczytać po
aktualizacji aplikacji — czyli dokładnie wtedy, gdy jest najbardziej potrzebna.
Migawka opisuje dane w kategoriach modelu z rozdziału 7, nie tabel.

### Odtwarzanie ZASTĘPUJE, nie dokłada

Doklejanie kopii do istniejących danych dawałoby przy każdym odtworzeniu
podwojone wydatki, bez możliwości ich rozdzielenia. Odtworzenie przywraca
stan z dnia kopii — w jednej transakcji SQL, więc przerwanie w połowie
nie zostawia bazy w stanie pośrednim.

Sprawdzenie pliku następuje PRZED dotknięciem bazy. Wskazanie zdjęcia albo
uszkodzonego pliku kończy się komunikatem, a dotychczasowe dane zostają
nietknięte.

### Identyfikatory są częścią kopii

`Payment.categoryId`, `billTemplateId` i `subscriptionId` wskazują na inne
rekordy. Odtwarzanie zachowuje identyfikatory, a liczniki nowych rekordów
startują powyżej najwyższego odtworzonego — inaczej pierwszy nowy wydatek
nadpisałby rekord z kopii.

### Czego kopia NIE obejmuje

Zdjęć paragonów. Baza trzyma wyłącznie ścieżkę do pliku (rozdział 8),
a same zdjęcia leżą w katalogu aplikacji. Po odtworzeniu kopii na innym
telefonie wydatek zachowa kwotę, datę i kategorię, ale zdjęcie się nie pokaże.
Dołączenie zdjęć wymagałoby archiwum ZIP zamiast pojedynczego pliku JSON —
do rozważenia, jeśli okaże się potrzebne.

## Etap 11 — dochody domowników i wykres budżetu ✅ ZAKOŃCZONY

Rozszerzenie poza pierwotną specyfikację, na życzenie właściciela projektu.
Aplikacja pokazywała wyłącznie wydatki; nie odpowiadała na pytanie
„ile mi jeszcze zostało w tym miesiącu".

- [x] Encja `Income` i migracja schematu do wersji 2 (tabela `income`)
- [x] Metody repozytorium w obu implementacjach + testy kontraktu (7)
- [x] Wyliczenie budżetu jako czysta funkcja + testy (16)
- [x] Wykres pierścieniowy (`react-native-svg`) na ekranie głównym
- [x] Ekran `/income`: lista, dodawanie, zmiana, usuwanie, przepisanie z poprzedniego miesiąca
- [x] Dochody objęte kopią zapasową (format pliku w wersji 2)
- [x] Test migracji: dane sprzed aktualizacji przeżywają przejście na wersję 2

### Dochód to osobna encja, nie płatność ujemna

Kusiło, żeby zapisać dochód jako płatność z minusem i nie dokładać tabeli.
Wtedy jednak każda suma, historia i przyszła analiza musiałaby pamiętać,
żeby go pominąć — jedno zapomniane miejsce i wypłata pojawia się jako zakup.
BR-01 mówi zresztą, że każdy zapis należy do jednej z trzech kategorii
głównych, a dochód nie jest żadną z nich.

Dochód przypisujemy do miesiąca (`RRRR-MM`), nie do dnia. Pytanie brzmi
„ile wpłynęło w sierpniu", a nie „którego dnia przyszła wypłata".

### Podstawą pierścienia jest większa z liczb: dochód albo wydatki

Gdyby podstawą był zawsze dochód, przekroczenie budżetu dałoby wycinki
sumujące się do więcej niż pełny okrąg i wykres rysowałby drugą warstwę
na pierwszej. Gdyby podstawą były zawsze wydatki, zniknęłaby informacja
„ile zostało", czyli powód powstania wykresu.

Przy takim wyborze pierścień czyta się jednoznacznie: mieścisz się w budżecie
— widać kolorowe wydatki i szarą resztę; przekroczyłeś — pierścień jest
w całości wypełniony wydatkami. Test pilnuje, że wycinki zawsze sumują się
dokładnie do jednego pełnego okręgu.

### Trzy stany karty budżetu

1. **Bez wpisanych dochodów** — w środku suma wydatków i zaproszenie do
   wpisania zarobków. Zmyślanie budżetu byłoby gorsze niż jego brak.
2. **W budżecie** — kwota „zostało", pierścień z wydatkami i szarą resztą.
3. **Po przekroczeniu** — kwota na czerwono z podpisem „ponad budżet",
   pokazywana bez minusa (słowo mówi to samo, a minus przy dużej czerwonej
   kwocie czyta się jak błąd aplikacji).

### Błąd znaleziony przy sprawdzaniu na wersji webowej

Obrót pierścienia zapisany przez właściwości `rotation` + `origin` gubił
punkt obrotu — w DOM wychodziło samo `rotate(-90)`, czyli obrót wokół
lewego górnego rogu zamiast środka. Poprawione na pełny zapis SVG
`rotate(-90 środekX środekY)`, który znaczy to samo na każdej platformie.

### Format kopii zapasowej: wersja 2

Kopie zapisane w wersji 1 (Etap 10) nadal się wczytują — brak listy dochodów
znaczy „nie było ich wtedy", czyli pusta lista. To jest powód, dla którego
plik w ogóle nosi numer wersji: nowa funkcja nie unieważnia starych kopii.

## Sprawdzone na telefonie — 21.08.2026

Build `preview` z commita `dd9bc94` (Etapy 10 i 11), zainstalowany na wierzchu
poprzedniej wersji, ten sam klucz podpisujący `Q8cjR6jgTR`.

| Co                                           | Wynik                     |
| -------------------------------------------- | ------------------------- |
| Migracja bazy na danych z poprzedniej wersji | ✅ stare dane na miejscu  |
| Zapisanie kopii zapasowej i wysłanie pliku   | ✅ działa                 |
| Wpisanie dochodów domowników                 | ✅ działa                 |
| Wykres budżetu — podział pierścienia         | ✅ wypełnia się poprawnie |

Migracja schematu 1 → 2 przeszła na prawdziwym urządzeniu z prawdziwymi
danymi, nie tylko w teście. To domyka zasadę 5 z `AGENTS.md` w praktyce:
aktualizacja aplikacji nie kasuje bazy.

### ODTWARZANIE kopii — potwierdzone na urządzeniu 04.09.2026

Przez dwa tygodnie była to jedyna funkcja aplikacji bez dowodu z urządzenia,
i jedyna, której nieudana próba kosztuje dane — odtworzenie zastępuje całą
zawartość. Sprawdzone przy okazji instalacji builda z Etapem 12, w bezpiecznej
kolejności:

1. zapisać świeżą kopię i wysłać plik poza telefon,
2. dopiero wtedy uruchomić odtwarzanie ze wskazaniem tego pliku,
3. sprawdzić, czy sumy i historia wróciły w komplecie.

**Działa.** Ta kolejność zostaje tu opisana nie jako zaległość, tylko jako
instrukcja na przyszłość: odtwarzanie bez wcześniejszej kopii poza telefonem
jest ryzykowne niezależnie od tego, ile razy zadziałało wcześniej.

## Publikacja na GitHubie — 27.08.2026

Repozytorium publiczne: https://github.com/oganszczyk/budzet-domowy

Wydanie `v1.0.0` z załączonym plikiem APK (156 MB) — trwały adres do
pobrania, niezależny od wygasających odnośników z EAS.

### Co jest ustawione

- **Kontrola jakości** (`.github/workflows/ci.yml`): typy, lint, testy
  i próba zbudowania wersji webowej przy każdym pushu i zgłoszeniu.
- **Ochrona gałęzi `main`**: wymagane przejście kontroli, zakaz wymuszonego
  przepchnięcia i skasowania. Właściciel może pchać wprost — GitHub zgłasza
  wtedy „Bypassed rule violations", co jest oczekiwane.
- **Szablony** zgłoszenia błędu, propozycji i propozycji zmian.
- **Dependabot** z celowym pominięciem pakietów zarządzanych przez SDK.

### Dependabot NIE rusza pakietów Expo

Wersje `expo`, `react`, `react-native` i pokrewnych narzuca wersja SDK.
Automat o tym nie wie i zaproponowałby aktualizacje psujące zgodność
z Expo Go. Są wykluczone w `.github/dependabot.yml`; aktualizuje się je
wyłącznie razem:

```
npx expo install --check
```

### Tożsamość w commitach

Historia została przepisana na adres zastępczy GitHuba
`321406981+oganszczyk@users.noreply.github.com`, żeby prywatny adres nie był
publiczny. Konfiguracja lokalna repozytorium już to ustawia — **nie commituj
z adresem prywatnym**.

### Dwa błędy wykryte dopiero przez kontrolę jakości

Oba przechodziły lokalnie i padały na czystej instalacji z `package-lock.json`:

1. Brak `@types/node` w zależnościach, mimo że adapter bazy do testów
   importuje `node:sqlite`.
2. `"types": ["jest"]` w `tsconfig.json` ograniczało wczytywane deklaracje
   wyłącznie do Jesta — typy Node trafiały do projektu bocznymi drzwiami,
   przez zależności Jesta.

Warto o tym pamiętać przy diagnozowaniu podobnych różnic: „u mnie działa"
przy pakietach oznacza zwykle pozostałości po wcześniejszych instalacjach
w `node_modules`.

### Zgłoszony błąd do naprawy

[#4](https://github.com/oganszczyk/budzet-domowy/issues/4) — formularz nowego
wydatku ucina ostatnią cyfrę roku (`27.08.202`). Dane są poprawne, to obcięcie
przy rysowaniu na Androidzie. Wcześniejsza poprawka (`flexShrink: 0`) nie
wystarczyła. Nie odtwarza się w wersji webowej — wymaga sprawdzenia
na urządzeniu.

## Etap 12 — analiza: propozycje i własne zestawienia ✅ ZAKOŃCZONY

Rozszerzenie poza pierwotną specyfikację. 5.9 zostawiło ten ekran pusty
„do czasu osobnej specyfikacji" i wymagało jedynie, żeby architektura miała
miejsce „na filtrowanie analiz po miesiącu i kategorii". Zakres ustalił
właściciel projektu 27.08.2026, potwierdził przed wdrożeniem; zbudowane
04.09.2026.

**UWAGA: ten etap wyszedł inaczej, niż zakładał `docs/PLAN-DALSZY.md`.**
Plan z 21.08.2026 dzielił pracę na trzy etapy: 12 (porównanie miesiąc do
miesiąca, bez wykresów), 13 (własne zestawienia), 14 (przebieg w czasie).
Decyzje właściciela z 27.08 przestawiły ten podział — przebieg w czasie
i kreator własnego zestawienia weszły od razu, a zapisywanie zostało
odłożone. Numeracja etapów w `PLAN-DALSZY.md` jest więc nieaktualna;
obowiązuje ta z tego pliku.

- [x] `AnalysisSubject` — sześć rodzajów przedmiotu analizy (`src/domain/analysis.ts`)
- [x] `listPaymentsForRange` / `listIncomesForRange` w obu implementacjach + 6 testów kontraktu
- [x] Szereg miesięczny, podsumowanie i porównanie lat jako czyste funkcje + 17 testów
- [x] Propozycje dobierane do danych + 14 testów reguł wyboru
- [x] Wykres słupkowy (`src/ui/components/bar-chart.tsx`)
- [x] Ekran „Analiza": trzy propozycje i jedno wejście do kreatora
- [x] Ekran `/analysis/report`: wybór pozycji i zakresu, wynik na żywo

### Cztery decyzje właściciela projektu (27.08.2026)

| Pytanie                      | Decyzja                             |
| ---------------------------- | ----------------------------------- |
| Ile pozycji naraz            | jedna, porównywana w czasie         |
| Jakie zakresy czasu          | rok do roku ORAZ własny od-do       |
| Zapisywanie zestawień        | dopiero po sprawdzeniu na telefonie |
| Propozycje stałe czy zmienne | dobierane do danych                 |

Świadomie NIE ma przycisków „ostatnie 6 miesięcy" ani „ostatnie 12 miesięcy":
własny zakres obejmuje oba, a każdy dodatkowy przycisk to kolejna rzecz do
przeczytania na ekranie, który ma być czysty.

### „Gaz" nie jest kategorią — dlatego powstał AnalysisSubject

Gaz, Prąd i Woda należą do JEDNEJ kategorii „Rachunki domowe" (BR-02 wymaga
podkategorii wyłącznie dla zakupów), a rozróżnia je `billTemplateId`. Analiza
filtrująca po samym `categoryId` nie umiałaby odpowiedzieć na pytanie
„ile płacę za gaz" — czyli na pytanie, od którego ten ekran się zaczął.

`AnalysisSubject` to typ rozłączny mówiący, PO KTÓREJ KOLUMNIE filtrujemy:
wszystkie wydatki, kategoria główna, rachunek cykliczny, subskrypcja,
podkategoria albo dochody.

### Repozytorium oddaje surowe rekordy, nie gotowe sumy

Kusiło dołożyć `getMonthlySeries(zakres, przedmiot)` i policzyć sumy w SQL.
Odrzucone: przedmiotów analizy jest sześć rodzajów, więc zapytanie sklejałoby
warunek `WHERE` z typu przedmiotu — reguła „co wchodzi do zestawienia"
wylądowałaby w tekście SQL i nie dałoby się jej sprawdzić testem bez bazy.

Przy skali domowego budżetu (kilkaset rekordów na rok) przeniesienie płatności
do pamięci kosztuje tyle co nic, a cała matematyka zostaje czystą funkcją.
Bez zmiany schematu, więc bez migracji.

### Trzy reguły, w których łatwo o ciche kłamstwo

1. **Średnia dzieli przez miesiące Z DANYMI, nie przez długość zakresu.**
   Trzy rachunki za gaz w zakresie sześciomiesięcznym podzielone przez sześć
   dają liczbę o połowę za niską — a użytkownik czyta ją jako „tyle płacę
   miesięcznie". Miesiąc, w którym rachunku nie było, nie jest miesiącem,
   w którym rachunek wyniósł zero.

2. **Rok do roku porównuje tyle samo miesięcy po obu stronach.** W sierpniu
   bieżący rok ma osiem miesięcy, a poprzedni dwanaście. Zestawienie wprost
   pokazałoby spadek o jedną trzecią w każdej kategorii — nieprawdę, i to
   nieprawdę wyglądającą na dobrą wiadomość.

3. **Zakupy porównujemy do ostatniego ZAMKNIĘTEGO miesiąca.** Rachunek zna
   swoją kwotę w chwili powstania, więc trwający miesiąc jest dla niego pełny.
   Zakupy zbierają się przez cały miesiąc, więc porównanie trwającego miesiąca
   ze średnią zawsze wychodziłoby „taniej niż zwykle" — fałszywa dobra
   wiadomość, pokazywana codziennie.

Dodatkowo miesiąc PUSTY jest odróżniony od miesiąca ZEROWEGO: rachunek bez
wpisanej kwoty (BR-05) nie wchodzi do sumy, ale jest liczony osobno i ekran
mówi wprost, ile takich rekordów siedzi w zakresie.

### Propozycja musi kosztować, nie tylko procentowo drgnąć

Kandydat trafia na ekran, gdy przekroczy OBA progi naraz: 20% odchylenia
od własnej średniej i 20 zł różnicy. Sam procent zgłaszałby kawę, która
podrożała z 8 na 12 zł. Sama złotówka zgłaszałaby czynsz, który drgnął o 30 zł
na 2 500 zł. Kolejność propozycji ustala ZŁOTÓWKA, nie procent — bo to
złotówki wychodzą z portfela.

Propozycji zapasowych jest cztery, a miejsc trzy. Nadmiar jest celowy:
„największy rachunek" odpada przy pustej bazie, a ekran i tak musi się zapełnić.

### Dwa błędy znalezione dopiero na działających danych

Testy jednostkowe przechodziły; oba wyszły przy klikaniu po ekranie.

1. **Podsumowanie liczyło się z innego zakresu niż wykres.** W trybie „rok do
   roku" pobieramy oba pełne lata, a pokazujemy tylko miesiące wchodzące do
   porównania. Podsumowanie liczone z całości podawało „najtaniej: listopad" —
   miesiąc nieobecny ani na wykresie, ani na liście pod nim. Poprawka: liczymy
   z tego, co widać.

2. **Wykres kulił się do lewej połowy karty.** Szerokość słupka liczyliśmy
   z `onLayout`, a to zdarzenie nie zawsze dociera (po odświeżeniu kodu w locie
   nie dociera nigdy) — stan zostawał na zerze i sześć słupków schodziło do
   minimalnych 22 pikseli. Poprawka: nie mierzymy nic. Kolumny mają `flex: 1`
   i `minWidth`, zawartość przewijanego obszaru `flexGrow: 1`; szerokość liczy
   silnik układu. Mało słupków — dzielą całą szerokość; dużo — wykres przewija
   się w bok.

### Sprawdzone na działających danych (wersja webowa, 04.09.2026)

Dziewięć zakupów rozrzuconych po miesiącach od lipca 2025 do sierpnia 2026.

| Sprawdzenie                         | Wynik                                                            |
| ----------------------------------- | ---------------------------------------------------------------- |
| Pusta baza                          | trzy propozycje zapasowe, ekran nie jest pusty                   |
| Propozycja dobrana do danych        | „Jedzenie — Lipiec 2026: o 20% taniej niż zwykle"                |
| Odniesienie dla zakupów             | lipiec (zamknięty), nie sierpień (trwający)                      |
| Kliknięcie propozycji               | otwiera kreator z wypełnioną pozycją i zakresem                  |
| Zakres własny III–VIII 2026         | suma 3 825,00 zł, średnia 637,50 zł, najdrożej sierpień          |
| Rok do roku                         | 4 475,00 zł kontra 505,00 zł, „pierwsze 8 miesięcy każdego roku" |
| Wysokości słupków                   | proporcjonalne (480 zł → 77 px przy 930 zł → 150 px)             |
| Sześć słupków na telefonie (375 px) | 45 px szerokości, wypełniają kartę                               |
| Szesnaście słupków                  | 22 px, wykres przewija się w bok (480 px treści na 309 px)       |
| Odwrócony zakres                    | niemożliwy — kraniec ciągnie drugi za sobą                       |
| Rachunki bez danych                 | komunikat zamiast pustego wykresu                                |

### Czego Etap 12 NIE robi

Nie zapisuje zestawień. Zbudowane zestawienie znika po wyjściu z ekranu.
To decyzja świadoma: najpierw sprawdzamy na telefonie, czy takie zestawienia
są w ogóle użyteczne, a dopiero potem dokładamy tabelę, migrację schematu
do wersji 3 i objęcie kopią zapasową (format pliku wersja 3).

### Sprawdzone na fizycznym telefonie — 04.09.2026

Build `preview` z commita `3207260`, zainstalowany na wierzchu poprzedniej
wersji, ten sam klucz podpisujący `Q8cjR6jgTR`.

| Co                                         | Wynik                                |
| ------------------------------------------ | ------------------------------------ |
| Dane z poprzedniej wersji po aktualizacji  | ✅ na miejscu                        |
| Zapisanie kopii zapasowej i wysłanie pliku | ✅ działa                            |
| Ekran analizy — trzy propozycje            | ✅ działa                            |
| Wykres i przewijanie w bok w trybie roku   | ✅ działa                            |
| Odtworzenie kopii zapasowej                | ✅ działa (patrz Etap 10)            |
| Podpisy pod słupkami                       | ❌ ucinane do kropek — opisane niżej |

Obawa o poziome przewijanie wewnątrz pionowo przewijanego ekranu okazała się
nieuzasadniona — na Androidzie działa.

### Usterka do naprawy: ucinane podpisy osi

Zgłoszenie właściciela projektu: pod słupkami „wszędzie kropki".

Przyczyna NIE jest tam, gdzie się wydaje. Nazwy miesięcy są już trzyliterowe
(`MONTH_SHORT_NAMES`); nie mieści się **rok** pod pierwszym słupkiem.
Zmierzone w czcionce podpisów przy `MIN_BAR_WIDTH` = 22 px:

| Podpis | Szerokość | Mieści się w 22 px |
| ------ | --------- | ------------------ |
| `lis`  | 11,4 px   | tak, z zapasem     |
| `maj`  | 20,0 px   | ledwo              |
| `mar`  | 21,3 px   | 0,7 px zapasu      |
| `2026` | 26,7 px   | **nie**            |

Trzyliterowe miesiące mieszczą się w przeglądarce, ale `mar` i `maj` mają
zapas mniejszy niż jeden piksel — na Androidzie, z inną czcionką systemową,
też się urywają. Stąd wrażenie, że kropki są wszędzie, choć zaczyna się
od samego roku.

Naprawa to jedna stała: `MIN_BAR_WIDTH` z 22 na około 32 px, czyli tyle,
żeby najszerszy podpis mieścił się z zapasem. Kosztuje to tylko tyle, że
mniej słupków widać naraz — wykres i tak się przewija.

To NIE jest ta sama usterka co zgłoszenie
[#4](https://github.com/oganszczyk/budzet-domowy/issues/4). Tam tekst gubi
ostatni znak przy rysowaniu mimo dostępnego miejsca; tutaj miejsca po prostu
nie ma i system uczciwie sygnalizuje to wielokropkiem.

## Etap 13 — zapisywanie własnych zestawień ✅ ZAKOŃCZONY

- [x] Poszerzyć `MIN_BAR_WIDTH` w `bar-chart.tsx` (usterka ucinanych podpisów)
- [x] Kolumna `uuid` — trwałe identyfikatory pod przyszłą synchronizację
- [x] Tabela `saved_report` i migracja schematu do wersji 3
- [x] Nazwa zestawienia i zapis z ekranu kreatora
- [x] Zapisane zestawienia na ekranie „Analiza", pod propozycjami
- [x] Objęcie kopią zapasową (format pliku wersja 3)
- [x] Odmiana miesięcy przez liczbę (`src/lib/plural.ts`)

### Zapisujemy DŁUGOŚĆ okna, nie wybrane miesiące

Decyzja właściciela projektu (04.09.2026). Zestawienie pamiętające
„marzec–sierpień 2026" byłoby za miesiąc migawką z przeszłości — a zakłada się
je raz i zagląda co miesiąc. Zapisujemy więc „ostatnie sześć miesięcy",
a konkretne miesiące wyliczamy dopiero przy otwarciu, względem dzisiaj.

Ekran mówi o tym wprost PRZED zapisem. Bez tego zdania użytkownik byłby
przekonany, że zapisał marzec–sierpień, i uznałby przesunięcie za usterkę.

Przedmiot analizy trzymamy jako `subjectKey` („BILL_TEMPLATE:3"), czyli ten sam
tekst, którym posługuje się adres ekranu. Rozbicie go na kolumny kusiło, ale
nie da się tego zrobić jedną kolumną liczbową: wariant `MAIN_TYPE` niesie
napis, a nie identyfikator. Dwie kolumny o zmiennym znaczeniu byłyby gorsze
niż jeden tekst, który ma już funkcje zapisu i odczytu wraz z testami.

### Kolumna `uuid` NIE weszła do modelu danych

Właściciel potwierdził, że pojawi się drugi telefon, a przy synchronizacji
`INTEGER AUTOINCREMENT` zawodzi: dwa urządzenia niezależnie utworzą wydatek
o numerze 42 i jeden nadpisze drugi. Trwały identyfikator trzeba nadać, zanim
uzbiera się rok danych.

Wcześniejsza ocena („kilka linijek") była prawdziwa wyłącznie na poziomie SQL.
Wciągnięcie `uuid` do typów `Payment`, `Category` i pozostałych wymusiłoby
dopisanie go **wszędzie, gdzie takie rekordy powstają** — w danych
demonstracyjnych, zasiewie, czytniku kopii zapasowej i kilkudziesięciu
testach — dla pola, którego dziś nikt nie odczytuje.

Kolumna została więc na poziomie bazy. Istniejące wiersze dostały wartość przy
migracji, a nowe dostają ją z WYZWALACZA, nie ze zmiany zapytań `INSERT`.
Rekordy powstają w dziesięciu miejscach repozytorium, licząc odtwarzanie kopii;
to dziesięć okazji, żeby o jednym zapomnieć — i to po cichu, bo brakujący
identyfikator niczego nie psuje aż do dnia, w którym powstanie synchronizacja.

Skala tej różnicy jest widoczna w liczbach: rozszerzenie migawki kopii
zapasowej o zapisane zestawienia wymagało poprawienia **trzech** miejsc
w testach. Ta sama operacja dla `uuid` na pięciu encjach dotknęłaby ich
kilkudziesięciu.

Model i format kopii rozszerzymy dopiero wtedy, gdy powstanie prawdziwa
synchronizacja — do tego czasu kolumna czeka wypełniona.

> **Dopisane po Etapie 14b (08.09.2026):** ten moment nastąpił. `uuid` należy
> dziś do typów, a kopia zapasowa go niesie. Przewidywana cena okazała się
> trafna co do rodzaju: poprawki dotknęły dziewięciu plików z testami.
> Wyzwalacz z tej migracji zostaje jako zabezpieczenie zapisów, które
> o kolumnie zapomną.

### Trzy formy liczby mnogiej

„Ostatnie 3 miesięcy" albo „ostatnie 22 miesiące" to nie jest drobiazg
kosmetyczny — tak pisze automat, nie aplikacja, której powierza się domowy
budżet. `src/lib/plural.ts` wybiera formę wg reguły polskiej, z wyjątkiem
na nastolatki (12–14 idą do „miesięcy" mimo końcówki 2–4). Test przechodzi
wszystkie dopuszczalne długości okna od 2 do 36.

### Zestawienie kasujemy NAPRAWDĘ

7.5 każe kategorie z historią ukrywać, a nie kasować — usunięta kategoria
zabrałaby ze sobą sens zapisanych wydatków. Zestawienie niczego nie osieroci:
to zapamiętane pytanie, nie dane. Kasujemy je fizycznie, po potwierdzeniu.

### Sprawdzone w działającej aplikacji

| Sprawdzenie                                 | Wynik                                            |
| ------------------------------------------- | ------------------------------------------------ |
| Pusta nazwa                                 | zapis zablokowany                                |
| Nazwa zajęta, inna wielkość liter           | zapis zablokowany                                |
| Zapis i pojawienie się na liście            | „Wszystkie wydatki · ostatnie 6 miesięcy"        |
| Otwarcie zapisanego zestawienia we wrześniu | zakres kwiecień–wrzesień, przeliczony od dzisiaj |
| Odmowa w pytaniu o usunięcie                | zestawienie zostaje                              |
| Potwierdzenie usunięcia                     | znika razem z całą sekcją                        |
| Migracja 1 → 3 na danych                    | wydatek nietknięty, identyfikatory nadane        |

**Do sprawdzenia na fizycznym telefonie:** czy poszerzenie słupka faktycznie
usuwa wielokropki pod osią. Pomiar mówi, że tak (najszerszy podpis 26,7 px
przy słupku 32 px), ale wielokropki wyszły właśnie z różnicy między czcionką
przeglądarki a systemową czcionką Androida.

## Etap 14 — synchronizacja dwóch telefonów (Supabase)

Decyzja właściciela projektu (08.09.2026): drugi telefon ma widzieć te same
wydatki. Specyfikacja wypycha synchronizację i konta poza MVP (3.2, P2), ale
8.2 wprost dopuszcza późniejsze zastąpienie repozytorium lokalnego chmurowym —
i po to powstał interfejs `ExpensesRepository`.

**Wybrany wariant: SQLite pozostaje bazą główną, Supabase jest lustrem.**
Aplikacja ma działać bez internetu, bo wydatek wpisuje się przy kasie.
Wariant „Supabase zamiast SQLite" odrzucony z tego jednego powodu.

Podział na cztery etapy, bo każdy z nich osobno kończy się działającą
aplikacją (zasada 4 z `AGENTS.md`):

| Etap | Zakres                                                       | Widoczne dla użytkownika            |
| ---- | ------------------------------------------------------------ | ----------------------------------- |
| 14a  | Klient Supabase, logowanie, ekran konta                      | Nowy ekran „Konto"                  |
| 14b  | `uuid` w modelach, ślad po skasowanych, znacznik do wysłania | Nic — przebudowa fundamentu         |
| 14c  | Tabele na serwerze + RLS, wysyłka zmian                      | Przycisk „Synchronizuj"             |
| 14d  | Pobieranie, scalanie, rozstrzyganie konfliktów               | Drugi telefon widzi dane pierwszego |

### Etap 14a — konto i logowanie ✅ ZAKOŃCZONY

- [x] `@supabase/supabase-js` + `expo-secure-store` (wersje pod SDK 54)
- [x] Odczyt konfiguracji z `.env` — `src/data/supabase/config.ts`
- [x] Magazyn sesji dzielony na kawałki — `src/data/supabase/session-storage.ts`
- [x] Klient tworzony leniwie — `src/data/supabase/client.ts`
- [x] Stan konta w kontekście — `src/features/auth/auth-context.tsx`
- [x] Tłumaczenie błędów serwera na polskie powody — `auth-errors.ts`
- [x] Ekran konta z czterema stanami — `src/app/account.tsx`
- [x] 27 nowych testów jednostkowych (razem 388, wszystkie przechodzą)

**Etap 14a NIE RUSZA DANYCH.** Zalogowanie niczego nie wysyła ani nie pobiera.
Ekran mówi to wprost, w żółtej ramce widocznej także po zalogowaniu — patrz
niżej, dlaczego to nie jest nadmiarowa ostrożność.

#### Ostrzeżenie o niedziałającej synchronizacji zostaje na ekranie ZAWSZE

Kusiło, żeby po zalogowaniu je schować — wygląda jak usterka do naprawienia
w następnym etapie. Zostaje, bo napis „Jesteś zalogowany" w aplikacji do
wydatków czyta się jako „dane są bezpieczne w chmurze". Człowiek, który tak
to zrozumie, przestanie robić kopie zapasowe — a kopia jest dziś jedynym
zabezpieczeniem danych. Cena pomyłki jest niesymetryczna: nadmiarowe zdanie
kosztuje chwilę czytania, brakujące kosztuje utratę całej historii wydatków.

#### Sesja dzielona na kawałki, a nie zapisana w całości

Dokumentacja Expo ostrzega, że SecureStore bywa odmawia przyjęcia wartości
powyżej ~2048 bajtów, a sesja Supabase (dwa tokeny JWT plus dane konta)
bywa dłuższa. Awaria byłaby podstępna: logowanie pozornie działa, a przy
następnym uruchomieniu aplikacja wraca do ekranu logowania bez wyjaśnienia.
`session-storage.ts` trzyma pod kluczem samą liczbę kawałków, a treść pod
`klucz.0`, `klucz.1`. Test pilnuje, żeby ŻADEN pojedynczy wpis nie przekroczył
limitu.

Logika dzielenia jest oddzielona od SecureStore tym samym szwem, co baza
(`expo-adapter` / `node-adapter`) — dzięki temu sprawdza ją 14 testów w Node,
bez telefonu.

#### Adres projektu jest obcinany z końcówki `/rest/v1`

Panel Supabase pokazuje obok siebie adres projektu i adres końcówki REST,
i przy pierwszym podłączeniu skopiowany został ten drugi. Biblioteka dokleja
`/rest/v1` sama, więc taki adres dałby zapytania pod `/rest/v1/rest/v1/...` —
czyli błąd 404 przy każdej operacji, z komunikatem nieprowadzącym do przyczyny.
`normalizeProjectUrl` obcina tę końcówkę i cztery pokrewne.

#### Brak pliku `.env` nie jest błędem

Repozytorium jest publiczne. Kto je sklonuje, nie dostanie `.env` i nie ma
własnego projektu w chmurze — aplikacja ma mu się uruchomić i działać na
lokalnej bazie. `readSupabaseConfig` zwraca wtedy `null`, ekran konta pokazuje
„Konto niedostępne", a cała reszta działa bez zmian.

#### Sprawdzone w działającej aplikacji

| Sprawdzenie                         | Wynik                                              |
| ----------------------------------- | -------------------------------------------------- |
| `npm run typecheck`                 | czysty                                             |
| `npm run lint`                      | czysty                                             |
| `npm test`                          | 388 testów, 21 zestawów — wszystkie przechodzą     |
| `npx expo export --platform web`    | build przechodzi, trasa `/account` w wyniku        |
| Wczytanie `.env` przez Metro        | ekran pokazał formularz, a nie „Konto niedostępne" |
| Walidacja pustego formularza        | „Wypełnij oba pola."                               |
| Przełącznik logowanie ↔ rejestracja | działa, zachowuje wpisany adres                    |

**Do sprawdzenia na fizycznym telefonie:** założenie konta, przyjście listu
potwierdzającego, zalogowanie, przeżycie sesji przez zamknięcie aplikacji
i wylogowanie. Weryfikacja w przeglądarce nie obejmuje SecureStore — w wersji
webowej sesja idzie do `localStorage`, więc dzielenie na kawałki i Keystore
sprawdzą się dopiero na Androidzie.

### Etap 14b — trwałe identyfikatory ✅ ZAKOŃCZONY

- [x] `uuid` wchodzi do typów `Payment`, `Category`, `BillTemplate`,
      `Subscription`, `Income` — spłata długu świadomie zaciągniętego w Etapie 13
- [x] Generator identyfikatorów — `src/lib/uuid.ts`
- [x] Tabela skasowanych rekordów `deleted_record` z wyzwalaczami
- [x] Znacznik `pendingSync` przy każdym zapisie, podnoszony wyzwalaczem
- [x] Migracja 3 → 4
- [x] Format kopii zapasowej w wersji 4 — z identyfikatorami i śladem
      po skasowanych; kopie w wersjach 1–3 nadal się wczytują
- [x] 39 nowych testów (razem 427, wszystkie przechodzą)
- [ ] ~~Klucze obce między rekordami po `uuid`, nie po lokalnym `id`~~ —
      **odstąpiono, uzasadnienie niżej**

**Etap 14b NIC NIE ZMIENIA NA EKRANIE.** To przebudowa fundamentu: aplikacja
wygląda i działa dokładnie tak samo, a różnicę widać dopiero w Etapie 14c.

#### Odstąpienie od kluczy obcych po `uuid`

Plan zakładał przepisanie `categoryId`, `billTemplateId` i `subscriptionId`
na odpowiedniki po `uuid`. Przy pisaniu okazało się to złym pomysłem.

Zmiana dotknęłaby repozytorium (ponad tysiąc linii), wszystkich ekranów
i kilkudziesięciu testów — a lokalnej bazie nie dałaby nic. Wewnątrz jednego
telefonu `INTEGER` jest poprawny i szybszy od porównywania 32 znaków tekstu,
a wskazuje na niego kilkanaście kolumn i indeksów.

Serwerowi potrzebne są identyfikatory trwałe i będzie je dostawał — tyle że
z jednego złączenia przy wysyłce:

```sql
SELECT p.*, c.uuid AS categoryUuid FROM payment p JOIN category c ON c.id = p.categoryId
```

Tłumaczenie `id` ↔ `uuid` mieszka więc w warstwie synchronizacji (Etap 14c),
zamiast rozlewać się po całej aplikacji. Cena: przy pobieraniu trzeba wczytywać
kategorie przed wydatkami, żeby było na co przetłumaczyć obcy `uuid`. To jedno
zdanie w kodzie synchronizacji wobec przebudowy połowy projektu.

#### Dlaczego `uuid` jest nieobowiązkowy przy tworzeniu

W gotowym rekordzie identyfikator jest wymagany. Przy TWORZENIU podaje się go
tylko wtedy, gdy rekord ma zachować cudzy: przy odtwarzaniu kopii zapasowej
i przy pobraniu z serwera. W pozostałych kilkunastu miejscach — formularzach,
automacie rachunków, danych demonstracyjnych, zasiewie i testach — nadaje go
baza albo repozytorium.

Gdyby był wymagany, każde z tych miejsc musiałoby zawołać generator, a pominięcie
jednego przeszłoby przez kompilator dopiero po dopisaniu tam pola z byle jaką
wartością. Nieobowiązkowe pole odwraca ten układ: kto milczy, dostaje poprawny
identyfikator.

#### Ślad po skasowanych, czyli dlaczego kasowanie musi zostawiać zapis

Bez tabeli `deleted_record` usunięcie wydatku byłoby nieodwracalne tylko
z pozoru. Telefon A kasuje wydatek i po prostu przestaje go mieć. Telefon B,
który nic nie kasował, nadal go ma i wysyła. Telefon A widzi rekord, którego
u siebie nie zna, uznaje go za nowy i zapisuje z powrotem. Skasowany wydatek
WRACA — za każdym razem, na obu telefonach, bez żadnego komunikatu.

Nagrobek zapisuje `uuid`, a nie `id`: lokalny numer nic nie znaczy poza tym
jednym telefonem, a wiersza, do którego należał, już nie ma.

#### Warunek wyzwalacza, który wygląda dziwnie i taki ma być

`AFTER UPDATE ... WHEN old.pendingSync = 0 AND new.pendingSync = 0`.
Cztery przypadki, wszystkie potrzebne:

| Zmiana                          | Warunek      | Co się dzieje                              |
| ------------------------------- | ------------ | ------------------------------------------ |
| edycja czystego rekordu (0 → 0) | spełniony    | znacznik idzie na 1 — o to chodzi          |
| edycja oznaczonego (1 → 1)      | niespełniony | nie trzeba, już jest 1                     |
| zgaszenie po wysyłce (1 → 0)    | niespełniony | inaczej wysyłka nigdy by się nie skończyła |
| zapis samego wyzwalacza (0 → 1) | niespełniony | inaczej wywoływałby sam siebie bez końca   |

Ostatni wiersz jest powodem, dla którego warunek nie brzmi po prostu
`old.pendingSync = 0`. Testy sprawdzają wszystkie cztery.

#### Wyzwalacze zamiast zmian w zapytaniach

Ta sama decyzja, co przy `uuid` w Etapie 13. Kasowanie i edycja dzieją się
w kilkunastu miejscach repozytorium i przybędzie ich wraz z synchronizacją.
Zapomniany jeden `DELETE` nie psuje niczego widocznego — objawia się dopiero
wracającym wydatkiem, wiele dni później, na drugim urządzeniu. Baza pilnuje
tego sama, więc nie da się tego pominąć.

Cena: TypeScript nie sprawdzi ani jednego wyzwalacza. Dlatego pilnuje ich
dziesięć testów w `migrations.test.ts`, a osiem testów kontraktu wymusza,
żeby wersja pamięciowa — gdzie to samo robi kod klasy — zachowywała się
identycznie.

#### Kopie zapasowe sprzed Etapu 14b nadal działają

Format pliku ma wersję 4. Brak pola `uuid` znaczy „kopia ze starszej wersji" —
czytnik nadaje wtedy nowe identyfikatory, bo dla serwera te rekordy i tak są
nowe. Pole OBECNE, ale uszkodzone, to co innego: odmowa wczytania. Dolosowanie
identyfikatora w tym miejscu byłoby najgorsze z możliwych — dwa telefony
odtworzyłyby tę samą kopię pod różnymi identyfikatorami i po synchronizacji
każdy wydatek istniałby dwa razy.

#### Sprawdzone

| Sprawdzenie                      | Wynik                                         |
| -------------------------------- | --------------------------------------------- |
| `npm run typecheck`              | czysty                                        |
| `npm run lint`                   | czysty                                        |
| `npm test`                       | 427 testów, 22 zestawy — wszystkie przechodzą |
| `npx expo export --platform web` | build przechodzi                              |

**Do sprawdzenia na fizycznym telefonie:** aktualizacja aplikacji na bazie
z prawdziwymi danymi — po migracji 3 → 4 wszystkie wydatki mają być na miejscu.
Test `aktualizacja ze starej wersji schematu zachowuje dane użytkownika`
odgrywa to w Node, ale na prawdziwym pliku bazy nikt tego jeszcze nie widział.

### Etap 14c — schemat na serwerze i wysyłka 🔜

- [ ] Tabele w Supabase z kolumną `user_id`
- [ ] Reguły RLS: `auth.uid() = user_id` — jedyne prawdziwe zabezpieczenie danych
- [ ] Wysyłka rekordów oznaczonych „do wysłania"

### Etap 14d — pobieranie i scalanie 🔜

- [ ] Pobieranie zmian od znacznika czasu serwera
- [ ] Konflikt rozstrzyga nowszy zapis (decyzja właściciela projektu, 08.09.2026)
- [ ] Ekran stanu synchronizacji

## Etap 15 — do rozstrzygnięcia 🔜

Kolejność zależy od tego, co uwiera po kilku tygodniach używania. Kandydaci
z `docs/PLAN-DALSZY.md`, w kolejności wartości do kosztu:

- [ ] Powiadomienia przed terminem rachunku — jedyna funkcja, która sama się
      spłaca; rachunki mają `dueDate`, a aplikacja nic z tym nie robi
- [ ] Przypomnienie o kopii zapasowej („nie robiłeś kopii od 30 dni")
- [ ] Automatyczna kategoryzacja po nazwie sklepu
- [ ] Limity dla kategorii („Jedzenie maksymalnie 1 500 zł")

## Odstępstwa od specyfikacji

| Punkt specyfikacji | Zapis w dokumencie     | Co robimy                                   | Dlaczego                                                                                                                               |
| ------------------ | ---------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 8. Frontend        | Flutter / Dart         | React Native + Expo (SDK 54)                | Decyzja właściciela projektu. Reszta specyfikacji — model danych, ekrany, reguły biznesowe, scenariusze testowe — pozostaje bez zmian. |
| 8. Baza lokalna    | SQLite                 | SQLite (`expo-sqlite`)                      | Bez zmian.                                                                                                                             |
| 8. Stan aplikacji  | jeden spójny mechanizm | TanStack Query + Context na wybrany miesiąc | Prawie cały stan to dane z bazy; unieważnianie zapytań realizuje AC 5.1 („suma zmienia się bez restartu").                             |
