@echo off
rem Baixa e instala Python, Node.js e PostgreSQL (se faltarem) e depois o sistema.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-tudo.ps1"
pause
