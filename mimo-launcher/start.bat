@echo off
chcp 65001 >nul
title MiMo Code — Панель управления
cd /d "%~dp0"

echo.
echo  MiMo Code — локальная панель управления
echo  ----------------------------------------
echo.

if not exist "node_modules\" (
    echo Установка зависимостей (первый запуск)...
    call npm install
    if errorlevel 1 (
        echo ОШИБКА: нужен Node.js — https://nodejs.org
        pause
        exit /b 1
    )
)

echo Выберите способ открытия:
echo   1 — В браузере (рекомендуется)
echo   2 — В окне приложения
echo.
set /p choice="Ваш выбор [1]: "
if "%choice%"=="" set choice=1
if "%choice%"=="2" (
    call node scripts/launch.mjs desktop
) else (
    call node scripts/launch.mjs browser
)

if errorlevel 1 (
    echo.
    echo Не удалось запустить панель.
    pause
    exit /b 1
)

echo.
pause
