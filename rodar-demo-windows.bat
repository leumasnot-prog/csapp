@echo off
rem Abre a versao mockada do sistema (sem banco de dados) em http://localhost:5173
setlocal
cd /d "%~dp0frontend"
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\vite" (
  echo Instalando os componentes do painel. Isso acontece so na primeira vez...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [ERRO] Falha ao instalar os componentes. Veja a mensagem acima.
    pause
    exit /b 1
  )
)
echo.
echo  Versao mockada: dados ficticios, sem banco de dados.
echo  Endereco: http://localhost:5173  - o navegador abre sozinho.
echo  Para parar: feche esta janela.
echo.
call npm run demo
pause
