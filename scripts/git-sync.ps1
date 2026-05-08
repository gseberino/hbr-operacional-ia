param(
  [string]$Message = "",
  [string]$RemoteUrl = "",
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

if (-not (Test-Path ".git")) {
  git init | Out-Host
}

git config --global --add safe.directory $Root.Path 2>$null
git branch -M $Branch

$remote = git remote get-url origin 2>$null
if (-not $remote -and $RemoteUrl) {
  git remote add origin $RemoteUrl
  $remote = $RemoteUrl
}

$status = git status --short
if (-not $status) {
  Write-Host "Nada novo para sincronizar."
} else {
  git add .
  if (-not $Message) {
    $stamp = Get-Date -Format "yyyy-MM-dd HH:mm"
    $Message = "Update HBR Operacional IA $stamp"
  }
  git commit -m $Message | Out-Host
}

if ($remote) {
  git push -u origin $Branch
} else {
  Write-Host "Repositorio remoto ainda nao configurado. Use:"
  Write-Host "  npm.cmd run sync -- -RemoteUrl https://github.com/USUARIO/REPOSITORIO.git"
}
