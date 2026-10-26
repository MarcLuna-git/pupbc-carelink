@echo off
setlocal EnableDelayedExpansion

echo ============================================
echo  PUPBC CareLink - MariaDB Backup
echo ============================================
echo.

rem Run from this script's folder so relative paths always resolve
pushd "%~dp0"

rem --- Configuration ---------------------------------------------------
rem Edit these if your XAMPP install path or credentials differ.
set "MYSQL_BIN=C:\xampp\mysql\bin"
set "DB_HOST=127.0.0.1"
set "DB_NAME=pupbc_carelink"
set "DB_USER=root"
set "DB_PASS="
set "BACKUP_DIR=..\backend\storage\backups"
rem ---------------------------------------------------------------------

set "DATE=%date:~10,4%-%date:~4,2%-%date:~7,2%"
set "TIME=%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIME=!TIME: =0!"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

set "FILE=%BACKUP_DIR%\pupbc_carelink_%DATE%_%TIME%.sql"

echo [!DATE! !TIME!] Backing up "!DB_NAME!"...

if "!DB_PASS!"=="" (
    "%MYSQL_BIN%\mysqldump.exe" -h !DB_HOST! -u !DB_USER! --single-transaction --routines --triggers --events !DB_NAME! > "!FILE!"
) else (
    "%MYSQL_BIN%\mysqldump.exe" -h !DB_HOST! -u !DB_USER! -p!DB_PASS! --single-transaction --routines --triggers --events !DB_NAME! > "!FILE!"
)

if !ERRORLEVEL! EQU 0 (
    for %%A in ("!FILE!") do set "SIZE=%%~zA"
    echo [OK] Backup saved: !FILE! - !SIZE! bytes
) else (
    echo [ERROR] Backup failed! Is MariaDB running in the XAMPP Control Panel?
    if exist "!FILE!" del "!FILE!"
)

popd
echo.
pause
