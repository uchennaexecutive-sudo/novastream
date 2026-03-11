# release.ps1 — Nova Stream release helper
# Usage: .\release.ps1 1.0.8 "Short changelog note"

param(
  [Parameter(Mandatory=$true)][string]$Version,
  [Parameter(Mandatory=$true)][string]$Notes
)

Set-Location c:\Users\uchen\nova-stream-dev

Write-Host "`n🔖 Releasing Nova Stream v$Version..." -ForegroundColor Cyan

# 1. Pull latest remote (CI bot may have committed latest.json)
Write-Host "`n⬇  Pulling latest remote..." -ForegroundColor Yellow
git pull --rebase origin main
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Pull/rebase failed" -ForegroundColor Red; exit 1 }

# 2. Commit staged changes
Write-Host "`n📝 Committing..." -ForegroundColor Yellow
git add -A
git commit -m "v${Version}: $Notes"
if ($LASTEXITCODE -ne 0) { Write-Host "⚠  Nothing new to commit (already clean)" -ForegroundColor DarkYellow }

# 3. Push main
Write-Host "`n⬆  Pushing main..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
  Write-Host "⚠  Push failed, trying rebase again..." -ForegroundColor DarkYellow
  git pull --rebase origin main
  git push origin main
  if ($LASTEXITCODE -ne 0) { Write-Host "❌ Push failed" -ForegroundColor Red; exit 1 }
}

# 4. Delete old local tag if exists, create fresh, force-push
Write-Host "`n🏷  Tagging v$Version..." -ForegroundColor Yellow
git tag -d "v$Version" 2>$null
git tag "v$Version"
git push origin "v$Version" --force
if ($LASTEXITCODE -ne 0) { Write-Host "❌ Tag push failed" -ForegroundColor Red; exit 1 }

Write-Host "`n✅ v$Version pushed! CI is now building." -ForegroundColor Green
Write-Host "   https://github.com/uchennaexecutive-sudo/novastream/actions`n" -ForegroundColor DarkGray
