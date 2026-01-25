@echo off
echo ====================================================================
echo  Klassik Stack - Automatische Installation
echo ====================================================================
echo.
echo Verbinde mit Server und starte Installation...
echo Du wirst nach dem sudo-Passwort gefragt.
echo.
pause

ssh -i "C:\Users\TUF-s\.ssh\id_ed25519_new" admxn@192.168.2.148 "chmod +x /tmp/complete-setup.sh && sudo /tmp/complete-setup.sh"

echo.
echo ====================================================================
echo Installation abgeschlossen!
echo.
echo Teste jetzt:
echo   https://klassik.99pace.space
echo   https://99pace.space
echo.
echo ====================================================================
pause
