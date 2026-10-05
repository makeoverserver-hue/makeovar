$ErrorActionPreference = "SilentlyContinue"
$port = 5000
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
Start-Sleep -Milliseconds 800
Copy-Item -LiteralPath "C:/Users/hp/Documents/Default Project/uploads/backups/restore_2026-09-01T15-17-51-261Z.db" -Destination "C:/Users/hp/Documents/Default Project/backend/prisma/clinic.db" -Force
Start-Process -FilePath node -ArgumentList "src/index.js" -WorkingDirectory "C:/Users/hp/Documents/Default Project/backend" -WindowStyle Hidden