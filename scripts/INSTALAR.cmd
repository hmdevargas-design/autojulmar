@echo off
cd /d "%~dp0"
echo A iniciar a instalacao da impressao automatica Autojulmar...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-impressao-auto.ps1"
echo.
if errorlevel 1 (
  echo A instalacao terminou com erro. Veja a mensagem acima.
) else (
  echo Instalacao concluida.
)
echo.
pause
