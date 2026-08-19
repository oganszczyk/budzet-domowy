/**
 * 4.2: dolny pasek nawigacyjny.
 *
 * [x] Pasek widoczny na ekranach głównych: Strona główna, Historia, Analiza.
 * [x] Ikona domu otwiera stronę główną.
 * [x] Ikona listy/zegara otwiera historię.
 * [x] Ikona wykresu otwiera analizę.
 * [x] Aktywna ikona jest wizualnie wyróżniona (kolor + wypełniona wersja ikony).
 * [x] Naciśnięcie aktywnej ikony nie tworzy kolejnej kopii ekranu —
 *     tym zajmuje się nawigator zakładek, nie musimy tego pisać ręcznie.
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { strings } from '@/constants/strings';
import { colors, fontSize } from '@/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: fontSize.caption,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: strings.tabs.home,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: strings.tabs.history,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="analysis"
        options={{
          title: strings.tabs.analysis,
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
