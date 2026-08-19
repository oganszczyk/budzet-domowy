/**
 * Pytanie „na pewno?" działające na telefonie i w przeglądarce.
 *
 * 5.8: „Przed usunięciem zawsze pokazać potwierdzenie."
 *
 * `Alert.alert` z React Native nie jest zaimplementowany w wersji webowej —
 * na telefonie pokazałby okienko, a w przeglądarce po cichu nic by nie zrobił
 * i usunięcie odbyłoby się bez pytania. Dlatego w przeglądarce sięgamy
 * po natywne `window.confirm`.
 */

import { Alert, Platform } from 'react-native';

import { strings } from '@/constants/strings';

type ConfirmOptions = {
  title: string;
  message?: string;
  /** Etykieta przycisku potwierdzającego. */
  confirmLabel?: string;
  /** Czy akcja jest niszcząca (czerwony przycisk na iOS). */
  destructive?: boolean;
};

export function confirm({
  title,
  message,
  confirmLabel = strings.common.confirm,
  destructive = false,
}: ConfirmOptions): Promise<boolean> {
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(
      typeof globalThis.confirm === 'function' ? globalThis.confirm(text) : true
    );
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: strings.common.cancel, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
