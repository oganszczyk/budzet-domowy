/**
 * Etap 14a: podłączenie magazynu sesji do prawdziwego urządzenia.
 *
 * Ten plik istnieje z tego samego powodu, co `sqlite/expo-adapter.ts`:
 * cała logika siedzi w `session-storage.ts` i daje się przetestować w Node,
 * a tutaj zostaje wyłącznie kilka linijek dotykających systemu.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { KeyValueBackend } from './session-storage';

/**
 * WEB NIE MA KEYCHAINA.
 *
 * `expo-secure-store` opiera się na Android Keystore i iOS Keychain — w
 * przeglądarce nie ma odpowiednika i biblioteka zgłasza niedostępność.
 * Wersja webowa służy nam wyłącznie do sprawdzania, czy aplikacja się buduje
 * (`expo export --platform web`), więc `localStorage` w zupełności wystarcza.
 *
 * Nie udajemy przy tym bezpieczeństwa, którego tam nie ma: token w
 * `localStorage` przetrwa odświeżenie strony i tyle. Gdyby wersja webowa
 * miała kiedyś trafić do ludzi, to miejsce wymaga ponownej decyzji.
 */
const webBackend: KeyValueBackend = {
  getItem: async (key) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key, value) => {
    globalThis.localStorage?.setItem(key, value);
  },
  removeItem: async (key) => {
    globalThis.localStorage?.removeItem(key);
  },
};

const nativeBackend: KeyValueBackend = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

/** Magazyn właściwy dla platformy, na której akurat działa aplikacja. */
export const platformSecureBackend: KeyValueBackend =
  Platform.OS === 'web' ? webBackend : nativeBackend;
