@echo off
chcp 65001 >nul
title Domowe wydatki - serwer Expo
cd /d "%~dp0"

rem Node.js zainstalowany przez winget bywa niewidoczny w nowym oknie.
rem Dokladamy jego katalog do PATH, jesli tam jest.
if exist "%ProgramFiles%\nodejs\npx.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\npx.cmd" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

where npx >/dev/null 2>nul
if errorlevel 1 (
  echo.
  echo  BLAD: nie znaleziono Node.js.
  echo  Zainstaluj go poleceniem:  winget install OpenJS.NodeJS.LTS
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo.
  echo  Pierwsze uruchomienie - instaluje zaleznosci. To potrwa chwile...
  echo.
  call npm install
)

echo.
echo  ================================================
echo   DOMOWE WYDATKI - serwer deweloperski
echo  ================================================
echo.
echo   1. Zainstaluj "Expo Go" ze sklepu Google Play.
echo   2. Telefon i komputer musza byc w tej samej sieci.
echo   3. Zeskanuj kod QR ponizej aplikacja Expo Go.
echo.
echo   Zatrzymanie serwera: Ctrl+C
echo.
rem --go WYMUSZA tryb Expo Go. Bez tego kod QR otwiera zainstalowana
rem wczesniej wlasna wersje aplikacji zamiast Expo Go, i widac STARY kod.
rem
rem Powod: w zaleznosciach jest expo-dev-client, wiec "expo start" domyslnie
rem startuje w trybie wlasnego builda i koduje w QR adres domapka://... .
rem Android oddaje taki adres zainstalowanej aplikacji, bo to ona zglosila
rem sie do obslugi tego schematu. Expo Go potrzebuje adresu exp://... .
rem
rem Gdy projekt przejdzie na wlasne buildy zamiast Expo Go, usun --go.
call npx expo start --go
echo.
echo  Serwer zostal zatrzymany. Nacisnij dowolny klawisz, aby zamknac.
pause >nul
