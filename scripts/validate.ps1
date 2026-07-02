$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Typecheck"
npm run typecheck

Write-Host "==> Lint"
npm run lint

Write-Host "==> Test"
npm run test

Write-Host "==> Build"
npm run build

Write-Host "All checks passed."
