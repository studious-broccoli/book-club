# Book Club - Start both servers
# Run this every time you want to use the app

$root = $PSScriptRoot

# Start backend in a new terminal window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$root\backend'; & '.\venv\Scripts\activate.ps1'; uvicorn main:app --reload"
)

# Wait a moment before opening the frontend
Start-Sleep -Seconds 2

# Start frontend in a new terminal window
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$root\frontend'; npm run dev"
)

Write-Host ""
Write-Host "Starting Book Club..." -ForegroundColor Magenta
Write-Host "Two terminal windows will open." -ForegroundColor White
Write-Host ""
Write-Host "Once both are running, open your browser to:" -ForegroundColor White
Write-Host "   http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop the servers, close the two terminal windows." -ForegroundColor Gray
Write-Host ""
