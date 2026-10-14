@echo off
setlocal
cd /d "%~dp0"
echo ============================================================
echo  Sistema de Substituicoes - instalacao local (Windows)
echo ============================================================
echo.

rem ---------- pre-requisitos
set "PY=python"
where py >nul 2>nul && set "PY=py -3"
%PY% -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)" >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Python 3.12 ou mais novo nao encontrado.
  echo        Instale em https://www.python.org/downloads/ marcando "Add python.exe to PATH".
  goto :erro
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org/
  goto :erro
)
set "PSQL="
where psql >nul 2>nul && set "PSQL=psql"
if not defined PSQL for /d %%D in ("C:\Program Files\PostgreSQL\*") do if exist "%%D\bin\psql.exe" set "PSQL=%%D\bin\psql.exe"
if not defined PSQL (
  echo [ERRO] PostgreSQL nao encontrado.
  echo        Instale em https://www.postgresql.org/download/windows/ e guarde a senha do usuario postgres.
  goto :erro
)
echo Python, Node.js e PostgreSQL encontrados.
echo.

rem ---------- banco
echo [1/4] Criando o banco de dados...
set /p "PGPASSWORD=Digite a senha do usuario 'postgres' (definida na instalacao do PostgreSQL): "
"%PSQL%" -U postgres -h localhost -q -v ON_ERROR_STOP=1 -c "DO $$BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='subst') THEN CREATE ROLE subst LOGIN SUPERUSER PASSWORD 'subst'; END IF; END$$;"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel conectar ao PostgreSQL. Confira a senha e se o servico esta rodando.
  goto :erro
)
"%PSQL%" -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='subst_dev'" | find "1" >nul
if errorlevel 1 (
  "%PSQL%" -U postgres -h localhost -q -c "CREATE DATABASE subst_dev OWNER subst"
  if errorlevel 1 goto :erro
)
set "PGPASSWORD="
echo Banco subst_dev pronto.
echo.

rem ---------- frontend
echo [2/4] Compilando o painel (pode levar alguns minutos)...
pushd frontend
call npm install --no-audit --no-fund
if errorlevel 1 (popd & goto :erro)
call npm run build
if errorlevel 1 (popd & goto :erro)
popd
echo.

rem ---------- backend
echo [3/4] Instalando o backend Python...
pushd backend
if not exist ".venv\Scripts\python.exe" (
  %PY% -m venv .venv
  if errorlevel 1 (popd & goto :erro)
)
".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
".venv\Scripts\python.exe" -m pip install -e . --quiet
if errorlevel 1 (popd & goto :erro)
echo.

echo [4/4] Criando dados de demonstracao...
set PYTHONIOENCODING=utf-8
".venv\Scripts\python.exe" -m app.cli demo --simular-vinculo
if errorlevel 1 (popd & goto :erro)
popd

echo.
echo ============================================================
echo  Instalacao concluida! Agora execute: iniciar-windows.bat
echo ============================================================
pause
exit /b 0

:erro
echo.
echo *** A instalacao parou por causa do erro acima. ***
pause
exit /b 1
