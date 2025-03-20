@echo off
cmd /c "
echo Starting CodexPad...

REM Build Go server if needed
cd %~dp0\server
go build -o codexpad-server.exe

REM Start the server directly
start /b """" codexpad-server.exe
echo Server started

REM Return to project root
cd ..

REM Start the app
start /b """" npm run start

REM Wait for user to close the app (check for Electron process)
echo CodexPad is running. Close the application window when done.
:CHECK_ELECTRON
timeout /t 3 /nobreak > nul
tasklist /FI "IMAGENAME eq electron.exe" 2>nul | find "electron.exe" > nul
if ERRORLEVEL 1 (
  goto CLEANUP
) else (
  goto CHECK_ELECTRON
)

:CLEANUP
echo Application closed, cleaning up...

REM Kill all related processes
taskkill /F /IM codexpad-server.exe 2>nul
taskkill /F /IM node.exe 2>nul
taskkill /F /FI "WINDOWTITLE eq react-scripts*" 2>nul
taskkill /F /FI "WINDOWTITLE eq npm*" 2>nul
taskkill /F /FI "WINDOWTITLE eq CodexPad*" 2>nul

REM If any of the above are still running, show a warning
echo.
echo CodexPad has been closed.
"