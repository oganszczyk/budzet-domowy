# Domowe wydatki — zasady projektu

Aplikacja do rejestrowania wydatków domowych. Pełna specyfikacja MVP:
`docs/Specyfikacja_aplikacji_wydatki_domowe.pdf` (wersja tekstowa do przeszukiwania:
`docs/specyfikacja.txt`). Postęp prac: `docs/ETAPY.md`.

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Zasady, których nie wolno złamać

1. **Kwoty tylko w groszach.** BR-03. `125,50 zł` to `12550`. Nigdy nie używaj liczb
   zmiennoprzecinkowych do pieniędzy. Konwersje wyłącznie przez `src/lib/money.ts`.
2. **Interfejs po polsku, kod po angielsku.** 1.2. Żadnego polskiego tekstu na stałe
   w komponentach — wszystko przez `src/constants/strings.ts`.
3. **Daty jako tekst ISO `RRRR-MM-DD`.** Nie obiekty `Date` w bazie. Patrz `src/lib/date.ts`.
4. **Budowa etapami.** Rozdział 9 specyfikacji. Po każdym etapie aplikacja musi się
   kompilować i zachowywać istniejące dane. Nie wdrażaj kilku etapów naraz.
5. **Migracje, nie kasowanie bazy.** Zmiana schematu = nowa migracja.
6. **Żadnego SQL w ekranach.** 8.1. Ekran pyta repozytorium, repozytorium zna bazę.

## Warstwy (8.1)

| Katalog         | Warstwa      | Zawartość                          |
| --------------- | ------------ | ---------------------------------- |
| `src/app/`      | Presentation | trasy expo-router                  |
| `src/ui/`       | Presentation | komponenty wspólne, motyw          |
| `src/features/` | Application  | przypadki użycia                   |
| `src/domain/`   | Domain       | modele, enumy, walidacja           |
| `src/data/`     | Data         | SQLite, repozytoria, migracje, OCR |

## Przed zamknięciem etapu

```bash
npm run typecheck && npm run lint && npm test
```

Dodatkowo `npx expo export --platform web --output-dir .expo-smoke` sprawdza,
czy aplikacja w ogóle się buduje.
