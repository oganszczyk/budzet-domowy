/**
 * Wykres pierścieniowy (Etap 11).
 *
 * Rysuje kolorowe wycinki na okręgu i pozwala umieścić dowolną treść
 * w środku — u nas kwotę, która została do końca miesiąca.
 *
 * JAK TO DZIAŁA:
 * Nie rysujemy czterech osobnych łuków. Rysujemy CZTERY PEŁNE OKRĘGI, jeden
 * na drugim, i każdemu każemy być widocznym tylko na swoim odcinku. Służy do
 * tego `strokeDasharray` — wzór kreska/przerwa nakładany na linię. Kreska
 * o długości wycinka i przerwa na całą resztę obwodu dają dokładnie jeden łuk.
 * `strokeDashoffset` przesuwa początek tego wzoru, więc kolejne wycinki
 * ustawiają się jeden za drugim.
 *
 * Wyliczanie łuków ręcznie (sinus, cosinus, ścieżki „A") dałoby ten sam
 * obraz znacznie większym kosztem — i z ryzykiem błędu przy wycinku
 * większym niż połowa okręgu, gdzie ścieżki SVG wymagają dodatkowej flagi.
 *
 * Obrót o -90 stopni przesuwa początek z prawej strony (domyślnej w SVG)
 * na godzinę dwunastą, bo tam czytelnik spodziewa się początku wykresu.
 *
 * Obrót zapisujemy jako pełne `rotate(kąt środekX środekY)`, a nie przez
 * osobne właściwości `rotation` i `origin`. Te drugie na wersji webowej
 * gubiły punkt obrotu — wychodziło samo `rotate(-90)`, czyli obrót wokół
 * lewego górnego rogu, i pierścień wyjeżdżał poza obszar rysowania.
 * Zapis z trzema liczbami jest zwykłym SVG i znaczy to samo wszędzie.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { colors } from '@/ui/theme';

export type DonutSegment = {
  /** Klucz do listy Reacta — nie jest pokazywany. */
  key: string;
  /** Udział w pełnym pierścieniu, od 0 do 1. */
  fraction: number;
  color: string;
};

type DonutChartProps = {
  segments: DonutSegment[];
  /** Średnica w punktach. */
  size?: number;
  /** Grubość pierścienia. */
  thickness?: number;
  /** Treść wyśrodkowana w otworze pierścienia. */
  children?: ReactNode;
  accessibilityLabel?: string;
};

export function DonutChart({
  segments,
  size = 220,
  thickness = 26,
  children,
  accessibilityLabel,
}: DonutChartProps) {
  // Promień liczymy do ŚRODKA grubej linii, nie do jej zewnętrznej krawędzi —
  // inaczej pierścień wystawałby poza obszar rysowania i obcinałby się.
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Ile obwodu zajęły już wcześniejsze wycinki.
  let consumed = 0;

  return (
    <View
      style={[styles.wrapper, { width: size, height: size }]}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size}>
        <G transform={`rotate(-90 ${center} ${center})`}>
          {/* Tor pierścienia. Widoczny, gdy nie ma żadnych danych, i wypełnia
              włosowe szczeliny między wycinkami przy zaokrąglaniu pikseli. */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={colors.border}
            strokeWidth={thickness}
            fill="none"
          />

          {segments.map((segment) => {
            const length = segment.fraction * circumference;
            const offset = -consumed * circumference;
            consumed += segment.fraction;

            return (
              <Circle
                key={segment.key}
                cx={center}
                cy={center}
                r={radius}
                stroke={segment.color}
                strokeWidth={thickness}
                fill="none"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
                // Zakończenia proste, nie zaokrąglone: zaokrąglone nachodziłyby
                // na sąsiedni wycinek i zawyżały optycznie małe kwoty.
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>

      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
