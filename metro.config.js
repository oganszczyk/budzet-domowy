// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * Konfiguracja potrzebna, żeby expo-sqlite działało także w przeglądarce.
 *
 * Na telefonie SQLite jest wbudowane w system. W przeglądarce expo-sqlite
 * uruchamia ten sam silnik skompilowany do WebAssembly, a to wymaga dwóch
 * rzeczy, których Metro nie robi domyślnie.
 */

// 1. Metro nie zna rozszerzenia .wasm i nie potrafi go dołączyć jako zasobu.
config.resolver.assetExts.push('wasm');

// 2. Baza w przeglądarce działa w wątku roboczym i korzysta z SharedArrayBuffer,
//    który przeglądarki udostępniają wyłącznie stronom "izolowanym
//    międzypochodzeniowo". Te dwa nagłówki właśnie to włączają.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    return middleware(req, res, next);
  };
};

module.exports = config;
