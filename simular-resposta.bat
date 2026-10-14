@echo off
rem Simula a resposta de um professor pelo bot (somente desenvolvimento).
rem Uso:  simular-resposta.bat NUMERO_DA_SOLICITACAO POSICAO aceito^|recuso
rem Ex.:  simular-resposta.bat 1 3 aceito
setlocal
cd /d "%~dp0backend"
set PYTHONIOENCODING=utf-8
if "%~3"=="" (
  echo Uso: simular-resposta.bat NUMERO_DA_SOLICITACAO POSICAO aceito^|recuso
  echo Ex.: simular-resposta.bat 1 3 aceito
  exit /b 1
)
".venv\Scripts\python.exe" -m app.cli simular-resposta %1 %2 %3
