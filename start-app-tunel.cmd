@echo off
chcp 65001 >nul
title Domowe wydatki - serwer Expo (tunel)
cd /d "%~dp0"

rem ===========================================================================
rem  WERSJA PRZEZ TUNEL - gdy telefon nie widzi komputera w sieci lokalnej.
rem
rem  Zwykly "start-app.cmd" wymaga, zeby telefon i komputer byly w tej samej
rem  sieci i zeby router pozwalal im sie nawzajem widziec. Czesto nie pozwala:
rem  komputer na kablu, telefon po Wi-Fi, siec dla gosci, wzmacniacz zasiegu
rem  robiacy wlasna podsiec. Objaw jest zawsze ten sam i mylacy - telefon
rem  probuje sie polaczyc i po chwili sie poddaje, bez zadnego bledu.
rem
rem  Tunel przepuszcza polaczenie przez serwery Expo, wiec telefon i komputer
rem  nie musza sie widziec - wystarczy, ze oba maja internet. Dziala nawet,
rem  gdy telefon jest na danych komorkowych.
rem
rem  CENA: wszystko idzie naokolo, wiec ladowanie aplikacji jest wolniejsze,
rem  a start serwera trwa dluzej. Jesli "start-app.cmd" dziala, uzywaj jego.
rem
rem  WYMAGA pakietu zainstalowanego globalnie:
rem    npm install -g @expo/ngrok@^4.1.0
rem  Skrypt sprawdza to nizej i podpowiada, gdy go brakuje.
rem ===========================================================================

rem Node.js zainstalowany przez winget bywa niewidoczny w nowym oknie.
if exist "%ProgramFiles%\nodejs\npx.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\npx.cmd" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

where npx >nul 2>nul
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
echo   DOMOWE WYDATKI - serwer deweloperski (TUNEL)
echo  ================================================
echo.
echo   1. Zainstaluj "Expo Go" ze sklepu Google Play.
echo   2. Telefon NIE musi byc w tej samej sieci co komputer.
echo   3. Zeskanuj kod QR ponizej aplikacja Expo Go.
echo.
echo   Start potrwa dluzej niz zwykle - tunel musi sie zestawic.
echo   Zatrzymanie serwera: Ctrl+C
echo.

rem --go wymusza tryb Expo Go - uzasadnienie w start-app.cmd.
call npx expo start --go --tunnel

echo.
echo  Serwer zostal zatrzymany. Nacisnij dowolny klawisz, aby zamknac.
pause >nul
