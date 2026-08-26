<!--
  Opisz zmianę tak, żeby dało się ją ocenić bez czytania całego kodu.
  Najważniejsze jest DLACZEGO — „co" widać w plikach.
-->

## Co zmienia

<!-- Jedno–dwa zdania. -->

## Dlaczego

<!--
  Jaki problem to rozwiązuje i dlaczego akurat tak. Jeżeli odrzuciłeś
  prostsze rozwiązanie, napisz dlaczego — to najcenniejsza część opisu.
-->

## Jak sprawdzone

<!--
  Testy automatyczne to nie wszystko. Napisz, co przeklikałeś na urządzeniu
  albo w wersji webowej — zwłaszcza przy zmianach dotyczących ekranów.
-->

## Lista kontrolna

- [ ] `npm run typecheck && npm run lint && npm test` przechodzi
- [ ] Kwoty pozostają całkowitą liczbą groszy (BR-03)
- [ ] Żaden nowy tekst interfejsu nie jest wpisany na stałe w komponencie —
      wszystko przez `src/constants/strings.ts`
- [ ] Zmiana schematu bazy to nowa migracja, a nie modyfikacja istniejącej
- [ ] Istniejące dane użytkownika przeżywają tę zmianę
- [ ] `docs/ETAPY.md` uzupełnione, jeśli to domknięcie etapu
