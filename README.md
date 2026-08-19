# Dom

Mobile app built with [Expo](https://expo.dev) (SDK 57) and React Native.

## Stack

| Piece      | Choice                                    |
| ---------- | ----------------------------------------- |
| Framework  | Expo SDK 57 / React Native 0.86            |
| Routing    | expo-router (file-based, typed routes)     |
| Language   | TypeScript (strict)                        |
| Compiler   | React Compiler enabled                     |
| Quality    | ESLint (eslint-config-expo) + Prettier     |

## Getting started

```bash
npm install
npm start
```

Then press `a` for Android, `w` for web, or scan the QR code with **Expo Go** on your phone.
iOS simulator needs macOS; Expo Go on an iPhone works from Windows.

## Scripts

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm start`            | Start the Metro dev server          |
| `npm run android`      | Start and open the Android emulator |
| `npm run web`          | Start and open in the browser       |
| `npm run lint`         | ESLint                              |
| `npm run lint:fix`     | ESLint with autofix                 |
| `npm run format`       | Prettier write                      |
| `npm run typecheck`    | `tsc --noEmit`                      |
| `npm run doctor`       | expo-doctor project health check    |
| `npm run reset-project`| Strip the demo screens (one-way)    |

## Layout

```
src/
  app/           file-based routes — a file here becomes a screen
    _layout.tsx  root layout (tabs)
    index.tsx    "/"
    explore.tsx  "/explore"
  components/    reusable UI
  constants/     theme tokens
  hooks/         shared hooks
assets/          images, icons, splash
```

Imports use the `@/` alias for `src/` and `@/assets/` for `assets/`.

## Environment variables

Copy `.env.example` to `.env.local`. Only variables prefixed `EXPO_PUBLIC_` are
readable from app code — never put secrets in them, they ship in the bundle.

## Notes

`src/` still contains Expo's starter demo screens. Run `npm run reset-project`
to clear them out, or replace them as the real screens take shape.
