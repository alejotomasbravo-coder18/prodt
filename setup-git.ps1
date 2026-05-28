# ======================================================
# ProDT - Git init + push a GitHub
# Ejecutar desde PowerShell en C:\Users\alejo\prodt
# ======================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$Token,

    [string]$GithubUser = "",
    [string]$RepoName   = "prodt"
)

Set-Location "C:\Users\alejo\prodt"

# 1. Obtener el username de GitHub con el token
Write-Host "`n[1/5] Verificando token de GitHub..." -ForegroundColor Cyan
$headers = @{ Authorization = "Bearer $Token"; "User-Agent" = "prodt-setup" }
$me = Invoke-RestMethod -Uri "https://api.github.com/user" -Headers $headers
$GithubUser = $me.login
Write-Host "  OK Usuario: $GithubUser" -ForegroundColor Green

# 2. Crear repositorio privado
Write-Host "`n[2/5] Creando repositorio privado '$RepoName'..." -ForegroundColor Cyan
$body = @{ name = $RepoName; private = $true; description = "ProDT - Gran DT y Prode del Mundial 2026" } | ConvertTo-Json
try {
    $repo = Invoke-RestMethod -Uri "https://api.github.com/user/repos" -Method POST -Headers $headers -Body $body -ContentType "application/json"
    Write-Host "  OK Repo creado: $($repo.html_url)" -ForegroundColor Green
} catch {
    $err = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($err.message -like "*already exists*") {
        Write-Host "  INFO El repo ya existe, continuando..." -ForegroundColor Yellow
    } else {
        Write-Host "  ERROR: $($err.message)" -ForegroundColor Red
        exit 1
    }
}

# 3. Git init
Write-Host "`n[3/5] Inicializando repositorio git..." -ForegroundColor Cyan
if (Test-Path ".git") {
    Write-Host "  INFO .git ya existe, saltando init" -ForegroundColor Yellow
} else {
    git init -b main
    Write-Host "  OK git init" -ForegroundColor Green
}
git config user.email "alejotomasbravo@gmail.com"
git config user.name  "Alejo"

# 4. Primer commit
Write-Host "`n[4/5] Agregando archivos y creando commit inicial..." -ForegroundColor Cyan
git add -A
git commit -m "feat: ProDT v2.0 - Gran DT + Prode del Mundial 2026"
Write-Host "  OK Commit creado" -ForegroundColor Green

# 5. Push
Write-Host "`n[5/5] Pusheando a GitHub..." -ForegroundColor Cyan
$remoteUrl = "https://$($Token)@github.com/$GithubUser/$RepoName.git"

$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    git remote set-url origin $remoteUrl
} else {
    git remote add origin $remoteUrl
}

git push -u origin main
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  OK Listo! Repo en GitHub:" -ForegroundColor Green
Write-Host "  https://github.com/$GithubUser/$RepoName" -ForegroundColor Cyan
Write-Host "  Ahora podes conectarlo a Vercel." -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Green
