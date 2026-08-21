# Domowe wydatki — zasady projektu

Aplikacja do rejestrowania wydatków domowych. Pełna specyfikacja MVP:
`docs/Specyfikacja_aplikacji_wydatki_domowe.pdf` (wersja tekstowa do przeszukiwania:
`docs/specyfikacja.txt`). Postęp prac: `docs/ETAPY.md`.

## Expo — WERSJA SDK 54

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

## Dlaczego SDK 54, a nie najnowszy

Expo Go z Google Play / App Store obsługuje **SDK 54** (pole `expoGoSdkVersion`
w https://api.expo.dev/v2/versions/latest). Projekt startowo powstał na SDK 57
i Expo Go odmawiał uruchomienia z komunikatem „Project is incompatible with this
version of Expo Go".

Trzymamy się SDK 54, dopóki testujemy na Expo Go. **Nie aktualizuj SDK** bez
przejścia na development build (`expo-dev-client` + EAS Build) — inaczej
aplikacja przestanie się otwierać na telefonie.

## Znane ryzyko: biblioteka OCR a Nowa Architektura

`@react-native-ml-kit/text-recognition` jest w React Native Directory oznaczona
jako **nieprzetestowana z Nową Architekturą**, którą SDK 54 włącza domyślnie.
`npx expo-doctor` zgłasza to jako ostrzeżenie — celowo go NIE wyciszamy.

To flaga „nikt nie sprawdził", a nie „na pewno nie działa": React Native 0.81
ma warstwę zgodności dla modułów starej architektury. Nie da się tego jednak
potwierdzić bez zbudowania własnej wersji aplikacji.

**Jeżeli po zbudowaniu skanowanie nie zadziała**, kolejność działań:

1. Wyłącz Nową Architekturę dla builda — w `app.json` dodaj
   `"newArchEnabled": false` w sekcji `expo` i zbuduj ponownie.
2. Jeżeli to nie pomoże, podmień bibliotekę. Zmiana dotyczy WYŁĄCZNIE pliku
   `src/features/receipts/mlkit-ocr-service.ts` — reguły odczytu z 5.6
   i cały ekran skanowania zostają bez zmian.

Aplikacja nie przestanie działać w żadnym z tych przypadków: gdy moduł
natywny jest niedostępny, `createOcrService()` sam wraca do silnika
demonstracyjnego, a ekran o tym informuje.

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
