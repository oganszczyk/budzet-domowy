# Historia zmian

Format zgodny z [Keep a Changelog](https://keepachangelog.com/pl/1.1.0/).
Numeracja wersji według [wersjonowania semantycznego](https://semver.org/lang/pl/).

## [Niewydane]

Plan dalszych prac: [`docs/PLAN-DALSZY.md`](docs/PLAN-DALSZY.md).

## [1.0.0] — 2026-08-21

Pierwsze wydanie. Pełne MVP zgodnie ze specyfikacją, potwierdzone na
fizycznym urządzeniu z Androidem.

### Dodane

- **Ekran główny** z sumami miesiąca dla trzech kategorii głównych
  i przełącznikiem miesiąca.
- **Rachunki domowe** — szablony cykliczne tworzące rekordy co miesiąc,
  statusy wyliczane przy odczycie, historia wcześniejszych kwot.
- **Subskrypcje** — częstotliwości miesięczne, kwartalne, półroczne, roczne
  i własne; prognoza kosztu rocznego; przypomnienie o potwierdzeniu
  korzystania.
- **Zakupy** — wpisywanie ręczne z podkategoriami, sposobem płatności
  i opcjonalnym zdjęciem paragonu.
- **Skanowanie paragonów** — odczyt kwoty przez ML Kit, offline,
  z obowiązkowym potwierdzeniem przez użytkownika przed zapisem.
- **Wspólna historia płatności** i ekran szczegółów.
- **Własne podkategorie** — decyzja do punktu 12.1 specyfikacji: użytkownik
  tworzy podkategorie, ale kategorie główne pozostają trzy.
- **Kopia zapasowa** — eksport całej zawartości do pliku JSON z wersją
  formatu i pełną walidacją przy odczycie; odtwarzanie zastępuje zawartość
  w jednej transakcji.
- **Budżet miesiąca** — dochody domowników i wykres pierścieniowy pokazujący,
  ile zostało po odjęciu wydatków.
- **Baza SQLite** z własnym mechanizmem migracji; dane przeżywają
  aktualizację aplikacji.

### Uwagi

- Kopia zapasowa nie obejmuje zdjęć paragonów — baza przechowuje wyłącznie
  ścieżki do plików.
- Ekran analizy jest na razie zaślepką; specyfikacja zostawiła go do osobnego
  opisania.
- Aplikacja nie ma mechanizmu aktualizacji — nowa wersja to nowy plik APK.

[niewydane]: https://github.com/oganszczyk/budzet-domowy/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/oganszczyk/budzet-domowy/releases/tag/v1.0.0
