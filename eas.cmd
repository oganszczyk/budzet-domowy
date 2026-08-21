@echo off
rem Uruchamia lokalnie zainstalowane EAS CLI z certyfikatami systemu Windows.
rem
rem Norton skanuje ruch HTTPS i podstawia wlasny certyfikat. Windows go zna,
rem bo Norton sam go tam zainstalowal, ale Node ma osobna liste zaufanych
rem certyfikatow i o nim nie wie - stad blad UNABLE_TO_VERIFY_LEAF_SIGNATURE.
rem --use-system-ca kaze Node korzystac z listy Windowsa.
rem
rem W PowerShell trzeba pisac z kropka i ukosnikiem, bo PS nie uruchamia
rem programow z biezacego katalogu:
rem
rem   .\eas.cmd login --no-browser
rem   .\eas.cmd init
rem   .\eas.cmd build --profile development --platform android

setlocal
cd /d "%~dp0"

set "NODE_OPTIONS=--use-system-ca"

rem Zapasowo: jesli Norton ma plik certyfikatu, wskaz go wprost.
if exist "%ProgramData%\Norton\Antivirus\wscert.pem" set "NODE_EXTRA_CA_CERTS=%ProgramData%\Norton\Antivirus\wscert.pem"

if not exist "%~dp0node_modules\.bin\eas.cmd" (
  echo Brak lokalnego eas-cli. Uruchom najpierw:  npm install
  exit /b 1
)

call "%~dp0node_modules\.bin\eas.cmd" %*
