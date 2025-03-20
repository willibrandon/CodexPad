# CodexPad PowerShell Launcher
Write-Host "Starting CodexPad..." -ForegroundColor Cyan

# Build Go server if needed
Push-Location "$PSScriptRoot\server"
go build -o codexpad-server.exe

# Start the server directly
$server = Start-Process -WindowStyle Hidden -FilePath "codexpad-server.exe" -PassThru
Write-Host "Server started" -ForegroundColor Green

# Return to project root and start the app
Pop-Location
Start-Process -NoNewWindow -FilePath "cmd" -ArgumentList "/c npm run start"

Write-Host "CodexPad is running. Close the application window when done." -ForegroundColor Cyan

# Wait for Electron to exit
while ($true) {
    Start-Sleep -Seconds 3
    if (-not (Get-Process -Name "electron" -ErrorAction SilentlyContinue)) {
        break
    }
}

Write-Host "Application closed, cleaning up..." -ForegroundColor Yellow

# Clean up processes
Get-Process -Name "codexpad-server" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force

Write-Host "CodexPad has been closed." -ForegroundColor Green 