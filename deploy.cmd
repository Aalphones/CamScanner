@echo off
rem ==========================================================================
rem  CamScanner - hochladen per Doppelklick.
rem  Baut die App und gleicht den Build mit dem Zielordner auf dem Strato-Paket ab.
rem ==========================================================================
setlocal
chcp 65001 >nul
title CamScanner Deploy
cd /d "%~dp0"

if exist "deploy.env" goto :configFound
echo [FEHLER] Die Datei deploy.env fehlt.
echo          Kopiere deploy.env.example nach deploy.env und trage deine
echo          Zugangsdaten ein.
goto :fail

:configFound
rem Einlesen bewusst ohne "delayed expansion": die wuerde ein Ausrufezeichen
rem im Passwort verschlucken. Ab dem setlocal darunter ist sie an, damit
rem Werte mit & | < > beim Schreiben nicht als Befehle gelesen werden.
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("deploy.env") do set "%%A=%%B"

setlocal enabledelayedexpansion

if not defined BASE_HREF set "BASE_HREF=/"

set "MISSING="
call :needValue WINSCP_PATH
call :needValue SFTP_PROTOCOL
call :needValue SFTP_HOST
call :needValue SFTP_USER
call :needValue SFTP_PASSWORD
call :needValue REMOTE_WEB_PATH
if defined MISSING goto :fail

rem "synchronize -delete" raeumt das Ziel leer, was nicht zum Build gehoert.
rem Auf "/" waere das der ganze Webbereich.
if not "!REMOTE_WEB_PATH!"=="/" goto :pathNotRoot
echo [FEHLER] REMOTE_WEB_PATH darf nicht "/" sein. Der Upload loescht im Ziel alles, was nicht zur App gehoert - trage den eigenen Ordner der Subdomain ein.
goto :fail

:pathNotRoot
if "!REMOTE_WEB_PATH:~-1!"=="/" goto :pathEndsWithSlash
echo [FEHLER] REMOTE_WEB_PATH muss mit einem Schraegstrich enden, z. B. /scanner/
goto :fail

:pathEndsWithSlash
if exist "!WINSCP_PATH!" goto :winscpFound
echo [FEHLER] WinSCP wurde nicht gefunden:
echo          !WINSCP_PATH!
echo          Gebraucht wird WinSCP.com aus dem portablen Paket, nicht WinSCP.exe.
goto :fail

:winscpFound
if /i not "!SFTP_PROTOCOL!"=="sftp" goto :protocolOk
if defined SFTP_HOSTKEY goto :protocolOk
echo [FEHLER] SFTP_HOSTKEY fehlt in deploy.env.
echo          WinSCP einmal von Hand starten, verbinden, den angezeigten
echo          Fingerabdruck in deploy.env eintragen.
goto :fail

:protocolOk
echo [1/4] App bauen ...
call npm run build -- --base-href "!BASE_HREF!"
if errorlevel 1 (
    echo [FEHLER] Der Build ist fehlgeschlagen. Es wird nichts hochgeladen.
    goto :fail
)
if not exist "dist\cam-scanner\browser\index.html" (
    echo [FEHLER] dist\cam-scanner\browser\index.html fehlt nach dem Build.
    goto :fail
)
if not exist "dist\cam-scanner\browser\.htaccess" (
    echo [FEHLER] dist\cam-scanner\browser\.htaccess fehlt nach dem Build.
    echo          Ohne sie gibt es keine HTTPS-Umleitung und kein Neuladen auf Unterseiten.
    goto :fail
)

echo.
echo Ziel auf dem Server: !REMOTE_WEB_PATH!
echo Dort wird alles geloescht, was nicht zur App gehoert.
choice /c JN /m "Jetzt hochladen"
if errorlevel 2 (
    echo Abgebrochen, es wurde nichts hochgeladen.
    pause
    exit /b 0
)

rem Vorlauf: WinSCP legt den Zielordner beim Abgleich nicht selbst an. Existiert er
rem schon, meldet mkdir einen Fehler - deshalb laeuft das getrennt und ungeprueft.
echo [2/4] Zielordner anlegen ...
set "PREP_SCRIPT=%TEMP%\camscanner-prep-%RANDOM%%RANDOM%.txt"
call :writeSession "!PREP_SCRIPT!"
>>"!PREP_SCRIPT!" echo option batch continue
>>"!PREP_SCRIPT!" echo mkdir !REMOTE_WEB_PATH!
>>"!PREP_SCRIPT!" echo exit
"!WINSCP_PATH!" /ini=nul /script="!PREP_SCRIPT!" >nul 2>&1
del "!PREP_SCRIPT!" >nul 2>&1

set "WINSCP_SCRIPT=%TEMP%\camscanner-deploy-%RANDOM%%RANDOM%.txt"
call :writeSession "!WINSCP_SCRIPT!"
>>"!WINSCP_SCRIPT!" echo synchronize remote -delete "dist\cam-scanner\browser" "!REMOTE_WEB_PATH!"
>>"!WINSCP_SCRIPT!" echo close
>>"!WINSCP_SCRIPT!" echo exit

echo [3/4] Verbinden und hochladen ...
"!WINSCP_PATH!" /ini=nul /script="!WINSCP_SCRIPT!"
set "WINSCP_EXIT=!ERRORLEVEL!"
del "!WINSCP_SCRIPT!" >nul 2>&1

if "!WINSCP_EXIT!"=="0" goto :done
echo.
echo [FEHLER] WinSCP hat abgebrochen, Code !WINSCP_EXIT!.
echo          Der Server ist eventuell nur halb aktualisiert.
echo          Meist liegt es am Passwort, am Fingerabdruck oder an einem
echo          falschen Zielpfad in deploy.env.
goto :fail

:done
echo.
echo [4/4] Fertig, alles ist oben.
if defined PUBLIC_URL echo          !PUBLIC_URL!
echo.
pause
exit /b 0

:fail
echo.
pause
exit /b 1

rem Zugangsdaten bewusst als eigene Schalter, nicht in der Adresse: ein # oder /
rem im Passwort wuerde die Adresse zerschneiden, ein | sogar die Skriptzeile.
:writeSession
> "%~1" echo option batch abort
>>"%~1" echo option confirm off
>>"%~1" echo option transfer binary
if /i "!SFTP_PROTOCOL!"=="sftp" goto :writeSessionSftp
>>"%~1" echo open !SFTP_PROTOCOL!://!SFTP_HOST!/ -username="!SFTP_USER!" -password="!SFTP_PASSWORD!"
exit /b 0
:writeSessionSftp
>>"%~1" echo open sftp://!SFTP_HOST!/ -username="!SFTP_USER!" -password="!SFTP_PASSWORD!" -hostkey="!SFTP_HOSTKEY!"
exit /b 0

:needValue
if not defined %~1 (
    echo [FEHLER] In deploy.env fehlt ein Wert: %~1
    set "MISSING=1"
)
exit /b 0
