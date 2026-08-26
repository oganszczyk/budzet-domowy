# Współtworzenie

Dzięki za zainteresowanie. Ten dokument opisuje, jak pracować nad projektem
tak, żeby zmiany dało się przyjąć bez długiej wymiany komentarzy.

## Zanim zaczniesz pisać kod

Przeczytaj [`AGENTS.md`](AGENTS.md). To nie jest zwykłe „przeczytaj
dokumentację" — ten plik zawiera reguły, których złamanie psuje dane
użytkownika, oraz uzasadnienia, dla których wyglądają tak, a nie inaczej.

Najkrócej:

- **Kwoty wyłącznie w groszach.** `125,50 zł` to `12550`. Nigdy liczba
  zmiennoprzecinkowa — `19.99 * 100` daje w JavaScripcie `1998.9999999999998`,
  a przy sumowaniu setek wydatków błędy się kumulują.
- **Interfejs po polsku, kod po angielsku.** Żadnego polskiego tekstu na stałe
  w komponencie — wszystko przez `src/constants/strings.ts`.
- **Daty jako tekst ISO** `RRRR-MM-DD`, nie obiekty `Date`.
- **Migracje, nie kasowanie bazy.** Nowa wersja schematu to nowy wpis na końcu
  tablicy `MIGRATIONS`. Nigdy nie edytuj istniejących — one wykonały się już
  na czyichś urządzeniach.
- **Żaden ekran nie zawiera SQL.** Ekran pyta repozytorium, repozytorium zna bazę.

## Przygotowanie środowiska

```bash
git clone https://github.com/rurikaburi/dom-apka.git
cd dom-apka
npm install
npm start
```

Do pracy nad ekranami wystarczy Expo Go albo wersja webowa (`npm run web`).
Skanowanie paragonów wymaga własnego builda — Expo Go nie ma modułu ML Kit.

## Przed wysłaniem zmiany

```bash
npm run typecheck && npm run lint && npm test
```

Wszystkie trzy muszą przejść. To samo uruchamia się automatycznie przy
zgłoszeniu, ale szybciej dowiesz się lokalnie.

Przy zmianach dotyczących ekranów uruchom też aplikację i przeklikaj to,
co zmieniałeś. Testy jednostkowe nie wychwycą układu, który się rozjechał.

## Jak dzielimy pracę

Projekt jest budowany **etapami** (rozdział 9 specyfikacji). Reguła brzmi:
po każdym etapie aplikacja musi się kompilować i zachowywać istniejące dane.
Nie wdrażamy kilku etapów naraz.

W praktyce oznacza to, że lepsza jest zmiana mała i skończona niż duża
i częściowa. Jeśli propozycja obejmuje kilka niezależnych rzeczy, podziel ją.

## Testy

Trzy rodzaje, każdy w swoim miejscu:

- **Czyste funkcje** — kwoty, daty, wyliczenia budżetu, format kopii
  zapasowej. Testowane wprost, bez żadnego otoczenia.
- **Kontrakt repozytorium** — [`src/data/repository-contract.test.ts`](src/data/repository-contract.test.ts)
  uruchamia ten sam zestaw testów na obu implementacjach: pamięciowej
  i SQLite. Nowa metoda repozytorium powinna trafić tutaj.
- **Scenariusze** — [`src/scenarios.test.ts`](src/scenarios.test.ts) odwzorowuje
  scenariusze T-01..T-16 ze specyfikacji na prawdziwej bazie SQLite.

Testy bazodanowe działają na wbudowanym module `node:sqlite`, więc SQL
sprawdza się w milisekundach, a nie dopiero po instalacji na telefonie.

## Opisy commitów

Piszemy po polsku, w trybie rozkazującym, i tłumaczymy **dlaczego**, nie „co".
Sam kod pokazuje, co się zmieniło; opis ma wyjaśnić powód i odrzucone
alternatywy.

Dobry przykład z historii projektu:

```
Nie proś o dostęp do mikrofonu

app.json deklarował RECORD_AUDIO, ale aplikacja nigdzie nie nagrywa
dźwięku. Zbędne uprawnienie odstrasza użytkowników i jest wytykane
przy publikacji w Google Play.
```

Pierwszy wiersz do 72 znaków, potem pusty wiersz, potem uzasadnienie.

## Zgłoszenia

- **Błąd** — użyj szablonu zgłoszenia błędu. Kroki do powtórzenia są
  najważniejszą częścią.
- **Propozycja** — najpierw opisz problem, dopiero potem rozwiązanie.
- **Bezpieczeństwo** — nie przez publiczne zgłoszenie, patrz
  [`SECURITY.md`](SECURITY.md).

Nie wklejaj do zgłoszeń prawdziwych kwot ani nazwisk domowników. Zgłoszenia
są publiczne.

## Praca z asystentem AI

Projekt powstał we współpracy z asystentem AI i [`AGENTS.md`](AGENTS.md) jest
jego instrukcją. Jeśli używasz asystenta, wskaż mu ten plik — zawiera reguły,
których nie da się wywnioskować z samego kodu, i ostrzeżenia o pułapkach,
w które łatwo wpaść (przypięta wersja SDK, moduł natywny OCR, format kopii
zapasowej).
