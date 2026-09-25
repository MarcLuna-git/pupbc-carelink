@echo off
echo ============================================
echo  PUPBC CareLink - Database Backup
echo ============================================
echo.

set DATE=%date:~10,4%-%date:~4,2%-%date:~7,2%
set TIME=%time:~0,2%%time:~3,2%%time:~6,2%
set TIME=%TIME: =0%
set BACKUP_DIR=..\backend\storage\backups
set MYSQLDUMP="C:\wamp64\bin\mysql\mysql9.1.0\bin\mysqldump.exe"

if not exist %BACKUP_DIR% mkdir %BACKUP_DIR%

set FILE=%BACKUP_DIR%\pupbc_backup_%DATE%_%TIME%.sql

echo [%DATE% %TIME%] Starting backup...
%MYSQLDUMP% -u root pupbc_carelink_v3 > "%FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [OK] Backup saved: %FILE%
) else (
    echo [ERROR] Backup failed! Check MySQL connection.
)

echo.
echo Done!
pause