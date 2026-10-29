# Instala tudo o que o sistema precisa no Windows e depois o proprio sistema.
# Uso: clique duas vezes em instalar-tudo.bat (ele chama este script).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Atualizar-Path {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path", "User")
}
function Existe($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function Instalar($id, $extra) {
    Write-Host "   Baixando e instalando $id (pode pedir permissao de administrador)..." -ForegroundColor Yellow
    $wargs = @("install", "-e", "--id", $id, "--accept-package-agreements", "--accept-source-agreements", "--silent") + $extra
    & winget @wargs
    return ($LASTEXITCODE -eq 0)
}
function Parar($msg) {
    Write-Host ""
    Write-Host "[ERRO] $msg" -ForegroundColor Red
    exit 1
}

Write-Host "============================================================"
Write-Host " Sistema de Substituicoes - instalacao completa (Windows)"
Write-Host "============================================================"

if (-not (Existe winget)) {
    Parar "winget nao encontrado. Atualize o 'Instalador de Aplicativo' pela Microsoft Store e tente de novo."
}

# ---------- Python 3.12+
Write-Host ""
Write-Host "[1/4] Python"
$pyOk = $false
if (Existe py) { & py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)" 2>$null; $pyOk = ($LASTEXITCODE -eq 0) }
if (-not $pyOk) {
    if (-not (Instalar "Python.Python.3.12" @("--scope", "user", "--override", "/quiet InstallAllUsers=0 PrependPath=1 Include_launcher=1"))) { Parar "Falha ao instalar o Python." }
    Atualizar-Path
} else { Write-Host "   Ja instalado." }

# ---------- Node.js
Write-Host ""
Write-Host "[2/4] Node.js"
if (-not (Existe npm)) {
    if (-not (Instalar "OpenJS.NodeJS.LTS" @())) { Parar "Falha ao instalar o Node.js." }
    Atualizar-Path
} else { Write-Host "   Ja instalado." }

# ---------- PostgreSQL
Write-Host ""
Write-Host "[3/4] PostgreSQL"
$psql = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $psql) {
    # Senha aleatoria para o usuario postgres, guardada em senha-postgres.txt (fora do Git).
    $senha = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | ForEach-Object { [char]$_ })
    $override = "--mode unattended --unattendedmodeui minimal --superpassword $senha"
    $ok = $false
    foreach ($id in @("PostgreSQL.PostgreSQL.17", "PostgreSQL.PostgreSQL.16")) {
        if (Instalar $id @("--override", $override)) { $ok = $true; break }
    }
    if (-not $ok) { Parar "Falha ao instalar o PostgreSQL." }
    Set-Content -Path "senha-postgres.txt" -Value "Senha do usuario postgres (PostgreSQL local): $senha"
    Write-Host "   Senha do usuario postgres salva em senha-postgres.txt" -ForegroundColor Green
    $env:PGPASSWORD = $senha
    Atualizar-Path
} else {
    Write-Host "   Ja instalado em $($psql.DirectoryName)."
    Write-Host "   O proximo passo vai pedir a senha do usuario postgres definida quando ele foi instalado."
}

# ---------- sistema
Write-Host ""
Write-Host "[4/4] Instalando o sistema (banco, painel, backend e dados de demonstracao)"
& "$PSScriptRoot\instalar-windows.bat"
if ($LASTEXITCODE -ne 0) { Parar "A instalacao do sistema falhou (veja a mensagem acima)." }

Write-Host ""
$resp = Read-Host "Tudo pronto! Iniciar o sistema agora? (S/N)"
if ($resp -match "^[sS]") { Start-Process -FilePath "$PSScriptRoot\iniciar-windows.bat" -WorkingDirectory $PSScriptRoot }
