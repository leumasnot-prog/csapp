@echo off
setlocal
cd /d "%~dp0backend"
if not exist ".venv\Scripts\python.exe" (
  echo Execute primeiro o instalar-windows.bat
  pause
  exit /b 1
)
set PYTHONIOENCODING=utf-8
set SUBST_TELEGRAM_WEBHOOK_SECRET=dev-segredo

echo Iniciando o worker (envio de mensagens e prazos) em outra janela...
start "Substituicoes - worker" cmd /k ".venv\Scripts\python.exe -m app.worker"

echo Abrindo o navegador em http://localhost:8000 ...
start "" cmd /c "timeout /t 4 >nul & start http://localhost:8000"

echo.
echo  Painel:      http://localhost:8000
echo  Secretaria:  admin@exemplo.gov.br   / admin12345
echo  Diretora:    diretor@exemplo.gov.br / diretor12345
echo.
echo  Para parar: feche esta janela e a janela do worker (ou Ctrl+C).
echo.
".venv\Scripts\python.exe" -m uvicorn app.main:app --port 8000
pause
