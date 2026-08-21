/**
 * Motyw aplikacji.
 *
 * 8. Założenia techniczne: motyw jasny i prosty.
 * Ciemny motyw może zostać dodany później — dlatego wszystkie kolory
 * są zebrane w jednym miejscu i nigdzie nie wpisujemy ich "na sztywno"
 * w ekranach. Dodanie ciemnego motywu to wtedy zmiana tego jednego pliku.
 */

export const colors = {
  /** Tło ekranu. */
  background: '#F4F5F7',
  /** Tło kart i list. */
  surface: '#FFFFFF',
  /** Delikatna linia oddzielająca. */
  border: '#E3E5E9',

  /** Tekst główny. */
  text: '#14161A',
  /** Tekst pomocniczy: opisy, daty, podpisy. */
  textMuted: '#646B76',
  /** Tekst na kolorowym tle. */
  textInverted: '#FFFFFF',

  /** Kolor wiodący — nagłówki, aktywna zakładka, przyciski główne. */
  primary: '#2F5BEA',
  primarySoft: '#E8EEFF',

  /** Kolory trzech kategorii głównych z ekranu głównego (5.1). */
  bills: '#2F5BEA',
  subscriptions: '#7A4DE0',
  purchases: '#12876F',

  /**
   * Budżet miesiąca (Etap 11).
   *
   * `remaining` jest celowo stonowany, a nie kolorowy: to jedyny wycinek
   * pierścienia, który NIE jest wydatkiem. Gdyby dostał własny mocny kolor,
   * czytałby się jak czwarta kategoria wydatków.
   */
  income: '#12876F',
  remaining: '#CBD2DC',
  overspent: '#C42B2B',

  /** Kolory statusów rachunku (5.2). */
  statusWaiting: '#8A6410',
  statusWaitingSoft: '#FDF3DA',
  statusToPay: '#2F5BEA',
  statusToPaySoft: '#E8EEFF',
  statusPaid: '#12876F',
  statusPaidSoft: '#DFF3EE',
  statusOverdue: '#C42B2B',
  statusOverdueSoft: '#FCE7E7',
} as const;

/** Odstępy — używamy skali zamiast dowolnych liczb, żeby ekrany były spójne. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const fontSize = {
  caption: 12,
  body: 15,
  label: 17,
  title: 20,
  heading: 24,
  amount: 28,
} as const;
