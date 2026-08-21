@echo off
rem Uruchamia polecenia EAS z certyfikatami systemu Windows.
rem
rem Norton skanuje ruch HTTPS i podstawia wlasny certyfikat. Windows go zna,
rem bo Norton sam go tam zainstalowal, ale Node ma osobna liste zaufanych
rem certyfikatow i o nim nie wie - stad blad UNABLE_TO_VERIFY_LEAF_SIGNATURE.
rem --use-system-ca kaze Node korzystac z listy Windowsa.
rem
rem Uzycie:  eas.cmd login --no-browser
rem          eas.cmd init
rem          eas.cmd build --profile development --platform android

setlocal
cd /d "%~dp0"

if exist "%ProgramFiles%\nodejs\npx.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"

set "NODE_OPTIONS=--use-system-ca"

rem Zapasowo: jesli Norton ma plik certyfikatu, wskaz go wprost.
if exist "%ProgramData%\Norton\Antivirus\wscert.pem" set "NODE_EXTRA_CA_CERTS=%ProgramData%\Norton\Antivirus\wscert.pem"

call npx eas %*
