@echo off
title VisionCare Mobile - Modo Cable USB
echo ========================================================
echo   VisionCare Mobile - Iniciando modo CABLE USB
echo ========================================================
echo.
echo 1. Verificando dispositivos conectados por USB...
adb devices
echo.
echo 2. Configurando tuneles ADB inversos (puertos 3000, 8000 y 8081)...
adb reverse tcp:3000 tcp:3000
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081
echo.
echo 3. Iniciando Expo Metro Bundler en modo localhost con cache limpia...
echo Presiona la tecla 'a' cuando aparezca el menu para abrir en tu celular.
echo.
npx expo start --localhost -c
pause
