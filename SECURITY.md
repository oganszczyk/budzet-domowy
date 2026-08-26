# Bezpieczeństwo

## Zakres

Aplikacja działa w całości na urządzeniu użytkownika. Nie ma serwera, kont
ani synchronizacji; nie zbiera analityki i nie wysyła danych na zewnątrz.
Rozpoznawanie tekstu z paragonów działa lokalnie.

Powierzchnia ataku jest więc mała, ale nie zerowa. Istotne obszary:

- **Dane finansowe na urządzeniu** — baza SQLite w prywatnej pamięci
  aplikacji, dziś bez dodatkowego szyfrowania i bez blokady PIN-em.
- **Pliki kopii zapasowej** — zwykły JSON, czytelny dla każdego, kto ma
  do niego dostęp. Tak jest celowo (kopię ma dać się otworzyć i przejrzeć),
  ale trzeba o tym wiedzieć, wysyłając plik.
- **Wczytywanie kopii** — jedyne miejsce, w którym aplikacja przyjmuje dane
  z zewnątrz. Plik jest sprawdzany przed dotknięciem bazy; odtwarzanie
  zastępuje całą zawartość.
- **Zależności** — biblioteki pochodzące z npm.

## Zgłaszanie podatności

**Nie zgłaszaj przez publiczne zgłoszenie (issue).**

Użyj prywatnego zgłoszenia w GitHubie:
**Security → Report a vulnerability** w tym repozytorium.

Napisz, co udało się osiągnąć i w jaki sposób. Zgłoszenia z krokami do
powtórzenia rozpatrują się szybciej niż opisy ogólne.

To projekt prowadzony po godzinach — odpowiedź może zająć kilka dni.
Nie ma programu nagród.

## Czego zgłaszać nie trzeba

- Braku szyfrowania bazy i braku blokady PIN-em. To wiadome ograniczenia,
  opisane wyżej i w [`docs/PLAN-DALSZY.md`](docs/PLAN-DALSZY.md).
- Tego, że plik kopii zapasowej jest czytelny — to decyzja projektowa.
- Ostrzeżeń `npm audit` dotyczących zależności deweloperskich, które nie
  trafiają do zbudowanej aplikacji.

## Obsługiwane wersje

Poprawki trafiają do najnowszej wersji. Starsze buildy nie są wspierane —
aplikacja nie ma mechanizmu aktualizacji, więc jedyną drogą jest
zainstalowanie nowego pliku APK.
