/**
 * Główny układ aplikacji — "korzeń" wszystkich ekranów.
 *
 * Tutaj podpinamy rzeczy, które muszą obowiązywać w całej aplikacji:
 *  1. SafeAreaProvider — żeby treść nie chowała się pod wycięciem aparatu
 *     ani pod paskiem gestów telefonu.
 *  2. QueryClientProvider — pamięć podręczna danych z bazy (patrz niżej).
 *  3. MonthProvider — wybrany miesiąc (4.3), wspólny dla wszystkich ekranów.
 *
 * Kolejność ma znaczenie: MonthProvider jest wewnątrz QueryClientProvider,
 * bo zapytania o dane będą zależeć od wybranego miesiąca, a nie odwrotnie.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { strings } from '@/constants/strings';
import { MonthProvider } from '@/features/month/month-context';
import { colors } from '@/ui/theme';

export default function RootLayout() {
  /**
   * QueryClient tworzymy raz, przez useState(() => ...).
   * Gdybyśmy napisali `new QueryClient()` bezpośrednio w ciele komponentu,
   * przy każdym przerysowaniu powstawałby nowy klient i cała pamięć
   * podręczna byłaby kasowana.
   */
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Dane siedzą w lokalnej bazie na tym samym urządzeniu,
            // więc nie ma czego odświeżać "w tle" ani ponawiać po błędzie sieci.
            retry: false,
            refetchOnWindowFocus: false,
            staleTime: Infinity,
          },
        },
      })
  );

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <MonthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.text, fontWeight: '700' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
              headerBackButtonDisplayMode: 'minimal',
            }}
          >
            {/* Zakładki mają własny nagłówek, więc ukrywamy nagłówek stosu. */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            <Stack.Screen name="bills/index" options={{ title: strings.bills.title }} />
            <Stack.Screen
              name="subscriptions/index"
              options={{ title: strings.subscriptions.title }}
            />
            <Stack.Screen name="purchases/index" options={{ title: strings.purchases.title }} />
          </Stack>
        </MonthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
