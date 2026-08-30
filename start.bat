@echo off
echo ========================================================
echo   Launching PULSE Competitive Season Platform...
echo ========================================================
echo.
start "" http://localhost:8080/index.html
python -m http.server 8080
pause
