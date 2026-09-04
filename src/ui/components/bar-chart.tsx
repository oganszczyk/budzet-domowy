/**
 * Wykres słupkowy — miesiąc po miesiącu (Etap 12).
 *
 * DLACZEGO ZWYKŁE WIDOKI, A NIE SVG
 *
 * Pierścień budżetu (Etap 11) musi być SVG, bo łuk nie jest prostokątem.
 * Słupek jest prostokątem, więc `<View>` o zadanej wysokości robi dokładnie
 * to samo — a podpisy pod osią zostają prawdziwym `<Text>`, który system
 * mierzy sam. Przy tekście w SVG trzeba by zgadywać szerokość napisu,
 * a to właśnie tam pierścień się wyłożył na wersji webowej.
 *
 * DLACZEGO NIE MIERZYMY SZEROKOŚCI
 *
 * Pierwsza wersja czytała szerokość przez `onLayout` i dopiero z niej liczyła
 * szerokość słupka. Sprawdzenie w przeglądarce pokazało, że to nie działa:
 * zdarzenie nie zawsze dociera (a po odświeżeniu kodu w locie nie dociera
 * nigdy), więc stan zostawał na zerze i sześć słupków kuliło się do
 * najwęższych 22 pikseli, zostawiając pół karty pustej.
 *
 * Teraz szerokość liczy silnik układu: każda kolumna ma `flex: 1`
 * i `minWidth`, a zawartość przewijanego obszaru `flexGrow: 1`. Gdy słupków
 * jest mało, dzielą między siebie całą szerokość; gdy dużo — schodzą do
 * `minWidth` i wykres zaczyna się przewijać w bok. Żadnego stanu, żadnego
 * pomiaru, ten sam wynik na telefonie i w przeglądarce.
 *
 * MIESIĄC PUSTY NIE JEST MIESIĄCEM ZEROWYM
 *
 * Brak danych rysujemy jako niski szary znacznik przy osi, a nie jako brak
 * słupka. Puste miejsce czytałoby się jak „tu nic nie wydałem", podczas gdy
 * znaczy „tu nic nie zapisałem". To dwie różne informacje.
 */

import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/ui/theme';

export type BarChartBar = {
  /** Klucz listy Reacta. */
  key: string;
  /** Podpis pod słupkiem, np. „sie". */
  label: string;
  /** Drugi wiersz podpisu — rok, pokazywany tylko tam, gdzie się zmienia. */
  sublabel?: string;
  valueGrosze: number;
  /** Czy w tym miesiącu nie ma ŻADNYCH danych (nie mylić z kwotą zero). */
  isEmpty: boolean;
};

type BarChartProps = {
  bars: BarChartBar[];
  /** Kolor słupków — zwykle kolor kategorii głównej. */
  color: string;
  /** Pozioma kreska średniej; pomijana, gdy nie ma czego uśredniać. */
  averageGrosze?: number;
  averageLabel?: string;
  /** Etykieta dla czytnika ekranu — wykres sam z siebie nic nie mówi. */
  accessibilityLabel?: string;
};

/** Wysokość obszaru rysowania. Podpisy osi leżą pod nim. */
const PLOT_HEIGHT = 150;

/** Najwęższy słupek, jaki jeszcze da się objąć wzrokiem. */
const MIN_BAR_WIDTH = 22;

const BAR_GAP = spacing.sm;

/** Wysokość znacznika miesiąca bez danych. */
const EMPTY_MARKER_HEIGHT = 3;

export function BarChart({
  bars,
  color,
  averageGrosze,
  averageLabel,
  accessibilityLabel,
}: BarChartProps) {
  const maxValue = bars.reduce((max, bar) => Math.max(max, bar.valueGrosze), 0);

  /** Wysokość słupka w pikselach. Skala liniowa od zera. */
  const heightFor = (bar: BarChartBar) => {
    if (bar.isEmpty || maxValue === 0) return EMPTY_MARKER_HEIGHT;
    // Minimum 2 piksele: kwota niezerowa musi być widoczna, choćby była
    // ułamkiem największej. Zniknięty słupek czytałby się jak brak danych.
    return Math.max(2, Math.round((bar.valueGrosze / maxValue) * PLOT_HEIGHT));
  };

  const averageOffset =
    averageGrosze !== undefined && averageGrosze > 0 && maxValue > 0
      ? Math.min(PLOT_HEIGHT, Math.round((averageGrosze / maxValue) * PLOT_HEIGHT))
      : null;

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {bars.map((bar) => (
          <View key={bar.key} style={styles.column}>
            <View style={styles.plot}>
              <View
                style={[
                  styles.bar,
                  {
                    height: heightFor(bar),
                    backgroundColor: bar.isEmpty ? colors.border : color,
                  },
                ]}
              />
            </View>

            <Text style={styles.label} numberOfLines={1}>
              {bar.label}
            </Text>
            {/* Rok podpisujemy tylko tam, gdzie się zmienia — inaczej powtarzałby
                się pod każdym słupkiem i zagłuszał nazwę miesiąca. */}
            <Text style={styles.sublabel} numberOfLines={1}>
              {bar.sublabel ?? ''}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/*
        Kreskę średniej pozycjonujemy od GÓRY komponentu, a nie od dołu.
        Obszar rysowania zaczyna się dokładnie na górnej krawędzi i ma znaną
        wysokość, więc `top` da się policzyć bez wiedzy o tym, ile miejsca
        zajmą podpisy pod osią.
      */}
      {averageOffset !== null ? (
        <View
          pointerEvents="none"
          style={[styles.averageLine, { top: PLOT_HEIGHT - averageOffset }]}
        >
          <View style={styles.averageRule} />
          {averageLabel ? <Text style={styles.averageLabel}>{averageLabel}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    // Kreska średniej leży w tym kontenerze bezwzględnie.
    position: 'relative',
  },
  content: {
    // `flexGrow` sprawia, że zawartość jest CO NAJMNIEJ tak szeroka jak ekran.
    // Bez tego kolumny z `flex: 1` nie miałyby czego dzielić i skurczyłyby się
    // do `minWidth`, zostawiając pustą prawą połowę karty.
    flexGrow: 1,
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  column: {
    flex: 1,
    minWidth: MIN_BAR_WIDTH,
    alignItems: 'center',
  },
  plot: {
    height: PLOT_HEIGHT,
    justifyContent: 'flex-end',
    width: '100%',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  label: {
    marginTop: spacing.xs,
    fontSize: fontSize.caption,
    color: colors.text,
  },
  sublabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  averageLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  averageRule: {
    flex: 1,
    height: 1,
    backgroundColor: colors.textMuted,
    opacity: 0.45,
  },
  averageLabel: {
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
