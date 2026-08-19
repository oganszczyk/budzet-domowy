# Domowe wydatki

Aplikacja mobilna do rejestrowania i kontrolowania wydatków domowych:
rachunków, subskrypcji i zakupów. Działa offline, dla jednej osoby, bez kont
i bez chmury.

Zbudowana z [Expo](https://expo.dev) SDK 57 i React Native, według
`docs/Specyfikacja_aplikacji_wydatki_domowe.pdf`.

## Uruchomienie

```bash
npm install
npm start
```

Następnie zeskanuj kod QR aplikacją **Expo Go** na telefonie, albo naciśnij
`w`, żeby otworzyć aplikację w przeglądarce.

## Stan prac

Zakończony **Etap 0** — szkielet aplikacji: nawigacja, motyw, formatowanie pl-PL.
Szczegółowy postęp: [`docs/ETAPY.md`](docs/ETAPY.md).

## Skrypty

| Polecenie           | Działanie                           |
| ------------------- | ----------------------------------- |
| `npm start`         | Serwer deweloperski Metro           |
| `npm run android`   | Uruchomienie na emulatorze Androida |
| `npm run web`       | Uruchomienie w przeglądarce         |
| `npm test`          | Testy jednostkowe                   |
| `npm run typecheck` | Sprawdzenie typów TypeScript        |
| `npm run lint`      | ESLint                              |
| `npm run format`    | Prettier                            |
| `npm run doctor`    | Kontrola zdrowia projektu Expo      |

## Struktura

```
src/
  app/          trasy — plik = ekran (expo-router)
    (tabs)/     ekrany z dolnym paskiem: Główna, Historia, Analiza
    bills/      rachunki domowe
    subscriptions/
    purchases/
  ui/           komponenty wspólne i motyw
  features/     przypadki użycia (warstwa Application)
  domain/       modele, enumy, reguły biznesowe
  data/         SQLite, repozytoria, migracje
  lib/          funkcje pomocnicze: kwoty, daty
  constants/    teksty interfejsu (po polsku)
docs/           specyfikacja i plan etapów
```

Import przez alias `@/` wskazuje na `src/`.

## Najważniejsze zasady

- **Kwoty w groszach.** `125,50 zł` zapisujemy jako `12550`. Nigdy jako `125.50`.
- **Interfejs po polsku, kod po angielsku.**
- **Daty jako tekst ISO** `RRRR-MM-DD`.

Pełna lista: [`AGENTS.md`](AGENTS.md).
